// PersistentAdContainer.tsx
import React, {useRef, useEffect} from "react"
import {View} from "react-native"

const adComponentsMap = new Map<string, React.ReactNode>()

interface PersistentAdContainerProps {
  id: string
  width: number
  height: number
  renderAd: () => React.ReactNode
}

const PersistentAdContainer: React.FC<PersistentAdContainerProps> = ({id, width, height, renderAd}) => {
  const isFirstRender = useRef(true)

  // Only render the ad once and store it in our map
  useEffect(() => {
    if (isFirstRender.current && !adComponentsMap.has(id)) {
      adComponentsMap.set(id, renderAd())
      isFirstRender.current = false
    }
  }, [id, renderAd])

  // Return the cached ad component or null while loading
  return <View style={{width, height, overflow: "hidden"}}>{adComponentsMap.get(id)}</View>
}

export default React.memo(PersistentAdContainer)
