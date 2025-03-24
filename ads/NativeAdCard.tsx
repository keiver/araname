import React, {useEffect, useState, useRef} from "react"
import {StyleSheet, View, Text, Platform, useColorScheme} from "react-native"
import {
  TestIds,
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView
} from "react-native-google-mobile-ads"
import useIAP from "./usePurchaseManager"

// Ad prod unit IDs, ready
const PRODUCTION_NATIVE_AD_ID = Platform.select({
  ios: "ca-app-pub-6899536859351708/1308232291", // DONE araname
  android: "ca-app-pub-6899536859351708/2113013667" // DONE araname
}) as string

// Use the correct test ID
const TEST_NATIVE_AD_ID = TestIds.NATIVE

interface NativeAdCardProps {
  itemWidth: number
  itemHeight: number
  onAdLoaded?: () => void
  onAdError?: (error: Error) => void
}

const NativeAdCard: React.FC<NativeAdCardProps> = ({itemWidth, itemHeight, onAdLoaded, onAdError}) => {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const theme = useColorScheme()
  const adUnitId = __DEV__ ? TEST_NATIVE_AD_ID : PRODUCTION_NATIVE_AD_ID
  const {hasNoAds, isCheckingPurchases} = useIAP()
  const adLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  // Force dimensions to be at least 120x120 for MediaView to ensure compliance
  const actualWidth = Math.max(itemWidth, 120)
  const actualHeight = Math.max(itemHeight, 160)

  // Calculate media height (total height minus space for info container)
  const mediaHeight = actualHeight - 150 // 50px for info container approximate height

  useEffect(() => {
    isMountedRef.current = true

    // Don't attempt to load ads if user has purchased no ads
    if (hasNoAds && !isCheckingPurchases) {
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

    // Create and load native ad in a non-blocking way
    const loadAd = async () => {
      try {
        const ad = await NativeAd.createForAdRequest(adUnitId, {
          requestNonPersonalizedAdsOnly: true,
          keywords: ["gallery", "photo", "camera", "edit"]
        })

        if (isMountedRef.current) {
          setNativeAd(ad)
          setIsLoading(false)

          if (onAdLoaded) {
            onAdLoaded()
          }

          // Clear timeout if ad loaded successfully
          if (adLoadTimeoutRef.current) {
            clearTimeout(adLoadTimeoutRef.current)
          }
        }
      } catch (error) {
        console.error("Failed to create native ad:", error)
        if (isMountedRef.current) {
          setIsLoading(false)

          if (onAdError) {
            onAdError(error instanceof Error ? error : new Error(String(error)))
          }

          // Clear timeout if ad failed to load
          if (adLoadTimeoutRef.current) {
            clearTimeout(adLoadTimeoutRef.current)
          }
        }
      }
    }

    // Use requestAnimationFrame to ensure UI updates before starting ad load
    requestAnimationFrame(() => {
      loadAd()
    })

    // Cleanup function
    return () => {
      isMountedRef.current = false

      if (adLoadTimeoutRef.current) {
        clearTimeout(adLoadTimeoutRef.current)
      }

      if (nativeAd) {
        nativeAd.destroy()
      }
    }
  }, [adUnitId, onAdLoaded, onAdError, hasNoAds, isCheckingPurchases])

  // Don't render anything if conditions aren't met
  if (isLoading || !nativeAd || hasNoAds || isCheckingPurchases) {
    return null
  }

  return (
    <NativeAdView
      style={[
        styles.container,
        {
          width: actualWidth,
          height: actualHeight,
          backgroundColor: "#2a2a2a",
          borderRadius: 23,
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: 2
          },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 1
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
            marginLeft: -2,
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
  )
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: "#3D3D3D21",
    borderRadius: 23,
    overflow: Platform.OS === "android" ? "visible" : "hidden",
    marginRight: 12,
    marginBottom: 12
  },
  mediaContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 53,
    backgroundColor: "#2a2a2a"
    // overflow: "hidden"
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
    paddingRight: 24, // Space for AD badge
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

export default NativeAdCard
