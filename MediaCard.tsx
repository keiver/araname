import React, {useEffect, useState} from "react"
import {StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Image, Dimensions, Platform} from "react-native"
import {Ionicons} from "@expo/vector-icons"
import {SvgUri} from "react-native-svg"
import axios from "axios"

const {width} = Dimensions.get("window")
const GRID_COLUMNS = 2
const GRID_SPACING = 12
const ITEM_WIDTH = (width - GRID_SPACING * (GRID_COLUMNS + 1)) / GRID_COLUMNS

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
}

export const MediaCard: React.FC<MediaCardProps> = ({item, downloadState, onDownload, onCancel}) => {
  const [fileSizeInfo, setFileSizeInfo] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const isDownloading = downloadState?.status === "downloading"
  const isComplete = downloadState?.status === "complete"
  const isError = downloadState?.status === "error"
  const isSaving = downloadState?.status === "saving"

  // Fetch file size information
  useEffect(() => {
    const estimateFileSize = async () => {
      if (item.estimatedSize) {
        setFileSizeInfo(formatFileSize(item.estimatedSize))
        return
      }

      try {
        setIsLoading(true)
        const response = await axios.head(item.url, {timeout: 3000})
        const contentLength = response.headers["content-length"]

        if (contentLength) {
          const size = parseInt(contentLength, 10)
          setFileSizeInfo(formatFileSize(size))
        } else {
          setFileSizeInfo("Unknown size")
        }
      } catch (error) {
        setFileSizeInfo("Size unavailable")
      } finally {
        setIsLoading(false)
      }
    }

    estimateFileSize()
  }, [item.url, item.estimatedSize])

  // Helper to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  // Determine item quality based on size or format
  const getQualityIndicator = (): {label: string; color: string} => {
    if (item.format === "webp" || item.format === "svg") {
      return {label: "HD", color: "#34C759"}
    }

    if (!item.estimatedSize && !fileSizeInfo) return {label: "", color: ""}

    const size = item.estimatedSize || (fileSizeInfo && !isNaN(parseInt(fileSizeInfo)) ? parseInt(fileSizeInfo) : 0)

    if (item.type === "image") {
      if (size > 1024 * 1024) return {label: "HD", color: "#34C759"}
      if (size > 500 * 1024) return {label: "Good", color: "#007AFF"}
      if (size > 100 * 1024) return {label: "Medium", color: "#FF9500"}
      return {label: "Low", color: "#8E8E93"}
    } else {
      if (size > 20 * 1024 * 1024) return {label: "HD", color: "#34C759"}
      if (size > 5 * 1024 * 1024) return {label: "Good", color: "#007AFF"}
      return {label: "Preview", color: "#FF9500"}
    }
  }

  const quality = getQualityIndicator()

  return (
    <View style={styles.gridItem}>
      <View style={styles.mediaCard}>
        {/* Media thumbnail with enhanced shadow */}
        <View style={styles.thumbnailContainer}>
          {item.type === "image" ? (
            item.format === "svg" ? (
              <SvgUri width={ITEM_WIDTH} height={ITEM_WIDTH * 0.6} uri={item.url} />
            ) : (
              <Image source={{uri: item.url}} style={styles.thumbnail} resizeMode="cover" />
            )
          ) : (
            <View style={styles.videoThumbnail}>
              <Ionicons name="videocam" size={36} color="#007AFF" />
            </View>
          )}

          {/* Format badge */}
          {item.format !== "standard" && (
            <View style={styles.formatBadge}>
              <Text style={styles.formatBadgeText}>{item.format.toUpperCase()}</Text>
            </View>
          )}

          {/* Quality indicator */}
          {quality.label && (
            <View style={[styles.qualityBadge, {backgroundColor: quality.color}]}>
              <Text style={styles.qualityBadgeText}>{quality.label}</Text>
            </View>
          )}
        </View>

        {/* Enhanced Media info */}
        <View style={styles.mediaInfo}>
          <Text style={styles.mediaFilename} numberOfLines={1}>
            {item.filename}
          </Text>
          <View style={styles.mediaMetaRow}>
            <Text style={styles.mediaType}>
              {item.type === "image"
                ? item.format !== "standard"
                  ? `${item.format.toUpperCase()}`
                  : "Image"
                : "Video"}
            </Text>
            {isLoading ? (
              <ActivityIndicator size="small" color="#999" style={styles.sizeLoader} />
            ) : (
              <Text style={styles.mediaSize}>{fileSizeInfo}</Text>
            )}
          </View>
        </View>

        {/* Action buttons with enhanced styling */}
        <View style={styles.actionContainer}>
          {isDownloading ? (
            <>
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, {width: `${(downloadState.progress * 100).toFixed(0)}%`}]} />
                <Text style={styles.progressText}>{`${(downloadState.progress * 100).toFixed(0)}%`}</Text>
              </View>
              <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => onCancel(item.url)}>
                <Ionicons name="close" size={20} color="#FFF" />
              </TouchableOpacity>
            </>
          ) : isSaving ? (
            <View style={styles.savingContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.savingText}>Saving...</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.actionButton,
                isComplete ? styles.completeButton : null,
                isError ? styles.errorButton : null
              ]}
              onPress={() => onDownload(item)}
            >
              {isComplete ? (
                <View style={styles.buttonContent}>
                  <Ionicons name="checkmark" size={18} color="#FFF" />
                  <Text style={styles.buttonText}>Saved</Text>
                </View>
              ) : isError ? (
                <View style={styles.buttonContent}>
                  <Ionicons name="refresh" size={18} color="#FFF" />
                  <Text style={styles.buttonText}>Retry</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="download" size={18} color="#FFF" />
                  <Text style={styles.buttonText}>Download</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  gridItem: {
    width: ITEM_WIDTH,
    margin: GRID_SPACING / 2
  },
  mediaCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  thumbnailContainer: {
    width: "100%",
    height: ITEM_WIDTH * 0.6,
    backgroundColor: "#F0F0F0",
    position: "relative"
  },
  thumbnail: {
    width: "100%",
    height: "100%"
  },
  videoThumbnail: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 122, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center"
  },
  formatBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3
  },
  formatBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "bold"
  },
  qualityBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3
  },
  qualityBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "bold"
  },
  mediaInfo: {
    padding: 12
  },
  mediaFilename: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4
  },
  mediaMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  mediaType: {
    fontSize: 12,
    color: "#666"
  },
  mediaSize: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500"
  },
  sizeLoader: {
    marginLeft: 5
  },
  actionContainer: {
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    padding: 12
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  buttonText: {
    color: "#FFF",
    fontWeight: "500",
    fontSize: 13,
    marginLeft: 5
  },
  actionButton: {
    height: 40,
    backgroundColor: "#007AFF",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#007AFF",
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2
  },
  completeButton: {
    backgroundColor: "#34C759",
    shadowColor: "#34C759"
  },
  errorButton: {
    backgroundColor: "#FF3B30",
    shadowColor: "#FF3B30"
  },
  cancelButton: {
    backgroundColor: "#8E8E93",
    position: "absolute",
    right: 0,
    top: 0,
    width: 36,
    height: 36,
    borderRadius: 18
  },
  progressContainer: {
    height: 40,
    backgroundColor: "#F0F0F0",
    borderRadius: 20,
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
    color: "#333",
    fontSize: 13,
    fontWeight: "600",
    paddingTop: Platform.OS === "android" ? 10 : 12
  },
  savingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 40
  },
  savingText: {
    marginLeft: 8,
    color: "#007AFF",
    fontSize: 13,
    fontWeight: "500"
  }
})
