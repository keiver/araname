import React from "react"
import {useIAP} from "./usePurchaseManager"
import {withIAPContext} from "react-native-iap"

interface AdBannerWrapperProps {
  children: React.ReactNode
  fallback?: React.ReactNode // Optional fallback component while checking
}

export const AdBannerWrapper: React.FC<AdBannerWrapperProps> = ({children, fallback = null}) => {
  const {hasNoAds, isCheckingPurchases} = useIAP()

  // While checking purchases, show nothing or fallback
  if (isCheckingPurchases) {
    return fallback ? <>{fallback}</> : null
  }

  // If user has no ads, don't show banner
  if (hasNoAds) {
    return null
  }

  // Show the ad banner
  return <>{children}</>
}

export default withIAPContext(AdBannerWrapper)
