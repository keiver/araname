import React, {useCallback, useEffect, useState} from "react"
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
  Alert
} from "react-native"
import {Ionicons} from "@expo/vector-icons"
import {SvgUri} from "react-native-svg"
import axios from "axios"
import * as Clipboard from "expo-clipboard"

const {width} = Dimensions.get("window")
const GRID_COLUMNS = 2
const GRID_SPACING = 12
const ITEM_WIDTH = (width - GRID_SPACING * (GRID_COLUMNS + 1)) / GRID_COLUMNS
const MIN_ITEM_HEIGHT = 150
const MAX_ITEM_HEIGHT = 250
const DEFAULT_ASPECT_RATIO = 1
interface MediaCardProps {
  item: {
    url: string
    type: "image" | "video" | "audio"
    filename: string
    format: string
    estimatedSize?: number
  }
  downloadState?: {
    progress: number
    status: "downloading" | "saving" | "complete" | "error"
  }
  onDownload: (item: any) => void
  onCancel: (url: string) => void
  itemWidth: number // New prop
}

export const MediaCard: React.FC<MediaCardProps> = ({item, downloadState, onDownload, onCancel, itemWidth}) => {
  const [fileSizeInfo, setFileSizeInfo] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState<{width: number; height: number} | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [copyMessage, setCopyMessage] = useState(false)

  const isDownloading = downloadState?.status === "downloading"
  const isComplete = downloadState?.status === "complete"
  const isError = downloadState?.status === "error"
  const isSaving = downloadState?.status === "saving"

  // Handle copy URI action
  const handleCopyUri = useCallback(async () => {
    setCopyMessage(true)
    try {
      await Clipboard.setStringAsync(item.url)

      setTimeout(() => {
        setCopyMessage(false)
      }, 2000) // Hide message after 2 seconds
    } catch (error) {
      console.error("Failed to copy URL:", error)
      setCopyMessage(false)
    }
  }, [item.url, setCopyMessage])

  // Extract file extension from filename
  const getFileExtension = (filename: string): string => {
    const parts = filename.split(".")
    if (parts.length > 1) {
      return parts[parts.length - 1].toUpperCase()
    }
    return item.format !== "standard" ? item.format.toUpperCase() : ""
  }

  // Helper to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  // Format dimensions for display
  const formatDimensions = (): string => {
    if (!dimensions) return ""
    return `${dimensions.width} × ${dimensions.height}`
  }

  // Fetch media info (file size and dimensions)
  useEffect(() => {
    const getMediaInfo = async () => {
      try {
        setIsLoading(true)

        // Get file size via HEAD request
        const response = await axios.head(item.url, {
          timeout: 3000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        })

        const contentLength = response.headers["content-length"]

        if (contentLength) {
          const size = parseInt(contentLength, 10)
          setFileSizeInfo(formatFileSize(size))
        } else {
          setFileSizeInfo("Unknown size")
        }

        // Get image dimensions
        if (item.type === "image" && item.format !== "svg") {
          Image.getSize(
            item.url,
            (width, height) => {
              setDimensions({width, height})
              setImageLoaded(true)
            },
            () => {
              setImageLoaded(true)
            }
          )
        } else {
          setImageLoaded(true)
        }
      } catch (error) {
        setFileSizeInfo("Size unavailable")
        setImageLoaded(true)
      } finally {
        setIsLoading(false)
      }
    }

    getMediaInfo()
  }, [item.url, item.type, item.format])

  // Calculate thumbnail height with aspect ratio constraints
  const calculateThumbnailHeight = useCallback((): number => {
    if (!dimensions) return itemWidth * DEFAULT_ASPECT_RATIO

    const aspectRatio = dimensions.height / dimensions.width
    // Constrain aspect ratio between 0.75 (landscape) and 1.5 (portrait)
    const constrainedRatio = Math.min(Math.max(aspectRatio, 0.75), 1.5)
    const height = itemWidth * constrainedRatio

    // Apply min/max constraints for uniformity
    return Math.min(Math.max(height, MIN_ITEM_HEIGHT), MAX_ITEM_HEIGHT)
  }, [dimensions, itemWidth])

  const progressPercentage = React.useMemo(() => {
    if (!downloadState || typeof downloadState.progress !== "number") {
      return "0%"
    }

    // Ensure progress is between 0 and 1
    const safeProgress = Math.max(0, Math.min(1, downloadState.progress))
    return `${Math.round(safeProgress * 100)}%`
  }, [downloadState])

  return (
    <View style={[styles.gridItem, {width: itemWidth - GRID_SPACING}]}>
      <View style={styles.mediaCard}>
        {/* Media thumbnail */}
        <TouchableOpacity
          // style={styles.actionButton}
          onPress={handleCopyUri}
          activeOpacity={0.7}
          style={[styles.thumbnailContainer, {height: calculateThumbnailHeight(), minHeight: MIN_ITEM_HEIGHT}]}
        >
          {item.type === "image" ? (
            item.format === "svg" ? (
              <SvgUri width={"100%"} height={calculateThumbnailHeight()} uri={item.url} />
            ) : (
              <Image
                source={{uri: item.url}}
                style={styles.thumbnail}
                resizeMode="contain"
                onLoad={() => setImageLoaded(true)}
              />
            )
          ) : (
            <View style={styles.videoThumbnail}>
              <Ionicons name="videocam" size={36} color="#007AFF" />
            </View>
          )}

          {/* File extension badge */}
          <View style={styles.formatBadge}>
            <Text style={styles.formatBadgeText}>{getFileExtension(item.filename)}</Text>
          </View>
          {copyMessage && (
            <View style={styles.formatBadge}>
              <Text style={styles.formatBadgeText}>URL copied to clipboard</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Media info and actions */}
        <View style={styles.infoContainer}>
          {/* Filename and dimensions */}
          <Text style={styles.mediaFilename} numberOfLines={1}>
            {item.filename}
          </Text>

          <View style={styles.detailsRow}>
            {dimensions && <Text style={styles.dimensionsText}>{formatDimensions()}</Text>}
            {isLoading ? (
              <ActivityIndicator size="small" color="#999" />
            ) : (
              <Text style={styles.mediaSize}>{fileSizeInfo}</Text>
            )}
          </View>

          {/* Action area */}
          {isDownloading ? (
            <View style={styles.downloadingContainer}>
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, {width: progressPercentage}]} />
                <Text style={styles.progressText}>
                  {downloadState && typeof downloadState.progress === "number"
                    ? `${Math.max(0, Math.min(100, Math.round(downloadState.progress * 100)))}%`
                    : "0%"}
                </Text>
              </View>
              <TouchableOpacity style={styles.cancelButton} onPress={() => onCancel(item.url)}>
                <Ionicons name="close-circle" size={22} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          ) : isSaving ? (
            <View style={styles.savingContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.savingText}>Saving...</Text>
            </View>
          ) : (
            <View style={styles.actionButtonsContainer}>
              {/* Download button */}
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  isComplete ? styles.completeButton : null,
                  isError ? styles.errorButton : null
                ]}
                onPress={() => onDownload(item)}
                activeOpacity={0.7}
              >
                {isComplete ? (
                  <Ionicons name="checkmark" size={22} color="#2e282ae6" />
                ) : isError ? (
                  <Ionicons name="refresh" size={22} color="#2e282ae6" />
                ) : (
                  <Ionicons name="cloud-download" size={22} color="#2e282ae6" />
                )}
                <Text style={styles.buttonText}>{isComplete ? " Downloaded" : " Download"}</Text>
              </TouchableOpacity>

              {/* Copy URL button */}
              {/* <TouchableOpacity style={styles.actionButton} onPress={handleCopyUri} activeOpacity={0.7}>
                <Ionicons name="copy" size={22} color="#FFF" />
              </TouchableOpacity> */}
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  gridItem: {
    marginBottom: 16,
    marginHorizontal: GRID_SPACING / 2,
    shadowColor: "#000",
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  mediaCard: {
    backgroundColor: "#FFFFFFDF",
    borderRadius: 23,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 0,
    borderWidth: 0
  },
  thumbnailContainer: {
    width: "100%",
    padding: 10,
    backgroundColor: "#2e282ae6",
    position: "relative",
    overflow: "hidden"
    // minHeight: 100
  },
  thumbnail: {
    width: "100%",
    height: "100%",
    backgroundColor: "transparent"
  },
  videoThumbnail: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 122, 255, 0)",
    justifyContent: "center",
    alignItems: "center"
  },
  formatBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    color: "#2e282ae6",
    backgroundColor: "#FFC814FF",
    shadowColor: "#000",
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3
  },
  formatBadgeText: {
    fontSize: 12,
    fontWeight: "bold"
  },
  infoContainer: {
    padding: 12
  },
  mediaFilename: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000000FF",
    marginBottom: 8
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  dimensionsText: {
    fontSize: 12,
    color: "#171717FF",
    fontWeight: "500"
  },
  mediaSize: {
    fontSize: 12,
    color: "#171717FF",
    fontWeight: "500"
  },
  downloadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4
  },
  progressContainer: {
    flex: 1,
    height: 36,
    backgroundColor: "#1F1F1F37",
    borderRadius: 18,
    overflow: "hidden",
    position: "relative"
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#007AFF"
  },
  progressText: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    textAlign: "center",
    textAlignVertical: "center",
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
    paddingTop: Platform.OS === "android" ? 8 : 10
  },
  cancelButton: {
    paddingLeft: 10
  },
  savingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 36,
    marginTop: 4
  },
  savingText: {
    marginLeft: 8,
    color: "#007AFF",
    fontSize: 13,
    fontWeight: "500"
  },
  actionButtonsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
    paddingHorizontal: 1
  },
  actionButton: {
    height: 34,
    width: "100%",
    minWidth: 100,
    maxWidth: 330,
    backgroundColor: "#d1d8e0",
    borderRadius: 122,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    flexDirection: "row"
  },
  completeButton: {
    backgroundColor: "#34C75960"
  },
  errorButton: {
    backgroundColor: "#FF3B30"
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  buttonText: {
    color: "#2e282ae6",
    fontWeight: "600",
    fontSize: 15,
    marginLeft: 8
  }
})
