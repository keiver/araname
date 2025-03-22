import React, {useState, useEffect} from "react"
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Share,
  Alert,
  ActivityIndicator,
  Platform,
  Keyboard,
  Modal
} from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as FileSystem from "expo-file-system"
import * as MediaLibrary from "expo-media-library"
import * as Linking from "expo-linking"
import {StatusBar as ExpoStatusBar} from "expo-status-bar"
import axios from "axios"
import urlJoin from "url-join"
import mime from "mime-types"
import {nanoid} from "nanoid/non-secure"
import htmlparser2 from "htmlparser2"

// Import types and constants
import {ResourceType, WebResource, FILE_EXTENSIONS, MIME_TYPES, VIDEO_EMBED_DOMAINS} from "./types"

// Setup axios instance with default config
const api = axios.create({
  timeout: 30000, // 30 seconds timeout
  headers: {
    "User-Agent": "Mozilla/5.0 Mobile Safari/604.1",
    Accept: "text/html,application/xhtml+xml,*/*"
  }
})

// Main app component
export default function App() {
  // State
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resources, setResources] = useState<WebResource[]>([])
  const [recentUrls, setRecentUrls] = useState<string[]>([])
  const [showRecent, setShowRecent] = useState(false)
  const [resourceFilter, setResourceFilter] = useState<ResourceType | "all">("all")
  const [hasCrawled, setHasCrawled] = useState(false)

  // Download state
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [currentDownload, setCurrentDownload] = useState("")

  // Load recent URLs on app start
  useEffect(() => {
    loadRecentUrls()
    checkPermissions()
  }, [])

  // Check for required permissions
  const checkPermissions = async () => {
    const {status} = await MediaLibrary.getPermissionsAsync()
    console.log(`Media library permission status: ${status}`)
  }

  // Request permissions when needed
  const requestPermissions = async (): Promise<boolean> => {
    const {status, canAskAgain} = await MediaLibrary.getPermissionsAsync()

    if (status === "granted") {
      return true
    }

    if (canAskAgain) {
      const {status: newStatus} = await MediaLibrary.requestPermissionsAsync()
      return newStatus === "granted"
    } else {
      Alert.alert(
        "Permission Required",
        "Media library permission is needed to save resources. Please enable it in Settings.",
        [
          {text: "Cancel", style: "cancel"},
          {text: "Open Settings", onPress: () => Linking.openSettings()}
        ]
      )
      return false
    }
  }

  // Load recent URLs from storage
  const loadRecentUrls = async () => {
    try {
      const storedUrls = await AsyncStorage.getItem("recentUrls")
      if (storedUrls) {
        setRecentUrls(JSON.parse(storedUrls))
      }
    } catch (err) {
      console.error("Failed to load recent URLs:", err)
    }
  }

  // Save a URL to recent list
  const saveRecentUrl = async (urlToSave: string) => {
    try {
      const updatedUrls = [urlToSave, ...recentUrls.filter(u => u !== urlToSave)].slice(0, 10)

      setRecentUrls(updatedUrls)
      await AsyncStorage.setItem("recentUrls", JSON.stringify(updatedUrls))
    } catch (err) {
      console.error("Failed to save recent URL:", err)
    }
  }

  // Handle URL submission
  const handleSubmit = async () => {
    if (!url) {
      setError("Please enter a URL")
      return
    }

    Keyboard.dismiss()
    setShowRecent(false)
    setIsLoading(true)
    setError(null)
    setResources([])

    try {
      // Normalize URL - simple normalization
      const normalizedUrl = url.startsWith("http") ? url : `https://${url}`
      console.log(`Crawling URL: ${normalizedUrl}`)

      // Fetch and extract resources
      const extractedResources = await fetchAndExtractResources(normalizedUrl)

      setResources(extractedResources)
      saveRecentUrl(normalizedUrl)
      setHasCrawled(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to crawl website"
      console.error("Error crawling website:", errorMessage)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Reset to initial state
  const handleReset = () => {
    setUrl("")
    setResources([])
    setError(null)
    setHasCrawled(false)
    setResourceFilter("all")
  }

  // Fetch website content and extract resources using axios + htmlparser2
  const fetchAndExtractResources = async (url: string): Promise<WebResource[]> => {
    try {
      // Fetch HTML content using axios
      const response = await api.get(url, {
        responseType: "text"
      })

      const htmlContent = response.data
      console.log(`Received HTML content (${htmlContent.length} bytes)`)

      // Extract resources using htmlparser2 instead of regex
      return extractResourcesWithHtmlParser(htmlContent, url)
    } catch (err) {
      // Axios error handling
      if (axios.isAxiosError(err)) {
        if (err.response) {
          throw new Error(`Failed to fetch website: ${err.response.status}`)
        } else if (err.request) {
          throw new Error("No response from server. Check your internet connection.")
        } else {
          throw new Error(`Request error: ${err.message}`)
        }
      }

      console.error("Error extracting resources:", err)
      throw err
    }
  }

  // Extract resources using htmlparser2 (which is React Native compatible)
  const extractResourcesWithHtmlParser = (html: string, baseUrl: string): WebResource[] => {
    const resources: WebResource[] = []
    const seen = new Set<string>()

    // Stack to track parent elements for context
    let elementStack: string[] = []

    // Helper function to add resource to the list
    function addResource(src: string, type: ResourceType) {
      try {
        const resolvedUrl = resolveUrl(src, baseUrl)
        if (!seen.has(resolvedUrl)) {
          seen.add(resolvedUrl)
          resources.push({
            id: nanoid(),
            url: resolvedUrl,
            type,
            filename: getFilenameFromUrl(resolvedUrl, getDefaultExtension(type))
          })
        }
      } catch (err) {
        console.warn(`Error adding resource: ${src}`, err)
      }
    }

    // Parse HTML using htmlparser2
    const parser = new htmlparser2.Parser({
      onopentag(name, attributes) {
        // Track element hierarchy
        elementStack.push(name)

        // Extract resources based on tag name and attributes
        switch (name) {
          case "img":
            if (attributes.src) {
              addResource(attributes.src, ResourceType.IMAGE)
            }
            break

          case "video":
            if (attributes.src) {
              addResource(attributes.src, ResourceType.VIDEO)
            }
            // Check poster attribute for video thumbnail
            if (attributes.poster) {
              addResource(attributes.poster, ResourceType.IMAGE)
            }
            break

          case "audio":
            if (attributes.src) {
              addResource(attributes.src, ResourceType.AUDIO)
            }
            break

          case "source":
            if (attributes.src) {
              const parentElement = elementStack[elementStack.length - 2] || ""

              if (attributes.type && attributes.type.startsWith("video/")) {
                addResource(attributes.src, ResourceType.VIDEO)
              } else if (attributes.type && attributes.type.startsWith("audio/")) {
                addResource(attributes.src, ResourceType.AUDIO)
              } else if (parentElement === "video") {
                addResource(attributes.src, ResourceType.VIDEO)
              } else if (parentElement === "audio") {
                addResource(attributes.src, ResourceType.AUDIO)
              } else {
                // Default to video
                addResource(attributes.src, ResourceType.VIDEO)
              }
            }
            break

          case "iframe":
            if (attributes.src && isVideoEmbed(attributes.src) && !seen.has(attributes.src)) {
              seen.add(attributes.src)
              resources.push({
                id: nanoid(),
                url: attributes.src,
                type: ResourceType.VIDEO,
                filename: `embedded-video-${resources.length}.url`,
                isEmbed: true
              })
            }
            break

          case "a":
            if (attributes.href) {
              try {
                const resolvedUrl = resolveUrl(attributes.href, baseUrl)
                const resourceType = getResourceTypeByExtension(resolvedUrl)

                if (resourceType !== null && !seen.has(resolvedUrl)) {
                  seen.add(resolvedUrl)
                  resources.push({
                    id: nanoid(),
                    url: resolvedUrl,
                    type: resourceType,
                    filename: getFilenameFromUrl(resolvedUrl, getDefaultExtension(resourceType))
                  })
                }
              } catch (err) {
                console.warn(`Error with link: ${attributes.href}`, err)
              }
            }
            break
        }

        // Handle styles with background images
        if (attributes.style && typeof attributes.style === "string") {
          const styleContent = attributes.style
          const matches = styleContent.match(/url\(['"]?([^'"()]+)['"]?\)/g)

          if (matches) {
            matches.forEach(match => {
              const url = match.replace(/url\(['"]?([^'"()]+)['"]?\)/, "$1")
              addResource(url, ResourceType.IMAGE)
            })
          }
        }
      },

      onclosetag(name) {
        // Remove element from stack when closed
        if (elementStack.length > 0 && elementStack[elementStack.length - 1] === name) {
          elementStack.pop()
        }
      }
    })

    // Parse the HTML content
    parser.write(html)
    parser.end()

    // Extract background images from style blocks (limited parsing)
    const styleBlockRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi
    let styleMatch

    while ((styleMatch = styleBlockRegex.exec(html)) !== null) {
      const styleContent = styleMatch[1]
      const urlMatches = styleContent.match(/url\(['"]?([^'"()]+)['"]?\)/g)

      if (urlMatches) {
        urlMatches.forEach(match => {
          const url = match.replace(/url\(['"]?([^'"()]+)['"]?\)/, "$1")
          addResource(url, ResourceType.IMAGE)
        })
      }
    }

    console.log(`Found ${resources.length} resources`)
    return resources
  }

  // Resolve relative URLs to absolute using url-join
  const resolveUrl = (url: string, baseUrl: string): string => {
    try {
      // Handle data URLs
      if (url.startsWith("data:")) {
        return url
      }

      // Handle absolute URLs
      if (url.startsWith("http://") || url.startsWith("https://")) {
        return url
      }

      // Handle protocol-relative URLs
      if (url.startsWith("//")) {
        const urlObj = new URL(baseUrl)
        return `${urlObj.protocol}${url}`
      }

      // Use urlJoin for other cases
      return urlJoin(baseUrl, url)
    } catch (err) {
      console.warn(`Error resolving URL (${url}):`, err)
      return url
    }
  }

  // Get resource type by file extension or MIME type
  const getResourceTypeByExtension = (url: string): ResourceType | null => {
    const lowerUrl = url.toLowerCase()

    // First try using mime-types library to detect type
    const mimeType = mime.lookup(lowerUrl)

    if (mimeType) {
      // Check MIME types
      for (const [type, mimes] of Object.entries(MIME_TYPES)) {
        if (mimes.includes(mimeType)) {
          return type as ResourceType
        }
      }
    }

    // Fallback to extension check
    for (const [type, extensions] of Object.entries(FILE_EXTENSIONS)) {
      if (extensions.some(ext => lowerUrl.endsWith(ext))) {
        return type as ResourceType
      }
    }

    return null
  }

  // Get filename from URL
  const getFilenameFromUrl = (url: string, defaultExt: string): string => {
    try {
      // For data URLs, generate a random filename
      if (url.startsWith("data:")) {
        return `file-${Date.now()}${defaultExt}`
      }

      // Extract filename from URL path
      const urlObj = new URL(url)
      let filename = urlObj.pathname.split("/").pop() || ""

      // Clean the filename and remove query parameters
      filename = filename.split("?")[0].split("#")[0]

      // If empty or no extension, use default
      if (!filename || !filename.includes(".")) {
        filename = `file-${Date.now()}${defaultExt}`
      }

      // Sanitize filename for filesystem
      return filename.replace(/[^a-zA-Z0-9._-]/g, "_")
    } catch (err) {
      return `file-${Date.now()}${defaultExt}`
    }
  }

  // Get default extension based on resource type
  const getDefaultExtension = (type: ResourceType): string => {
    switch (type) {
      case ResourceType.IMAGE:
        return ".jpg"
      case ResourceType.VIDEO:
        return ".mp4"
      case ResourceType.AUDIO:
        return ".mp3"
      case ResourceType.DOCUMENT:
        return ".pdf"
      default:
        return ".bin"
    }
  }

  // Check if URL is a video embed
  const isVideoEmbed = (url: string): boolean => {
    return VIDEO_EMBED_DOMAINS.some(domain => url.includes(domain))
  }

  // Download a resource with axios
  const downloadResource = async (resource: WebResource) => {
    try {
      console.log(`Starting download: ${resource.url}`)

      // For embed URLs, open in browser
      if (resource.isEmbed) {
        Linking.openURL(resource.url)
        return
      }

      // Request permissions
      const hasPermission = await requestPermissions()
      if (!hasPermission) {
        console.log("Permission denied")
        return
      }

      // Show download UI
      setIsDownloading(true)
      setDownloadProgress(0)
      setCurrentDownload(resource.filename)

      // Local file path
      const localUri = FileSystem.cacheDirectory + resource.filename

      try {
        // Use Expo FileSystem's downloadResumable for better progress tracking
        const downloadResumable = FileSystem.createDownloadResumable(
          resource.url,
          localUri,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 Mobile Safari/604.1"
            }
          },
          downloadProgress => {
            const progress = (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100
            setDownloadProgress(progress)
          }
        )

        // Start the download
        const {uri} = await downloadResumable.downloadAsync()

        if (!uri) {
          throw new Error("Download failed: no URI returned")
        }

        console.log(`Download complete, uri: ${uri}`)

        // Save the file
        saveToMediaLibrary(uri, resource)
      } catch (error) {
        console.error("Error downloading:", error)
        throw error
      }
    } catch (err) {
      console.error("Download error:", err)
      Alert.alert("Download Error", err instanceof Error ? err.message : "Failed to download file")
      setIsDownloading(false)
    }
  }

  // Save file to media library
  const saveToMediaLibrary = async (fileUri: string, resource: WebResource) => {
    try {
      // Create asset in media library
      const asset = await MediaLibrary.createAssetAsync(fileUri)

      // Get or create album
      const album = await MediaLibrary.getAlbumAsync("araname")
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false)
      } else {
        await MediaLibrary.createAlbumAsync("araname", asset, false)
      }

      Alert.alert("Success", `${resource.filename} saved to your gallery in the araname album`)
    } catch (err) {
      console.error("Error saving to gallery:", err)

      // Fallback to share
      await Share.share({
        url: fileUri,
        title: resource.filename
      })
    } finally {
      setIsDownloading(false)
    }
  }

  // Share a resource URL
  const handleShareResource = async (resource: WebResource) => {
    try {
      await Share.share({
        message: resource.url,
        url: Platform.OS === "ios" ? resource.url : undefined,
        title: `Resource from ${url}`
      })
    } catch (err) {
      console.error("Error sharing:", err)
    }
  }

  // Filter resources by type
  const filteredResources = resourceFilter === "all" ? resources : resources.filter(r => r.type === resourceFilter)

  // Count resources by type
  const resourceCounts = resources.reduce((counts, resource) => {
    counts[resource.type] = (counts[resource.type] || 0) + 1
    return counts
  }, {} as Record<string, number>)

  // Render resource item
  const renderResourceItem = ({item}: {item: WebResource}) => (
    <View style={styles.resourceItem}>
      <TouchableOpacity
        style={styles.resourceContent}
        onPress={() => {
          Alert.alert(item.filename, `Type: ${item.type}\nURL: ${item.url}`, [
            {text: "Cancel", style: "cancel"},
            {text: "Download", onPress: () => downloadResource(item)},
            {text: "Share URL", onPress: () => handleShareResource(item)}
          ])
        }}
      >
        {/* Resource thumbnail */}
        <View style={styles.thumbnailContainer}>
          {item.type === ResourceType.IMAGE ? (
            <Image source={{uri: item.url}} style={styles.thumbnail} resizeMode="cover" />
          ) : (
            <View style={[styles.thumbnail, styles.iconContainer]}>
              <Text style={styles.thumbnailIcon}>
                {item.type === ResourceType.VIDEO ? "▶" : item.type === ResourceType.AUDIO ? "♪" : "📄"}
              </Text>
            </View>
          )}
        </View>

        {/* Resource details */}
        <View style={styles.resourceDetails}>
          <Text style={styles.resourceFilename} numberOfLines={1}>
            {item.filename}
          </Text>
          <Text style={styles.resourceUrl} numberOfLines={1}>
            {item.url.substring(0, 40)}...
          </Text>
          {item.isEmbed && <Text style={styles.embedLabel}>Embedded content</Text>}
        </View>
      </TouchableOpacity>
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Araname Resource Crawler</Text>
        {hasCrawled && (
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>New Search</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* URL Input Section (only shown if not crawled yet) */}
      {!hasCrawled && (
        <View style={styles.inputSection}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={url}
              onChangeText={setUrl}
              placeholder="Enter website URL"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onFocus={() => setShowRecent(recentUrls.length > 0)}
              onSubmitEditing={handleSubmit}
            />

            <TouchableOpacity
              style={[styles.submitButton, !url ? styles.submitButtonDisabled : null]}
              onPress={handleSubmit}
              disabled={!url || isLoading}
            >
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Crawl</Text>}
            </TouchableOpacity>
          </View>

          {/* Recent URLs dropdown */}
          {showRecent && recentUrls.length > 0 && (
            <View style={styles.recentUrlsContainer}>
              <FlatList
                data={recentUrls}
                keyExtractor={(item, index) => `recent-${index}`}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={styles.recentUrlItem}
                    onPress={() => {
                      setUrl(item)
                      setShowRecent(false)
                    }}
                  >
                    <Text style={styles.recentUrlText} numberOfLines={1}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
                keyboardShouldPersistTaps="handled"
              />
            </View>
          )}

          {/* Error message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Crawling website...</Text>
        </View>
      )}

      {/* Results section */}
      {hasCrawled && !isLoading && (
        <View style={styles.resultsContainer}>
          {/* Filter tabs */}
          <View style={styles.filterTabs}>
            <TouchableOpacity
              style={[styles.filterTab, resourceFilter === "all" ? styles.activeFilterTab : null]}
              onPress={() => setResourceFilter("all")}
            >
              <Text style={[styles.filterTabText, resourceFilter === "all" ? styles.activeFilterTabText : null]}>
                All ({resources.length})
              </Text>
            </TouchableOpacity>

            {Object.entries(resourceCounts).map(([type, count]) => (
              <TouchableOpacity
                key={type}
                style={[styles.filterTab, resourceFilter === type ? styles.activeFilterTab : null]}
                onPress={() => setResourceFilter(type as ResourceType)}
              >
                <Text style={[styles.filterTabText, resourceFilter === type ? styles.activeFilterTabText : null]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}s ({count})
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Results list */}
          <FlatList
            data={filteredResources}
            renderItem={renderResourceItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.resourcesList}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {resources.length === 0
                    ? "No resources found on this website."
                    : `No ${resourceFilter} resources found.`}
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* Download Progress Modal */}
      <Modal visible={isDownloading} transparent={true} animationType="fade">
        <View style={styles.modalBackground}>
          <View style={styles.downloadModal}>
            <Text style={styles.downloadTitle}>Downloading</Text>
            <Text style={styles.downloadFilename}>{currentDownload}</Text>

            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, {width: `${downloadProgress}%`}]} />
            </View>

            <Text style={styles.progressText}>{downloadProgress.toFixed(0)}%</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9f9f9"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 1
      },
      android: {
        elevation: 2
      }
    })
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2196F3"
  },
  resetButton: {
    backgroundColor: "#2196F3",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4
  },
  resetButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500"
  },
  inputSection: {
    padding: 16
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center"
  },
  input: {
    flex: 1,
    height: 46,
    backgroundColor: "#fff",
    borderRadius: 4,
    paddingHorizontal: 12,
    fontSize: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 1
      },
      android: {
        elevation: 1
      }
    })
  },
  submitButton: {
    backgroundColor: "#2196F3",
    height: 46,
    paddingHorizontal: 16,
    marginLeft: 8,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center"
  },
  submitButtonDisabled: {
    backgroundColor: "#90CAF9"
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold"
  },
  recentUrlsContainer: {
    backgroundColor: "#fff",
    borderRadius: 4,
    marginTop: 4,
    maxHeight: 200,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 2
      },
      android: {
        elevation: 2
      }
    })
  },
  recentUrlItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0"
  },
  recentUrlText: {
    fontSize: 14
  },
  errorContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#FFEBEE",
    borderRadius: 4
  },
  errorText: {
    color: "#D32F2F",
    textAlign: "center"
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#2196F3"
  },
  resultsContainer: {
    flex: 1
  },
  filterTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    paddingBottom: 8
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 20,
    backgroundColor: "#E3F2FD"
  },
  activeFilterTab: {
    backgroundColor: "#2196F3"
  },
  filterTabText: {
    fontSize: 14,
    color: "#2196F3"
  },
  activeFilterTabText: {
    color: "#fff",
    fontWeight: "500"
  },
  resourcesList: {
    paddingHorizontal: 16,
    paddingBottom: 20
  },
  resourceItem: {
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 12,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 1
      },
      android: {
        elevation: 1
      }
    })
  },
  resourceContent: {
    flexDirection: "row",
    padding: 12
  },
  thumbnailContainer: {
    width: 60,
    height: 60,
    marginRight: 12,
    borderRadius: 4,
    overflow: "hidden"
  },
  thumbnail: {
    width: 60,
    height: 60,
    backgroundColor: "#f0f0f0"
  },
  iconContainer: {
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center"
  },
  thumbnailIcon: {
    fontSize: 24,
    color: "#424242"
  },
  resourceDetails: {
    flex: 1,
    justifyContent: "center"
  },
  resourceFilename: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4
  },
  resourceUrl: {
    fontSize: 12,
    color: "#757575",
    marginBottom: 4
  },
  embedLabel: {
    fontSize: 11,
    color: "#FF9800",
    fontWeight: "500"
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center"
  },
  downloadModal: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 20,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 3},
        shadowOpacity: 0.2,
        shadowRadius: 5
      },
      android: {
        elevation: 5
      }
    })
  },
  downloadTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8
  },
  downloadFilename: {
    fontSize: 14,
    color: "#757575",
    marginBottom: 16,
    textAlign: "center"
  },
  progressContainer: {
    width: "100%",
    height: 10,
    backgroundColor: "#E0E0E0",
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 8
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#2196F3"
  },
  progressText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#2196F3"
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center"
  },
  emptyText: {
    color: "#757575",
    fontSize: 16,
    textAlign: "center"
  }
})
