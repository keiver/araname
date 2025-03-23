import React, {useState, useRef} from "react"
import {View, StyleSheet, ActivityIndicator} from "react-native"
import {WebView} from "react-native-webview"

/**
 * InvisibleWebViewExtractor
 * A WebView-based media extractor that extracts media elements from a webpage
 */
const InvisibleWebViewExtractor = ({
  url,
  onMediaExtracted,
  onError,
  onLoadStart,
  onLoadEnd,
  visible = false // Set to true only for debugging
}) => {
  const [error, setError] = useState(null)
  const webViewRef = useRef(null)

  // Extraction script that will run in the webpage context
  const extractionScript = `
    (function() {
      // Helper to create a unique identifier for media items
      const createUniqueId = () => {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
      };

      // Helper to sanitize filenames
      const sanitizeFilename = (url, type) => {
        try {
          let filename = url.split('/').pop() || '';
          filename = filename.split('?')[0];
          filename = filename.replace(/[^a-zA-Z0-9._-]/g, '');
          
          if (!filename || filename.length < 3) {
            const ext = type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : 'mp3';
            return \`\${type}_\${Date.now()}.\${ext}\`;
          }
          
          return filename;
        } catch (e) {
          const ext = type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : 'mp3';
          return \`\${type}_\${Date.now()}.\${ext}\`;
        }
      };

      // Helper to determine format from filename
      const getFormatFromFilename = (filename) => {
        const lowerFilename = filename.toLowerCase();
        if (lowerFilename.endsWith('.svg')) return 'svg';
        if (lowerFilename.endsWith('.webp')) return 'webp';
        if (lowerFilename.endsWith('.gif')) return 'gif';
        return 'standard';
      };

      // Start collecting media
      const mediaItems = [];
      const processedUrls = new Set();
      
      // Extract all media types
      function extractAllMedia() {
        // Images extraction
        document.querySelectorAll('img').forEach(img => {
          const src = img.currentSrc || img.src;
          if (src && !src.startsWith('data:') && !processedUrls.has(src)) {
            processedUrls.add(src);
            const filename = sanitizeFilename(src, 'image');
            mediaItems.push({
              url: src,
              type: 'image',
              filename,
              format: getFormatFromFilename(filename),
              width: img.naturalWidth || undefined,
              height: img.naturalHeight || undefined
            });
          }
          
          // Check srcset if available
          if (img.srcset) {
            const srcsets = img.srcset.split(',');
            srcsets.forEach(srcset => {
              const parts = srcset.trim().split(' ');
              if (parts.length >= 1) {
                const srcUrl = parts[0];
                if (srcUrl && !srcUrl.startsWith('data:') && !processedUrls.has(srcUrl)) {
                  processedUrls.add(srcUrl);
                  const filename = sanitizeFilename(srcUrl, 'image');
                  mediaItems.push({
                    url: srcUrl,
                    type: 'image',
                    filename,
                    format: getFormatFromFilename(filename)
                  });
                }
              }
            });
          }
        });

        // Background images
       const allElements = document.querySelectorAll('*');
        for (const element of allElements) {
          try {
            const style = window.getComputedStyle(element);
            const backgroundImage = style.backgroundImage;
            
            if (backgroundImage && backgroundImage !== 'none') {
              const matches = backgroundImage.match(/url\\(['"]?([^'"()]+)['"]?\\)/g);
              if (matches) {
                matches.forEach(match => {
                  const url = match.replace(/url\\(['"]?([^'"()]+)['"]?\\)/, '$1');
                  if (url && !url.startsWith('data:') && !processedUrls.has(url)) {
                    processedUrls.add(url);
                    const filename = sanitizeFilename(url, 'image');
                    mediaItems.push({
                      url,
                      type: 'image',
                      filename,
                      format: getFormatFromFilename(filename)
                    });
                  }
                });
              }
            }
          } catch (e) {
            // Skip elements with getComputedStyle errors
            continue;
          }
        }

        for (const element of allElements) {
          try {
            // Check :before pseudo-element
              const beforeStyle = window.getComputedStyle(element, ':before');
            const beforeBgImage = beforeStyle.backgroundImage;
            
            if (beforeBgImage && beforeBgImage !== 'none') {
              try {
                const matches = beforeBgImage.match(/url\\(['"]?([^'"()]+)['"]?\\)/g);
                if (matches) {
                  matches.forEach(match => {
                    const url = match.replace(/url\\(['"]?([^'"()]+)['"]?\\)/, '$1');
                    if (url && !url.startsWith('data:') && !processedUrls.has(url)) {
                      processedUrls.add(url);
                      const filename = sanitizeFilename(url, 'image');
                      mediaItems.push({
                        url,
                        type: 'image',
                        filename,
                        format: getFormatFromFilename(filename)
                      });
                    }
                  });
                }
              } catch (err) {
                // Silently continue, but in future consider logging these errors for debugging
              }
            }
            // Check :after pseudo-element
            const afterStyle = window.getComputedStyle(element, ':after');
            const afterBgImage = afterStyle.backgroundImage;
            
            if (afterBgImage && afterBgImage !== 'none') {
              const matches = afterBgImage.match(/url\(['"]?([^'"()]+)['"]?\)/g);
              if (matches) {
                matches.forEach(match => {
                  const url = match.replace(/url\(['"]?([^'"()]+)['"]?\)/, '$1');
                  if (url && !url.startsWith('data:') && !processedUrls.has(url)) {
                    processedUrls.add(url);
                    const filename = sanitizeFilename(url, 'image');
                    mediaItems.push({
                      url,
                      type: 'image',
                      filename,
                      format: getFormatFromFilename(filename)
                    });
                  }
                });
              }
            }
          } catch (e) {
            // Skip elements with getComputedStyle errors for pseudo-elements
            continue;
          }
        }

        // Videos
        document.querySelectorAll('video').forEach(video => {
          if (video.src && !processedUrls.has(video.src)) {
            processedUrls.add(video.src);
            mediaItems.push({
              url: video.src,
              type: 'video',
              filename: sanitizeFilename(video.src, 'video'),
              format: 'standard'
            });
          }
          
          if (video.poster && !processedUrls.has(video.poster)) {
            processedUrls.add(video.poster);
            const filename = sanitizeFilename(video.poster, 'image');
            mediaItems.push({
              url: video.poster,
              type: 'image',
              filename,
              format: getFormatFromFilename(filename)
            });
          }
          
          video.querySelectorAll('source').forEach(source => {
            if (source.src && !processedUrls.has(source.src)) {
              processedUrls.add(source.src);
              mediaItems.push({
                url: source.src,
                type: 'video',
                filename: sanitizeFilename(source.src, 'video'),
                format: 'standard'
              });
            }
          });
        });
        
        // Audio elements
        document.querySelectorAll('audio').forEach(audio => {
          if (audio.src && !processedUrls.has(audio.src)) {
            processedUrls.add(audio.src);
            mediaItems.push({
              url: audio.src,
              type: 'audio',
              filename: sanitizeFilename(audio.src, 'audio'),
              format: 'standard'
            });
          }
          
          audio.querySelectorAll('source').forEach(source => {
            if (source.src && !processedUrls.has(source.src)) {
              processedUrls.add(source.src);
              mediaItems.push({
                url: source.src,
                type: 'audio',
                filename: sanitizeFilename(source.src, 'audio'),
                format: 'standard'
              });
            }
          });
        });
        
        // Iframes with video embeds
        const videoProviders = [
          'youtube.com/embed',
          'youtube-nocookie.com/embed',
          'player.vimeo.com',
          'dailymotion.com/embed',
          'facebook.com/plugins/video'
        ];
        
        document.querySelectorAll('iframe').forEach(iframe => {
          const src = iframe.src;
          if (src && !processedUrls.has(src)) {
            const isVideoEmbed = videoProviders.some(provider => src.includes(provider));
            
            if (isVideoEmbed) {
              processedUrls.add(src);
              mediaItems.push({
                url: src,
                type: 'video',
                filename: \`embedded-video-\${Date.now()}.url\`,
                format: 'standard',
                isEmbed: true
              });
            }
          }
        });
        
        // Send back the extracted media items
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'EXTRACTION_RESULT',
          data: mediaItems
        }));
      }
      
      // Execute extraction after the page is fully loaded
      // Give some time for dynamic content to load
      setTimeout(extractAllMedia, 10000);
      
      // Return true to avoid string to be treated as a React Native WebView error
      true;
    })();
  `

  // Handle messages from WebView
  const onMessage = event => {
    try {
      const message = JSON.parse(event.nativeEvent.data)

      if (message.type === "EXTRACTION_RESULT") {
        if (onMediaExtracted) {
          onMediaExtracted(message.data)
        }
      }
    } catch (e) {
      const errorMsg = "Failed to parse extraction results"
      setError(errorMsg)
      if (onError) {
        onError(errorMsg)
      }
    }
  }

  // Handle load error
  const handleError = error => {
    const errorMsg = `Failed to load: ${error}`
    setError(errorMsg)
    if (onError) {
      onError(errorMsg)
    }
  }

  return (
    <View style={[styles.container, visible ? styles.visibleContainer : styles.invisibleContainer]}>
      <WebView
        ref={webViewRef}
        source={{uri: url}}
        style={visible ? styles.visibleWebView : styles.invisibleWebView}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onLoadStart={onLoadStart}
        onLoadEnd={onLoadEnd}
        onError={handleError}
        onMessage={onMessage}
        injectedJavaScript={extractionScript}
        allowsFullscreenVideo={false}
        mediaPlaybackRequiresUserAction={true}
      />

      {visible && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFC312" />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: "absolute"
  },
  visibleContainer: {
    width: "100%",
    height: 300, // Fixed height for debugging
    zIndex: 100
  },
  invisibleContainer: {
    width: 1,
    height: 1,
    opacity: 0,
    position: "absolute",
    top: -1,
    left: -1
  },
  visibleWebView: {
    flex: 1
  },
  invisibleWebView: {
    width: 1,
    height: 1
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)"
  }
})

export default InvisibleWebViewExtractor
