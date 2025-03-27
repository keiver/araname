// PersistentAdContainer.tsx
import React, {useEffect, useState} from "react"
import {View} from "react-native"

// We'll move this to a global scope constant or context since the current map approach might be causing issues
const adComponentsMap = new Map<string, React.ReactNode>()

interface PersistentAdContainerProps {
  id: string
  width: number
  height: number
  renderAd: () => React.ReactNode
}

const PersistentAdContainer: React.FC<PersistentAdContainerProps> = ({id, width, height, renderAd}) => {
  const [adComponent, setAdComponent] = useState<React.ReactNode | null>(null)

  // Only render the ad once on mount
  useEffect(() => {
    console.log(`[PersistentAdContainer] Component mounted for ad: ${id}`)

    // Check if we already have this ad in our cache
    if (!adComponentsMap.has(id)) {
      console.log(`[PersistentAdContainer] Render attempt 1 for ad: ${id}`)
      const component = renderAd()
      adComponentsMap.set(id, component)
      console.log(`[PersistentAdContainer] Successfully rendered and stored ad component for id: ${id}`)
    }

    // Always update local state with the cached component
    setAdComponent(adComponentsMap.get(id) || null)

    // No cleanup needed as we want to persist these components
  }, [id, renderAd])

  // Return the cached ad component
  return <View style={{width, height, overflow: "hidden", backgroundColor: "transparent"}}>{adComponent}</View>
}

export default React.memo(PersistentAdContainer)
