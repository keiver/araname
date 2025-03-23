import React, {useEffect, useState, useCallback, forwardRef, useImperativeHandle, useRef} from "react"
import {Platform, StyleSheet, useColorScheme, View} from "react-native"
import mobileAds, {BannerAd, BannerAdSize, TestIds, InterstitialAd, AdEventType} from "react-native-google-mobile-ads"
import AsyncStorage from "@react-native-async-storage/async-storage"
import useIAP from "./usePurchaseManager"

// Ad unit IDs, keeping as is
const PRODUCTION_BANNER_ID = Platform.select({
  ios: "ca-app-pub-6899536859351708/1504976759",
  android: "ca-app-pub-6899536859351708/5225833566"
}) as string

const PRODUCTION_INTERSTITIAL_ID = Platform.select({
  ios: "ca-app-pub-6899536859351708/7284783017",
  android: "ca-app-pub-6899536859351708/6718878636"
}) as string

interface AdBannerProps {
  onError?: (error: Error) => void
  onAdLoaded?: () => void
  onInterstitialClosed?: () => void
  onInterstitialShown?: () => void
  interstitial?: boolean
}

// Define the ref interface
export interface AdBannerRef {
  showInterstitial: () => Promise<boolean>
}

export const initializeAds = async () => {
  try {
    await mobileAds().setRequestConfiguration({
      testDeviceIdentifiers: []
    })
    await mobileAds().initialize()
    return true
  } catch (error) {
    console.error("Mobile Ads initialization failed:", error)
    return false
  }
}

const AdBanner = forwardRef<AdBannerRef, AdBannerProps>((props, ref) => {
  const {onError, onAdLoaded, onInterstitialClosed, onInterstitialShown, interstitial} = props
  const [isAdsInitialized, setIsAdsInitialized] = useState(false)
  const theme = useColorScheme()
  const adRef = React.useRef<BannerAd | null>(null)

  // Interstitial ad references and state
  const interstitialRef = useRef<InterstitialAd | null>(null)
  const isLoadingInterstitialRef = useRef(false)
  const isShowingInterstitialRef = useRef(false)
  const unsubscribeFunctionsRef = useRef<Array<() => void>>([])
  const [isInterstitialReady, setIsInterstitialReady] = useState(false)

  const {hasNoAds, isCheckingPurchases} = useIAP()

  // Determine ad unit IDs based on environment
  const bannerAdUnitId = __DEV__ ? TestIds.BANNER : PRODUCTION_BANNER_ID
  const interstitialAdUnitId = __DEV__ ? TestIds.INTERSTITIAL : PRODUCTION_INTERSTITIAL_ID

  // Add a helper function to force interstitial cleanup
  const forceInterstitialCleanup = useCallback(() => {
    if (isShowingInterstitialRef.current) {
      console.log("Forcing interstitial cleanup")
      isShowingInterstitialRef.current = false
      setIsInterstitialReady(false)

      // Make sure the callback is called
      if (onInterstitialClosed) {
        console.log("Calling onInterstitialClosed callback")
        onInterstitialClosed()
      }

      // Load a new ad after a brief delay
      setTimeout(() => {
        loadInterstitialAd()
      }, 1000)
    }
  }, [onInterstitialClosed])

  // Cleanup interstitial ad event listeners
  const cleanupInterstitialListeners = useCallback(() => {
    if (unsubscribeFunctionsRef.current.length > 0) {
      unsubscribeFunctionsRef.current.forEach(unsubscribe => unsubscribe())
      unsubscribeFunctionsRef.current = []
    }
  }, [])

  // Load interstitial ad
  // In AdBanner.tsx - Update your loadInterstitialAd function

  const loadInterstitialAd = useCallback(() => {
    // Skip if already loading, showing, ads not initialized, or premium user
    if (
      isLoadingInterstitialRef.current ||
      isShowingInterstitialRef.current ||
      !isAdsInitialized ||
      hasNoAds ||
      isCheckingPurchases
    ) {
      return
    }

    // Mark as loading
    isLoadingInterstitialRef.current = true

    // Reset ready state
    setIsInterstitialReady(false)

    // Clean up existing listeners
    cleanupInterstitialListeners()

    // Add a delay before creating the ad to ensure JavaScriptEngine is ready
    setTimeout(() => {
      try {
        console.log("Creating and loading new interstitial ad")

        // Create new ad
        const ad = InterstitialAd.createForAdRequest(interstitialAdUnitId, {
          requestNonPersonalizedAdsOnly: true,
          keywords: ["game", "memory", "puzzle", "egypt"]
        })

        // Set up event listeners
        const loadedUnsubscribe = ad.addAdEventListener(AdEventType.LOADED, () => {
          console.log("Interstitial loaded")
          isLoadingInterstitialRef.current = false
          setIsInterstitialReady(true)
        })
        unsubscribeFunctionsRef.current.push(loadedUnsubscribe)

        // Rest of your event listeners...

        // Store reference and load
        interstitialRef.current = ad
        ad.load()
      } catch (error) {
        console.error("Error creating interstitial:", error)
        isLoadingInterstitialRef.current = false
        setIsInterstitialReady(false)

        // Try again after error
        setTimeout(() => {
          loadInterstitialAd()
        }, 5000)
      }
    }, 1500) // Add a 1.5 second delay before attempting to create the ad
  }, [
    isAdsInitialized,
    hasNoAds,
    isCheckingPurchases,
    interstitialAdUnitId,
    onInterstitialClosed,
    cleanupInterstitialListeners
  ])

  // Show interstitial ad if available - improved version
  const showInterstitial = useCallback(async (): Promise<boolean> => {
    // Check if we can show the ad
    if (!interstitialRef.current || !isInterstitialReady || isShowingInterstitialRef.current || hasNoAds) {
      console.log("Cannot show interstitial:", {
        hasAd: !!interstitialRef.current,
        isReady: isInterstitialReady,
        isShowing: isShowingInterstitialRef.current,
        hasNoAds
      })

      // Start loading for next time
      if (!isLoadingInterstitialRef.current && !hasNoAds) {
        loadInterstitialAd()
      }

      return false
    }

    try {
      // Mark as showing
      isShowingInterstitialRef.current = true

      console.log("Showing interstitial ad")
      interstitialRef.current.show()
      onInterstitialShown?.()

      // Add safety timeout in case the close event doesn't fire
      setTimeout(() => {
        if (isShowingInterstitialRef.current) {
          console.log("Safety timeout: Interstitial ad might not have closed properly, forcing cleanup")
          forceInterstitialCleanup()
        }
      }, 15000) // 15 second safety timeout

      return true
    } catch (error) {
      console.error("Failed to show interstitial:", error)
      isShowingInterstitialRef.current = false
      setIsInterstitialReady(false)

      // Try to load a new ad after failure
      setTimeout(() => {
        loadInterstitialAd()
      }, 1000)

      return false
    }
  }, [isInterstitialReady, hasNoAds, onInterstitialShown, loadInterstitialAd, forceInterstitialCleanup])

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    showInterstitial
  }))

  // Initialize ads and setup
  useEffect(() => {
    const initialize = async () => {
      const initialized = await initializeAds()
      setIsAdsInitialized(initialized)
    }

    initialize()

    // Cleanup on unmount
    return () => {
      cleanupInterstitialListeners()
    }
  }, [cleanupInterstitialListeners])

  // Load initial interstitial when ads are initialized
  useEffect(() => {
    if (
      isAdsInitialized &&
      !hasNoAds &&
      !isCheckingPurchases &&
      !isInterstitialReady &&
      !isLoadingInterstitialRef.current
    ) {
      loadInterstitialAd()
    }
  }, [isAdsInitialized, hasNoAds, isCheckingPurchases, isInterstitialReady, loadInterstitialAd])

  // Debug effect to monitor state changes
  useEffect(() => {
    console.log("Interstitial state updated:", {
      isReady: isInterstitialReady,
      isLoading: isLoadingInterstitialRef.current,
      isShowing: isShowingInterstitialRef.current
    })
  }, [isInterstitialReady])

  if (!isAdsInitialized) {
    return null
  }

  // don't show banner for interstitial ads
  if (interstitial) {
    return null
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: "transparent",
          borderRadius: 0
        }
      ]}
    >
      <BannerAd
        ref={adRef}
        size={BannerAdSize.BANNER}
        unitId={bannerAdUnitId}
        onAdLoaded={() => {
          console.log("Banner ad loaded successfully")
          onAdLoaded?.()
        }}
        onAdFailedToLoad={error => {
          console.warn("Banner ad failed to load:", error)
          onError?.(error)
        }}
      />
    </View>
  )
})

// For better debugging in React DevTools
AdBanner.displayName = "AdBanner"

// Create a hook to use the interstitial ad functionality
export const useInterstitialAd = ({
  isAdsInitialized = true,
  hasNoAds = false,
  isCheckingPurchases = false,
  onInterstitialClosed,
  onInterstitialShown
}: {
  isAdsInitialized?: boolean
  hasNoAds?: boolean
  isCheckingPurchases?: boolean
  onInterstitialClosed?: () => void
  onInterstitialShown?: () => void
}): {isInterstitialLoaded: boolean; showInterstitialAd: () => boolean} => {
  const [interstitialAd, setInterstitialAd] = useState<InterstitialAd | null>(null)
  const [isInterstitialLoaded, setIsInterstitialLoaded] = useState(false)

  // Using refs for flags that don't need to trigger re-renders
  const isLoadingRef = useRef(false)
  const isShowingRef = useRef(false)
  const eventListenersRef = useRef<Array<() => void>>([])

  // Determine ad unit ID based on environment
  const interstitialAdUnitId = __DEV__ ? TestIds.INTERSTITIAL : PRODUCTION_INTERSTITIAL_ID

  // Clean up existing ad event listeners
  const cleanupAdEventListeners = useCallback(() => {
    if (eventListenersRef.current.length > 0) {
      eventListenersRef.current.forEach(unsubscribe => unsubscribe())
      eventListenersRef.current = []
    }
  }, [])

  // Initialize and load interstitial ad
  const loadInterstitialAd = useCallback(() => {
    // Skip load if any of these conditions are true
    if (isLoadingRef.current || isShowingRef.current || hasNoAds || !isAdsInitialized) {
      return
    }

    // Set loading flag
    isLoadingRef.current = true

    // Clean up existing ad
    cleanupAdEventListeners()
    setInterstitialAd(null)

    // Create new ad
    try {
      const ad = InterstitialAd.createForAdRequest(interstitialAdUnitId, {
        requestNonPersonalizedAdsOnly: true,
        keywords: ["game", "memory", "puzzle", "egypt"]
      })

      // Store the new ad reference
      setInterstitialAd(ad)

      // Set up event listeners
      const onLoadedUnsubscribe = ad.addAdEventListener(AdEventType.LOADED, () => {
        isLoadingRef.current = false
        setIsInterstitialLoaded(true)
      })
      eventListenersRef.current.push(onLoadedUnsubscribe)

      // Add opened event listener
      const onOpenedUnsubscribe = ad.addAdEventListener(AdEventType.OPENED, () => {
        console.log("Interstitial opened via hook")
        isShowingRef.current = true
      })
      eventListenersRef.current.push(onOpenedUnsubscribe)

      const onClosedUnsubscribe = ad.addAdEventListener(AdEventType.CLOSED, () => {
        console.log("Interstitial closed via hook")
        setIsInterstitialLoaded(false)
        isShowingRef.current = false

        if (onInterstitialClosed) {
          console.log("Calling onInterstitialClosed callback")
          onInterstitialClosed()
        }

        // Start loading a new ad after the current one closes
        setTimeout(() => {
          loadInterstitialAd()
        }, 1000)
      })
      eventListenersRef.current.push(onClosedUnsubscribe)

      const onErrorUnsubscribe = ad.addAdEventListener(AdEventType.ERROR, error => {
        console.error("Interstitial ad error:", error)
        isLoadingRef.current = false
        isShowingRef.current = false // Reset on error
        setIsInterstitialLoaded(false)

        // Try to load again after an error
        setTimeout(() => {
          loadInterstitialAd()
        }, 5000)
      })
      eventListenersRef.current.push(onErrorUnsubscribe)

      // Start loading
      ad.load()
    } catch (error) {
      console.error("Error creating interstitial ad:", error)
      isLoadingRef.current = false
      isShowingRef.current = false // Reset on error

      // Try again after error
      setTimeout(() => {
        loadInterstitialAd()
      }, 5000)
    }
  }, [isAdsInitialized, interstitialAdUnitId, onInterstitialClosed, hasNoAds, cleanupAdEventListeners])

  // Show interstitial ad with improved safety mechanisms
  const showInterstitialAd = useCallback((): boolean => {
    // Prevent showing if any of these conditions are true
    if (!isInterstitialLoaded || !interstitialAd || isShowingRef.current || hasNoAds) {
      if (!isLoadingRef.current && !hasNoAds) {
        // If ad not loaded and not already loading, try to load one
        loadInterstitialAd()
      }
      return false
    }

    try {
      // Set flag to prevent concurrent show attempts
      isShowingRef.current = true

      // Show the ad
      interstitialAd.show()
      onInterstitialShown?.()

      // Add safety timeout
      setTimeout(() => {
        if (isShowingRef.current) {
          console.log("Safety timeout: Interstitial might be stuck in shown state, forcing cleanup")
          isShowingRef.current = false
          setIsInterstitialLoaded(false)

          if (onInterstitialClosed) {
            console.log("Calling onInterstitialClosed callback from safety timeout")
            onInterstitialClosed()
          }

          // Try to load a new ad
          setTimeout(() => {
            loadInterstitialAd()
          }, 1000)
        }
      }, 15000) // 15 second safety timeout

      return true
    } catch (error) {
      console.error("Failed to show interstitial ad:", error)
      isShowingRef.current = false
      setIsInterstitialLoaded(false)

      // Try to load a new ad after failure
      setTimeout(() => {
        loadInterstitialAd()
      }, 1000)

      return false
    }
  }, [isInterstitialLoaded, interstitialAd, hasNoAds, onInterstitialShown, onInterstitialClosed, loadInterstitialAd])

  // Load initial ad when ads are initialized
  useEffect(() => {
    if (isAdsInitialized && !hasNoAds && !isCheckingPurchases && !isLoadingRef.current) {
      loadInterstitialAd()
    }
  }, [isAdsInitialized, hasNoAds, isCheckingPurchases, loadInterstitialAd])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAdEventListeners()
    }
  }, [cleanupAdEventListeners])

  return {
    isInterstitialLoaded,
    showInterstitialAd
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 50
  }
})

export default AdBanner
