import React, {useState, useRef, useEffect} from "react"
import {View, StyleSheet, ActivityIndicator} from "react-native"
import {WebView} from "react-native-webview"

/**
 * InvisibleWebViewExtractor
 * A WebView-based media extractor that extracts media elements from a webpage
 * with advanced support for lazy-loaded content
 */
const InvisibleWebViewExtractor = ({
  url,
  onMediaExtracted,
  onError,
  onLoadStart,
  onLoadEnd,
  extractionDelay = 5000, // Default delay before starting extraction
  visible = false // Set to true only for debugging
}) => {
  const [error, setError] = useState(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const webViewRef = useRef(null)
  const extractionTimeoutRef = useRef(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (extractionTimeoutRef.current) {
        clearTimeout(extractionTimeoutRef.current)
      }
    }
  }, [])

  // Initial script to inject when page loads - sets up lazy load detection
  const initialScript = `
    // Track loading state
    window.mediaExtractorState = {
      pageLoaded: false,
      preparingForExtraction: false,
      extractionStarted: false,
      lazy: {
        scrollAttempts: 0,
        lastImgCount: 0,
        stabilityCounter: 0
      }
    };
    
    // Notify when the page initially loads
    if (document.readyState === 'complete') {
      window.mediaExtractorState.pageLoaded = true;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'PAGE_LOADED'
      }));
    } else {
      window.addEventListener('load', function() {
        window.mediaExtractorState.pageLoaded = true;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'PAGE_LOADED'
        }));
      });
    }
    
    true;
  `

  // Script that prepares the page for extraction by triggering lazy loading
  const preparationScript = `
    (function() {
      if (window.mediaExtractorState.preparingForExtraction) {
        return true;
      }
      
      window.mediaExtractorState.preparingForExtraction = true;
      
      // Function to report progress
      function reportProgress(message) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'EXTRACTION_PROGRESS',
          message: message
        }));
      }
      
      // Detect if we're on YouTube
      const isYouTube = window.location.href.includes('youtube.com');
      
      // Helper to generate scroll positions
      function generateScrollPositions() {
        const positions = [];
        const pageHeight = Math.max(
          document.body.scrollHeight, 
          document.documentElement.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.offsetHeight
        );
        const viewportHeight = window.innerHeight;
        const steps = Math.max(10, Math.ceil(pageHeight / (viewportHeight / 3)));
        
        for (let i = 0; i <= steps; i++) {
          positions.push(Math.floor((pageHeight / steps) * i));
        }
        return positions;
      }
      
      // Handle YouTube-specific elements
      function handleYouTubeElements() {
        if (!isYouTube) return;
        
        reportProgress("Processing YouTube thumbnails");
        
        try {
          // Find all thumbnail elements
          const thumbnails = document.querySelectorAll('ytd-thumbnail, ytd-playlist-thumbnail, yt-img-shadow');
          
          thumbnails.forEach(thumbnail => {
            // Trigger hover events
            ['mouseover', 'mouseenter'].forEach(eventType => {
              thumbnail.dispatchEvent(new MouseEvent(eventType, {
                bubbles: true,
                cancelable: true,
                view: window
              }));
            });
            
            // Find and force load img elements
            const thumbnailImg = thumbnail.querySelector('img');
            if (thumbnailImg) {
              // Check all possible src attributes
              ['src', 'data-src', 'data-thumb'].forEach(attr => {
                const value = thumbnailImg.getAttribute(attr);
                if (value && !value.startsWith('data:')) {
                  thumbnailImg.src = value;
                }
              });
            }
          });
          
          // Try to load more content
          const loadMoreButton = document.querySelector('ytd-continuation-item-renderer, yt-button-renderer');
          if (loadMoreButton) {
            loadMoreButton.scrollIntoView();
            loadMoreButton.click();
          }
        } catch (e) {
          reportProgress("YouTube handling error: " + e.message);
        }
      }
      
      // Trigger lazy loading on common implementations
      function triggerLazyLoading() {
        const imgs = document.querySelectorAll('img');
        
        // 1. Update state tracking
        window.mediaExtractorState.lazy.scrollAttempts++;
        
        reportProgress("Triggering lazy load: attempt " + 
                      window.mediaExtractorState.lazy.scrollAttempts + 
                      ", found " + imgs.length + " images");
        
        // 2. Process all images with various data attributes
        imgs.forEach(img => {
          try {
            // List of possible src attribute names
            const srcAttrs = [
              'data-src', 'data-original', 'data-lazy-src', 
              'data-img', 'data-srcset', 'data-original-set',
              'data-fallback', 'data-thumb', 'data-bg',
              'loading', 'src', 'srcset'
            ];
            
            // Find a valid source
            for (const attr of srcAttrs) {
              const value = img.getAttribute(attr);
              if (value && !value.startsWith('data:') && 
                  value.match(/\\.(jpe?g|png|gif|webp|svg)/i)) {
                  
                // Force the image to load if it hasn't already
                if (!img.complete || img.naturalWidth === 0) {
                  img.src = value;
                  
                  // Make the image visible if it's hidden
                  if (img.style.display === 'none') img.style.display = 'inline-block';
                  if (img.style.visibility === 'hidden') img.style.visibility = 'visible';
                  if (parseFloat(img.style.opacity) === 0) img.style.opacity = '1';
                }
                break;
              }
            }
          } catch (e) {
            // Continue with next image if there's an error
          }
        });
        
        // 3. Check if we need to continue lazy load triggering
        const currentImgCount = document.querySelectorAll('img[src]').length;
        
        if (currentImgCount === window.mediaExtractorState.lazy.lastImgCount) {
          window.mediaExtractorState.lazy.stabilityCounter++;
        } else {
          window.mediaExtractorState.lazy.stabilityCounter = 0;
          window.mediaExtractorState.lazy.lastImgCount = currentImgCount;
        }
        
        // Determine if extraction is ready
        const readyForExtraction = 
          window.mediaExtractorState.lazy.stabilityCounter >= 3 || 
          window.mediaExtractorState.lazy.scrollAttempts >= 15;
        
        if (readyForExtraction) {
          reportProgress("Content stabilized, ready for extraction");
          
          // Proceed with extraction
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'READY_FOR_EXTRACTION'
          }));
          
          return true;
        } else {
          // Not ready yet, continue scrolling
          const scrollPositions = generateScrollPositions();
          const scrollIndex = window.mediaExtractorState.lazy.scrollAttempts % scrollPositions.length;
          
          window.scrollTo(0, scrollPositions[scrollIndex]);
          
          // Schedule next check
          setTimeout(triggerLazyLoading, 500);
        }
      }
      
      // Start the process
      reportProgress("Starting page preparation");
      handleYouTubeElements();
      triggerLazyLoading();
      
      return true;
    })();
  `

  // Extraction script that will run in the webpage context
  const extractionScript = `
    (function() {
      if (window.mediaExtractorState.extractionStarted) {
        return true;
      }
      
      window.mediaExtractorState.extractionStarted = true;
      
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

      // Check if URL is valid for extraction
      const isValidUrl = (url) => {
        if (!url) return false;
        if (url.startsWith('data:')) return false;
        if (url.startsWith('blob:')) return false;
        if (url.length < 5) return false;
        return true;
      };

      // Start collecting media
      const mediaItems = [];
      const processedUrls = new Set();
      
      // Function to extract media
      function extractAllMedia() {
        const isYouTube = window.location.href.includes('youtube.com');
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'EXTRACTION_PROGRESS',
          message: "Extracting media items"
        }));
        
        // 1. Handle standard images
        document.querySelectorAll('img').forEach(img => {
          try {
            // Get the best source available
            let sources = [
              img.currentSrc,
              img.src,
              img.getAttribute('data-src'),
              img.getAttribute('data-lazy-src'),
              img.getAttribute('data-original'),
              img.getAttribute('data-thumb'),
              img.getAttribute('data-bg')
            ];
            
            // For YouTube, check specific attributes
            if (isYouTube) {
              sources.push(img.getAttribute('data-ytimg'));
              
              // If it's a thumbnail, try to get the maxresdefault version
              if (img.src && img.src.includes('hqdefault.jpg')) {
                sources.push(img.src.replace('hqdefault.jpg', 'maxresdefault.jpg'));
              }
            }
            
            // Filter out invalid sources
            const validSources = sources.filter(src => isValidUrl(src));
            
            // Process each valid source
            validSources.forEach(src => {
              if (!processedUrls.has(src)) {
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
            });
            
            // Handle srcset if available
            if (img.srcset) {
              const srcsets = img.srcset.split(',');
              srcsets.forEach(srcset => {
                const parts = srcset.trim().split(' ');
                if (parts.length >= 1) {
                  const srcUrl = parts[0];
                  if (isValidUrl(srcUrl) && !processedUrls.has(srcUrl)) {
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
          } catch (e) {
            // Continue with next image
          }
        });

        // 2. Background images
        try {
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
                    if (isValidUrl(url) && !processedUrls.has(url)) {
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
              
              // Check pseudo-elements
              const pseudoElements = [':before', ':after'];
              pseudoElements.forEach(pseudo => {
                try {
                  const pseudoStyle = window.getComputedStyle(element, pseudo);
                  const bgImage = pseudoStyle.backgroundImage;
                  
                  if (bgImage && bgImage !== 'none') {
                    const matches = bgImage.match(/url\\(['"]?([^'"()]+)['"]?\\)/g);
                    if (matches) {
                      matches.forEach(match => {
                        const url = match.replace(/url\\(['"]?([^'"()]+)['"]?\\)/, '$1');
                        if (isValidUrl(url) && !processedUrls.has(url)) {
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
                  // Skip this pseudo-element if there's an error
                }
              });
            } catch (e) {
              // Skip this element if there's an error
            }
          }
        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'EXTRACTION_PROGRESS',
            message: "Error extracting background images: " + e.message
          }));
        }

        // 3. Videos
        try {
          document.querySelectorAll('video').forEach(video => {
            if (video.src && isValidUrl(video.src) && !processedUrls.has(video.src)) {
              processedUrls.add(video.src);
              mediaItems.push({
                url: video.src,
                type: 'video',
                filename: sanitizeFilename(video.src, 'video'),
                format: 'standard'
              });
            }
            
            if (video.poster && isValidUrl(video.poster) && !processedUrls.has(video.poster)) {
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
              if (source.src && isValidUrl(source.src) && !processedUrls.has(source.src)) {
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
        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'EXTRACTION_PROGRESS',
            message: "Error extracting videos: " + e.message
          }));
        }
        
        // 4. Audio elements
        try {
          document.querySelectorAll('audio').forEach(audio => {
            if (audio.src && isValidUrl(audio.src) && !processedUrls.has(audio.src)) {
              processedUrls.add(audio.src);
              mediaItems.push({
                url: audio.src,
                type: 'audio',
                filename: sanitizeFilename(audio.src, 'audio'),
                format: 'standard'
              });
            }
            
            audio.querySelectorAll('source').forEach(source => {
              if (source.src && isValidUrl(source.src) && !processedUrls.has(source.src)) {
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
        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'EXTRACTION_PROGRESS',
            message: "Error extracting audio: " + e.message
          }));
        }
        
        // 5. YouTube-specific additional handling
        if (isYouTube) {
          try {
            // Extract channel logo and banner images
            const channelImages = document.querySelectorAll('#channel-header img, #channel-header-container img, #avatar img');
            channelImages.forEach(img => {
              const src = img.src || img.getAttribute('data-src');
              if (isValidUrl(src) && !processedUrls.has(src)) {
                processedUrls.add(src);
                const filename = sanitizeFilename(src, 'image');
                mediaItems.push({
                  url: src,
                  type: 'image',
                  filename,
                  format: getFormatFromFilename(filename)
                });
              }
            });
          } catch (e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'EXTRACTION_PROGRESS',
              message: "Error in YouTube-specific handling: " + e.message
            }));
          }
        }
        
        // 6. Iframes with video embeds
        try {
          const videoProviders = [
            'youtube.com/embed',
            'youtube-nocookie.com/embed',
            'player.vimeo.com',
            'dailymotion.com/embed',
            'facebook.com/plugins/video'
          ];
          
          document.querySelectorAll('iframe').forEach(iframe => {
            const src = iframe.src;
            if (isValidUrl(src) && !processedUrls.has(src)) {
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
        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'EXTRACTION_PROGRESS',
            message: "Error extracting iframe embeds: " + e.message
          }));
        }
        
        // Send back the extracted media items
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'EXTRACTION_RESULT',
          data: mediaItems,
          stats: {
            totalItems: mediaItems.length,
            imageCount: mediaItems.filter(item => item.type === 'image').length,
            videoCount: mediaItems.filter(item => item.type === 'video').length,
            audioCount: mediaItems.filter(item => item.type === 'audio').length
          }
        }));
      }
      
      // Start the extraction process
      extractAllMedia();
      
      return true;
    })();
  `

  // Handle messages from WebView
  const onMessage = event => {
    try {
      const message = JSON.parse(event.nativeEvent.data)

      switch (message.type) {
        case "PAGE_LOADED":
          // Start preparation after initial load with a short delay
          setTimeout(() => {
            webViewRef.current?.injectJavaScript(preparationScript)
          }, 500)
          break

        case "EXTRACTION_PROGRESS":
          // Handle progress updates (useful for debugging)
          console.log(`Extraction progress: ${message.message}`)
          break

        case "READY_FOR_EXTRACTION":
          // When the page is ready, start the actual extraction
          if (!isExtracting) {
            setIsExtracting(true)
            webViewRef.current?.injectJavaScript(extractionScript)
          }
          break

        case "EXTRACTION_RESULT":
          // Handle the final extraction results
          if (onMediaExtracted) {
            onMediaExtracted(message.data)
          }
          break

        default:
          // Ignore unknown message types
          break
      }
    } catch (e) {
      const errorMsg = `Failed to parse message: ${e.message}`
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

  // When the page initially loads, set up a fallback extraction timer
  // This ensures extraction happens even if some events don't fire correctly
  const handleLoadEnd = event => {
    // Call the original onLoadEnd callback if provided
    if (onLoadEnd) {
      onLoadEnd(event)
    }

    // Set up a fallback timer to ensure extraction happens
    if (extractionTimeoutRef.current) {
      clearTimeout(extractionTimeoutRef.current)
    }

    extractionTimeoutRef.current = setTimeout(() => {
      if (!isExtracting) {
        setIsExtracting(true)

        // Force start extraction if it hasn't started yet
        webViewRef.current?.injectJavaScript(`
          // Ensure we've triggered lazy loading
          if (!window.mediaExtractorState || !window.mediaExtractorState.preparingForExtraction) {
            ${preparationScript}
          }
          
          // Wait a bit and then force extraction
          setTimeout(function() {
            ${extractionScript}
          }, 2000);
          
          true;
        `)
      }
    }, extractionDelay) // Use the configurable delay
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
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        onMessage={onMessage}
        injectedJavaScript={initialScript}
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
