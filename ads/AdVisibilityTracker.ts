import {Platform} from "react-native"
import {NativeAd} from "react-native-google-mobile-ads"

// Simple custom event emitter implementation
class SimpleEventEmitter {
  private listeners: Map<string, Set<Function>> = new Map()

  public addListener(eventName: string, callback: Function): {remove: () => void} {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set())
    }
    this.listeners.get(eventName)!.add(callback)

    return {
      remove: () => {
        const eventListeners = this.listeners.get(eventName)
        if (eventListeners) {
          eventListeners.delete(callback)
        }
      }
    }
  }

  public emit(eventName: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(eventName)
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(...args)
        } catch (error) {
          console.error(`Error in event listener for ${eventName}:`, error)
        }
      })
    }
  }
}

// Constants for visibility tracking
const VISIBILITY_THRESHOLD_MS = 1000 // 1 second minimum visibility time
const VISIBILITY_AREA_THRESHOLD = 0.5 // 50% of the ad must be visible

// Interface for visibility events
export interface AdVisibilityEvent {
  adId: string
  isVisible: boolean
  timestamp: number
  viewableArea: number // 0-1 representing percentage of ad visible
}

// Track ad impression status to prevent duplicates
interface AdImpressionState {
  lastVisibleTimestamp: number
  cumulativeVisibleTime: number
  hasRecordedImpression: boolean
  viewabilityPercentage: number
  createdAt: number // Add creation timestamp
}

/**
 * Utility class to track ad visibility and manage impressions
 */
class AdVisibilityTracker {
  private static instance: AdVisibilityTracker | null = null
  private adVisibilityMap: Map<string, AdImpressionState> = new Map()
  private visibilityCheckInterval: NodeJS.Timeout | null = null
  private eventEmitter = new SimpleEventEmitter()
  private instanceCount: number = 0 // Reference counting for proper cleanup
  private lastCleanupTime: number = Date.now()

  // Singleton pattern with reference counting
  private constructor() {
    // Set up interval to track cumulative visibility - less frequent checking
    this.visibilityCheckInterval = setInterval(() => {
      this.processVisibilityTimes()

      // Cleanup old entries every 30 seconds
      if (Date.now() - this.lastCleanupTime > 30000) {
        this.cleanupOldEntries()
        this.lastCleanupTime = Date.now()
      }
    }, 500) // Check every 500ms instead of 200ms
  }

  public static getInstance(): AdVisibilityTracker {
    if (!AdVisibilityTracker.instance) {
      AdVisibilityTracker.instance = new AdVisibilityTracker()
    }

    // Increment reference count
    AdVisibilityTracker.instance.instanceCount++
    return AdVisibilityTracker.instance
  }

  // New method to cleanup old entries that may have been forgotten
  private cleanupOldEntries(): void {
    const now = Date.now()
    const FIVE_MINUTES = 5 * 60 * 1000
    let count = 0

    for (const [adId, state] of this.adVisibilityMap.entries()) {
      // Remove entries older than 5 minutes that never recorded an impression
      if (!state.hasRecordedImpression && now - state.createdAt > FIVE_MINUTES) {
        this.adVisibilityMap.delete(adId)
        count++
      }
    }

    if (count > 0) {
      console.log(`[AdVisibilityTracker] Cleaned up ${count} stale ad entries`)
    }
  }

  /**
   * Track an ad's visibility state
   * @param adId Unique identifier for the ad
   * @param isVisible Whether the ad is currently visible
   * @param viewableArea Portion of the ad that is visible (0-1)
   */
  public trackAdVisibility(adId: string, isVisible: boolean, viewableArea: number = 1): void {
    const now = Date.now()

    // Create or retrieve visibility state for this ad
    if (!this.adVisibilityMap.has(adId)) {
      this.adVisibilityMap.set(adId, {
        lastVisibleTimestamp: isVisible ? now : 0,
        cumulativeVisibleTime: 0,
        hasRecordedImpression: false,
        viewabilityPercentage: isVisible ? viewableArea : 0,
        createdAt: now // Add creation timestamp
      })
    } else {
      const adState = this.adVisibilityMap.get(adId)!

      // Update visibility state
      if (isVisible && adState.lastVisibleTimestamp === 0) {
        // Ad just became visible
        adState.lastVisibleTimestamp = now
        adState.viewabilityPercentage = viewableArea
      } else if (!isVisible && adState.lastVisibleTimestamp > 0) {
        // Ad just became invisible
        const visibleDuration = now - adState.lastVisibleTimestamp
        adState.cumulativeVisibleTime += visibleDuration
        adState.lastVisibleTimestamp = 0
        adState.viewabilityPercentage = 0
      } else if (isVisible) {
        // Ad remains visible, update viewability percentage
        adState.viewabilityPercentage = viewableArea
      }

      this.adVisibilityMap.set(adId, adState)
    }

    // Emit visibility event for optional listening components
    this.eventEmitter.emit("adVisibilityChanged", {
      adId,
      isVisible,
      timestamp: now,
      viewableArea
    })
  }

  /**
   * Process visibility times and record impressions when threshold is met
   */
  private processVisibilityTimes(): void {
    const now = Date.now()

    this.adVisibilityMap.forEach((state, adId) => {
      // If ad is currently visible, add time since last check
      if (state.lastVisibleTimestamp > 0 && state.viewabilityPercentage >= VISIBILITY_AREA_THRESHOLD) {
        const additionalVisibleTime = now - state.lastVisibleTimestamp
        state.cumulativeVisibleTime += additionalVisibleTime
        state.lastVisibleTimestamp = now

        // Record impression if threshold is met and not already recorded
        if (state.cumulativeVisibleTime >= VISIBILITY_THRESHOLD_MS && !state.hasRecordedImpression) {
          this.recordImpression(adId)
          state.hasRecordedImpression = true
        }
      }
    })
  }

  /**
   * Record a valid impression for an ad
   * @param adId The ad identifier
   */
  private recordImpression(adId: string): void {
    console.log(`[AdVisibilityTracker] Recording impression for ad: ${adId}`)
    // Emit event for impression recording
    this.eventEmitter.emit("adImpressionRecorded", {adId})
  }

  /**
   * Register an ad for tracking
   * @param adId Unique identifier for the ad
   */
  public registerAd(adId: string): void {
    if (!this.adVisibilityMap.has(adId)) {
      this.adVisibilityMap.set(adId, {
        lastVisibleTimestamp: 0,
        cumulativeVisibleTime: 0,
        hasRecordedImpression: false,
        viewabilityPercentage: 0,
        createdAt: Date.now() // Add creation timestamp
      })
    }
  }

  /**
   * Unregister an ad when it's removed
   * @param adId Unique identifier for the ad
   */
  public unregisterAd(adId: string): void {
    this.adVisibilityMap.delete(adId)
  }

  /**
   * Release one reference to the tracker
   * When all references are released, destroy the tracker
   */
  public release(): void {
    this.instanceCount--

    if (this.instanceCount <= 0) {
      this.destroy()
    }
  }

  /**
   * Check if an ad has recorded an impression
   * @param adId Unique identifier for the ad
   */
  public hasRecordedImpression(adId: string): boolean {
    return this.adVisibilityMap.get(adId)?.hasRecordedImpression || false
  }

  /**
   * Add listener for ad visibility events
   * @param callback Function to call when visibility changes
   */
  public addVisibilityListener(callback: (event: AdVisibilityEvent) => void): any {
    return this.eventEmitter.addListener("adVisibilityChanged", callback)
  }

  /**
   * Add listener for ad impression events
   * @param callback Function to call when impression is recorded
   */
  public addImpressionListener(callback: (event: {adId: string}) => void): any {
    return this.eventEmitter.addListener("adImpressionRecorded", callback)
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.visibilityCheckInterval) {
      clearInterval(this.visibilityCheckInterval)
      this.visibilityCheckInterval = null
    }

    this.adVisibilityMap.clear()
    AdVisibilityTracker.instance = null
  }
}

export default AdVisibilityTracker
