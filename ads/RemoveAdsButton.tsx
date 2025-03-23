import React, {useState, useCallback, useEffect} from "react"
import {View, Text, StyleSheet, Alert, Pressable, ActivityIndicator} from "react-native"
import {Ionicons} from "@expo/vector-icons"
import {useIAP} from "./usePurchaseManager"
import {getProducts} from "react-native-iap"
import {STORE_SKUS, IAPError} from "./ProductTypes"
import {withIAPContext} from "react-native-iap"

const BUTTON_MAX_WIDTH = 250

const RemoveAdsButton: React.FC = () => {
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

        console.log("[IAP Button] Retrieved products:", products)

        if (products && products.length > 0) {
          setPrice(products[0].localizedPrice)
        } else {
          console.warn("[IAP Button] No products returned")
        }
      } catch (error) {
        console.error("[IAP Button] Product retrieval error:", error)
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
      console.log("[IAP Button] Starting purchase flow")

      const result = await purchaseNoAds()
      console.log("[IAP Button] Purchase result:", result)

      if (result.success) {
        Alert.alert("Success", "Thank you for your purchase!")
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
      console.error("[IAP Button] Purchase error:", error)
      Alert.alert("Error", "An unexpected error occurred. Please try again.")
    }
  }, [isInitialized, purchaseNoAds])

  const handleRestore = useCallback(async () => {
    if (isRestoring || !isInitialized) return

    try {
      setIsRestoring(true)
      console.log("[IAP Button] Starting restore")

      const result = await restorePurchases()
      console.log("[IAP Button] Restore result:", result)

      if (result.success) {
        Alert.alert("Success", "Your ad-free access has been restored!")
      } else {
        Alert.alert("Info", "No previous purchases found.")
      }
    } catch (error) {
      console.error("[IAP Button] Restore error:", error)
      Alert.alert("Error", "Failed to restore purchases. Please check your internet connection and try again.")
    } finally {
      setIsRestoring(false)
    }
  }, [isRestoring, restorePurchases, isInitialized])

  // if (hasNoAds) return null
  const iconA = hasNoAds ? (
    <Ionicons name="checkmark" size={20} color={"#fff"} />
  ) : (
    <Ionicons color={"#fff"} name="cart" size={20} />
  )
  const p = hasNoAds ? "" : price !== "$0" ? `• ${price}` : ""
  const l = hasNoAds ? "Ad-Free" : "Remove Ads"

  return (
    <View style={styles.container}>
      <View style={styles.buttonContainer}>
        <Pressable
          style={[styles.purchaseButton, (hasNoAds || isLoading || isLoadingPrice) && styles.disabled]}
          onPress={hasNoAds ? null : handlePurchase}
          disabled={isLoading || isLoadingPrice || !isInitialized}
        >
          <>
            {isLoadingPrice || isLoading ? <ActivityIndicator color={"#fff"} /> : iconA}

            <Text style={styles.purchaseButtonText}>
              {l} {p}
            </Text>
          </>
        </Pressable>

        <Pressable
          style={[styles.restoreButton, (isRestoring || !isInitialized) && styles.disabled]}
          onPress={handleRestore}
          disabled={isRestoring || !isInitialized}
        >
          <>
            {isRestoring || isLoading ? (
              <ActivityIndicator color={"#fff"} />
            ) : (
              <Ionicons name="refresh" size={20} color={"#fff"} />
            )}

            <Text style={styles.restoreButtonText}>Restore Purchases</Text>
          </>
        </Pressable>
      </View>
      <Text style={styles.description}>
        {!hasNoAds ? "Remove all advertisements forever with a one-time purchase." : "Thank you for supporting us!"}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    padding: 16,
    gap: 16
  },
  description: {
    fontSize: 16,
    opacity: 0.6,
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 22
  },
  buttonContainer: {
    width: "100%",
    maxWidth: BUTTON_MAX_WIDTH,
    gap: 12
  },
  purchaseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0942B97",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 130,
    gap: 8,
    borderWidth: 1,
    borderColor: tintColorDark
  },
  purchaseButtonText: {
    fontSize: 16,
    fontWeight: "600"
  },
  restoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    paddingVertical: 12,
    borderRadius: 130,
    gap: 8,
    borderWidth: 1,
    borderColor: tintColorDark
  },
  restoreButtonText: {
    fontSize: 16,
    fontWeight: "500"
  },
  disabled: {
    opacity: 0.3
  }
})

export default withIAPContext(RemoveAdsButton)
