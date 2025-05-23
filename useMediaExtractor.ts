import {useState, useEffect, useRef, useCallback} from "react"
import axios from "axios"
import * as FileSystem from "expo-file-system"
import {Alert, Share} from "react-native"
import cheerio from "react-native-cheerio"
import {isDevelopmentEnvironment} from "./DomainClassifier"

// Types
interface MediaItem {
  url: string
  type: "image" | "video" | "audio" | "ad"
  filename: string
  format: string
  width?: number
  height?: number
  isEmbed?: boolean
}

interface DownloadState {
  progress: number
  status: "downloading" | "saving" | "complete" | "error"
}

type DownloadingItems = Record<string, DownloadState>

const useMediaExtractor = () => {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [downloadingItems, setDownloadingItems] = useState<DownloadingItems>({})

  // WebView extraction state
  const [useWebViewExtraction, setUseWebViewExtraction] = useState(false)
  const [extractionInProgress, setExtractionInProgress] = useState(false)

  const extractionController = useRef<AbortController | null>(null)
  const uniqueUrls = useRef(new Set<string>())
  const abortControllersRef = useRef<Record<string, AbortController>>({})

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(abortControllersRef.current).forEach(controller => {
        try {
          controller.abort()
        } catch (e) {}
      })
    }
  }, [])

  // Basic URL validation and formatting
  const validateUrl = useCallback((inputUrl: string): boolean => {
    if (!inputUrl?.trim()) return false

    try {
      new URL(inputUrl.startsWith("http") ? inputUrl : `https://${inputUrl}`)
      return true
    } catch {
      return false
    }
  }, [])

  // Format a URL with proper protocol
  const formatUrl = useCallback((inputUrl: string): string => {
    if (!inputUrl?.trim()) return ""
    return inputUrl.match(/^https?:\/\//) ? inputUrl : `https://${inputUrl}`
  }, [])

  // Cancel a specific download
  const cancelDownload = useCallback((itemUrl: string): void => {
    const controller = abortControllersRef.current[itemUrl]
    if (controller) {
      try {
        controller.abort()
      } catch (e) {}
      delete abortControllersRef.current[itemUrl]

      setDownloadingItems(prev => {
        const newState = {...prev}
        delete newState[itemUrl]
        return newState
      })
    }
  }, [])

  // Cancel all active downloads
  const cancelAllDownloads = useCallback((): void => {
    Object.values(abortControllersRef.current).forEach(controller => {
      try {
        controller.abort()
      } catch (e) {}
    })
    abortControllersRef.current = {}
    setDownloadingItems({})
  }, [])

  // Helper to get sanitized filename
  const getFilename = (url: string, type: "image" | "video" | "audio"): string => {
    try {
      // Extract filename from URL
      let filename = url.split("/").pop() || ""
      // Remove query params
      filename = filename.split("?")[0]
      // Remove invalid characters
      filename = filename.replace(/[^a-zA-Z0-9._-]/g, "")

      // Default if invalid
      if (!filename || filename.length < 3) {
        const ext = type === "image" ? "jpg" : type === "video" ? "mp4" : "mp3"
        return `${type}_${Date.now()}.${ext}`
      }

      return filename
    } catch {
      const ext = type === "image" ? "jpg" : type === "video" ? "mp4" : "mp3"
      return `${type}_${Date.now()}.${ext}`
    }
  }

  const cleanMediaItems = useCallback((items: MediaItem[]): MediaItem[] => {
    return items.filter(item => {
      if (!item.url || item.url.length < 8 || !item.url.includes("://")) {
        return false
      }

      if (item.url.startsWith("data:")) {
        return false
      }

      if (!item.type || !item.filename || !item.format) {
        return false
      }

      const filenameParts = item.filename.split(".")
      const extension = filenameParts.length > 1 ? `.${filenameParts[filenameParts.length - 1].toLowerCase()}` : ""

      if (item.type === "image") {
        const validImageExtensions = [
          ".jpg",
          ".jpeg",
          ".png",
          ".gif",
          ".webp",
          ".svg",
          ".bmp",
          ".avif",
          ".ico",
          ".tiff",
          ".tif",
          ".jfif",
          ".jpe",
          ".jp2",
          ".jpx",
          ".j2k",
          ".jxr",
          ".heic",
          ".heif",
          ".apng",
          ".pjpeg",
          ".wbmp",
          ".xbm"
        ]

        if (item.format === "png" || extension === ".png") {
          return true
        }

        if (!extension || !validImageExtensions.includes(extension)) {
          return false
        }
      } else if (item.type === "video") {
        if (item.isEmbed) return true

        const validVideoExtensions = [".mp4", ".webm", ".ogg", ".ogv", ".mov", ".avi", ".wmv", ".flv", ".mkv", ".m4v", ".mpg", ".mpeg", ".3gp", ".3g2", ".ts", ".mts", ".m2ts"]

        if (!extension || !validVideoExtensions.includes(extension)) {
          return false
        }
      } else if (item.type === "audio") {
        const validAudioExtensions = [".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".flac", ".wma", ".opus", ".mid", ".midi", ".aiff", ".alac"]

        if (!extension || !validAudioExtensions.includes(extension)) {
          return false
        }
      }

      if (item.width !== undefined && item.height !== undefined) {
        if (item.width <= 0 || item.height <= 0 || Number.isNaN(item.width) || Number.isNaN(item.height)) {
          return false
        }
      }

      return true
    })
  }, [])

  const getFormatFromFilename = (filename: string): string => {
    const lowerFilename = filename.toLowerCase()
    if (lowerFilename.endsWith(".svg")) return "svg"
    if (lowerFilename.endsWith(".webp")) return "webp"
    if (lowerFilename.endsWith(".gif")) return "gif"
    if (lowerFilename.endsWith(".mp4")) return "mp4"
    if (lowerFilename.endsWith(".jpg") || lowerFilename.endsWith(".jpeg")) return "jpeg"
    if (lowerFilename.endsWith(".png")) return "png"
    if (lowerFilename.endsWith(".bmp")) return "bmp"
    if (lowerFilename.endsWith(".tiff") || lowerFilename.endsWith(".tif")) return "tiff"
    if (lowerFilename.endsWith(".ico")) return "ico"
    if (lowerFilename.endsWith(".avif")) return "avif"
    if (lowerFilename.endsWith(".heic") || lowerFilename.endsWith(".heif")) return "heic"
    if (lowerFilename.endsWith(".mp3")) return "mp3"
    if (lowerFilename.endsWith(".wav")) return "wav"
    if (lowerFilename.endsWith(".ogg")) return "ogg"
    if (lowerFilename.endsWith(".oga")) return "oga"
    if (lowerFilename.endsWith(".aac")) return "aac"
    if (lowerFilename.endsWith(".flac")) return "flac"
    if (lowerFilename.endsWith(".wma")) return "wma"
    if (lowerFilename.endsWith(".opus")) return "opus"
    if (lowerFilename.endsWith(".mid") || lowerFilename.endsWith(".midi")) return "midi"
    if (lowerFilename.endsWith(".aiff") || lowerFilename.endsWith(".alac")) return "aiff"
    if (lowerFilename.endsWith(".webm")) return "webm"
    return "standard"
  }

  const extractResources = useCallback(
    async (useWebView = false): Promise<void> => {
      if (!validateUrl(url)) {
        Alert.alert("Error", "Please enter a valid URL")
        return
      }

      setLoading(true)
      setMedia([])
      uniqueUrls.current.clear()
      cancelAllDownloads()

      setUseWebViewExtraction(useWebView)
      setExtractionInProgress(true)

      if (useWebView) {
        return
      }

      if (extractionController.current) {
        extractionController.current.abort()
      }

      extractionController.current = new AbortController()

      try {
        const formattedUrl = formatUrl(url)

        const response = await axios.get(formattedUrl, {
          timeout: 15000,
          signal: extractionController.current.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        })

        const html = response.data
        const $ = cheerio.load(html)
        const mediaItems: MediaItem[] = []

        const extractMedia = (selector: string, getUrl: ($el: cheerio.Cheerio) => string | undefined, type: "image" | "video"): void => {
          $(selector).each((_, element) => {
            const $el = $(element)
            const sourceUrl = getUrl($el)

            if (!sourceUrl) return

            try {
              const fullUrl = sourceUrl.startsWith("http") ? sourceUrl : new URL(sourceUrl, formattedUrl).href

              // Skip if already processed
              if (uniqueUrls.current.has(fullUrl)) return
              uniqueUrls.current.add(fullUrl)

              const filename = getFilename(fullUrl, type)

              mediaItems.push({
                url: fullUrl,
                type,
                filename,
                format: type === "image" ? getFormatFromFilename(filename) : "standard"
              })
            } catch (err) {
              // Silently skip problematic URLs
            }
          })
        }

        await new Promise<void>(resolve => {
          setTimeout(() => {
            // Images - direct src
            extractMedia("img", $el => $el.attr("src"), "image")

            // Video sources
            extractMedia("video source", $el => $el.attr("src"), "video")

            // Video poster images
            extractMedia("video", $el => $el.attr("poster"), "image")

            // Background images in style attributes
            $("[style*='background']").each((_, element) => {
              const style = $(element).attr("style")
              if (!style) return

              try {
                const urlMatch = style.match(/url\(\s*['"]?([^'"()]+)['"]?\s*\)/i)
                if (!urlMatch?.[1]) return

                const bgUrl = urlMatch[1]
                const fullUrl = bgUrl.startsWith("http") ? bgUrl : new URL(bgUrl, formattedUrl).href

                if (uniqueUrls.current.has(fullUrl)) return
                uniqueUrls.current.add(fullUrl)

                const filename = getFilename(fullUrl, "image")

                mediaItems.push({
                  url: fullUrl,
                  type: "image",
                  filename,
                  format: getFormatFromFilename(filename)
                })
              } catch (err) {
                // Silently skip problematic URLs
              }
            })

            resolve()
          }, 0)
        })

        // Update UI after extraction completes
        if (mediaItems.length === 0) {
          Alert.alert("No Media Found", "No media was found on this page.")
        } else {
          const cleanedItems = cleanMediaItems(mediaItems)
          setMedia(cleanedItems)
        }
      } catch (error) {
        if (axios.isCancel(error)) {
          console.log("Request cancelled")
        } else {
          Alert.alert("Error", `Failed to extract resources: ${(error as Error).message || "Unknown error"}`)
        }
      } finally {
        setLoading(false)
        extractionController.current = null
        setExtractionInProgress(false)
      }
    },
    [url, validateUrl, formatUrl, cancelAllDownloads]
  )

  // Handle results from WebView extraction
  const handleWebViewResults = useCallback(
    (extractedMedia: MediaItem[]) => {
      // Update state
      setLoading(false)
      setExtractionInProgress(false)

      // Clean the media items
      const cleanedItems = cleanMediaItems(extractedMedia)

      if (cleanedItems.length === 0) {
        Alert.alert("No Media Found", "No media was found on this page using WebView extraction.")
      } else {
        setMedia(cleanedItems)
      }
    },
    [cleanMediaItems]
  ) // Add cleanMediaItems to the dependency array

  // Download media function
  const downloadMedia = useCallback(async (item: MediaItem): Promise<void> => {
    return Promise.resolve() // Placeholder to ensure the function returns a promise
    // // Check for existing download
    // if (downloadingItems[item.url]?.status === "downloading") {
    //   Alert.alert("Download in Progress", "Cancel this download?", [
    //     {text: "Cancel Download", onPress: () => cancelDownload(item.url)},
    //     {text: "Continue", style: "cancel"}
    //   ])
    //   return
    // }

    // try {
    //   // Check permissions
    //   if (!permissionResponse?.granted) {
    //     const permission = await requestPermission()
    //     if (!permission.granted) {
    //       Alert.alert("Permission Required", "Media library permission is needed.")
    //       return
    //     }
    //   }

    //   // Initialize download state
    //   setDownloadingItems(prev => ({
    //     ...prev,
    //     [item.url]: {progress: 0, status: "downloading"}
    //   }))

    //   // Create abort controller
    //   const abortController = new AbortController()
    //   abortControllersRef.current[item.url] = abortController

    //   // Download file
    //   const fileUri = `${FileSystem.cacheDirectory}${item.filename}`
    //   const downloadResumable = FileSystem.createDownloadResumable(item.url, fileUri, {}, progress => {
    //     const downloadProgress = progress.totalBytesWritten / progress.totalBytesExpectedToWrite
    //     setDownloadingItems(prev => ({
    //       ...prev,
    //       [item.url]: {progress: downloadProgress, status: "downloading"}
    //     }))
    //   })

    //   const {uri} = await downloadResumable.downloadAsync()

    //   // Update status to saving
    //   setDownloadingItems(prev => ({
    //     ...prev,
    //     [item.url]: {progress: 1, status: "saving"}
    //   }))

    //   try {
    //     // Try saving to gallery
    //     await MediaLibrary.saveToLibraryAsync(uri)

    //     // Update status to complete
    //     setDownloadingItems(prev => ({
    //       ...prev,
    //       [item.url]: {progress: 1, status: "complete"}
    //     }))

    //     // Clear status after delay
    //     setTimeout(() => {
    //       setDownloadingItems(prev => {
    //         const newState = {...prev}
    //         delete newState[item.url]
    //         return newState
    //       })
    //     }, 2000)

    //     // Alert.alert("Success", `${item.type === "image" ? "Image" : "Video"} saved to gallery`)
    //   } catch (saveError) {
    //     // Offer Files app as alternative
    //     Alert.alert(
    //       "Gallery Save Failed",
    //       `This format may not be supported by the gallery. Save to Files instead?`,
    //       [
    //         {
    //           text: "Cancel",
    //           style: "cancel",
    //           onPress: () => {
    //             setDownloadingItems(prev => {
    //               const newState = {...prev}
    //               delete newState[item.url]
    //               return newState
    //             })
    //           }
    //         },
    //         {
    //           text: "Save to Files",
    //           onPress: async () => {
    //             try {
    //               await Share.share({
    //                 url: uri,
    //                 message: `${item.filename}`
    //               })

    //               setDownloadingItems(prev => ({
    //                 ...prev,
    //                 [item.url]: {progress: 1, status: "complete"}
    //               }))

    //               setTimeout(() => {
    //                 setDownloadingItems(prev => {
    //                   const newState = {...prev}
    //                   delete newState[item.url]
    //                   return newState
    //                 })
    //               }, 2000)
    //             } catch (shareError) {
    //               setDownloadingItems(prev => ({
    //                 ...prev,
    //                 [item.url]: {progress: 0, status: "error"}
    //               }))

    //               setTimeout(() => {
    //                 setDownloadingItems(prev => {
    //                   const newState = {...prev}
    //                   delete newState[item.url]
    //                   return newState
    //                 })
    //               }, 2000)

    //               // Alert.alert("Error", "Failed to save file") // TODO: rreview
    //             }
    //           }
    //         }
    //       ]
    //     )
    //   }
    // } catch (error) {
    //   console.error("Download error:", error)

    //   if ((error as Error).message?.includes("aborted")) {
    //     // Download was cancelled
    //     setDownloadingItems(prev => {
    //       const newState = {...prev}
    //       delete newState[item.url]
    //       return newState
    //     })
    //   } else {
    //     // Other error
    //     setDownloadingItems(prev => ({
    //       ...prev,
    //       [item.url]: {progress: 0, status: "error"}
    //     }))

    //     setTimeout(() => {
    //       setDownloadingItems(prev => {
    //         const newState = {...prev}
    //         delete newState[item.url]
    //         return newState
    //       })
    //     }, 2000)

    //     Alert.alert("Error", `Download failed: ${(error as Error).message || "Unknown error"}`)
    //   }
    // } finally {
    //   // Clean up abort controller
    //   delete abortControllersRef.current[item.url]
    // }
  }, [])

  const resetState = useCallback(() => {
    setUrl("")
    setLoading(false)
    setMedia([])
    setDownloadingItems({})
    setExtractionInProgress(false)
  }, [])

  return {
    resetState,
    cleanMediaItems,
    url,
    setUrl,
    loading,
    media,
    downloadingItems,
    extractResources,
    downloadMedia,
    cancelDownload,
    cancelAllDownloads,
    formatUrl,
    useWebViewExtraction,
    extractionInProgress,
    handleWebViewResults
  }
}

export default useMediaExtractor
