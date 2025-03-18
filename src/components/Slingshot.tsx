/**
 * Slingshot component for visualizing the drag and launch
 */

import React, {useEffect, useRef} from "react"
import {StyleSheet, Animated, View} from "react-native"
import {SlingshotState} from "../types/game.types"
import {COLORS} from "../constants"

interface SlingshotProps {
  slingshot: SlingshotState
}

export const Slingshot: React.FC<SlingshotProps> = ({slingshot}) => {
  // Animation for opacity
  const opacityAnim = useRef(new Animated.Value(0)).current

  // Update animation when slingshot state changes
  useEffect(() => {
    // Animate opacity based on slingshot active state
    Animated.timing(opacityAnim, {
      toValue: slingshot.isActive ? 1 : 0,
      duration: 200,
      useNativeDriver: true
    }).start()
  }, [slingshot.isActive, opacityAnim])

  // Don't render anything if slingshot is not active and already faded out
  if (!slingshot.isActive && opacityAnim._value === 0) return null

  // Calculate angle and length of the slingshot line
  const dx = slingshot.endPoint.x - slingshot.startPoint.x
  const dy = slingshot.endPoint.y - slingshot.startPoint.y
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)
  const length = Math.sqrt(dx * dx + dy * dy)

  // Add a visible indicator at both ends of the slingshot
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Line connecting start and end points - fix the transform origin */}
      <Animated.View
        style={[
          styles.slingshotLine,
          {
            position: "absolute",
            left: slingshot.startPoint.x,
            top: slingshot.startPoint.y,
            width: length,
            height: 3,
            transform: [{translateY: -1.5}, {rotate: `${angle}deg`}],
            transformOrigin: "left center",
            opacity: opacityAnim
          }
        ]}
      />

      {/* Start point indicator (fixed point) */}
      <Animated.View
        style={[
          styles.startPoint,
          {
            position: "absolute",
            left: slingshot.startPoint.x - 5,
            top: slingshot.startPoint.y - 5,
            opacity: opacityAnim
          }
        ]}
      />

      {/* End point indicator (moving with drag) */}
      <Animated.View
        style={[
          styles.endPoint,
          {
            position: "absolute",
            left: slingshot.endPoint.x - 5,
            top: slingshot.endPoint.y - 5,
            opacity: opacityAnim
          }
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  slingshotLine: {
    backgroundColor: COLORS.SLINGSHOT,
    borderRadius: 2,
    zIndex: 10,
    shadowColor: COLORS.SLINGSHOT,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 5
  },
  startPoint: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderWidth: 1,
    borderColor: COLORS.SLINGSHOT,
    zIndex: 11
  },
  endPoint: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.HIGHLIGHT,
    borderWidth: 1,
    borderColor: "white",
    zIndex: 11
  }
})

export default Slingshot
