import {useState, useCallback, useRef} from "react"
import {SvgUri} from "react-native-svg"

/**
 * Custom hook to get SVG dimensions using onLoad callback
 * @param {string} uri - The URI of the SVG
 * @returns {Object} SVG dimensions and component
 */
export const useSvgSize = uri => {
  const [dimensions, setDimensions] = useState({
    width: 0,
    height: 0,
    aspectRatio: 0
  })

  const [status, setStatus] = useState({
    isLoading: true,
    isLoaded: false,
    error: null
  })

  const svgRef = useRef(null)

  // Handle the SVG load event
  const handleLoad = useCallback(event => {
    const {width, height} = event
    const aspectRatio = width && height ? width / height : 0

    setDimensions({
      width,
      height,
      aspectRatio
    })

    setStatus({
      isLoading: false,
      isLoaded: true,
      error: null
    })
  }, [])

  // Handle load error
  const handleError = useCallback(error => {
    setStatus({
      isLoading: false,
      isLoaded: false,
      error: error?.message || "Failed to load SVG"
    })
  }, [])

  // The SvgComponent that consumers will render
  const SvgComponent = useCallback(
    ({style, ...props}) => {
      return <SvgUri ref={svgRef} uri={uri} onLoad={handleLoad} onError={handleError} style={style} {...props} />
    },
    [uri, handleLoad, handleError]
  )

  return {
    ...dimensions,
    ...status,
    SvgComponent
  }
}
