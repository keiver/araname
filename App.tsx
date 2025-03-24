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
  useColorScheme,
  Alert,
  Linking
} from "react-native"
import {StatusBar} from "expo-status-bar"
import * as Haptics from "expo-haptics"
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
import NativeAdCard from "./ads/NativeAdCard"
import compressAndDownloadFiles from "./useZip"
import AdBanner, {AdBannerRef} from "./ads/AdBanner"
import SettingsModal from "./Settings"
import useIAP from "./ads/usePurchaseManager"
import MediaInfoModal from "./Modal"
import {isDevelopmentEnvironment} from "./DomainClassifier"

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

  const [zipProgress, setZipProgress] = useState(0)

  // Selection state
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({})
  const [selectionMode, setSelectionMode] = useState(false)
  const {hasNoAds, isCheckingPurchases} = useIAP()

  const {width, isLandscape} = useOrientation()

  // Dynamically adjust columns based on device type AND orientation
  const GRID_COLUMNS =
    Platform.OS === "ios"
      ? Platform.isPad
        ? 3 // iPad uses 3 columns
        : isLandscape
        ? 3
        : 2 // iPhone: 3 cols landscape, 2 cols portrait
      : 2 // Keep 2 columns for Android

  const GRID_SPACING = 14

  const adBannerRef = useRef<AdBannerRef>(null)
  const [interCoutner, setInterCounter] = useState(0)
  const showInterstitialAd = useCallback(async () => {
    if (adBannerRef.current) {
      const result = await adBannerRef.current.showInterstitial()
      console.log(`Interstitial show attempt result: ${result}`)
      return result
    }
    return false
  }, [adBannerRef])

  // This is where the issue is - we need to account for FlatList's internal spacing
  // FlatList has some internal spacing not accounted for in our calculations
  const CONTAINER_PADDING = 32
  const ADDITIONAL_PADDING = isLandscape && Platform.OS === "ios" && !Platform.isPad ? 10 : 0
  const ADJUSTED_WIDTH = width - CONTAINER_PADDING - ADDITIONAL_PADDING

  // Make sure we use integer values to avoid pixel misalignment
  const ITEM_WIDTH = Math.floor((ADJUSTED_WIDTH - GRID_SPACING * (GRID_COLUMNS - 1)) / GRID_COLUMNS)
  const [settingsVisible, setSettingsVisible] = useState(false)
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

  // Filtered media based on the current filter
  const filteredMedia = useMemo(() => {
    if (filterType === "all") return media
    return media.filter(item => item.type === filterType || item.format === filterType)
  }, [media, filterType])

  const mediaWithAds = useMemo(() => {
    if (filteredMedia.length === 0) return []

    // Create a new array with ads inserted at regular intervals
    const result = [...filteredMedia]

    // Insert an ad after every 6 items (adjust this number as needed)
    const adInterval = 6
    let insertedAds = 0

    for (let i = adInterval; i < result.length + insertedAds; i += adInterval + 1) {
      if (hasNoAds) {
        continue
      }

      // Create a special ad item that can be identified in renderItem
      result.splice(i, 0, {
        isAd: true,
        id: `ad-${insertedAds}`,
        url: `ad-${insertedAds}`,
        type: "ad"
      })
      insertedAds++
    }

    return result
  }, [filteredMedia, hasNoAds])

  // Selection-related methods
  const toggleItemSelection = useCallback(
    async (itemUrl: string) => {
      // Create a new selection state first
      const newSelectionState = {
        ...selectedItems,
        [itemUrl]: !selectedItems[itemUrl]
      }

      // Check if any items remain selected after this update
      const willHaveSelectedItems = Object.values(newSelectionState).some(Boolean)

      // Update selection
      setSelectedItems(newSelectionState)

      // Update mode based on selection state
      if (!selectionMode && willHaveSelectedItems) {
        setSelectionMode(true)
      } else if (selectionMode && !willHaveSelectedItems) {
        setSelectionMode(false)
      }

      try {
        await Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      } catch (error) {}

      setZipProgress(0) // Reset progress when toggling selection
    },
    [selectionMode, selectedItems, setZipProgress]
  )

  const clearSelection = useCallback(() => {
    setSelectedItems({})
    setSelectionMode(false)
  }, [])

  const selectAllItems = useCallback(async () => {
    // Check if all non-ad items are already selected
    const totalSelectableItems = filteredMedia.filter(item => item.type !== "ad" && item.url).length
    const currentlySelectedCount = Object.values(selectedItems).filter(Boolean).length

    // If all items are already selected, clear the selection
    if (currentlySelectedCount === totalSelectableItems && totalSelectableItems > 0) {
      setSelectionMode(true)
      setSelectedItems([] as any)

      try {
        await Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      } catch (error) {}

      return
    }

    // Otherwise, perform normal "select all" operation
    const newSelection: Record<string, boolean> = {}
    filteredMedia.forEach(item => {
      if (item.type !== "ad" && item.url) {
        newSelection[item.url] = true
      }
    })
    setSelectedItems(newSelection)
    setSelectionMode(true)
    try {
      await Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } catch (error) {}
  }, [filteredMedia, selectedItems, clearSelection, setSelectionMode, setSelectedItems])

  const downloadSelectedItems = useCallback(async () => {
    if (!isDevelopmentEnvironment(recentUrls?.[0]?.url)) {
      Alert.alert("Error", "Media download is disabled for non development environments.", [
        {text: "OK"},
        {
          text: "Read More",
          onPress: () => {
            Linking.openURL("https://keiver.dev/lab/araname#media-download-policy")
          }
        }
      ])
      return
    }

    setZipProgress(0)

    const urls = filteredMedia
      .filter(item => selectedItems[item.url] && item.url)
      ?.map(item => item.url)
      .filter(Boolean) as string[]

    await compressAndDownloadFiles(urls, `araname-downloaded-resources-${Date.now()}.zip`, r => {
      console.log("Download progress", r)
      setZipProgress(r)
    })

    if (interCoutner % 3 === 0) {
      // Show interstitial ad every 3 downloads
      await showInterstitialAd().then(result => {
        if (result) {
          setInterCounter(0) // Reset counter if ad was shown
        }
      })
    } else {
      setInterCounter(prev => prev + 1) // Increment counter if ad wasn't shown
    }
  }, [
    selectedItems,
    compressAndDownloadFiles,
    setZipProgress,
    setInterCounter,
    interCoutner,
    isDevelopmentEnvironment,
    recentUrls
  ])

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

  // Pre-calculate derived UI states to reduce jank
  const uiState = useMemo(
    () => ({
      hasResults: media.length > 0,
      resultCount: filteredMedia.length,
      selectedCount: Object.values(selectedItems).filter(Boolean).length
    }),
    [media.length, filteredMedia.length, selectedItems]
  )

  // Handle search action - always use WebView extraction
  const handleSearch = useCallback(() => {
    Keyboard.dismiss()
    if (url) {
      addRecentUrl(url)
      // Always use the advanced WebView extraction
      extractResources(true)
      setFilterType("all")
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
      if (!isDevelopmentEnvironment(recentUrls?.[0]?.url)) {
        Alert.alert("Error", "Media download is disabled for non development environments.", [
          {text: "OK"},
          {
            text: "Read More",
            onPress: () => {
              Linking.openURL("https://keiver.dev/lab/araname#media-download-policy")
            }
          }
        ])
        return
      }

      downloadMedia(item)
    },
    [downloadMedia, recentUrls, isDevelopmentEnvironment] // Ensure we have the latest recentUrls and environment check
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
    ({item, index}) => {
      const adjustedItemWidth =
        isLandscape && Platform.OS === "ios" && !Platform.isPad
          ? ITEM_WIDTH - 40 // Landscape adjustment for iPhone
          : ITEM_WIDTH // Normal width for portrait or iPad

      if (item.type === "ad") {
        return <NativeAdCard itemWidth={adjustedItemWidth} itemHeight={300} key={item.id} />
      }

      return (
        <MediaCard
          item={item}
          downloadState={downloadingItems[item.url]}
          onDownload={handleDownload}
          onCancel={handleCancelDownload}
          itemWidth={adjustedItemWidth}
          isLastInRow={(index + 1) % GRID_COLUMNS === 0}
          isSelected={!!selectedItems[item.url]}
          onSelectToggle={toggleItemSelection}
          selectionMode={selectionMode}
        />
      )
    },
    [
      downloadingItems,
      handleDownload,
      handleCancelDownload,
      ITEM_WIDTH,
      GRID_COLUMNS,
      selectedItems,
      toggleItemSelection,
      selectionMode
    ]
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
  // console.log("%cApp.tsx:219 filteredMedia", "color: #007acc;", filteredMedia)

  const handleCloseSettings = useCallback(() => {
    setSettingsVisible(false)
  }, [setSettingsVisible])

  const handleOpenSettings = useCallback(() => {
    setSettingsVisible(true)
  }, [setSettingsVisible])

  return (
    <GestureHandlerRootView style={{flex: 1, backgroundColor: "transparent"}}>
      <SafeAreaView
        style={[
          styles.container,
          {
            position: "relative",
            backgroundColor: theme === "dark" ? "#3d3d3d" : "#CCDDCC"
          }
        ]}
      >
        <StatusBar style={theme === "dark" ? "light" : "dark"} backgroundColor="transparent" translucent={true} />

        <Text
          style={[
            {
              width: "100%",
              textAlign: "center",
              opacity: 0.7,
              marginBottom: 5,
              marginTop: 10
              // marginLeft: 22,
              // backgroundColor: "#FFFFFF80"
            },
            {color: theme === "dark" ? "#FFC814FF" : "#4A4A4AFF"}
          ]}
        >
          Araname - Web Resource Inspector
        </Text>
        {/* Search input */}
        <View style={styles.searchContainer}>
          <View style={[styles.inputWrapper, {backgroundColor: theme === "dark" ? "#8F8E8E58" : "#E0E0EFFF"}]}>
            <TextInput
              ref={inputRef}
              style={[styles.input, {color: theme === "dark" ? "#FFC814FF" : "#4A4A4AFF"}]}
              placeholder="https://localhost"
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
                  backgroundColor: theme === "dark" ? "#5F5F5FF9" : "#FFFFFFFB",
                  borderColor: theme === "dark" ? "#00000029" : "#FFFFFF29",
                  borderWidth: 1,
                  shadowColor: theme === "dark" ? "#00000029" : "#E0E0EFFF",
                  shadowOffset: {width: 0, height: 3},
                  shadowOpacity: 0.2,
                  shadowRadius: 25,
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
              {selectionMode ? (
                <View style={styles.selectionToolbar}>
                  <Text style={[styles.selectionCount, {color: theme === "dark" ? "#CCCCCC" : "#4A4A4AFF"}]}>
                    {uiState.selectedCount} items selected
                  </Text>
                  <View style={styles.selectionActions}>
                    <TouchableOpacity
                      style={styles.selectionActionButton}
                      onPress={uiState.selectedCount === 0 ? () => {} : downloadSelectedItems}
                      disabled={uiState.selectedCount === 0}
                    >
                      <Ionicons
                        name="cloud-download"
                        size={22}
                        color={uiState.selectedCount === 0 ? "#CCCCCC" : "#FFC814FF"}
                      />
                      <Text
                        style={[
                          styles.selectionActionText,
                          {
                            color: uiState.selectedCount === 0 ? "#CCCCCC" : "#FFC814FF"
                          }
                        ]}
                      >
                        Zip Selected{" "}
                        {zipProgress > 0 && zipProgress < 100 ? <Text>{zipProgress?.toFixed(0) || ""}%</Text> : ""}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.selectionActionButton} onPress={selectAllItems}>
                      <Ionicons name="checkmark-circle" size={22} color="#FFC814FF" />
                      <Text style={styles.selectionActionText}>Select All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.selectionActionButton} onPress={clearSelection}>
                      <Ionicons name="close-circle" size={22} color="#FFC814FF" />
                      <Text style={styles.selectionActionText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <FilterBar
                  currentFilter={filterType}
                  onFilterChange={handleFilterChange}
                  filters={[
                    {id: "all", label: "All"},
                    {id: "image", label: "Image"},
                    {id: "video", label: "Video"},
                    {id: "audio", label: "Audio"},
                    {id: "svg", label: "SVG"},
                    {id: "webp", label: "WebP"},
                    {id: "gif", label: "GIF"},
                    {id: "jpg", label: "JPG"},
                    {id: "jpeg", label: "JPEG"},
                    {id: "png", label: "PNG"}
                  ]}
                  resultCount={uiState.resultCount}
                />
              )}
            </View>
            {/* <NativeAdCard itemWidth={200} itemHeight={300} /> */}
            <FlatList
              data={mediaWithAds}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              numColumns={GRID_COLUMNS}
              contentContainerStyle={[
                styles.gridContainer,
                {
                  paddingBottom:
                    180 +
                    // If the last row is incomplete, add extra space
                    (mediaWithAds.length % GRID_COLUMNS !== 0 ? 40 : 0)
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
              extraData={{filterType, selectedItems, selectionMode}} // Object syntax is more reliable
              // Maintain position during updates
              maintainVisibleContentPosition={{
                minIndexForVisible: 0
              }}
              key={`grid-${GRID_COLUMNS}-${isLandscape ? "landscape" : "portrait"}`}
            />
            {filteredMedia.length === 0 && !isCheckingPurchases && !hasNoAds && (
              <View
                style={[
                  styles.gridContainer,
                  {
                    paddingBottom: "100%"
                  }
                ]}
              >
                <NativeAdCard itemWidth={180} itemHeight={300} />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="images-outline"
              size={80}
              color={theme === "light" ? "#8F8F8FFF" : "#CCDDCC"}
              style={styles.shadow}
            />
            <TouchableWithoutFeedback onPress={focusInput}>
              <Text
                style={[
                  styles.emptyText,
                  styles.shadow,
                  {
                    color: theme === "dark" ? "#C8C8C8FF" : "#4A4A4AFF"
                  }
                ]}
              >
                Enter a website URL to inspect resources
              </Text>
            </TouchableWithoutFeedback>
          </View>
        )}
        <DraggableToolbar>
          <Actions onSettings={handleOpenSettings} />
          <MediaInfoModal visible={settingsVisible} onClose={handleCloseSettings} title="Araname">
            <SettingsModal appVersion={version_string} />
          </MediaInfoModal>
        </DraggableToolbar>
        {/* Always include the WebView extractor when extraction is in progress */}
        {extractionInProgress && (
          <InvisibleWebViewExtractor
            url={formatUrl(url)}
            onMediaExtracted={handleWebViewResults}
            onError={() => {
              console.log("Error extracting media")
            }}
          />
        )}
        <AdBanner
          ref={adBannerRef}
          interstitial
          onInterstitialShown={() => console.log("Interstitial shown")}
          onInterstitialClosed={() => console.log("Interstitial closed")}
        />
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
    marginTop: 1,
    marginBottom: 1
  },
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 16,
    alignItems: "center"
    // marginTop: -18
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
    paddingHorizontal: 20,
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
    paddingBottom: 120,
    backgroundColor: "transparent"
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
  },
  selectionToolbar: {
    flexDirection: "column",
    paddingVertical: 8,
    backgroundColor: "transparent",
    borderRadius: 8,
    marginBottom: 8
  },
  selectionCount: {
    fontSize: 14,
    fontWeight: "600",
    // color: "#2e282ae6",
    marginBottom: 8
  },
  selectionActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    alignItems: "center"
  },
  selectionActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#2e282ae6",
    marginRight: 8
  },
  selectionActionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFC814FF",
    marginLeft: 6
  }
})

export default App
