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
  LogBox,
  useColorScheme
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
import useMediaExtractor from "./useMediaExtractor"

// Import our new components
import {MediaCard} from "./MediaCard"
import {FilterBar} from "./FilterBar"
import {useRecentUrls} from "./useRecentUrls"
import {useOrientation} from "./useOrientation"
import Actions from "./Actions"
import DraggableToolbar from "./DraggableToolbar"
import {GestureHandlerRootView} from "react-native-gesture-handler"
import InvisibleWebViewExtractor from "./Extractor"

const versionFile = require("./app.json")

const App: React.FC = () => {
  const {
    url,
    setUrl,
    loading,
    media,
    downloadingItems,
    extractResources,
    downloadMedia,
    cancelDownload,
    formatUrl,
    useWebViewExtraction,
    handleWebViewResults,
    extractionInProgress,
    cleanMediaItems
  } = useMediaExtractor()

  const {width, isLandscape} = useOrientation()

  const GRID_COLUMNS = 2 //Platform.OS === "ios" && Platform.isPad ? 3 : 2
  const GRID_SPACING = 14
  const ITEM_WIDTH = (width - GRID_SPACING * (GRID_COLUMNS + 1)) / GRID_COLUMNS

  // Filter state
  const [filterType, setFilterType] = useState<string>("all")

  // State for recent URLs dropdown
  const [showRecentUrls, setShowRecentUrls] = useState(false)

  // State to track a URL that's pending extraction
  const [pendingExtractUrl, setPendingExtractUrl] = useState<string | null>(null)

  // Reference for detecting outside taps on dropdown
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  const {recentUrls, isLoading: urlsLoading, addRecentUrl} = useRecentUrls()
  const theme = useColorScheme()

  // Effect to handle URL extraction when it comes from recent URLs
  useEffect(() => {
    if (pendingExtractUrl) {
      // If we have a pending URL to extract, do it now
      // Give a small delay to ensure state updates are complete
      const timer = setTimeout(() => {
        // Always use the advanced WebView extraction
        extractResources(true)
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

  // Handle search action - always use WebView extraction
  const handleSearch = useCallback(() => {
    Keyboard.dismiss()
    if (url) {
      addRecentUrl(url)
      // Always use the advanced WebView extraction
      extractResources(true)
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

  const focusInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current?.focus?.()
    }
  }, [inputRef])

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
        <Ionicons name="globe-outline" size={16} color={theme === "dark" ? "#FFC814FF" : "#4A4A4AFF"} />
        <Text
          style={[
            styles.recentUrlText,
            {
              color: theme === "dark" ? "#FFC814FF" : "#4A4A4AFF"
            }
          ]}
          numberOfLines={1}
        >
          {item.title || item.url}
        </Text>
        <Text style={styles.recentUrlTime}>{new Date(item.timestamp).toLocaleDateString()}</Text>
      </TouchableOpacity>
    ),
    [handleRecentUrlSelect, theme]
  )

  const version_string = `v${versionFile.expo.version}` || "1"
  console.log("%cApp.tsx:219 filteredMedia", "color: #007acc;", filteredMedia)
  return (
    <GestureHandlerRootView style={{flex: 1, backgroundColor: "transparent"}}>
      <SafeAreaView
        style={[
          styles.container,
          {
            backgroundColor: theme === "dark" ? "#3d3d3d" : "#cdcd"
          }
        ]}
      >
        <StatusBar style={theme === "dark" ? "light" : "dark"} backgroundColor="transparent" translucent={true} />

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
                color: theme === "dark" ? "#C8C8C8FF" : "#4A4A4AFF",
                textShadowColor: theme === "dark" ? "#767676FF" : "#4A4A4A2F",
                textShadowOffset: {width: 0, height: 1},
                textShadowRadius: 2,
                fontSize: 14,
                position: "relative",
                fontWeight: "500",
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
              fontSize: 12,
              color: theme === "dark" ? "#C8C8C8FF" : "#4A4A4AFF"

              // fontWeight: "600"
            }}
          >
            {" "}
            {version_string}
          </Text>
        </View>

        {/* Search input */}
        <View style={styles.searchContainer}>
          <View style={[styles.inputWrapper, {backgroundColor: theme === "dark" ? "#8F8E8E58" : "#E0E0EFFF"}]}>
            <TextInput
              ref={inputRef}
              style={[styles.input, {color: theme === "dark" ? "#FFC814FF" : "#4A4A4AFF"}]}
              placeholder="Enter website URL"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />

            {recentUrls.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.historyButton,
                  {
                    backgroundColor: theme === "dark" ? "#FFC8142C" : "#2e282ae6"
                  }
                ]}
                onPress={() => setShowRecentUrls(prevState => !prevState)}
              >
                <Ionicons name="time-outline" size={22} color={theme === "dark" ? "#FFC8148A" : "#FFC814FF"} />
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

            <View
              ref={dropdownRef}
              style={[
                styles.recentUrlsContainer,
                {
                  width: width - 108,
                  backgroundColor: theme === "dark" ? "#5F5F5FF9" : "#E0E0EFFF",
                  borderColor: theme === "dark" ? "#00000029" : "#00000029",
                  borderWidth: 1,
                  shadowColor: theme === "dark" ? "#00000029" : "#E0E0EFFF",
                  shadowOffset: {width: 0, height: 3},
                  shadowOpacity: 0.2,
                  shadowRadius: 5,
                  elevation: 10 // Increased elevation for Android
                }
              ]}
            >
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
              contentContainerStyle={[
                styles.gridContainer,
                {
                  paddingBottom:
                    180 +
                    // If the last row is incomplete, add extra space
                    (filteredMedia.length % GRID_COLUMNS !== 0 ? 40 : 0)
                }
              ]}
              showsVerticalScrollIndicator={false}
              // Performance optimization props
              removeClippedSubviews={false} // Ensures items are rendered properly at edges
              scrollIndicatorInsets={{bottom: 140}} // Matches toolbar height
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
          <TouchableWithoutFeedback onPress={focusInput}>
            <View style={styles.emptyContainer}>
              <Ionicons
                name="images-outline"
                size={80}
                color={theme === "light" ? "#8F8F8FFF" : "#cdcd"}
                style={styles.shadow}
              />
              <Text
                style={[
                  styles.emptyText,
                  styles.shadow,
                  {
                    color: theme === "dark" ? "#C8C8C8FF" : "#4A4A4AFF"
                  }
                ]}
              >
                Enter a website URL to extract images and videos
              </Text>
            </View>
          </TouchableWithoutFeedback>
        )}
        <DraggableToolbar>
          <Actions />
        </DraggableToolbar>
        {/* Always include the WebView extractor when extraction is in progress */}
        {extractionInProgress && (
          <InvisibleWebViewExtractor
            url={formatUrl(url)}
            onMediaExtracted={handleWebViewResults}
            onError={() => {
              setLoading(false)
            }}
          />
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 0
  },
  modalTitle: {
    // fontSize: 12,
    fontWeight: "800",
    marginVertical: 24,
    textAlign: "center"
    // letterSpacing: 0.5
  },
  shadow: {
    shadowColor: "#000",
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4A4A4AFF",
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
    backgroundColor: "#FFFFFF29",
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
    color: "#FFC312",
    backgroundColor: "transparent"
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
    marginLeft: 10,
    shadowColor: "#cdcd",
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  historyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#CDCDCD38",
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
    color: "#4A4A4AFF",
    textAlign: "center",
    marginTop: 16
  },
  recentUrlsContainer: {
    position: "absolute",
    top: 98,
    left: 16,
    right: 78,
    maxHeight: 300,
    backgroundColor: "transparent",
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
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderBottomWidth: 0
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
