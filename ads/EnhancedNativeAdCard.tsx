import React, {useEffect, useState, useRef, useMemo} from "react"
import {StyleSheet, View, Text, Platform, useColorScheme, findNodeHandle} from "react-native"
import {NativeAd, NativeAdView, NativeAsset, NativeAssetType, NativeMediaView} from "react-native-google-mobile-ads"
import AdManager from "./AdManager"
import useIAP from "./usePurchaseManager"
import AdVisibilityTracker from "./AdVisibilityTracker"

interface EnhancedNativeAdCardProps {
  itemWidth: number
  itemHeight: number
  onAdLoaded?: () => void
  onAdError?: (error: Error) => void
  onViewabilityChange?: (viewable: boolean, viewableArea: number) => void
  isVisible?: boolean // Pass from parent's viewability tracking
  viewableArea?: number // Percentage of ad that's visible (0-1)
  testID?: string
}

const EnhancedNativeAdCard: React.FC<EnhancedNativeAdCardProps> = ({
  itemWidth,
  itemHeight,
  onAdLoaded,
  onAdError,
  onViewabilityChange,
  isVisible = true, // Default to true for initial rendering
  viewableArea = 1.0, // Default to fully visible
  testID
}) => {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null)
  const [adId, setAdId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const theme = useColorScheme()
  const {hasNoAds, isCheckingPurchases} = useIAP()
  const isMountedRef = useRef(true)
  const adLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const adManager = AdManager.getInstance()
  const cardRef = React.createRef<View>()
  const lastVisibilityRef = useRef<boolean>(true) // Initialize as visible
  const lastViewableAreaRef = useRef<number>(1.0) // Initialize as fully visible
  const hasLoadedAdRef = useRef<boolean>(false)
  const visibilityTrackerRef = useRef<AdVisibilityTracker | null>(null)

  const cacheKey = useMemo(() => {
    // Use the testID as the cache key if provided
    return testID || `ad-card-${itemWidth}-${itemHeight}`
  }, [testID, itemWidth, itemHeight])

  // Ensure minimum dimensions for AdMob requirements - memoized for performance
  const dimensions = useMemo(() => {
    const actualWidth = Math.max(itemWidth, 120)
    const actualHeight = Math.max(itemHeight, 160)
    const mediaHeight = actualHeight - 150

    return {actualWidth, actualHeight, mediaHeight}
  }, [itemWidth, itemHeight])

  // Effect to handle ONLY visibility tracking, separate from ad loading
  useEffect(() => {
    // Only track visibility when we have a loaded ad
    if (nativeAd && adId && (isVisible !== lastVisibilityRef.current || viewableArea !== lastViewableAreaRef.current)) {
      console.log(`[EnhancedNativeAdCard] Visibility changed: ${adId}, visible=${isVisible}, area=${viewableArea}`)

      // Track the new visibility state
      adManager.trackAdVisibility(adId, isVisible, viewableArea)

      // Update refs to remember the last tracked state
      lastVisibilityRef.current = isVisible
      lastViewableAreaRef.current = viewableArea

      // Notify parent component if callback provided
      if (onViewabilityChange) {
        onViewabilityChange(isVisible, viewableArea)
      }
    }
  }, [isVisible, viewableArea, nativeAd, adId, onViewabilityChange, adManager])

  // This effect ONLY handles initial ad loading and cleanup
  useEffect(() => {
    console.log(`[EnhancedNativeAdCard] Component mounted: ${testID || "ad-card"}`)
    isMountedRef.current = true

    // Get a reference to the visibility tracker
    visibilityTrackerRef.current = AdVisibilityTracker.getInstance()

    // Skip if already loaded or premium user
    if (hasLoadedAdRef.current || hasNoAds || isCheckingPurchases) {
      return
    }

    console.log(`[EnhancedNativeAdCard] Initial load started: ${testID || "ad-card"}`)
    hasLoadedAdRef.current = true
    setIsLoading(true)

    // Add a timeout to prevent waiting too long for ad loading
    adLoadTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        console.log(`[EnhancedNativeAdCard] Ad loading timeout: ${testID || "ad-card"}`)
        setIsLoading(false)
        if (onAdError) {
          onAdError(new Error("Ad loading timeout"))
        }
      }
    }, 10000) // 10 second timeout

    // Load ad without delay to make sure it shows immediately
    const loadAd = async () => {
      try {
        if (!isMountedRef.current) return

        console.log(`[EnhancedNativeAdCard] Getting ad from manager: ${cacheKey}`)
        // Get a native ad from the manager, using the cache key
        const {ad, adId: newAdId} = await adManager.getNativeAd(cacheKey)

        if (!isMountedRef.current) {
          return
        }

        if (ad) {
          console.log(`[EnhancedNativeAdCard] Ad loaded successfully: ${newAdId}`)
          setNativeAd(ad)
          setAdId(newAdId)
          setIsLoading(false)

          if (onAdLoaded) onAdLoaded()

          // Clear timeout if ad loaded successfully
          if (adLoadTimeoutRef.current) {
            clearTimeout(adLoadTimeoutRef.current)
            adLoadTimeoutRef.current = null
          }

          // Force ad to be visible immediately
          console.log(`[EnhancedNativeAdCard] Forcing initial visibility: ${newAdId}`)
          adManager.trackAdVisibility(newAdId, true, 1.0)
          lastVisibilityRef.current = true
          lastViewableAreaRef.current = 1.0
        } else {
          console.log(`[EnhancedNativeAdCard] Failed to load ad: ${cacheKey}`)
          setIsLoading(false)
          if (onAdError) onAdError(new Error("Failed to load ad"))
        }
      } catch (error) {
        console.error(`[EnhancedNativeAdCard] Error loading ad:`, error)
        if (isMountedRef.current) {
          setIsLoading(false)
          if (onAdError) onAdError(error instanceof Error ? error : new Error(String(error)))

          // Clear timeout if ad failed to load
          if (adLoadTimeoutRef.current) {
            clearTimeout(adLoadTimeoutRef.current)
            adLoadTimeoutRef.current = null
          }
        }
      }
    }

    loadAd()

    // Cleanup function
    return () => {
      console.log(`[EnhancedNativeAdCard] Component unmounting: ${testID || "ad-card"}`)
      isMountedRef.current = false

      if (adLoadTimeoutRef.current) {
        clearTimeout(adLoadTimeoutRef.current)
        adLoadTimeoutRef.current = null
      }

      // Don't destroy the ad - it's cached in the AdManager

      // Unregister from visibility tracking
      if (adId) {
        adManager.trackAdVisibility(adId, false, 0)
      }

      if (visibilityTrackerRef.current) {
        visibilityTrackerRef.current.release()
        visibilityTrackerRef.current = null
      }
    }
  }, [hasNoAds, isCheckingPurchases, onAdLoaded, onAdError, adManager, cacheKey, testID]) // removed isVisible and viewableArea

  // Show a placeholder during loading instead of null
  if (isLoading || hasNoAds || isCheckingPurchases) {
    return (
      <View
        style={{
          width: dimensions.actualWidth,
          height: dimensions.actualHeight,
          backgroundColor: "#2a2a2a20",
          borderRadius: 23
        }}
      />
    )
  }

  // Don't render anything if no ad loaded
  if (!nativeAd) {
    return (
      <View
        style={{
          width: dimensions.actualWidth,
          height: dimensions.actualHeight,
          backgroundColor: "#2a2a2a10",
          borderRadius: 23
        }}
      />
    )
  }

  return (
    <View ref={cardRef} collapsable={false} testID={testID || "native-ad-card"}>
      <NativeAdView
        style={[
          styles.container,
          {
            width: dimensions.actualWidth,
            height: dimensions.actualHeight,
            backgroundColor: "#2a2a2a",
            borderRadius: 23
          }
        ]}
        nativeAd={nativeAd}
      >
        <View style={[styles.mediaContainer, {height: dimensions.mediaHeight}]}>
          <NativeMediaView
            style={{
              width: dimensions.actualWidth - 10,
              height: dimensions.mediaHeight - 10,
              backgroundColor: "transparent"
            }}
          />
        </View>

        <View
          style={[
            styles.infoContainer,
            {
              backgroundColor: theme === "dark" ? "#C1C1C1B4" : "#FFFFFFE3",
              width: dimensions.actualWidth + 1,
              marginLeft: -2, // Added this negative margin to match original
              position: "absolute",
              bottom: 0
            }
          ]}
        >
          <View style={styles.textContainer}>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text
                style={[styles.headline, {color: theme === "dark" ? "#F5F5F5C9" : "#212121E6"}]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {nativeAd.headline}
              </Text>
            </NativeAsset>

            <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
              <View style={styles.callToActionButton}>
                <Text style={styles.callToActionText} numberOfLines={1} ellipsizeMode="tail">
                  {nativeAd.callToAction}
                </Text>
              </View>
            </NativeAsset>
          </View>

          <View style={styles.adBadge}>
            <Text style={styles.adBadgeText}>AD</Text>
          </View>
        </View>
      </NativeAdView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: "#3D3D3D21",
    borderRadius: 23,
    overflow: Platform.OS === "android" ? "visible" : "hidden",
    marginRight: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 1
  },
  mediaContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 53,
    backgroundColor: "#2a2a2a"
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    overflow: Platform.OS === "android" ? "visible" : "hidden",
    minHeight: 50
  },
  textContainer: {
    flex: 1,
    paddingBottom: 1,
    paddingRight: 24,
    paddingTop: 8,
    backgroundColor: "transparent"
  },
  headline: {
    fontSize: 14,
    fontWeight: "400"
  },
  callToActionButton: {
    backgroundColor: "#0EB2EEFF",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 42,
    marginTop: 14,
    alignSelf: "flex-start",
    height: 24
  },
  callToActionText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#2e282ae6"
  },
  adBadge: {
    backgroundColor: "#0EB2EEFF",
    paddingHorizontal: 4,
    paddingVertical: 2,
    justifyContent: "center",
    alignItems: "center",
    height: 16,
    borderRadius: 42
  },
  adBadgeText: {
    color: "#2e282ae6",
    fontSize: 8,
    fontWeight: "bold"
  }
})

// Modify memo comparison to include visibility props
export default React.memo(EnhancedNativeAdCard, (prevProps, nextProps) => {
  // Re-render if visibility changes
  if (prevProps.isVisible !== nextProps.isVisible || prevProps.viewableArea !== nextProps.viewableArea) {
    return false // Different props, should re-render
  }

  // Otherwise, only re-render if width/height/testID changes
  return (
    prevProps.itemWidth === nextProps.itemWidth &&
    prevProps.itemHeight === nextProps.itemHeight &&
    prevProps.testID === nextProps.testID
  )
})
