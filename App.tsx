import React, {useState} from "react"
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform
} from "react-native"
import {StatusBar} from "expo-status-bar"
import axios from "axios"
import * as FileSystem from "expo-file-system"
import * as MediaLibrary from "expo-media-library"
import {Ionicons} from "@expo/vector-icons"
import cheerio from "react-native-cheerio"

const App = () => {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [media, setMedia] = useState([])
  const [downloadingItems, setDownloadingItems] = useState({})
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions()

  const validateUrl = text => {
    const pattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w.-]*)*\/?$/
    return pattern.test(text)
  }

  const extractResources = async () => {
    if (!url) {
      Alert.alert("Error", "Please enter a URL")
      return
    }

    if (!validateUrl(url)) {
      Alert.alert("Error", "Please enter a valid URL")
      return
    }

    try {
      setLoading(true)
      setMedia([])

      // Make sure URL has proper protocol
      const formattedUrl = url.startsWith("http") ? url : `https://${url}`

      // Fetch the webpage content
      const response = await axios.get(formattedUrl)
      const html = response.data

      // Use react-native-cheerio to parse HTML
      const $ = cheerio.load(html)

      // Extract image URLs
      const imageUrls = []
      $("img").each((i, element) => {
        const src = $(element).attr("src")
        if (src) {
          // Handle relative URLs
          const fullUrl = src.startsWith("http") ? src : new URL(src, formattedUrl).href
          imageUrls.push({
            url: fullUrl,
            type: "image",
            filename: fullUrl.split("/").pop() || `image_${i}.jpg`
          })
        }
      })

      // Extract video URLs
      const videoUrls = []
      $("video source").each((i, element) => {
        const src = $(element).attr("src")
        if (src) {
          const fullUrl = src.startsWith("http") ? src : new URL(src, formattedUrl).href
          videoUrls.push({
            url: fullUrl,
            type: "video",
            filename: fullUrl.split("/").pop() || `video_${i}.mp4`
          })
        }
      })

      // Combine media sources
      const combinedMedia = [...imageUrls, ...videoUrls]

      if (combinedMedia.length === 0) {
        Alert.alert("No Media Found", "No images or videos were found on this page.")
        setLoading(false)
        return
      }

      setMedia(combinedMedia)
      setLoading(false)
    } catch (error) {
      console.error("Error extracting resources:", error)
      Alert.alert("Error", "Failed to extract resources from the URL")
      setLoading(false)
    }
  }

  const downloadMedia = async item => {
    try {
      // Check for permissions
      if (!permissionResponse?.granted) {
        const permission = await requestPermission()
        if (!permission.granted) {
          Alert.alert("Permission Required", "Media library permission is required to save media.")
          return
        }
      }

      // Create a temporary file
      const fileUri = `${FileSystem.cacheDirectory}${item.filename}`

      // Initialize download progress in state
      setDownloadingItems(prev => ({
        ...prev,
        [item.url]: {progress: 0, status: "downloading"}
      }))

      // Download the file
      const downloadResumable = FileSystem.createDownloadResumable(item.url, fileUri, {}, downloadProgress => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
        // Update download progress in state
        setDownloadingItems(prev => ({
          ...prev,
          [item.url]: {progress, status: "downloading"}
        }))
      })

      const {uri} = await downloadResumable.downloadAsync()

      // Update status to 'saving'
      setDownloadingItems(prev => ({
        ...prev,
        [item.url]: {progress: 1, status: "saving"}
      }))

      // Save to media library
      await MediaLibrary.saveToLibraryAsync(uri)

      // Update status to 'complete'
      setDownloadingItems(prev => ({
        ...prev,
        [item.url]: {progress: 1, status: "complete"}
      }))

      // Clear the download status after 2 seconds
      setTimeout(() => {
        setDownloadingItems(prev => {
          const newState = {...prev}
          delete newState[item.url]
          return newState
        })
      }, 2000)

      Alert.alert("Success", `${item.type === "image" ? "Image" : "Video"} saved to gallery`)
    } catch (error) {
      console.error("Error downloading media:", error)

      // Update status to 'error'
      setDownloadingItems(prev => ({
        ...prev,
        [item.url]: {progress: 0, status: "error"}
      }))

      // Clear the error status after 2 seconds
      setTimeout(() => {
        setDownloadingItems(prev => {
          const newState = {...prev}
          delete newState[item.url]
          return newState
        })
      }, 2000)

      Alert.alert("Error", `Failed to download ${item.type}`)
    }
  }

  const renderItem = ({item}) => {
    const downloadState = downloadingItems[item.url]
    const isDownloading = downloadState?.status === "downloading"
    const isComplete = downloadState?.status === "complete"
    const isError = downloadState?.status === "error"
    const isSaving = downloadState?.status === "saving"

    return (
      <View style={styles.mediaItem}>
        {item.type === "image" ? (
          <Image source={{uri: item.url}} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={styles.videoThumbnail}>
            <Ionicons name="videocam" size={40} color="#007AFF" />
          </View>
        )}

        <View style={styles.mediaDetails}>
          <Text style={styles.mediaFilename} numberOfLines={1}>
            {item.filename}
          </Text>
          <Text style={styles.mediaType}>{item.type === "image" ? "Image" : "Video"}</Text>

          {isDownloading && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, {width: `${downloadState.progress * 100}%`}]} />
              <Text style={styles.progressText}>{Math.round(downloadState.progress * 100)}%</Text>
            </View>
          )}

          {isSaving && <Text style={styles.savingText}>Saving to gallery...</Text>}
        </View>

        <TouchableOpacity
          style={[
            styles.downloadButton,
            isDownloading || isSaving ? styles.downloadingButton : null,
            isComplete ? styles.completeButton : null,
            isError ? styles.errorButton : null
          ]}
          onPress={() => downloadMedia(item)}
          disabled={isDownloading || isSaving}
        >
          {isDownloading ? (
            <ActivityIndicator color="white" size="small" />
          ) : isComplete ? (
            <Ionicons name="checkmark" size={24} color="white" />
          ) : isError ? (
            <Ionicons name="alert-circle" size={24} color="white" />
          ) : (
            <Ionicons name="cloud-download-outline" size={24} color="white" />
          )}
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Media Downloader</Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter website URL"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.button} onPress={extractResources} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Extract</Text>}
        </TouchableOpacity>
      </View>

      {media.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>
            {media.length} {media.length === 1 ? "item" : "items"} found
          </Text>
          <FlatList
            data={media}
            renderItem={renderItem}
            keyExtractor={(item, index) => `${item.url}-${index}`}
            style={styles.mediaList}
          />
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7"
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA"
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: "#000",
    textAlign: "center"
  },
  inputContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 8
  },
  input: {
    flex: 1,
    height: 50,
    backgroundColor: "white",
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E5E5EA"
  },
  button: {
    height: 50,
    backgroundColor: "#007AFF",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600"
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#1C1C1E"
  },
  mediaList: {
    flex: 1
  },
  mediaItem: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    alignItems: "center"
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: "#E5E5EA"
  },
  videoThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: "#E5E5EA",
    justifyContent: "center",
    alignItems: "center"
  },
  mediaDetails: {
    flex: 1,
    marginLeft: 12
  },
  mediaFilename: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1C1C1E",
    marginBottom: 4
  },
  mediaType: {
    fontSize: 14,
    color: "#8E8E93"
  },
  downloadButton: {
    width: 44,
    height: 44,
    backgroundColor: "#007AFF",
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center"
  },
  downloadingButton: {
    backgroundColor: "#8E8E93"
  },
  completeButton: {
    backgroundColor: "#34C759"
  },
  errorButton: {
    backgroundColor: "#FF3B30"
  },
  progressContainer: {
    height: 6,
    backgroundColor: "#E5E5EA",
    borderRadius: 3,
    marginTop: 4,
    width: "100%",
    overflow: "hidden",
    position: "relative"
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#007AFF",
    borderRadius: 3
  },
  progressText: {
    position: "absolute",
    right: 0,
    top: 8,
    fontSize: 10,
    color: "#8E8E93"
  },
  savingText: {
    fontSize: 12,
    color: "#007AFF",
    marginTop: 4
  }
})

export default App
