import * as FileSystem from "expo-file-system"
import * as Sharing from "expo-sharing"
import * as MediaLibrary from "expo-media-library"
import {Platform, Alert} from "react-native"
import JSZip from "jszip"

/**
 * Download and compress files from URLs into a zip file
 * @param {string[]} fileUrls - Array of URLs to download and compress
 * @param {string} zipFilename - Name of the output zip file
 * @param {Function} onProgress - Optional progress callback
 * @returns {Promise<{success: boolean, path?: string, failedUrls?: string[]}>}
 */
export async function compressAndDownloadFiles(
  fileUrls: string[],
  zipFilename = `araname-downloaded-resources-${new Date().toDateString()}.zip`,
  onProgress?: (progress: number) => void
): Promise<any> {
  try {
    // Create temp directory for downloads
    const tempDir = `${FileSystem.cacheDirectory}temp_downloads_${Date.now()}/`
    const zipPath = `${FileSystem.cacheDirectory}${zipFilename}`

    // Create the temp directory
    await FileSystem.makeDirectoryAsync(tempDir, {intermediates: true})

    // Progress tracking
    const totalFiles = fileUrls.length
    let completedFiles = 0

    // Function to update progress
    const updateProgress = (current: number, total: number) => {
      if (onProgress) {
        onProgress((current / total) * 100)
      }
    }

    console.log("Downloading files...")

    // Download all files
    const downloadPromises = fileUrls.map(async (url, index) => {
      try {
        // Extract filename from URL or create a unique name if none exists
        const filename = url.split("/").pop() || `file_${index}_${Date.now()}`
        const localFilePath = `${tempDir}${filename}`

        console.log(`Downloading ${url} to ${localFilePath}`)

        // Download the file
        const downloadResult = await FileSystem.downloadAsync(url, localFilePath)

        if (downloadResult.status !== 200) {
          throw new Error(`Failed to download ${url}: Status ${downloadResult.status}`)
        }

        // Update progress
        completedFiles++
        updateProgress(completedFiles, totalFiles)

        return {url, path: localFilePath, name: filename, success: true}
      } catch (error) {
        console.error(`Error downloading ${url}:`, error)
        completedFiles++
        updateProgress(completedFiles, totalFiles)
        return {url, success: false, error: error}
      }
    })

    // Wait for all downloads to complete
    const results = await Promise.all(downloadPromises)
    const successfulDownloads = results.filter(result => result.success)

    if (successfulDownloads.length === 0) {
      throw new Error("No files were downloaded successfully")
    }

    console.log("Files downloaded successfully:", successfulDownloads.length)

    // Reset progress for compression
    updateProgress(96, 100)

    console.log("Creating zip file using JSZip...")

    try {
      // Create a new JSZip instance
      const zip = new JSZip()

      // Read each file and add it to the zip
      for (const file of successfulDownloads) {
        console.log(`Adding ${file.name} to zip...`)

        // Read the file content
        const fileContent = await FileSystem.readAsStringAsync(file.path, {
          encoding: FileSystem.EncodingType.Base64
        })

        // Add file to zip (using base64 format)
        zip.file(file?.name, fileContent, {base64: true})
      }

      console.log("Generating zip file...")

      // Generate the zip content as base64
      const zipContent = await zip.generateAsync(
        {
          type: "base64",
          compression: "DEFLATE",
          compressionOptions: {level: 9}
        },
        metadata => {
          console.log(`Zip progress: ${Math.round(metadata.percent)}%`)
          updateProgress(metadata.percent, 100)
        }
      )

      console.log("Writing zip file to filesystem...")

      // Write the zip content to a file
      await FileSystem.writeAsStringAsync(zipPath, zipContent, {
        encoding: FileSystem.EncodingType.Base64
      })

      console.log("Zip file created successfully at:", zipPath)
    } catch (zipError) {
      console.error("[DEV LOG]: Error creating ZIP file", zipError)
      throw new Error("Failed to create ZIP file")
    }

    // Clean up temp files
    await FileSystem.deleteAsync(tempDir, {idempotent: true})

    // Handle the zip file based on platform
    await shareOrSaveZip(zipPath, zipFilename)

    return {
      success: true,
      path: zipPath,
      failedUrls: results.filter(result => !result.success).map(result => result.url)
    }
  } catch (error) {
    console.error("Error in compression process:", error)
    throw error
  }
}

/**
 * Handle sharing or saving the zip file based on platform
 * @param {string} zipPath - Path to the zip file
 * @param {string} zipFilename - Name of the zip file
 */
async function shareOrSaveZip(zipPath: string, zipFilename: string): Promise<void> {
  console.log("Sharing or saving zip file:", zipPath)

  if (Platform.OS === "web") {
    // For web platform
    try {
      console.log("Web platform detected, creating download link")

      // For web, we need to read the file and create a data URL
      const fileContent = await FileSystem.readAsStringAsync(zipPath, {
        encoding: FileSystem.EncodingType.Base64
      })

      // Create a download link
      const link = document.createElement("a")
      link.href = `data:application/zip;base64,${fileContent}`
      link.download = zipFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      console.log("Download initiated on web")
    } catch (error) {
      console.error("Error sharing on web:", error)
      throw new Error("Failed to share file on web platform")
    }
  } else if (Platform.OS === "ios" || Platform.OS === "android") {
    // For mobile platforms
    try {
      console.log("Mobile platform detected")
      const isSharingAvailable = await Sharing.isAvailableAsync()

      if (isSharingAvailable) {
        console.log("Sharing is available, opening share dialog")

        // Share the file using the native share dialog
        await Sharing.shareAsync(zipPath, {
          mimeType: "application/zip",
          dialogTitle: `Download ${zipFilename}`,
          UTI: "public.zip-archive" // iOS only
        })

        console.log("Share dialog opened")
      } else if (Platform.OS === "android") {
        console.log("Sharing not available on Android, trying media library")

        // Android fallback: Save to the media library
        try {
          const {status} = await MediaLibrary.requestPermissionsAsync()
          if (status !== "granted") {
            Alert.alert("Permission needed", "Media library permission is required to save files")
            return
          }

          console.log("Permission granted, saving to media library")

          const asset = await MediaLibrary.createAssetAsync(zipPath)

          try {
            const album = await MediaLibrary.getAlbumAsync("Downloads")
            if (album) {
              await MediaLibrary.addAssetsToAlbumAsync([asset], album, false)
            } else {
              await MediaLibrary.createAlbumAsync("Downloads", asset, false)
            }

            console.log("File saved to Downloads folder")
            Alert.alert("Success", `File saved to Downloads folder as ${zipFilename}`)
          } catch (albumError) {
            console.error("Error with album operations:", albumError)
            // If we can't save to an album, at least the asset is created in the library
            Alert.alert("Success", `File saved to your media library as ${zipFilename}`)
          }
        } catch (error) {
          console.error("Error saving to media library:", error)
          Alert.alert("Error", "Failed to save file to your device")
        }
      } else {
        throw new Error("Sharing is not available on this device")
      }
    } catch (error) {
      console.error("Error sharing file:", error)
      throw error
    }
  } else {
    console.error("Unsupported platform:", Platform.OS)
    throw new Error(`Platform ${Platform.OS} is not supported`)
  }
}

export default compressAndDownloadFiles
