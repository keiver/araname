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
  isVisible = false,
  viewableArea = 0,
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
  const lastVisibilityRef = useRef<boolean>(false)
  const lastViewableAreaRef = useRef<number>(0)
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
  // It should not re-run when visibility changes
  useEffect(() => {
    isMountedRef.current = true

    // Get a reference to the visibility tracker
    visibilityTrackerRef.current = AdVisibilityTracker.getInstance()

    // Only load an ad once per component lifecycle
    if (hasLoadedAdRef.current) {
      return
    }

    // Skip ad loading if user has premium or we're checking purchase status
    if (hasNoAds || isCheckingPurchases) {
      return
    }

    hasLoadedAdRef.current = true
    setIsLoading(true)

    // Add a timeout to prevent waiting too long for ad loading
    adLoadTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setIsLoading(false)
        if (onAdError) {
          onAdError(new Error("Ad loading timeout"))
        }
      }
    }, 10000) // 10 second timeout

    // Load ad with a random delay to prevent too many simultaneous loads
    const loadAdWithDelay = async () => {
      try {
        // Random delay between 100-500ms to stagger loads
        const delay = Math.floor(Math.random() * 400) + 100
        await new Promise(resolve => setTimeout(resolve, delay))

        if (!isMountedRef.current) return

        // Get a native ad from the manager, using the cache key
        const {ad, adId: newAdId} = await adManager.getNativeAd(cacheKey)

        if (!isMountedRef.current) {
          // Component unmounted while we were loading
          // Don't destroy the ad - it's now cached
          return
        }

        if (ad) {
          setNativeAd(ad)
          setAdId(newAdId)
          setIsLoading(false)

          if (onAdLoaded) onAdLoaded()

          // Clear timeout if ad loaded successfully
          if (adLoadTimeoutRef.current) {
            clearTimeout(adLoadTimeoutRef.current)
          }

          // If ad is already visible when loaded, initialize tracking
          if (isVisible) {
            adManager.trackAdVisibility(newAdId, isVisible, viewableArea)
            lastVisibilityRef.current = isVisible
            lastViewableAreaRef.current = viewableArea
          }
        } else {
          setIsLoading(false)
          if (onAdError) onAdError(new Error("Failed to load ad"))
        }
      } catch (error) {
        if (isMountedRef.current) {
          setIsLoading(false)
          if (onAdError) onAdError(error instanceof Error ? error : new Error(String(error)))

          // Clear timeout if ad failed to load
          if (adLoadTimeoutRef.current) {
            clearTimeout(adLoadTimeoutRef.current)
          }
        }
      }
    }

    loadAdWithDelay()

    // Cleanup function
    return () => {
      isMountedRef.current = false

      if (adLoadTimeoutRef.current) {
        clearTimeout(adLoadTimeoutRef.current)
      }

      // Don't destroy the ad - it's now cached in the AdManager

      // Unregister from visibility tracking
      if (adId) {
        adManager.trackAdVisibility(adId, false, 0)
      }

      if (visibilityTrackerRef.current) {
        visibilityTrackerRef.current.release()
        visibilityTrackerRef.current = null
      }
    }
  }, [hasNoAds, isCheckingPurchases, onAdLoaded, onAdError, adManager]) // removed isVisible and viewableArea

  // Show nothing while loading or if premium user
  if (isLoading || !nativeAd || hasNoAds || isCheckingPurchases) {
    return null
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
    backgroundColor: "#FFC814FF",
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
    backgroundColor: "#FFC814FF",
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

export default React.memo(EnhancedNativeAdCard, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  // Only re-render if width/height/testID changes, ignore visibility changes
  return (
    prevProps.itemWidth === nextProps.itemWidth &&
    prevProps.itemHeight === nextProps.itemHeight &&
    prevProps.testID === nextProps.testID
  )
})
