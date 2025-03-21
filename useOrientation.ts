// useOrientation.ts
import {useState, useEffect} from "react"
import {Dimensions} from "react-native"

export const useOrientation = () => {
  const [screenDimensions, setScreenDimensions] = useState(Dimensions.get("window"))

  useEffect(() => {
    const onChange = ({window}) => {
      setScreenDimensions(window)
    }

    const subscription = Dimensions.addEventListener("change", onChange)

    // Clean up
    return () => subscription.remove()
  }, [])

  return {
    ...screenDimensions,
    isPortrait: screenDimensions.height > screenDimensions.width,
    isLandscape: screenDimensions.width > screenDimensions.height
  }
}
