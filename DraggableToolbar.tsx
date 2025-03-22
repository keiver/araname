import React, {useCallback, useState, useEffect} from "react"
import {StyleSheet, Dimensions, View, TouchableOpacity, Platform, Text} from "react-native"
import {BlurView} from "expo-blur"
import {PanGestureHandler} from "react-native-gesture-handler"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  useAnimatedGestureHandler,
  withTiming,
  Easing,
  useAnimatedReaction
} from "react-native-reanimated"

import Right from "./assets/right.svg"
import Left from "./assets/left.svg"

// Initial dimensions - will be updated when orientation changes
const initialDimensions = Dimensions.get("window")
const TOOLBAR_HEIGHT = 140
const VISIBLE_PORTION = 26
const BOTTOM_AD_BANNER_HEIGHT = 50

const SPRING_CONFIG = {
  damping: 20,
  mass: 1,
  stiffness: 200
}

interface DraggableToolbarProps {
  children?: React.ReactNode
  onPositionChange?: (position: number) => void
  initialPosition?: number
}

type GestureContext = {
  startY: number
  startX: number // Add this to track horizontal position
  isHorizontalSwipe: boolean // Flag to track swipe direction
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView)

export function DraggableToolbar({children, onPositionChange, initialPosition}: DraggableToolbarProps) {
  // State to track current screen dimensions
  const [dimensions, setDimensions] = useState({
    width: initialDimensions.width,
    height: initialDimensions.height
  })

  // Use current dimensions to calculate max offset and initial position
  const minOffset = 0
  const maxOffset = dimensions.height - TOOLBAR_HEIGHT

  // Calculate default initialPosition based on current dimensions if not provided
  const defaultInitialPosition = dimensions.height - TOOLBAR_HEIGHT

  const translateY = useSharedValue(initialPosition ?? defaultInitialPosition)
  const translateX = useSharedValue(0)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Listen for dimension changes (orientation changes)
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({window}) => {
      const {width, height} = window
      setDimensions({width, height})

      // Adjust toolbar position if it would be off-screen after rotation
      if (translateY.value > height - TOOLBAR_HEIGHT) {
        translateY.value = withTiming(height - TOOLBAR_HEIGHT, {
          duration: 300,
          easing: Easing.inOut(Easing.ease)
        })
      }

      // Handle horizontal position adjustment if collapsed
      if (isCollapsed && translateX.value > 0) {
        translateX.value = withTiming(width - VISIBLE_PORTION, {
          duration: 300,
          easing: Easing.inOut(Easing.ease)
        })
      }
    })

    return () => subscription.remove()
  }, [isCollapsed])

  useAnimatedReaction(
    () => translateX.value,
    value => {
      runOnJS(setIsCollapsed)(value > 0)
    }
  )

  const handleCollapse = useCallback(() => {
    translateX.value = withTiming(dimensions.width - VISIBLE_PORTION, {
      duration: 300,
      easing: Easing.inOut(Easing.ease)
    })
  }, [dimensions.width])

  const handleExpand = useCallback(() => {
    if (translateX.value > 0) {
      translateX.value = withTiming(0, {
        duration: 300,
        easing: Easing.inOut(Easing.ease)
      })
    }
  }, [])

  const panGestureHandler = useAnimatedGestureHandler({
    onStart: (event, context: GestureContext) => {
      context.startY = translateY.value
      context.startX = translateX.value
      context.isHorizontalSwipe = false
    },
    onActive: (event, context) => {
      // Determine if this is primarily a horizontal or vertical gesture
      // We do this by checking which has greater magnitude
      if (!context.isHorizontalSwipe && Math.abs(event.translationX) < Math.abs(event.translationY)) {
        // Vertical gesture - keep existing behavior
        const newPosition = context.startY + event.translationY
        translateY.value = Math.max(minOffset, Math.min(maxOffset, newPosition))

        if (onPositionChange) {
          runOnJS(handlePositionChange)(translateY.value)
        }
      } else {
        // Horizontal gesture
        context.isHorizontalSwipe = true

        // Check direction of swipe
        if (context.startX === 0) {
          // Panel is expanded, handle collapsing
          const newX = Math.max(0, event.translationX)
          if (newX > dimensions.width / 4) {
            // If swiped more than 1/4 of screen width, snap to collapsed state
            translateX.value = withTiming(dimensions.width - VISIBLE_PORTION, {
              duration: 300,
              easing: Easing.inOut(Easing.ease)
            })
          } else {
            // Otherwise, follow finger
            translateX.value = newX
          }
        } else {
          // Panel is collapsed, handle expanding
          const newX = Math.max(0, context.startX + event.translationX)
          if (newX < dimensions.width - VISIBLE_PORTION - dimensions.width / 4) {
            // If swiped more than 1/4 of screen width toward left, snap to expanded state
            translateX.value = withTiming(0, {
              duration: 300,
              easing: Easing.inOut(Easing.ease)
            })
          } else {
            // Otherwise, follow finger but don't go past fully expanded
            translateX.value = Math.min(dimensions.width - VISIBLE_PORTION, newX)
          }
        }
      }
    },
    onEnd: (event, context) => {
      if (context.isHorizontalSwipe) {
        // Horizontal gesture ended - snap to expanded or collapsed state
        if (translateX.value > (dimensions.width - VISIBLE_PORTION) / 2) {
          // Collapse if dragged more than halfway
          translateX.value = withTiming(dimensions.width - VISIBLE_PORTION, {
            duration: 300,
            easing: Easing.inOut(Easing.ease)
          })
          runOnJS(setIsCollapsed)(true)
        } else {
          // Expand
          translateX.value = withTiming(0, {
            duration: 300,
            easing: Easing.inOut(Easing.ease)
          })
          runOnJS(setIsCollapsed)(false)
        }
      } else {
        // Vertical gesture ended - keep existing behavior
        if (translateX.value === 0) {
          translateY.value = withSpring(Math.max(minOffset, Math.min(maxOffset, translateY.value)), SPRING_CONFIG)
        }
      }
    }
  })

  const handlePositionChange = useCallback(
    (position: number) => {
      onPositionChange?.(position)
    },
    [onPositionChange]
  )

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{translateY: translateY.value}, {translateX: translateX.value}]
  }))

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.container, animatedStyle, {width: dimensions.width}]}>
        <View style={[styles.handleContainer, {width: dimensions.width}]}>
          <View style={styles.handleIndicator} />
        </View>
        <TouchableOpacity
          style={styles.gestureContainer}
          onPress={isCollapsed ? handleExpand : undefined}
          activeOpacity={isCollapsed ? 0.6 : 1}
        >
          <PanGestureHandler onGestureEvent={panGestureHandler}>
            <Animated.View style={styles.gestureContainer}>
              <AnimatedBlurView
                intensity={100}
                tint="dark"
                style={[
                  styles.blurContainer,
                  {
                    borderRadius: isCollapsed && translateX.value !== 0 ? 36 : 0
                  }
                ]}
              >
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleCollapse}
                  hitSlop={{top: 10, right: 10, bottom: 10, left: 10}}
                >
                  <Right color="#FFC312" />
                </TouchableOpacity>

                <View style={styles.content}>{children}</View>
                {isCollapsed && (
                  <View style={styles.expandButton}>
                    <Left color="#FFC312" />
                  </View>
                )}
              </AnimatedBlurView>
            </Animated.View>
          </PanGestureHandler>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    height: TOOLBAR_HEIGHT,
    zIndex: 1,
    shadowColor: "#000",
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 0
  },
  gestureContainer: {
    flex: 1
  },
  blurContainer: {
    flex: 1,
    borderBottomRightRadius: 0,
    borderTopRightRadius: 0,
    overflow: "hidden",
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },
  closeButton: {
    position: "absolute",
    top: 0,
    right: 4,
    height: TOOLBAR_HEIGHT,
    zIndex: 2,
    backgroundColor: "transparent",
    padding: 10,
    width: 35,
    opacity: 0.8,
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },
  expandButton: {
    position: "absolute",
    top: 0,
    left: 4,
    height: TOOLBAR_HEIGHT,
    zIndex: 2,
    backgroundColor: "transparent",
    padding: 10,
    width: 35,
    opacity: 0.8,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: -14
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 24
  },
  handleContainer: {
    top: 14,
    alignItems: "center",
    zIndex: 1,
    gap: 0
  },
  handleIndicator: {
    width: 36,
    height: 4,
    backgroundColor: "orange",
    opacity: 0.4,
    borderRadius: 2,
    marginLeft: 22
  }
})

export default DraggableToolbar
