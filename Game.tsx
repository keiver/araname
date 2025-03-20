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
  StatusBar,
  Keyboard,
  Linking,
  ScrollView
} from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as FileSystem from "expo-file-system"
import * as MediaLibrary from "expo-media-library"
import {StatusBar as ExpoStatusBar} from "expo-status-bar"

// Storage keys
const STORAGE_KEYS = {
  RECENT_URLS: "recentUrls"
}

// Resource types
enum ResourceType {
  IMAGE = "image",
  VIDEO = "video",
  AUDIO = "audio",
  OTHER = "other"
}

// Main resource interface
interface WebResource {
  id: string
  url: string
  type: ResourceType
  filename: string
  isEmbed?: boolean
}

// Debug log container
interface DebugLog {
  timestamp: string
  message: string
  type: "info" | "warning" | "error"
}

// App component
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
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([])
  const [showDebugLogs, setShowDebugLogs] = useState(false)

  // Load recent URLs on app start
  useEffect(() => {
    loadRecentUrls()
    requestMediaLibraryPermissions()
  }, [])

  // Request necessary permissions
  const requestMediaLibraryPermissions = async () => {
    const {status} = await MediaLibrary.requestPermissionsAsync()
    addDebugLog(`Media library permission status: ${status}`, "info")
  }

  // Add debug log
  const addDebugLog = (message: string, type: "info" | "warning" | "error" = "info") => {
    const timestamp = new Date().toISOString().substring(11, 19) // HH:MM:SS
    setDebugLogs(logs => [...logs, {timestamp, message, type}])
    console.log(`[${timestamp}][${type}] ${message}`)
  }

  // Load recent URLs from storage
  const loadRecentUrls = async () => {
    try {
      const storedUrls = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_URLS)
      if (storedUrls) {
        setRecentUrls(JSON.parse(storedUrls))
        addDebugLog(`Loaded ${JSON.parse(storedUrls).length} recent URLs`, "info")
      } else {
        addDebugLog("No recent URLs found", "info")
      }
    } catch (err) {
      addDebugLog(`Failed to load recent URLs: ${err}`, "error")
    }
  }

  // Save a URL to recent list
  const saveRecentUrl = async (urlToSave: string) => {
    try {
      // Add to beginning, remove duplicates, limit to 10
      const updatedUrls = [urlToSave, ...recentUrls.filter(u => u !== urlToSave)].slice(0, 10)

      setRecentUrls(updatedUrls)
      await AsyncStorage.setItem(STORAGE_KEYS.RECENT_URLS, JSON.stringify(updatedUrls))
      addDebugLog(`Saved URL to recent list: ${urlToSave}`, "info")
    } catch (err) {
      addDebugLog(`Failed to save recent URL: ${err}`, "error")
    }
  }

  // Handle URL submission
  const handleSubmit = async () => {
    if (!url) {
      setError("Please enter a URL")
      addDebugLog("Submission attempt with empty URL", "warning")
      return
    }

    Keyboard.dismiss()
    setShowRecent(false)
    setIsLoading(true)
    setError(null)
    setResources([])
    setDebugLogs([])

    addDebugLog(`Starting to crawl URL: ${url}`, "info")

    try {
      // Normalize URL
      const normalizedUrl = url.startsWith("http") ? url : `https://${url}`
      addDebugLog(`Normalized URL: ${normalizedUrl}`, "info")

      // Fetch and extract resources
      const extractedResources = await fetchAndExtractResources(normalizedUrl)
      addDebugLog(`Extraction complete. Found ${extractedResources.length} resources`, "info")

      setResources(extractedResources)
      saveRecentUrl(normalizedUrl)
      setHasCrawled(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to crawl website"
      addDebugLog(`Error crawling website: ${errorMessage}`, "error")
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
    addDebugLog("App state reset", "info")
  }

  // Fetch website content and extract resources
  const fetchAndExtractResources = async (url: string): Promise<WebResource[]> => {
    try {
      addDebugLog(`Fetching content from: ${url}`, "info")

      // Fetch HTML content
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 SlingShip Resource Crawler"
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch website: ${response.status} ${response.statusText}`)
      }

      addDebugLog(`Response status: ${response.status}`, "info")

      const htmlContent = await response.text()
      const contentLength = htmlContent.length

      addDebugLog(`Received HTML content. Length: ${contentLength} characters`, "info")
      addDebugLog(`First 100 chars: ${htmlContent.substring(0, 100).replace(/\n/g, "↩")}...`, "info")

      // Extract resources
      return extractResources(htmlContent, url)
    } catch (err) {
      addDebugLog(`Error in fetchAndExtractResources: ${err}`, "error")
      throw err
    }
  }

  // Extract resources from HTML content
  const extractResources = (htmlContent: string, baseUrl: string): WebResource[] => {
    const resources: WebResource[] = []
    const seen = new Set<string>() // Track URLs to avoid duplicates

    addDebugLog(`Starting resource extraction from HTML for base URL: ${baseUrl}`, "info")

    try {
      // Extract images
      let imgCount = 0
      const imgRegex = /<img[^>]+src=["']([^"'>]+)["']/g
      let match

      addDebugLog(`Looking for image tags with regex: ${imgRegex.source}`, "info")

      while ((match = imgRegex.exec(htmlContent)) !== null) {
        imgCount++
        const src = match[1]
        addDebugLog(`Found image #${imgCount}: ${src.substring(0, 50)}${src.length > 50 ? "..." : ""}`, "info")

        const resolvedUrl = resolveUrl(src, baseUrl)
        addDebugLog(`Resolved image URL: ${resolvedUrl}`, "info")

        if (!seen.has(resolvedUrl)) {
          seen.add(resolvedUrl)
          resources.push({
            id: `img-${resources.length}`,
            url: resolvedUrl,
            type: ResourceType.IMAGE,
            filename: getFilenameFromUrl(resolvedUrl, ".jpg")
          })
          addDebugLog(`Added image resource: ${resolvedUrl}`, "info")
        } else {
          addDebugLog(`Skipped duplicate image: ${resolvedUrl}`, "info")
        }
      }

      addDebugLog(`Found ${imgCount} image tags total`, "info")

      // Try alternate image regex if none found
      if (imgCount === 0) {
        addDebugLog("No images found with primary regex, trying alternate patterns", "info")

        // Try without quotes
        const imgRegexAlt = /<img[^>]+src=([^ >]+)/g
        while ((match = imgRegexAlt.exec(htmlContent)) !== null) {
          imgCount++
          const src = match[1]
          addDebugLog(`Found image with alt regex #${imgCount}: ${src}`, "info")

          const resolvedUrl = resolveUrl(src, baseUrl)
          if (!seen.has(resolvedUrl)) {
            seen.add(resolvedUrl)
            resources.push({
              id: `img-${resources.length}`,
              url: resolvedUrl,
              type: ResourceType.IMAGE,
              filename: getFilenameFromUrl(resolvedUrl, ".jpg")
            })
          }
        }
      }

      // Extract videos
      let videoCount = 0

      // Standard video tags
      const videoRegex =
        /<video[^>]*>[\s\S]*?<source[^>]+src=["']([^"'>]+)["'][^>]*>[\s\S]*?<\/video>|<video[^>]+src=["']([^"'>]+)["']/g
      addDebugLog(`Looking for video tags with regex: ${videoRegex.source}`, "info")

      while ((match = videoRegex.exec(htmlContent)) !== null) {
        videoCount++
        const src = match[1] || match[2]
        addDebugLog(`Found video #${videoCount}: ${src}`, "info")

        const resolvedUrl = resolveUrl(src, baseUrl)
        if (!seen.has(resolvedUrl)) {
          seen.add(resolvedUrl)
          resources.push({
            id: `vid-${resources.length}`,
            url: resolvedUrl,
            type: ResourceType.VIDEO,
            filename: getFilenameFromUrl(resolvedUrl, ".mp4")
          })
          addDebugLog(`Added video resource: ${resolvedUrl}`, "info")
        } else {
          addDebugLog(`Skipped duplicate video: ${resolvedUrl}`, "info")
        }
      }

      // Video embeds (iframes)
      let iframeCount = 0
      const iframeRegex = /<iframe[^>]+src=["']([^"'>]+)["']/g
      addDebugLog(`Looking for iframe embeds with regex: ${iframeRegex.source}`, "info")

      while ((match = iframeRegex.exec(htmlContent)) !== null) {
        iframeCount++
        const src = match[1]
        addDebugLog(`Found iframe #${iframeCount}: ${src}`, "info")

        if (isVideoEmbed(src)) {
          addDebugLog(`Iframe is a video embed: ${src}`, "info")

          if (!seen.has(src)) {
            seen.add(src)
            resources.push({
              id: `iframe-${resources.length}`,
              url: src,
              type: ResourceType.VIDEO,
              filename: `embedded-video-${resources.length}.url`,
              isEmbed: true
            })
            addDebugLog(`Added iframe video resource: ${src}`, "info")
          } else {
            addDebugLog(`Skipped duplicate iframe: ${src}`, "info")
          }
        } else {
          addDebugLog(`Iframe is not a recognized video embed: ${src}`, "info")
        }
      }

      // Look for links to media files
      let linkCount = 0
      const linkRegex = /<a[^>]+href=["']([^"'>]+)["']/g
      addDebugLog(`Looking for media links with regex: ${linkRegex.source}`, "info")

      while ((match = linkRegex.exec(htmlContent)) !== null) {
        linkCount++
        const href = match[1]

        // Only log media links
        if (isMediaUrl(href)) {
          addDebugLog(`Found media link #${linkCount}: ${href}`, "info")

          const resolvedUrl = resolveUrl(href, baseUrl)
          if (!seen.has(resolvedUrl)) {
            seen.add(resolvedUrl)

            let type = ResourceType.OTHER
            if (isImageUrl(href)) {
              type = ResourceType.IMAGE
            } else if (isVideoUrl(href)) {
              type = ResourceType.VIDEO
            } else if (isAudioUrl(href)) {
              type = ResourceType.AUDIO
            }

            resources.push({
              id: `link-${resources.length}`,
              url: resolvedUrl,
              type: type,
              filename: getFilenameFromUrl(resolvedUrl, getDefaultExtension(type))
            })
            addDebugLog(`Added link resource of type ${type}: ${resolvedUrl}`, "info")
          } else {
            addDebugLog(`Skipped duplicate link: ${resolvedUrl}`, "info")
          }
        }
      }

      // If we still haven't found any images, try looking for background images in style attributes
      if (resources.filter(r => r.type === ResourceType.IMAGE).length === 0) {
        addDebugLog("No images found in standard tags, looking for background images", "info")

        const styleRegex = /style=["'][^"']*background-image:\s*url\(['"]?([^'"()]+)['"]?\)[^"']*/g
        let styleImgCount = 0

        while ((match = styleRegex.exec(htmlContent)) !== null) {
          styleImgCount++
          const src = match[1]
          addDebugLog(`Found background image #${styleImgCount}: ${src}`, "info")

          const resolvedUrl = resolveUrl(src, baseUrl)
          if (!seen.has(resolvedUrl)) {
            seen.add(resolvedUrl)
            resources.push({
              id: `style-img-${resources.length}`,
              url: resolvedUrl,
              type: ResourceType.IMAGE,
              filename: getFilenameFromUrl(resolvedUrl, ".jpg")
            })
            addDebugLog(`Added background image resource: ${resolvedUrl}`, "info")
          }
        }

        addDebugLog(`Found ${styleImgCount} background images`, "info")
      }

      addDebugLog(`Resource extraction complete. Found ${resources.length} unique resources`, "info")
      return resources
    } catch (err) {
      addDebugLog(`Error extracting resources: ${err}`, "error")
      return resources // Return whatever we managed to extract
    }
  }

  // Resolve relative URLs to absolute
  const resolveUrl = (url: string, baseUrl: string): string => {
    try {
      // For data URLs, return as is
      if (url.startsWith("data:")) {
        return url
      }

      // For absolute URLs, return as is
      if (url.startsWith("http://") || url.startsWith("https://")) {
        return url
      }

      // Parse base URL
      const baseUrlObj = new URL(baseUrl)

      // For protocol-relative URLs (//example.com/image.jpg)
      if (url.startsWith("//")) {
        return `${baseUrlObj.protocol}${url}`
      }

      // For root-relative URLs (/images/logo.png)
      if (url.startsWith("/")) {
        return `${baseUrlObj.origin}${url}`
      }

      // For relative URLs (images/logo.png)
      // Remove filename part from base URL if present
      let basePath = baseUrlObj.pathname
      if (!basePath.endsWith("/")) {
        basePath = basePath.substring(0, basePath.lastIndexOf("/") + 1)
      }

      return `${baseUrlObj.origin}${basePath}${url}`
    } catch (err) {
      addDebugLog(`Error resolving URL (${url}, ${baseUrl}): ${err}`, "error")
      return url // Return original if resolution fails
    }
  }

  // Get filename from URL
  const getFilenameFromUrl = (url: string, defaultExt: string): string => {
    try {
      // For data URLs, generate a filename
      if (url.startsWith("data:")) {
        return `data-file-${Math.floor(Math.random() * 10000)}${defaultExt}`
      }

      // Extract the filename from URL path
      const pathname = new URL(url).pathname
      let filename = pathname.split("/").pop() || ""

      // Clean the filename
      filename = filename.replace(/[?#].*$/, "")

      // If filename is empty or doesn't have an extension, add default extension
      if (!filename || !filename.includes(".")) {
        filename = `file-${Math.floor(Math.random() * 10000)}${defaultExt}`
      }

      return filename
    } catch (err) {
      addDebugLog(`Error getting filename from URL (${url}): ${err}`, "error")
      return `file-${Math.floor(Math.random() * 10000)}${defaultExt}`
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
      default:
        return ".bin"
    }
  }

  // Check if URL is a video embed
  const isVideoEmbed = (url: string): boolean => {
    const videoEmbedDomains = [
      "youtube.com/embed",
      "player.vimeo.com",
      "dailymotion.com/embed",
      "facebook.com/plugins/video",
      "instagram.com/p/",
      "tiktok.com/embed"
    ]

    return videoEmbedDomains.some(domain => url.includes(domain))
  }

  // Check if URL is any media type
  const isMediaUrl = (url: string): boolean => {
    return isImageUrl(url) || isVideoUrl(url) || isAudioUrl(url)
  }

  // Check URL file extensions
  const isImageUrl = (url: string): boolean => {
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"]
    return imageExtensions.some(ext => url.toLowerCase().endsWith(ext))
  }

  const isVideoUrl = (url: string): boolean => {
    const videoExtensions = [".mp4", ".webm", ".ogg", ".mov", ".avi", ".wmv", ".flv", ".mkv"]
    return videoExtensions.some(ext => url.toLowerCase().endsWith(ext))
  }

  const isAudioUrl = (url: string): boolean => {
    const audioExtensions = [".mp3", ".wav", ".ogg", ".m4a", ".aac"]
    return audioExtensions.some(ext => url.toLowerCase().endsWith(ext))
  }

  // Download a resource
  const downloadResource = async (resource: WebResource) => {
    try {
      addDebugLog(`Starting download of resource: ${resource.url}`, "info")

      // For embed URLs, open in browser
      if (resource.isEmbed) {
        addDebugLog(`Opening embed URL in browser: ${resource.url}`, "info")
        await Linking.openURL(resource.url)
        return
      }

      // Check permissions
      const {status} = await MediaLibrary.requestPermissionsAsync()
      addDebugLog(`Media library permission status: ${status}`, "info")

      if (status !== "granted") {
        Alert.alert("Permission Required", "Storage permission is needed to save resources")
        return
      }

      // Show progress alert
      Alert.alert("Downloading", "Starting download...")

      // Sanitize filename
      const sanitizedFilename = resource.filename.replace(/[^a-zA-Z0-9._-]/g, "_")
      const localUri = `${FileSystem.cacheDirectory}${sanitizedFilename}`

      addDebugLog(`Downloading to local URI: ${localUri}`, "info")

      // Download the file
      const downloadResumable = FileSystem.createDownloadResumable(resource.url, localUri, {}, downloadProgress => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
        console.log(`Download progress: ${progress * 100}%`)
      })

      const {uri} = await downloadResumable.downloadAsync()
      addDebugLog(`Download complete, uri: ${uri}`, "info")

      if (!uri) {
        throw new Error("Download failed - no URI returned")
      }

      // Save to media library based on type
      if (resource.type === ResourceType.IMAGE || resource.type === ResourceType.VIDEO) {
        const asset = await MediaLibrary.createAssetAsync(uri)
        addDebugLog(`Asset created, id: ${asset.id}`, "info")

        const album = await MediaLibrary.getAlbumAsync("SlingShip")
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false)
          addDebugLog(`Added to existing album: SlingShip`, "info")
        } else {
          await MediaLibrary.createAlbumAsync("SlingShip", asset, false)
          addDebugLog(`Created new album: SlingShip`, "info")
        }

        Alert.alert("Success", `${resource.type === ResourceType.IMAGE ? "Image" : "Video"} saved to gallery`)
      } else {
        // For other file types, share
        addDebugLog(`Sharing file: ${uri}`, "info")
        await Share.share({
          url: uri,
          message: `Resource from SlingShip: ${resource.url}`
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      addDebugLog(`Download error: ${errorMessage}`, "error")
      Alert.alert("Download Failed", errorMessage)
    }
  }

  // Share a resource URL
  const handleShareResource = async (resource: WebResource) => {
    try {
      addDebugLog(`Sharing resource URL: ${resource.url}`, "info")
      await Share.share({
        message: resource.url,
        url: Platform.OS === "ios" ? resource.url : undefined,
        title: `Resource from SlingShip Crawler`
      })
    } catch (err) {
      addDebugLog(`Error sharing: ${err}`, "error")
    }
  }

  // Filter resources by type
  const filteredResources = resourceFilter === "all" ? resources : resources.filter(r => r.type === resourceFilter)

  // Count resources by type
  const imageCount = resources.filter(r => r.type === ResourceType.IMAGE).length
  const videoCount = resources.filter(r => r.type === ResourceType.VIDEO).length
  const audioCount = resources.filter(r => r.type === ResourceType.AUDIO).length

  // Toggle debug logs
  const toggleDebugLogs = () => {
    setShowDebugLogs(!showDebugLogs)
  }

  // Render resource item
  const renderResourceItem = ({item}: {item: WebResource}) => (
    <View style={styles.resourceItem}>
      <TouchableOpacity
        style={styles.resourceContent}
        onPress={() =>
          Alert.alert("Resource Details", `Type: ${item.type}\nURL: ${item.url}`, [
            {text: "Cancel", style: "cancel"},
            {text: "Download", onPress: () => downloadResource(item)},
            {text: "Share", onPress: () => handleShareResource(item)}
          ])
        }
      >
        {/* Resource thumbnail or icon */}
        <View style={styles.thumbnailContainer}>
          {item.type === ResourceType.IMAGE ? (
            <Image
              source={{uri: item.url}}
              style={styles.thumbnail}
              resizeMode="cover"
              onError={() => addDebugLog(`Error loading image thumbnail: ${item.url}`, "warning")}
            />
          ) : (
            <View style={[styles.thumbnail, styles.nonImageThumbnail]}>
              <Text style={styles.thumbnailIcon}>
                {item.type === ResourceType.VIDEO ? "▶" : item.type === ResourceType.AUDIO ? "♪" : "📄"}
              </Text>
            </View>
          )}
          <View style={styles.resourceTypeBadge}>
            <Text style={styles.resourceTypeBadgeText}>{item.type.charAt(0).toUpperCase()}</Text>
          </View>
        </View>

        {/* Resource details */}
        <View style={styles.resourceDetails}>
          <Text style={styles.resourceFilename} numberOfLines={1}>
            {item.filename}
          </Text>
          <Text style={styles.resourceUrl} numberOfLines={1}>
            {item.url}
          </Text>
          {item.isEmbed && <Text style={styles.embedLabel}>Embedded content</Text>}
        </View>
      </TouchableOpacity>

      {/* Quick actions */}
      <View style={styles.resourceActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => downloadResource(item)}>
          <Text style={styles.actionButtonText}>{item.isEmbed ? "Open" : "Download"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => handleShareResource(item)}>
          <Text style={styles.actionButtonText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  // Render debug log item
  const renderDebugLogItem = ({item}: {item: DebugLog}) => (
    <View
      style={[
        styles.debugLogItem,
        item.type === "error"
          ? styles.debugLogError
          : item.type === "warning"
          ? styles.debugLogWarning
          : styles.debugLogInfo
      ]}
    >
      <Text style={styles.debugLogTime}>{item.timestamp}</Text>
      <Text style={styles.debugLogText}>{item.message}</Text>
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SlingShip Resource Crawler</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.debugButton} onPress={toggleDebugLogs}>
            <Text style={styles.debugButtonText}>{showDebugLogs ? "Hide Logs" : "Show Logs"}</Text>
          </TouchableOpacity>

          {hasCrawled && (
            <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>New Search</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Debug logs section */}
      {showDebugLogs && debugLogs.length > 0 && (
        <View style={styles.debugLogsContainer}>
          <Text style={styles.debugLogsTitle}>Debug Logs ({debugLogs.length})</Text>
          <FlatList
            data={debugLogs}
            renderItem={renderDebugLogItem}
            keyExtractor={(_, index) => `log-${index}`}
            style={styles.debugLogsList}
          />
        </View>
      )}

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
          {showRecent && (
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

            <TouchableOpacity
              style={[styles.filterTab, resourceFilter === ResourceType.IMAGE ? styles.activeFilterTab : null]}
              onPress={() => setResourceFilter(ResourceType.IMAGE)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  resourceFilter === ResourceType.IMAGE ? styles.activeFilterTabText : null
                ]}
              >
                Images ({imageCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterTab, resourceFilter === ResourceType.VIDEO ? styles.activeFilterTab : null]}
              onPress={() => setResourceFilter(ResourceType.VIDEO)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  resourceFilter === ResourceType.VIDEO ? styles.activeFilterTabText : null
                ]}
              >
                Videos ({videoCount})
              </Text>
            </TouchableOpacity>

            {audioCount > 0 && (
              <TouchableOpacity
                style={[styles.filterTab, resourceFilter === ResourceType.AUDIO ? styles.activeFilterTab : null]}
                onPress={() => setResourceFilter(ResourceType.AUDIO)}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    resourceFilter === ResourceType.AUDIO ? styles.activeFilterTabText : null
                  ]}
                >
                  Audio ({audioCount})
                </Text>
              </TouchableOpacity>
            )}
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
  headerButtons: {
    flexDirection: "row"
  },
  debugButton: {
    backgroundColor: "#607D8B",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8
  },
  debugButtonText: {
    color: "#fff",
    fontSize: 12
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
  debugLogsContainer: {
    maxHeight: 200,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd"
  },
  debugLogsTitle: {
    fontSize: 14,
    fontWeight: "bold",
    padding: 8,
    backgroundColor: "#f0f0f0"
  },
  debugLogsList: {
    backgroundColor: "#f0f0f0"
  },
  debugLogItem: {
    flexDirection: "row",
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd"
  },
  debugLogInfo: {
    backgroundColor: "#E3F2FD"
  },
  debugLogWarning: {
    backgroundColor: "#FFF9C4"
  },
  debugLogError: {
    backgroundColor: "#FFEBEE"
  },
  debugLogTime: {
    fontSize: 12,
    fontWeight: "bold",
    marginRight: 8
  },
  debugLogText: {
    fontSize: 12,
    flex: 1
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
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  filterTabs: {
    flexDirection: "row",
    marginBottom: 12
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
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
    position: "relative",
    marginRight: 12
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 4,
    backgroundColor: "#f0f0f0"
  },
  nonImageThumbnail: {
    backgroundColor: "#CFD8DC",
    justifyContent: "center",
    alignItems: "center"
  },
  thumbnailIcon: {
    fontSize: 24,
    color: "#455A64"
  },
  resourceTypeBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#2196F3",
    justifyContent: "center",
    alignItems: "center"
  },
  resourceTypeBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold"
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
  resourceActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0"
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  actionButtonText: {
    color: "#2196F3",
    fontSize: 14,
    fontWeight: "500"
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
