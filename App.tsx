import React, {useCallback, useState, useMemo, useRef, useEffect} from "react"
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  StatusBar as RNStatusBar,
  Dimensions,
  Platform,
  Keyboard,
  LogBox
} from "react-native"
import {StatusBar} from "expo-status-bar"
import {Ionicons} from "@expo/vector-icons"

// Ignore specific warnings
LogBox.ignoreLogs([
  "Sending `onAnimatedValueUpdate` with no listeners registered.",
  "[runtime not ready]",
  "The native view manager required by name (ExpoClipboard)"
])

// Import our custom hook
import {useMediaExtractor} from "./useMediaExtractor"

// Import our new components
import {MediaCard} from "./MediaCard"
import {FilterBar} from "./FilterBar"
import {useRecentUrls} from "./useRecentUrls"
import {useOrientation} from "./useOrientation"
import Actions from "./Actions"
import DraggableToolbar from "./DraggableToolbar"
import {GestureHandlerRootView} from "react-native-gesture-handler"

const versionFile = require("./app.json")

const App: React.FC = () => {
  const {url, setUrl, loading, media, downloadingItems, extractResources, downloadMedia, cancelDownload} =
    useMediaExtractor()

  const {width, isLandscape} = useOrientation()

  const GRID_COLUMNS = Platform.OS === "ios" && Platform.isPad ? 3 : 2
  const GRID_SPACING = 12
  const ITEM_WIDTH = (width - GRID_SPACING * (GRID_COLUMNS + 1)) / GRID_COLUMNS

  // Filter state
  const [filterType, setFilterType] = useState<string>("all")

  // State for recent URLs dropdown
  const [showRecentUrls, setShowRecentUrls] = useState(false)

  // State to track a URL that's pending extraction
  const [pendingExtractUrl, setPendingExtractUrl] = useState<string | null>(null)

  // Reference for detecting outside taps on dropdown
  const dropdownRef = useRef(null)

  const {recentUrls, isLoading: urlsLoading, addRecentUrl} = useRecentUrls()

  // Effect to handle URL extraction when it comes from recent URLs
  useEffect(() => {
    if (pendingExtractUrl) {
      // If we have a pending URL to extract, do it now
      // Give a small delay to ensure state updates are complete
      const timer = setTimeout(() => {
        extractResources()
        // Clear the pending flag
        setPendingExtractUrl(null)
      }, 50)

      return () => clearTimeout(timer)
    }
  }, [pendingExtractUrl, extractResources])

  // Filtered media based on the current filter
  const filteredMedia = useMemo(() => {
    if (filterType === "all") return media
    return media.filter(item => item.type === filterType || item.format === filterType)
  }, [media, filterType])

  // Pre-calculate derived UI states to reduce jank
  const uiState = useMemo(
    () => ({
      hasResults: media.length > 0,
      resultCount: filteredMedia.length
    }),
    [media.length, filteredMedia.length]
  )

  // Handle search action
  const handleSearch = useCallback(() => {
    Keyboard.dismiss()
    if (url) {
      addRecentUrl(url)
      extractResources()
    }
  }, [url, addRecentUrl, extractResources])

  // Handle selection from recent URLs
  const handleRecentUrlSelect = useCallback(
    (selectedUrl: string) => {
      setUrl(selectedUrl)
      setShowRecentUrls(false)
      // Update the recent URLs list to move this URL to the top
      addRecentUrl(selectedUrl)
      // Set the URL for extraction after state updates are complete
      setPendingExtractUrl(selectedUrl)
      // This will trigger the useEffect that calls extractResources
    },
    [setUrl, addRecentUrl]
  )

  // Optimize filter change handler to minimize state updates
  const handleFilterChange = useCallback(
    newFilter => {
      // Only update if it's actually different
      if (newFilter !== filterType) {
        setFilterType(newFilter)
      }
    },
    [filterType]
  )

  // Handle touches outside the dropdown to dismiss it
  const handleOutsideTouch = useCallback(() => {
    if (showRecentUrls) {
      setShowRecentUrls(false)
    }
  }, [showRecentUrls])

  // Handle download action
  const handleDownload = useCallback(
    item => {
      downloadMedia(item)
    },
    [downloadMedia]
  )

  // Handle canceling download
  const handleCancelDownload = useCallback(
    itemUrl => {
      cancelDownload(itemUrl)
    },
    [cancelDownload]
  )

  // Optimize key extractor for FlatList to help with recycling views
  const keyExtractor = useCallback((item, index) => {
    return `${item.type}-${item.format}-${item.url.slice(-40)}-${index}`
  }, [])

  // Render each media item using our new MediaCard component
  const renderItem = useCallback(
    ({item}) => (
      <MediaCard
        item={item}
        downloadState={downloadingItems[item.url]}
        onDownload={handleDownload}
        onCancel={handleCancelDownload}
        itemWidth={ITEM_WIDTH}
      />
    ),
    [downloadingItems, handleDownload, handleCancelDownload, ITEM_WIDTH]
  )

  // Optimize recent URL rendering
  const renderRecentUrlItem = useCallback(
    ({item}) => (
      <TouchableOpacity style={styles.recentUrlItem} onPress={() => handleRecentUrlSelect(item.url)}>
        <Ionicons name="globe-outline" size={16} color="#666" />
        <Text style={styles.recentUrlText} numberOfLines={1}>
          {item.title || item.url}
        </Text>
        <Text style={styles.recentUrlTime}>{new Date(item.timestamp).toLocaleDateString()}</Text>
      </TouchableOpacity>
    ),
    [handleRecentUrlSelect]
  )

  const version_string = `v${versionFile.expo.version}` || "1"

  return (
    <GestureHandlerRootView style={{flex: 1, backgroundColor: "transparent"}}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />

        {/* Title */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "flex-start",
            margin: 4
          }}
        >
          <Text
            style={[
              styles.modalTitle,
              {
                position: "relative",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                margin: 4
              }
            ]}
          >
            araname - web media extractor
          </Text>
          <Text
            style={{
              marginVertical: 21,
              fontSize: 12
              // fontWeight: "600"
            }}
          >
            {" "}
            {version_string}
          </Text>
        </View>

        {/* Search input */}
        <View style={styles.searchContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Enter website URL"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />

            {recentUrls.length > 0 && (
              <TouchableOpacity style={styles.historyButton} onPress={() => setShowRecentUrls(prevState => !prevState)}>
                <Ionicons name="time-outline" size={22} color="#666" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.searchButton} onPress={handleSearch} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFC8148A" size="small" />
            ) : (
              <Ionicons name="search" size={22} color="#FFC814FF" />
            )}
          </TouchableOpacity>
        </View>

        {/* Recent URLs dropdown with overlay for tapping outside */}
        {showRecentUrls && (
          <>
            <TouchableWithoutFeedback onPress={handleOutsideTouch}>
              <View style={styles.dropdownOverlay} />
            </TouchableWithoutFeedback>

            <View ref={dropdownRef} style={styles.recentUrlsContainer}>
              <FlatList
                data={recentUrls}
                keyExtractor={item => item.url}
                renderItem={renderRecentUrlItem}
                initialNumToRender={10}
                maxToRenderPerBatch={5}
                windowSize={5}
              />
            </View>
          </>
        )}

        {/* Results grid */}
        {uiState.hasResults ? (
          <View style={styles.resultsContainer}>
            <View style={styles.resultsHeader}>
              <FilterBar
                currentFilter={filterType}
                onFilterChange={handleFilterChange}
                filters={[
                  {id: "all", label: "All"},
                  {id: "image", label: "Images"},
                  {id: "video", label: "Videos"},
                  {id: "svg", label: "SVG"},
                  {id: "webp", label: "WebP"},
                  {id: "gif", label: "GIFs"}
                ]}
                resultCount={uiState.resultCount}
              />
            </View>

            <FlatList
              data={filteredMedia}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              numColumns={GRID_COLUMNS}
              contentContainerStyle={styles.gridContainer}
              showsVerticalScrollIndicator={false}
              // Performance optimization props
              removeClippedSubviews={true}
              maxToRenderPerBatch={4}
              updateCellsBatchingPeriod={50}
              windowSize={9}
              initialNumToRender={8}
              // Additional props for smooth filtering
              disableVirtualization={false}
              extraData={filterType} // Ensures re-render when filter changes
              // Maintain position during updates
              maintainVisibleContentPosition={{
                minIndexForVisible: 0
              }}
              key={`grid-${GRID_COLUMNS}`} // Force re-render when columns change
            />
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={80} color="#DDD" />
            <Text style={styles.emptyText}>Enter a website URL to extract media</Text>
          </View>
        )}
        <DraggableToolbar>
          <Actions />
        </DraggableToolbar>
      </SafeAreaView>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fab1a0",
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 0
  },
  modalTitle: {
    // fontSize: 12,
    fontWeight: "800",
    color: "#122441FF",
    marginVertical: 24,
    textAlign: "center"
    // letterSpacing: 0.5
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 16
  },
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 16,
    alignItems: "center"
  },
  dropdownOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    zIndex: 999
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 25,
    paddingRight: 8,
    shadowColor: "#000",
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  input: {
    flex: 1,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#333"
  },
  searchButton: {
    width: 66,
    height: 66,
    borderRadius: 3318,
    backgroundColor: "#2e282ae6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFC312",
    color: "#FFC8148A",
    marginLeft: 10
  },
  historyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFC4125C",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16
    // marginHorizontal: "auto"
  },
  resultsHeader: {
    paddingHorizontal: 8,
    marginBottom: 4
  },
  gridContainer: {
    paddingTop: 8,
    paddingBottom: 120
    // paddingHorizontal: 11
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
    marginTop: 16
  },
  recentUrlsContainer: {
    position: "absolute",
    top: 98,
    left: 16,
    right: 78,
    maxHeight: 300,
    backgroundColor: "white",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 10, // Increased elevation for Android
    zIndex: 1000,
    padding: 8,
    overflow: "hidden" // Ensure proper rendering on top
  },
  recentUrlItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0"
  },
  recentUrlText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    marginLeft: 8
  },
  recentUrlTime: {
    fontSize: 11,
    color: "#999",
    marginLeft: 4
  }
})

export default App
