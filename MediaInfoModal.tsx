import React, {useEffect, useState, useCallback, useMemo} from "react"
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Platform,
  useColorScheme,
  Linking
} from "react-native"
import {Ionicons} from "@expo/vector-icons"
import axios from "axios"
import * as Clipboard from "expo-clipboard"
import {BlurView} from "expo-blur"

// Constants for time-related calculations
const SECONDS_IN_DAY = 86400
const SECONDS_IN_HOUR = 3600
const SECONDS_IN_MINUTE = 60

interface MediaInfoModalProps {
  visible: boolean
  item: {
    url: string
    type: "image" | "video" | "audio"
    filename: string
    format: string
    estimatedSize?: number
  } | null
  onClose: () => void
}

interface HeaderInfo {
  [key: string]: string
}

interface MediaMetadata {
  size: string
  dimensions?: string
  mimeType: string
  lastModified?: string
  server?: string
  cacheControl?: string
  expiresAt?: string
  etag?: string
  age?: string
  additionalHeaders: HeaderInfo
  responseTime: string
}

export const MediaInfoModal: React.FC<MediaInfoModalProps> = ({visible, item, onClose}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null)
  const [copySuccess, setCopySuccess] = useState<string | null>(null)

  const theme = useColorScheme()
  const isDark = theme === "dark"

  // Color scheme based on theme
  const colors = useMemo(
    () => ({
      background: isDark ? "#1C1C1E" : "#F2F2F7CA",
      card: isDark ? "#2C2C2E" : "#FFFFFFBC",
      text: isDark ? "#FFFFFF" : "#000000",
      subText: isDark ? "#8E8E93" : "#3C3C43",
      headerBackground: isDark ? "#1C1C1E" : "#F2F2F752",
      separator: isDark ? "#38383A" : "#C6C6C8",
      primary: "#FFC814FF",
      success: "#4CD964",
      error: "#FF3B30"
    }),
    [isDark]
  )

  // Reset state when modal opens or item changes
  useEffect(() => {
    if (visible && item) {
      setMetadata(null)
      setError(null)
      fetchMetadata()
    }
  }, [visible, item?.url])

  // Format file size from bytes
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }, [])

  // Format date for display
  const formatDate = useCallback((dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString()
    } catch (e) {
      return "Unknown"
    }
  }, [])

  // Format time duration (for Cache-Control max-age and Age headers)
  const formatDuration = useCallback((seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return "Unknown"

    if (seconds === 0) return "0 seconds"

    const days = Math.floor(seconds / SECONDS_IN_DAY)
    const hours = Math.floor((seconds % SECONDS_IN_DAY) / SECONDS_IN_HOUR)
    const minutes = Math.floor((seconds % SECONDS_IN_HOUR) / SECONDS_IN_MINUTE)
    const remainingSeconds = seconds % SECONDS_IN_MINUTE

    const parts = []
    if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`)
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? "s" : ""}`)
    if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`)
    if (remainingSeconds > 0) parts.push(`${remainingSeconds} second${remainingSeconds > 1 ? "s" : ""}`)

    return parts.join(", ")
  }, [])

  // Extract cache control information
  const parseCacheControl = useCallback(
    (cacheControl: string): {maxAge?: string; public?: boolean; private?: boolean} => {
      const result: {maxAge?: string; public?: boolean; private?: boolean} = {}

      if (!cacheControl) return result

      const directives = cacheControl.split(",").map(d => d.trim())

      for (const directive of directives) {
        if (directive.startsWith("max-age=")) {
          const maxAgeValue = parseInt(directive.substring(8), 10)
          result.maxAge = formatDuration(maxAgeValue)
        } else if (directive === "public") {
          result.public = true
        } else if (directive === "private") {
          result.private = true
        }
      }

      return result
    },
    [formatDuration]
  )

  // Get expire time from max-age and date
  const calculateExpiry = useCallback((cacheControl: string, dateHeader: string): string => {
    try {
      if (!cacheControl || !dateHeader) return "Unknown"

      const directives = cacheControl.split(",").map(d => d.trim())
      let maxAge = 0

      for (const directive of directives) {
        if (directive.startsWith("max-age=")) {
          maxAge = parseInt(directive.substring(8), 10)
          break
        }
      }

      if (maxAge <= 0) return "Not specified"

      const serverDate = new Date(dateHeader)
      if (isNaN(serverDate.getTime())) return "Invalid date"

      const expiryDate = new Date(serverDate.getTime() + maxAge * 1000)
      return expiryDate.toLocaleString()
    } catch (e) {
      return "Error calculating"
    }
  }, [])

  // Determine if response is from cache based on headers
  const determineIsCached = useCallback((headers: any): boolean => {
    if (headers["x-cache"] && headers["x-cache"].toLowerCase().includes("hit")) return true
    if (headers["cf-cache-status"] && headers["cf-cache-status"].toLowerCase() === "hit") return true
    if (headers["age"] && parseInt(headers["age"], 10) > 0) return true
    return false
  }, [])

  // Copy text to clipboard
  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await Clipboard.setStringAsync(text)
      setCopySuccess(label)
      setTimeout(() => setCopySuccess(null), 2000)
    } catch (e) {
      console.error("Failed to copy to clipboard:", e)
    }
  }, [])

  // Open URL in browser
  const openInBrowser = useCallback(async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url)
      if (canOpen) {
        await Linking.openURL(url)
      } else {
        setError("Cannot open this URL in browser")
      }
    } catch (e) {
      setError("Failed to open URL")
    }
  }, [])

  // Fetch metadata using HEAD request
  const fetchMetadata = useCallback(async () => {
    if (!item) return

    setIsLoading(true)
    setError(null)

    const startTime = Date.now()

    try {
      const response = await axios.head(item.url, {
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "*/*"
        },
        validateStatus: () => true // Allow any status code
      })

      const responseTime = `${Date.now() - startTime}ms`
      const headers = response.headers

      // Extract key information
      const size = headers["content-length"] ? formatFileSize(parseInt(headers["content-length"], 10)) : "Unknown"

      const mimeType = headers["content-type"] || "Unknown"
      const lastModified = headers["last-modified"] ? formatDate(headers["last-modified"]) : "Not specified"

      const server = headers["server"] || "Not specified"
      const cacheControl = headers["cache-control"] || "Not specified"

      // Calculate expiry time if possible
      const expiresAt =
        headers["cache-control"] && headers["date"]
          ? calculateExpiry(headers["cache-control"], headers["date"])
          : headers["expires"]
          ? formatDate(headers["expires"])
          : "Not specified"

      const etag = headers["etag"] || "Not specified"
      const age = headers["age"] ? formatDuration(parseInt(headers["age"], 10)) : "Not specified"

      // Exclude headers we've already processed
      const processedHeaderKeys = [
        "content-length",
        "content-type",
        "last-modified",
        "server",
        "cache-control",
        "expires",
        "etag",
        "age"
      ]

      // Get additional headers
      const additionalHeaders: HeaderInfo = {}
      for (const key in headers) {
        if (!processedHeaderKeys.includes(key.toLowerCase())) {
          additionalHeaders[key] = headers[key]
        }
      }

      // Set metadata
      setMetadata({
        size,
        mimeType,
        lastModified,
        server,
        cacheControl,
        expiresAt,
        etag,
        age,
        additionalHeaders,
        responseTime
      })

      // If this is an image, get dimensions
      if (item.type === "image" && Platform.OS !== "web") {
        try {
          // This is handled separately to not block the main metadata display
          const Image = require("react-native").Image
          Image.getSize(
            item.url,
            (width: number, height: number) => {
              setMetadata(prevMetadata => (prevMetadata ? {...prevMetadata, dimensions: `${width} × ${height}`} : null))
            },
            () => {} // Silently fail
          )
        } catch (e) {
          // Silently fail if we can't get dimensions
        }
      }
    } catch (e) {
      console.error("Error fetching metadata:", e)
      setError(
        "Failed to fetch file information. The resource may be inaccessible or the server may be blocking HEAD requests."
      )
    } finally {
      setIsLoading(false)
    }
  }, [item, formatFileSize, formatDate, calculateExpiry, formatDuration])

  // Info section component for consistency
  const InfoSection = ({title, children}: {title: string; children: React.ReactNode}) => (
    <View style={styles.section}>
      <Text
        style={[
          styles.sectionTitle,
          {
            color: isDark ? "#FFFFFF" : "#00000093",
            textShadowColor: "#C8C8C854",
            textShadowOffset: {width: 0, height: 1},
            textShadowRadius: 1
          }
        ]}
      >
        {title}
      </Text>
      <View style={[styles.sectionContent, {backgroundColor: colors.card}]}>{children}</View>
    </View>
  )

  // Info row component for consistency
  const InfoRow = ({label, value, copyable = false}: {label: string; value: string; copyable?: boolean}) => (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, {color: colors.subText}]}>{label}</Text>
      <View style={styles.infoValueContainer}>
        <Text style={[styles.infoValue, {color: colors.text}]} selectable={true}>
          {value}
        </Text>
        {copyable && (
          <TouchableOpacity style={styles.copyButton} onPress={() => copyToClipboard(value, label)}>
            <Ionicons
              name={copySuccess === label ? "checkmark" : "copy-outline"}
              size={16}
              color={copySuccess === label ? colors.success : colors.primary}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )

  // Header component
  const ModalHeader = () => (
    <View style={[styles.header, {backgroundColor: colors.headerBackground}]}>
      <View style={styles.headerContent}>
        <Text style={[styles.headerTitle, {color: colors.text}]}>File Information</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  )

  // Action buttons component
  const ActionButtons = () => (
    <View style={styles.actionButtonsContainer}>
      <TouchableOpacity
        style={[styles.actionButton, {backgroundColor: colors.primary}]}
        onPress={() => item && copyToClipboard(item.url, "URL")}
      >
        <Ionicons name="copy-outline" size={20} color="#2e282ae6" />
        <Text style={styles.actionButtonText}>Copy</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, {backgroundColor: colors.primary}]}
        onPress={() => item && openInBrowser(item.url)}
      >
        <Ionicons name="open-outline" size={20} color="#2e282ae6" />
        <Text style={styles.actionButtonText}>Open</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.actionButton, {backgroundColor: colors.primary}]} onPress={fetchMetadata}>
        <Ionicons name="refresh-outline" size={20} color="#2e282ae6" />
        <Text style={styles.actionButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  )

  if (!visible || !item) return null

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.blurContainer}>
        <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
          <ModalHeader />

          <ScrollView style={styles.scrollContent}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, {color: colors.text}]}>Fetching file information...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
                <Text style={[styles.errorText, {color: colors.error}]}>{error}</Text>
                <TouchableOpacity
                  style={[styles.retryButton, {backgroundColor: colors.primary}]}
                  onPress={fetchMetadata}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <InfoSection title="Basic">
                  <InfoRow label="Filename" value={item.filename} copyable />
                  <InfoRow label="Type" value={item.type.charAt(0).toUpperCase() + item.type.slice(1)} />
                  <InfoRow label="Format" value={item.format.toUpperCase()} />
                  <InfoRow label="URL" value={item.url} copyable />
                  {metadata?.dimensions && <InfoRow label="Dimensions" value={metadata.dimensions} />}
                  <InfoRow label="Size" value={metadata?.size || "Unknown"} />
                  <InfoRow label="MIME Type" value={metadata?.mimeType || "Unknown"} />
                </InfoSection>

                <InfoSection title="Server">
                  <InfoRow label="Server" value={metadata?.server || "Unknown"} />
                  <InfoRow label="Response Time" value={metadata?.responseTime || "Unknown"} />
                  <InfoRow label="Last Modified" value={metadata?.lastModified || "Unknown"} />
                  <InfoRow label="ETag" value={metadata?.etag || "Unknown"} />
                </InfoSection>

                <InfoSection title="Cache">
                  <InfoRow label="Cache Control" value={metadata?.cacheControl || "Unknown"} />
                  {metadata?.cacheControl && (
                    <>
                      {parseCacheControl(metadata.cacheControl).maxAge && (
                        <InfoRow label="Max Age" value={parseCacheControl(metadata.cacheControl).maxAge || "Unknown"} />
                      )}
                      <InfoRow
                        label="Cache Scope"
                        value={
                          parseCacheControl(metadata.cacheControl).public
                            ? "Public"
                            : parseCacheControl(metadata.cacheControl).private
                            ? "Private"
                            : "Not specified"
                        }
                      />
                    </>
                  )}
                  <InfoRow label="Expires At" value={metadata?.expiresAt || "Unknown"} />
                  <InfoRow label="Age" value={metadata?.age || "Unknown"} />
                  {metadata?.additionalHeaders["x-cache"] && (
                    <InfoRow label="X-Cache" value={metadata.additionalHeaders["x-cache"]} />
                  )}
                  {metadata?.additionalHeaders["cf-cache-status"] && (
                    <InfoRow label="CF-Cache-Status" value={metadata.additionalHeaders["cf-cache-status"]} />
                  )}
                </InfoSection>

                {Object.keys(metadata?.additionalHeaders || {}).length > 0 && (
                  <InfoSection title="Additional Headers">
                    {Object.entries(metadata?.additionalHeaders || {}).map(([key, value]) => (
                      <InfoRow key={key} label={key} value={value.toString()} />
                    ))}
                  </InfoSection>
                )}
              </>
            )}
          </ScrollView>

          <ActionButtons />
        </SafeAreaView>
      </BlurView>
    </Modal>
  )
}

const {width, height} = Dimensions.get("window")

const styles = StyleSheet.create({
  blurContainer: {
    flex: 1,
    justifyContent: "center"
  },
  container: {
    height: height * 0.8,
    overflow: "hidden",
    width: "90%",
    borderRadius: 36,
    marginHorizontal: "auto"
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)"
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 24
  },
  closeButton: {
    padding: 4
  },
  scrollContent: {
    flex: 1,
    padding: 25
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12
  },
  sectionContent: {
    borderRadius: 12,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 8
      },
      android: {
        elevation: 2
      }
    })
  },
  infoRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)"
  },
  infoLabel: {
    width: "30%",
    fontSize: 14,
    fontWeight: "500"
  },
  infoValueContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  infoValue: {
    flex: 1,
    fontSize: 14
  },
  copyButton: {
    padding: 4,
    marginLeft: 8
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40
  },
  errorText: {
    marginTop: 12,
    marginBottom: 24,
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 24
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8
  },
  retryButtonText: {
    color: "#2e282ae6",
    fontWeight: "600"
  },
  actionButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)"
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 1230,
    marginRight: 8
  },
  actionButtonText: {
    color: "#2e282ae6",
    fontWeight: "600",
    marginLeft: 8
  }
})
