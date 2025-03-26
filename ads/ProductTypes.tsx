import {Platform} from "react-native"
import type {
  Purchase,
  PurchaseError,
  Product,
  ProductPurchase,
  SubscriptionPurchase,
  Subscription
} from "react-native-iap"

// Define correct type for Purchase from react-native-iap
type IAPPurchase = ProductPurchase | SubscriptionPurchase

// Change from interface to type
export type StoredPurchase = IAPPurchase & {
  timestamp: number
  status: PurchaseStatus
  retryCount?: number
}

export const STORE_SKUS = {
  NO_ADS: Platform.select({
    ios: "dev.keiver.araname.no.ads.1.1.3",
    android: "dev.keiver.araname.no.ads",
    default: "dev.keiver.araname.no.ads"
  })
} as const

export type StoreSkuKeys = keyof typeof STORE_SKUS
export type StoreSku = (typeof STORE_SKUS)[StoreSkuKeys]

export interface IAPState {
  isInitialized: boolean
  hasNoAds: boolean
  isLoading: boolean
  error: Error | null
  products: Array<Product | Subscription>
}

export enum PurchaseStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  RESTORED = "RESTORED"
}

export interface StoredPurchases {
  [key: string]: StoredPurchase
}

export interface PurchaseResult {
  success: boolean
  error?: Error | PurchaseError
  status: PurchaseStatus
  purchase?: IAPPurchase
  code?: string
}

export interface IAPManagerInterface {
  initialize(): Promise<boolean>
  checkNoAdsStatus(): Promise<boolean>
  purchaseNoAds(): Promise<PurchaseResult>
  handlePurchaseCompletion(purchase: IAPPurchase): Promise<void>
  restorePurchases(): Promise<PurchaseResult>
  cleanup(): void
}

export interface UseIAPReturn extends Omit<IAPState, "error"> {
  error: Error | PurchaseError | null
  isCheckingPurchases: boolean
  purchaseNoAds: () => Promise<PurchaseResult>
  restorePurchases: () => Promise<PurchaseResult>
  products: Array<Product | Subscription>
}

export class IAPError extends Error {
  code?: string
  details?: unknown

  constructor(message: string, code?: string, details?: unknown) {
    super(message)
    this.name = "IAPError"
    this.code = code
    this.details = details
  }
}
