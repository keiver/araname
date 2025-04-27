import {Platform} from "react-native"
import {NativeAd, TestIds} from "react-native-google-mobile-ads"
import AdVisibilityTracker from "./AdVisibilityTracker"

// Ad unit IDs - using your existing production IDs
const PRODUCTION_NATIVE_AD_ID = Platform.select({
  ios: "ca-app-pub-6899536859351708/1308232291",
  android: "ca-app-pub-6899536859351708/2113013667"
}) as string

interface AdRequest {
  id: string
  timestamp: number
  onAdLoaded?: (ad: NativeAd) => void
  onAdError?: (error: Error) => void
  status: "pending" | "loading" | "loaded" | "error" | "displayed" | "impression_recorded"
  ad?: NativeAd
  visibilityData?: {
    isVisible: boolean
    viewableArea: number
    visibleSince?: number
    totalVisibleTime: number
  }
}

export default class AdManager {
  private static instance: AdManager | null = null
  private isInitialized: boolean = false
  private nativeAdPool: Map<string, NativeAd> = new Map()
  private adQueue: AdRequest[] = []
  private processingQueue: boolean = false
  private lastRequestTime: number = 0
  private activeRequests: number = 0
  private destroyed: boolean = false
  private visibilityTracker: AdVisibilityTracker
  private adInfoMap: Map<string, {adId: string; hasRecordedImpression: boolean; createdAt: number}> = new Map()
  private lastCleanupTime: number = Date.now()
  private adCache: Map<string, {ad: NativeAd; adId: string}> = new Map()
  private initialRenderIds: Set<string> = new Set() // Track IDs of ads in initial render

  // Configuration
  private adInterval: number = 50 // Show ad every 10 items (was 6)
  private requestThrottleMs: number = 2000 // 2 seconds between requests
  private maxConcurrentRequests: number = 1 // Only one request at a time
  private adPoolSize: number = 2 // Keep 2 ads preloaded (was 3)
  private maxQueueSize: number = 5 // Limit queue size
  private useTestAds: boolean = __DEV__

  private constructor() {
    console.log("[AdManager] Creating new AdManager instance")
    this.visibilityTracker = AdVisibilityTracker.getInstance()
    this.setupVisibilityListeners()
    this.initialize()
  }

  public static getInstance(): AdManager {
    if (!AdManager.instance) {
      AdManager.instance = new AdManager()
    }
    return AdManager.instance
  }

  private setupVisibilityListeners(): void {
    // Listen for impression events
    this.visibilityTracker.addImpressionListener(({adId}) => {
      console.log(`[AdManager] Impression recorded for ad: ${adId}`)

      // Find the ad request by adId and update its status
      const adKey = this.findAdKeyById(adId)
      if (adKey) {
        const adInfo = this.adInfoMap.get(adKey)
        if (adInfo) {
          adInfo.hasRecordedImpression = true
          this.adInfoMap.set(adKey, adInfo)
        }
      }
    })
  }

  private findAdKeyById(adId: string): string | undefined {
    for (const [key, info] of this.adInfoMap.entries()) {
      if (info.adId === adId) {
        return key
      }
    }
    return undefined
  }

  private async initialize(): Promise<boolean> {
    if (this.isInitialized) return true

    try {
      console.log("[AdManager] Initializing mobile ads")
      this.isInitialized = true
      console.log("[AdManager] Mobile ads initialized successfully")

      // Preload some ads for immediate use
      this.preloadNativeAds(2)

      return true
    } catch (error) {
      console.error("[AdManager] Failed to initialize mobile ads:", error)
      return false
    }
  }

  // Preload multiple native ads
  private preloadNativeAds(count: number): void {
    for (let i = 0; i < count; i++) {
      setTimeout(() => this.preloadNativeAd(), i * 1000)
    }
  }

  // Check if cleanup is needed and perform if necessary
  private checkAndCleanup(): void {
    // Clean up unused ads every 30 seconds
    if (Date.now() - this.lastCleanupTime > 30000) {
      this.cleanupUnusedAds()
      this.lastCleanupTime = Date.now()
    }
  }

  // Clean up ads that haven't been used
  private cleanupUnusedAds(): void {
    const now = Date.now()
    const THREE_MINUTES = 3 * 60 * 1000
    let count = 0

    for (const [adId, info] of this.adInfoMap.entries()) {
      // If ad hasn't recorded impression in 3 minutes, clean it up
      if (!info.hasRecordedImpression && now - info.createdAt > THREE_MINUTES) {
        this.visibilityTracker.unregisterAd(adId)
        this.adInfoMap.delete(adId)
        count++
      }
    }

    console.log(`[AdManager] Cleaned up ${count} unused ads`)
  }

  // Preload a single native ad - following the pattern from NativeAdCard
  private async preloadNativeAd(): Promise<void> {
    if (this.destroyed || this.nativeAdPool.size >= this.adPoolSize) return

    try {
      const adUnitId = this.useTestAds ? TestIds.NATIVE : PRODUCTION_NATIVE_AD_ID
      const adId = `native-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

      // Use the same pattern as in your NativeAdCard component
      const ad = await NativeAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
        keywords: ["image", "gallery", "media"]
      })

      // If ad loaded successfully and we're not destroyed
      if (!this.destroyed) {
        this.nativeAdPool.set(adId, ad)

        // Register this ad with the visibility tracker
        this.visibilityTracker.registerAd(adId)
        this.adInfoMap.set(adId, {
          adId,
          hasRecordedImpression: false,
          createdAt: Date.now()
        })

        console.log(`[AdManager] Preloaded native ad: ${adId}`)
      } else {
        // If manager was destroyed while loading, clean up the ad
        ad.destroy()
      }
    } catch (error) {
      console.error("[AdManager] Failed to preload native ad:", error)
    }
  }

  // Get an ad from the pool or load a new one
  public async getNativeAd(cacheKey?: string): Promise<{ad: NativeAd | null; adId: string}> {
    this.checkAndCleanup()

    // If a cacheKey is provided and we have a cached ad, return it
    if (cacheKey && this.adCache.has(cacheKey)) {
      console.log(`[AdManager] Using cached ad for key: ${cacheKey}`)
      return this.adCache.get(cacheKey)!
    }

    // First check if we have a preloaded ad
    if (this.nativeAdPool.size > 0) {
      const oldestKey = [...this.nativeAdPool.keys()][0]
      const ad = this.nativeAdPool.get(oldestKey)
      this.nativeAdPool.delete(oldestKey)

      // Preload a replacement
      this.preloadNativeAd()

      // If we have a cache key, store this ad
      if (cacheKey && ad) {
        this.adCache.set(cacheKey, {ad, adId: oldestKey})
        console.log(`[AdManager] Cached ad with ID: ${oldestKey} for key: ${cacheKey}`)
      }

      return {ad: ad || null, adId: oldestKey}
    }

    // No ad in pool, load one directly
    const now = Date.now()
    if (now - this.lastRequestTime < this.requestThrottleMs) {
      console.log("[AdManager] Throttling ad request")
      return {ad: null, adId: ""}
    }

    this.lastRequestTime = now

    try {
      const adUnitId = this.useTestAds ? TestIds.NATIVE : PRODUCTION_NATIVE_AD_ID
      const adId = `native-direct-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

      console.log(`[AdManager] Creating new ad directly with ID: ${adId}`)

      // Create and load the ad directly
      const ad = await NativeAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
        keywords: ["image", "gallery", "media"]
      })

      // Register this ad with visibility tracker
      this.visibilityTracker.registerAd(adId)
      this.adInfoMap.set(adId, {
        adId,
        hasRecordedImpression: false,
        createdAt: Date.now()
      })

      // If we have a cache key, store this ad
      if (cacheKey && ad) {
        this.adCache.set(cacheKey, {ad, adId})
        console.log(`[AdManager] Cached directly loaded ad with ID: ${adId} for key: ${cacheKey}`)
      }

      // Preload another ad for next time
      this.preloadNativeAd()

      return {ad, adId}
    } catch (error) {
      console.error("[AdManager] Failed to create native ad:", error)
      return {ad: null, adId: ""}
    }
  }

  // Track visibility for a specific ad
  public trackAdVisibility(adId: string, isVisible: boolean, viewableArea: number): void {
    if (!adId) return

    // Update creation time if this is a new ad
    if (!this.adInfoMap.has(adId)) {
      this.adInfoMap.set(adId, {
        adId,
        hasRecordedImpression: false,
        createdAt: Date.now()
      })
    }

    // If this is part of initial render and it's the first time it's visible,
    // mark it as part of initial render for special handling
    if (isVisible && !this.initialRenderIds.has(adId)) {
      this.initialRenderIds.add(adId)
      console.log(`[AdManager] First visibility for initial render ad: ${adId}`)
    }

    this.visibilityTracker.trackAdVisibility(adId, isVisible, viewableArea)
  }

  // Force impression recording for an ad - use carefully
  public forceImpression(adId: string): void {
    if (!adId) return

    console.log(`[AdManager] Force recording impression for ad: ${adId}`)
    this.visibilityTracker.forceRecordImpression(adId)

    // Update local tracking
    const adKey = this.findAdKeyById(adId)
    if (adKey) {
      const adInfo = this.adInfoMap.get(adKey)
      if (adInfo) {
        adInfo.hasRecordedImpression = true
        this.adInfoMap.set(adKey, adInfo)
      }
    }
  }

  // Insert ads into a list of items with improved spacing
  public insertNativeAdsIntoList<T>(items: T[], idProperty: string = "url"): T[] {
    if (items.length === 0) return items

    const result = [...items]
    let insertedAds = 0

    // Insert an ad every N items (using adInterval instead of hardcoded 6)
    for (let i = this.adInterval; i < result.length + insertedAds; i += this.adInterval + 1) {
      const adItem = {
        isAd: true,
        id: `ad-${insertedAds}`,
        [idProperty]: `ad-${insertedAds}`,
        type: "ad"
      } as unknown as T

      result.splice(i, 0, adItem)
      insertedAds++
    }

    console.log(`[AdManager] Inserted ${insertedAds} ads into list of ${items.length} items`)
    return result
  }

  // Check if an ad should be inserted after this index
  public shouldInsertAdAfter(index: number): boolean {
    return (index + 1) % this.adInterval === 0
  }

  // Check if an ad has recorded an impression
  public hasRecordedImpression(adId: string): boolean {
    if (!adId) return false
    const adInfo = this.adInfoMap.get(adId)
    return adInfo?.hasRecordedImpression || false
  }

  // Clean up all resources
  public destroy(): void {
    this.destroyed = true

    // Clean up native ad pool - properly call destroy on each ad
    for (const ad of this.nativeAdPool.values()) {
      ad.destroy()
    }
    this.nativeAdPool.clear()

    // Clean up visibility tracking
    for (const [adId, _] of this.adInfoMap) {
      this.visibilityTracker.unregisterAd(adId)
    }

    // Release the tracker
    this.visibilityTracker.release()

    this.adInfoMap.clear()
    this.initialRenderIds.clear()

    // Clear the queue
    this.adQueue = []

    // Reset singleton
    AdManager.instance = null
  }
}
