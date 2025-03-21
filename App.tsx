import React, {useCallback, useState, useMemo} from "react"
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  StatusBar as RNStatusBar,
  Dimensions,
  Platform,
  Keyboard
} from "react-native"
import {StatusBar} from "expo-status-bar"
import {Ionicons} from "@expo/vector-icons"

// Import our custom hook
import {useMediaExtractor} from "./useMediaExtractor"

// Import our new components
import {MediaCard} from "./MediaCard"
import {FilterBar} from "./FilterBar"
import {MasonryGrid} from "./MasonryGrid"

const {width} = Dimensions.get("window")
const GRID_COLUMNS = 2
const GRID_SPACING = 12
const ITEM_WIDTH = (width - GRID_SPACING * (GRID_COLUMNS + 1)) / GRID_COLUMNS

const App: React.FC = () => {
  const {url, setUrl, loading, media, downloadingItems, extractResources, downloadMedia, cancelDownload} =
    useMediaExtractor()

  // Filter state
  const [filterType, setFilterType] = useState<string>("all")

  // Filtered media based on the current filter
  const filteredMedia = useMemo(() => {
    if (filterType === "all") return media
    return media.filter(item => item.type === filterType || item.format === filterType)
  }, [media, filterType])

  // Handle search action
  const handleSearch = useCallback(() => {
    Keyboard.dismiss()
    extractResources()
  }, [extractResources])

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

  // Render each media item using our new MediaCard component
  const renderItem = useCallback(
    ({item}) => (
      <MediaCard
        item={item}
        downloadState={downloadingItems[item.url]}
        onDownload={handleDownload}
        onCancel={handleCancelDownload}
      />
    ),
    [downloadingItems, handleDownload, handleCancelDownload]
  )

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Title */}
      <Text style={styles.title}>Media Downloader</Text>

      {/* Search input */}
      <View style={styles.searchContainer}>
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
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Ionicons name="search" size={22} color="#FFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Results grid */}
      {media.length > 0 ? (
        <View style={styles.resultsContainer}>
          <View style={styles.resultsHeader}>
            <FilterBar
              currentFilter={filterType}
              onFilterChange={setFilterType}
              filters={[
                {id: "all", label: "All"},
                {id: "image", label: "Images"},
                {id: "video", label: "Videos"},
                {id: "svg", label: "SVG"},
                {id: "webp", label: "WebP"},
                {id: "gif", label: "GIFs"}
              ]}
              resultCount={filteredMedia.length}
            />
          </View>

          <MasonryGrid
            data={filteredMedia}
            renderItem={(item, index) => (
              <MediaCard
                item={item}
                downloadState={downloadingItems[item.url]}
                onDownload={handleDownload}
                onCancel={handleCancelDownload}
              />
            )}
            numColumns={GRID_COLUMNS}
            spacing={GRID_SPACING}
            containerStyle={styles.gridContainer}
          />
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={80} color="#DDD" />
          <Text style={styles.emptyText}>Enter a website URL to extract media</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 0
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
    marginBottom: 16
  },
  input: {
    flex: 1,
    height: 50,
    backgroundColor: "#FFF",
    borderRadius: 25,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#333",
    shadowColor: "#000",
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  searchButton: {
    width: 50,
    height: 50,
    backgroundColor: "#007AFF",
    borderRadius: 25,
    marginLeft: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 8
  },
  resultsHeader: {
    paddingHorizontal: 8,
    marginBottom: 4
  },
  gridContainer: {
    padding: GRID_SPACING / 2
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
  }
})

export default App
