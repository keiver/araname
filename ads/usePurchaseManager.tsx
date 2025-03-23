import {useState, useEffect, useCallback, useRef} from "react"
import IAPManager from "./PurchaseManager"
import {IAPState, PurchaseStatus, PurchaseResult, UseIAPReturn, STORE_SKUS} from "./ProductTypes"
import {DeviceEventEmitter} from "react-native"

const initialState: IAPState = {
  isInitialized: false,
  hasNoAds: false,
  isLoading: true,
  error: null,
  products: []
}

export const useIAP = (): UseIAPReturn => {
  const [state, setState] = useState<IAPState>(initialState)
  const [isCheckingPurchases, setIsCheckingPurchases] = useState(true)
  const mountedRef = useRef(true)
  const initializationAttempted = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    let initializationTimeout: NodeJS.Timeout

    const initialize = async () => {
      if (initializationAttempted.current) return
      initializationAttempted.current = true

      console.log("[IAP Hook] Starting initialization")
      setIsCheckingPurchases(true)

      try {
        const iapManager = IAPManager.getInstance()
        const initialized = await iapManager.initialize()

        if (!mountedRef.current) return

        if (initialized) {
          console.log("[IAP Hook] Successfully initialized, checking no ads status")
          const noAdsStatus = await iapManager.checkNoAdsStatus()
          console.log("[IAP Hook] No ads status:", noAdsStatus)

          safeSetState({
            isInitialized: true,
            hasNoAds: noAdsStatus,
            isLoading: false
          })
        } else {
          // If initialization fails, retry after a delay
          initializationTimeout = setTimeout(() => {
            initializationAttempted.current = false
            initialize()
          }, 5000)

          console.error("[IAP Hook] Failed to initialize")
          safeSetState({
            isInitialized: false,
            isLoading: false,
            error: new Error("Failed to initialize IAP")
          })
        }
      } catch (err) {
        if (!mountedRef.current) return

        console.error("[IAP Hook] Initialization error:", err)
        safeSetState({
          isInitialized: false,
          isLoading: false,
          error: err instanceof Error ? err : new Error("Unknown error occurred")
        })
      } finally {
        if (mountedRef.current) {
          console.log("[IAP Hook] Finished checking purchases")
          setIsCheckingPurchases(false)
        }
      }
    }

    initialize()

    return () => {
      console.log("[IAP Hook] Cleaning up")
      mountedRef.current = false
      clearTimeout(initializationTimeout)
      IAPManager.getInstance().cleanup()
    }
  }, [])

  const safeSetState = useCallback((newState: Partial<IAPState>) => {
    if (mountedRef.current) {
      setState(prev => ({...prev, ...newState}))
    }
  }, [])

  const purchaseNoAds = useCallback(async (): Promise<PurchaseResult> => {
    if (!state.isInitialized) {
      console.warn("[IAP Hook] Attempted purchase before initialization")
      return {
        success: false,
        error: new Error("IAP not initialized"),
        status: PurchaseStatus.FAILED
      }
    }

    console.log("[IAP Hook] Starting no ads purchase")
    safeSetState({isLoading: true, error: null})

    try {
      const result = await IAPManager.getInstance().purchaseNoAds()
      console.log("[IAP Hook] Purchase result:", result)

      if (!mountedRef.current) return result

      if (result.success) {
        safeSetState({
          hasNoAds: true,
          isLoading: false
        })
      } else {
        console.error("[IAP Hook] Purchase failed:", result.error)
        safeSetState({
          isLoading: false,
          error: result.error || new Error("Purchase failed")
        })
      }

      return result
    } catch (err) {
      console.error("[IAP Hook] Purchase error:", err)
      if (!mountedRef.current) {
        return {
          success: false,
          error: err instanceof Error ? err : new Error("Unknown error occurred"),
          status: PurchaseStatus.FAILED
        }
      }

      const error = err instanceof Error ? err : new Error("Unknown error occurred")
      safeSetState({
        isLoading: false,
        error
      })

      return {
        success: false,
        error,
        status: PurchaseStatus.FAILED
      }
    }
  }, [state.isInitialized, safeSetState])

  const restorePurchases = useCallback(async (): Promise<PurchaseResult> => {
    if (!state.isInitialized) {
      console.warn("[IAP Hook] Attempted restore before initialization")
      return {
        success: false,
        error: new Error("IAP not initialized"),
        status: PurchaseStatus.FAILED
      }
    }

    console.log("[IAP Hook] Starting purchase restoration")
    safeSetState({isLoading: true, error: null})

    try {
      const result = await IAPManager.getInstance().restorePurchases()
      console.log("[IAP Hook] Restore result:", result)

      if (!mountedRef.current) return result

      if (result.success) {
        safeSetState({
          hasNoAds: true,
          isLoading: false
        })
      } else {
        console.error("[IAP Hook] Restore failed:", result.error)
        safeSetState({
          isLoading: false,
          error: result.error || new Error("Restore failed")
        })
      }

      return result
    } catch (err) {
      console.error("[IAP Hook] Restore error:", err)
      if (!mountedRef.current) {
        return {
          success: false,
          error: err instanceof Error ? err : new Error("Unknown error occurred"),
          status: PurchaseStatus.FAILED
        }
      }

      const error = err instanceof Error ? err : new Error("Unknown error occurred")
      safeSetState({
        isLoading: false,
        error
      })

      return {
        success: false,
        error,
        status: PurchaseStatus.FAILED
      }
    }
  }, [state.isInitialized, safeSetState])

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener("purchaseCompleted", (productId: string) => {
      if (productId === STORE_SKUS.NO_ADS) {
        safeSetState({
          hasNoAds: true,
          isLoading: false
        })
      }
    })

    return () => {
      subscription.remove()
    }
  }, [safeSetState])

  return {
    ...state,
    isCheckingPurchases,
    // hasNoAds: true, // TODO: Remove this line, true we are testing the no ads feature
    // isLoading: false, // TODO: Remove this line, true we are testing the no ads feature
    // isInitialized: true, // TODO: Remove this line, true we are testing the no ads feature
    purchaseNoAds,
    restorePurchases
  }
}

export default useIAP
