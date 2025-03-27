import React, {useEffect, useState, useRef} from "react"
import {StyleSheet, View, Text, Platform, useColorScheme, findNodeHandle} from "react-native"
import {NativeAd, NativeAdView, NativeAsset, NativeAssetType, NativeMediaView} from "react-native-google-mobile-ads"
import AdManager from "./AdManager"
import useIAP from "./usePurchaseManager"

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
  const cardRef = useRef<View>(null)
  const lastVisibilityRef = useRef<boolean>(false)
  const lastViewableAreaRef = useRef<number>(0)

  // Ensure minimum dimensions for AdMob requirements
  const actualWidth = Math.max(itemWidth, 120)
  const actualHeight = Math.max(itemHeight, 160)
  const mediaHeight = actualHeight - 150

  // Effect to handle props updates for visibility
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
  }, [isVisible, viewableArea, nativeAd, adId, onViewabilityChange])

  // This effect handles ad loading and cleanup
  useEffect(() => {
    isMountedRef.current = true

    // Skip ad loading if user has premium or we're checking purchase status
    if (hasNoAds || isCheckingPurchases) {
      return
    }

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

    // Use a delay to prevent loading all ads at once when scrolling
    const loadAdWithDelay = async () => {
      // Random delay between 100-500ms to stagger loads
      const delay = Math.floor(Math.random() * 400) + 100
      await new Promise(resolve => setTimeout(resolve, delay))

      if (!isMountedRef.current) return

      try {
        // Get a native ad from the manager
        const {ad, adId: newAdId} = await adManager.getNativeAd()

        if (!isMountedRef.current) {
          // Component unmounted while we were loading
          if (ad) ad.destroy()
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

          // Initialize visibility tracking with current state
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

    return () => {
      isMountedRef.current = false

      if (adLoadTimeoutRef.current) {
        clearTimeout(adLoadTimeoutRef.current)
      }

      // Clean up the ad when unmounting
      if (nativeAd) {
        nativeAd.destroy()
      }

      // Unregister from visibility tracking
      if (adId) {
        adManager.trackAdVisibility(adId, false, 0)
      }
    }
  }, [hasNoAds, isCheckingPurchases, onAdLoaded, onAdError])

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
            width: actualWidth,
            height: actualHeight,
            backgroundColor: "#2a2a2a",
            borderRadius: 23
          }
        ]}
        nativeAd={nativeAd}
      >
        <View style={[styles.mediaContainer, {height: mediaHeight}]}>
          <NativeMediaView
            style={{
              width: actualWidth - 10,
              height: mediaHeight - 10,
              backgroundColor: "transparent"
            }}
          />
        </View>

        <View
          style={[
            styles.infoContainer,
            {
              backgroundColor: theme === "dark" ? "#C1C1C1B4" : "#FFFFFFE3",
              width: actualWidth + 1,
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

export default React.memo(EnhancedNativeAdCard)
