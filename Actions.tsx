import React, {useState, useCallback, useEffect} from "react"
import {StyleSheet, View, Text, TouchableOpacity, Alert, ActivityIndicator} from "react-native"
import {Ionicons} from "@expo/vector-icons"
import {useIAP} from "./ads/usePurchaseManager"
import {getProducts} from "react-native-iap"
import {STORE_SKUS, IAPError} from "./ads/ProductTypes"
import {withIAPContext} from "react-native-iap"

interface ActionsProps {
  removeAdsText?: string
  restorePurchasesText?: string
  settingsText?: string
  onRemoveAds?: () => void
  onRestorePurchases?: () => void
  onSettings: () => void
}

const Actions: React.FC<ActionsProps> = ({
  removeAdsText = "Remove Ads",
  restorePurchasesText = "Restore Purchases",
  settingsText = "Settings",
  onRemoveAds,
  onRestorePurchases,
  onSettings
}) => {
  const {purchaseNoAds, isLoading, hasNoAds, restorePurchases, isInitialized} = useIAP()
  const [price, setPrice] = useState<string>("$0")
  const [isLoadingPrice, setIsLoadingPrice] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  useEffect(() => {
    const fetchProducts = async () => {
      if (!isInitialized) {
        // Make sure we stop loading if we're not initialized
        setIsLoadingPrice(false)
        return
      }

      try {
        setIsLoadingPrice(true)

        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error("Product retrieval timeout")), 10000)
        })

        // Race between actual product fetch and timeout
        const products = await Promise.race([getProducts({skus: [STORE_SKUS.NO_ADS]}), timeoutPromise])

        console.log("[IAP Actions] Retrieved products:", products)

        if (products && products.length > 0) {
          setPrice(products[0].localizedPrice)
        } else {
          console.warn("[IAP Actions] No products returned")
        }
      } catch (error) {
        console.error("[IAP Actions] Product retrieval error:", error)
      } finally {
        setIsLoadingPrice(false)
      }
    }

    fetchProducts()

    // Ensure loading stops after component unmount
    return () => {
      setIsLoadingPrice(false)
    }
  }, [isInitialized])

  const handlePurchase = useCallback(async () => {
    if (!isInitialized) {
      Alert.alert("Error", "Please wait while we initialize the purchase system")
      return
    }

    try {
      console.log("[IAP Actions] Starting purchase flow")

      const result = await purchaseNoAds()
      console.log("[IAP Actions] Purchase result:", result)

      if (result.success) {
        Alert.alert("Success", "Thank you for your purchase!")
        // Call the external callback if provided
        onRemoveAds?.()
      } else {
        if (result.error instanceof IAPError && result.error.code === "USER_CANCELLED") {
          return
        }

        const errorMessage =
          result.error instanceof IAPError && result.error.code === "BILLING_UNAVAILABLE"
            ? "Purchase is currently unavailable. Please try again later."
            : "Purchase failed. Please check your internet connection and try again."

        Alert.alert("Error", errorMessage)
      }
    } catch (error) {
      console.error("[IAP Actions] Purchase error:", error)
      Alert.alert("Error", "An unexpected error occurred. Please try again.")
    }
  }, [isInitialized, purchaseNoAds, onRemoveAds])

  const handleRestore = useCallback(async () => {
    if (isRestoring || !isInitialized) return

    try {
      setIsRestoring(true)
      console.log("[IAP Actions] Starting restore")

      const result = await restorePurchases()
      console.log("[IAP Actions] Restore result:", result)

      if (result.success) {
        Alert.alert("Success", "Your ad-free access has been restored!")
        // Call the external callback if provided
        onRestorePurchases?.()
      } else {
        Alert.alert("Info", "No previous purchases found.")
      }
    } catch (error) {
      console.error("[IAP Actions] Restore error:", error)
      Alert.alert("Error", "Failed to restore purchases. Please check your internet connection and try again.")
    } finally {
      setIsRestoring(false)
    }
  }, [isRestoring, restorePurchases, isInitialized, onRestorePurchases])

  // Determine display text for remove ads button
  const displayRemoveAdsText = hasNoAds ? "Ad-Free" : `${removeAdsText}${price !== "$0" ? ` • ${price}` : ""}`

  return (
    <View style={styles.headerContainer}>
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, (hasNoAds || isLoading || isLoadingPrice) && styles.disabledButton]}
          onPress={hasNoAds ? undefined : handlePurchase}
          disabled={isLoading || isLoadingPrice || !isInitialized || hasNoAds}
        >
          {isLoadingPrice || isLoading ? (
            <View
              style={{
                width: 30,
                height: 30,
                justifyContent: "center",
                alignItems: "center"
              }}
            >
              <ActivityIndicator size="small" color="#FFC312" />
            </View>
          ) : (
            <Ionicons name={hasNoAds ? "checkmark" : "chatbox"} size={30} color="#FFC312" />
          )}
          <Text style={{fontSize: 10, color: "#FFC312"}}>{displayRemoveAdsText}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, (isRestoring || !isInitialized) && styles.disabledButton]}
          onPress={handleRestore}
          disabled={isRestoring || !isInitialized}
        >
          {isRestoring ? (
            <View
              style={{
                width: 30,
                height: 30,
                justifyContent: "center",
                alignItems: "center"
              }}
            >
              <ActivityIndicator size="small" color="#FFC312" />
            </View>
          ) : (
            <Ionicons name="pricetag-outline" size={30} color="#FFC312" />
          )}
          <Text style={{fontSize: 10, color: "#FFC312"}}>{restorePurchasesText}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onSettings}>
          <Ionicons name="settings-outline" size={30} color="#FFC312" />
          <Text style={{fontSize: 10, color: "#FFC312"}}>{settingsText}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center"
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333"
  },
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  actionButton: {
    width: 106,
    height: 66,
    borderRadius: 0,
    backgroundColor: "#E4582E00",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    borderWidth: 0,
    borderColor: "#FFC312",
    marginTop: 7
  },
  disabledButton: {
    opacity: 0.5
  }
})

export default withIAPContext(Actions)
