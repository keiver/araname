import {Platform, NativeEventEmitter, DeviceEventEmitter} from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import {
  initConnection,
  endConnection,
  getProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  getAvailablePurchases,
  type ProductPurchase,
  type PurchaseError,
  validateReceiptIos,
  validateReceiptAndroid
} from "react-native-iap"
import {STORE_SKUS, type StoredPurchases, type PurchaseResult, PurchaseStatus, IAPError} from "./ProductTypes"

const PURCHASE_KEY = "@app_purchases"
const MAX_RETRY_ATTEMPTS = 3
const RETRY_DELAY = 1000 // 1 second

export default class IAPManager {
  private static instance: IAPManager | null = null
  private purchaseUpdateSubscription: ReturnType<typeof purchaseUpdatedListener> | null = null
  private purchaseErrorSubscription: ReturnType<typeof purchaseErrorListener> | null = null
  private isConnected: boolean = false
  private connectionPromise: Promise<boolean> | null = null

  private constructor() {}

  public static getInstance(): IAPManager {
    if (!IAPManager.instance) {
      IAPManager.instance = new IAPManager()
    }
    return IAPManager.instance
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async retryOperation<T>(operation: () => Promise<T>, retryCount: number = 0): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      console.log("[IAP] Operation failed, attempt:", retryCount + 1, error)
      if (retryCount < MAX_RETRY_ATTEMPTS) {
        await this.delay(RETRY_DELAY * Math.pow(2, retryCount))
        return this.retryOperation(operation, retryCount + 1)
      }
      throw error
    }
  }

  public async initialize(): Promise<boolean> {
    if (this.connectionPromise) {
      return this.connectionPromise
    }

    this.connectionPromise = (async () => {
      try {
        console.log("[IAP] Initializing IAP connection")
        if (this.isConnected) {
          return true
        }

        await initConnection()
        this.isConnected = true
        console.log("[IAP] Successfully initialized connection")

        this.purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase: ProductPurchase) => {
          console.log("[IAP] Purchase updated:", purchase)
          if (purchase.productId === STORE_SKUS.NO_ADS) {
            await this.handlePurchaseCompletion(purchase)
          }
        })

        this.purchaseErrorSubscription = purchaseErrorListener((error: PurchaseError) => {
          console.warn("[IAP] Purchase Error:", error)
        })

        return true
      } catch (err) {
        console.error("[IAP] Failed to initialize:", err)
        this.isConnected = false
        throw new IAPError("Failed to initialize in-app purchases", "INIT_FAILED", err)
      }
    })()

    return this.connectionPromise
  }

  public async checkNoAdsStatus(): Promise<boolean> {
    try {
      console.log("[IAP] Checking no ads status")
      const purchases = await AsyncStorage.getItem(PURCHASE_KEY)
      if (purchases) {
        const parsedPurchases: StoredPurchases = JSON.parse(purchases)
        const noAdsPurchase = parsedPurchases[STORE_SKUS.NO_ADS]

        if (noAdsPurchase) {
          console.log("[IAP] Found local purchase, verifying with store")
          const availablePurchases = await this.retryOperation(() => getAvailablePurchases())
          const validPurchase = availablePurchases.some(receipt => receipt.productId === STORE_SKUS.NO_ADS)

          if (validPurchase) {
            console.log("[IAP] Valid purchase confirmed")
            return true
          }
        }
      }

      console.log("[IAP] Checking store for purchases")
      const availablePurchases = await this.retryOperation(() => getAvailablePurchases())
      console.log("[IAP] Available purchases:", availablePurchases)

      const hasNoAdsPurchase = availablePurchases.some(purchase => purchase.productId === STORE_SKUS.NO_ADS)

      if (hasNoAdsPurchase) {
        console.log("[IAP] Found valid store purchase, updating local storage")
        const purchase = availablePurchases.find(p => p.productId === STORE_SKUS.NO_ADS)
        if (purchase) {
          const updatedPurchases: StoredPurchases = purchases ? JSON.parse(purchases) : {}
          updatedPurchases[STORE_SKUS.NO_ADS] = {
            ...purchase,
            timestamp: Date.now(),
            status: PurchaseStatus.RESTORED
          }
          await AsyncStorage.setItem(PURCHASE_KEY, JSON.stringify(updatedPurchases))
        }
        return true
      }

      console.log("[IAP] No valid purchase found, cleaning storage")
      if (purchases) {
        const parsedPurchases: StoredPurchases = JSON.parse(purchases)
        if (parsedPurchases[STORE_SKUS.NO_ADS]) {
          delete parsedPurchases[STORE_SKUS.NO_ADS]
          await AsyncStorage.setItem(PURCHASE_KEY, JSON.stringify(parsedPurchases))
        }
      }

      return false
    } catch (err) {
      console.error("[IAP] Failed to check no ads status:", err)
      return false
    }
  }

  public async purchaseNoAds(): Promise<PurchaseResult> {
    try {
      console.log("[IAP] Starting no ads purchase flow")
      const products = await this.retryOperation(() => getProducts({skus: [STORE_SKUS.NO_ADS]}))
      console.log("[IAP] Retrieved products:", products)

      if (!products.length) {
        throw new IAPError("No ads removal product not found", "PRODUCT_NOT_FOUND")
      }

      if (Platform.OS === "ios") {
        await requestPurchase({sku: STORE_SKUS.NO_ADS})
      } else {
        await requestPurchase({skus: [STORE_SKUS.NO_ADS]})
      }

      console.log("[IAP] Purchase request sent successfully")

      return {
        success: true,
        status: PurchaseStatus.PENDING
      }
    } catch (err: any) {
      console.error("[IAP] Purchase failed:", err)

      // Handle user cancellation
      if (err?.code === "E_USER_CANCELLED") {
        return {
          success: false,
          status: PurchaseStatus.FAILED,
          error: new IAPError("Purchase was cancelled", "USER_CANCELLED")
        }
      }

      // Handle billing unavailable
      if (err?.code === "E_BILLING_UNAVAILABLE") {
        return {
          success: false,
          status: PurchaseStatus.FAILED,
          error: new IAPError("Billing is currently unavailable", "BILLING_UNAVAILABLE")
        }
      }

      return {
        success: false,
        error: err instanceof Error ? err : new Error("Unknown purchase error"),
        status: PurchaseStatus.FAILED
      }
    }
  }

  private async validatePurchase(purchase: ProductPurchase): Promise<boolean> {
    try {
      console.log("[IAP] Validating purchase:", purchase.productId)
      if (Platform.OS === "ios") {
        const receipt = purchase.transactionReceipt
        if (!receipt) return false

        console.log("[IAP] Validating iOS receipt")
        const validation = await validateReceiptIos({
          receiptBody: {
            "receipt-data": receipt
          }
        })
        console.log("[IAP] iOS validation result:", validation?.status)

        return validation?.status === 0
      } else if (Platform.OS === "android") {
        // Skip validation for Android purchases
        console.log("[IAP] Android purchase - skipping validation and considering valid")
        return true
      }

      return false
    } catch (err) {
      console.error("[IAP] Purchase validation failed:", err)
      return false
    }
  }

  public async handlePurchaseCompletion(purchase: ProductPurchase): Promise<void> {
    try {
      console.log("[IAP] Handling purchase completion:", purchase.productId)

      // For Android, we'll skip validation but still process the purchase
      let isValid = Platform.OS === "android" ? true : await this.validatePurchase(purchase)

      if (!isValid && Platform.OS === "ios") {
        throw new IAPError("iOS purchase validation failed", "INVALID_PURCHASE")
      }

      // Finish transaction for both platforms
      try {
        await finishTransaction({purchase})
        console.log("[IAP] Transaction finished successfully")
      } catch (finishError) {
        console.warn("[IAP] Failed to finish transaction:", finishError)
        // Only throw for iOS - Android can continue
        if (Platform.OS === "ios") throw finishError
      }

      // Store purchase info for both platforms
      const purchases = await AsyncStorage.getItem(PURCHASE_KEY)
      const parsedPurchases: StoredPurchases = purchases ? JSON.parse(purchases) : {}

      parsedPurchases[STORE_SKUS.NO_ADS] = {
        ...purchase,
        timestamp: Date.now(),
        status: PurchaseStatus.COMPLETED
      }

      await AsyncStorage.setItem(PURCHASE_KEY, JSON.stringify(parsedPurchases))
      console.log("[IAP] Purchase stored successfully")

      // Emit purchase completion event
      DeviceEventEmitter.emit("purchaseCompleted", STORE_SKUS.NO_ADS)
    } catch (err) {
      console.error("[IAP] Failed to complete purchase:", err)
      throw new IAPError("Failed to complete purchase", "COMPLETION_FAILED", err)
    }
  }

  public async restorePurchases(): Promise<PurchaseResult> {
    try {
      console.log("[IAP] Starting purchase restoration")
      const availablePurchases = await this.retryOperation(() => getAvailablePurchases())
      console.log("[IAP] Available purchases to restore:", availablePurchases)

      const hasNoAdsPurchase = availablePurchases.some(purchase => purchase.productId === STORE_SKUS.NO_ADS)

      if (hasNoAdsPurchase) {
        console.log("[IAP] Found valid purchase to restore")
        const purchases = await AsyncStorage.getItem(PURCHASE_KEY)
        const parsedPurchases: StoredPurchases = purchases ? JSON.parse(purchases) : {}

        parsedPurchases[STORE_SKUS.NO_ADS] = {
          ...availablePurchases[0],
          timestamp: Date.now(),
          status: PurchaseStatus.RESTORED
        }

        await AsyncStorage.setItem(PURCHASE_KEY, JSON.stringify(parsedPurchases))
        console.log("[IAP] Purchase restored successfully")

        return {
          success: true,
          status: PurchaseStatus.RESTORED
        }
      }

      console.log("[IAP] No purchases found to restore")
      return {
        success: false,
        error: new IAPError("No purchases found to restore", "NO_PURCHASES"),
        status: PurchaseStatus.FAILED
      }
    } catch (err) {
      console.error("[IAP] Failed to restore purchases:", err)
      return {
        success: false,
        error: err instanceof Error ? err : new Error("Unknown restore error"),
        status: PurchaseStatus.FAILED
      }
    }
  }

  public cleanup(): void {
    console.log("[IAP] Cleaning up IAP manager")
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove()
      this.purchaseUpdateSubscription = null
    }

    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove()
      this.purchaseErrorSubscription = null
    }

    if (this.isConnected) {
      endConnection()
      this.isConnected = false
    }

    this.connectionPromise = null
    console.log("[IAP] Cleanup completed")
  }
}
