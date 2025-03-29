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
const VISIBLE_PORTION = 34
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
  startX: number
  isHorizontalSwipe: boolean
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView)

export function DraggableToolbar({children, onPositionChange, initialPosition}: DraggableToolbarProps) {
  // State to track current screen dimensions
  const [dimensions, setDimensions] = useState({
    width: initialDimensions.width,
    height: initialDimensions.height
  })

  // Use current dimensions to calculate max offset and initial position
  const minOffset = Platform.OS === "android" ? -10 : 0
  const maxOffset = Platform.OS === "android" ? dimensions.height - 60 : dimensions.height - TOOLBAR_HEIGHT

  // Calculate default initialPosition based on current dimensions if not provided
  const defaultInitialPosition = dimensions.height - TOOLBAR_HEIGHT

  const translateY = useSharedValue(initialPosition ?? defaultInitialPosition)
  const translateX = useSharedValue(0)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [initialAnimationDone, setInitialAnimationDone] = useState(false)
  const [activeSide, setActiveSide] = useState<"left" | "right">("right")

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
      if (isCollapsed) {
        if (activeSide === "right" && translateX.value > 0) {
          translateX.value = withTiming(width - VISIBLE_PORTION, {
            duration: 300,
            easing: Easing.inOut(Easing.ease)
          })
        } else if (activeSide === "left" && translateX.value < 0) {
          translateX.value = withTiming(-(width - VISIBLE_PORTION), {
            duration: 300,
            easing: Easing.inOut(Easing.ease)
          })
        }
      }
    })

    return () => subscription.remove()
  }, [isCollapsed, activeSide])

  useAnimatedReaction(
    () => translateX.value,
    value => {
      runOnJS(setIsCollapsed)(value !== 0)
    }
  )

  const handleCollapseRight = useCallback(() => {
    translateX.value = withTiming(dimensions.width - VISIBLE_PORTION, {
      duration: 300,
      easing: Easing.inOut(Easing.ease)
    })
    setActiveSide("right")
  }, [dimensions.width])

  const handleCollapseLeft = useCallback(() => {
    translateX.value = withTiming(-(dimensions.width - VISIBLE_PORTION), {
      duration: 300,
      easing: Easing.inOut(Easing.ease)
    })
    setActiveSide("left")
  }, [dimensions.width])

  const handleExpand = useCallback(() => {
    translateX.value = withTiming(0, {
      duration: 300,
      easing: Easing.inOut(Easing.ease)
    })
  }, [])

  const handlePositionChange = useCallback(
    (position: number) => {
      onPositionChange?.(position)
    },
    [onPositionChange]
  )

  // Enhanced gesture handler with side-switching support
  const panGestureHandler = useAnimatedGestureHandler({
    onStart: (event, context: GestureContext) => {
      context.startY = translateY.value
      context.startX = translateX.value
      context.isHorizontalSwipe = false
    },
    onActive: (event, context) => {
      // Determine horizontal or vertical movement - use a threshold
      const DIRECTION_THRESHOLD = 10

      if (
        !context.isHorizontalSwipe &&
        (Math.abs(event.translationX) > DIRECTION_THRESHOLD || Math.abs(event.translationY) > DIRECTION_THRESHOLD)
      ) {
        // Set swipe direction once it's clear
        context.isHorizontalSwipe = Math.abs(event.translationX) > Math.abs(event.translationY)
      }

      if (!context.isHorizontalSwipe) {
        // VERTICAL GESTURE - Fix for Android
        const newPosition = context.startY + event.translationY
        translateY.value = Math.max(minOffset, Math.min(maxOffset, newPosition))

        if (onPositionChange) {
          runOnJS(handlePositionChange)(translateY.value)
        }
      } else {
        // HORIZONTAL GESTURE - Enhanced with side switching
        if (context.startX === 0) {
          // Panel is expanded, handle collapsing to either side
          if (event.translationX > 0) {
            // Swiping right - collapse to right
            const newX = Math.max(0, event.translationX)
            translateX.value = newX

            if (newX > dimensions.width / 4) {
              // If dragged far enough, snap to right side
              translateX.value = withTiming(dimensions.width - VISIBLE_PORTION, {
                duration: 300,
                easing: Easing.inOut(Easing.ease)
              })
              runOnJS(setActiveSide)("right")
            }
          } else if (event.translationX < 0) {
            // Swiping left - collapse to left
            const newX = Math.min(0, event.translationX)
            translateX.value = newX

            if (newX < -dimensions.width / 4) {
              // If dragged far enough, snap to left side
              translateX.value = withTiming(-(dimensions.width - VISIBLE_PORTION), {
                duration: 300,
                easing: Easing.inOut(Easing.ease)
              })
              runOnJS(setActiveSide)("left")
            }
          }
        } else if (context.startX > 0) {
          // Panel is collapsed to right, handle expanding
          const newX = Math.max(0, context.startX + event.translationX)
          if (event.translationX < -dimensions.width / 4) {
            // Fast swipe left - expand
            translateX.value = withTiming(0, {
              duration: 300,
              easing: Easing.inOut(Easing.ease)
            })
          } else {
            // Follow finger
            translateX.value = Math.min(dimensions.width - VISIBLE_PORTION, newX)
          }
        } else if (context.startX < 0) {
          // Panel is collapsed to left, handle expanding
          const newX = Math.min(0, context.startX + event.translationX)
          if (event.translationX > dimensions.width / 4) {
            // Fast swipe right - expand
            translateX.value = withTiming(0, {
              duration: 300,
              easing: Easing.inOut(Easing.ease)
            })
          } else {
            // Follow finger
            translateX.value = Math.max(-(dimensions.width - VISIBLE_PORTION), newX)
          }
        }
      }
    },
    onEnd: (event, context) => {
      if (context.isHorizontalSwipe) {
        // Complete horizontal gesture with snapping
        if (translateX.value === 0) {
          // Currently expanded - determine which way to collapse
          if (event.translationX > dimensions.width / 4) {
            // Collapse to right
            translateX.value = withTiming(dimensions.width - VISIBLE_PORTION, {
              duration: 300,
              easing: Easing.inOut(Easing.ease)
            })
            runOnJS(setActiveSide)("right")
          } else if (event.translationX < -dimensions.width / 4) {
            // Collapse to left
            translateX.value = withTiming(-(dimensions.width - VISIBLE_PORTION), {
              duration: 300,
              easing: Easing.inOut(Easing.ease)
            })
            runOnJS(setActiveSide)("left")
          } else {
            // Not enough movement, stay expanded
            translateX.value = withTiming(0, {
              duration: 300,
              easing: Easing.inOut(Easing.ease)
            })
          }
        } else if (translateX.value > 0) {
          // Currently collapsed to right or partially moved
          if (translateX.value < (dimensions.width - VISIBLE_PORTION) / 2) {
            // Expand if dragged more than halfway
            translateX.value = withTiming(0, {
              duration: 300,
              easing: Easing.inOut(Easing.ease)
            })
          } else {
            // Stay collapsed to right
            translateX.value = withTiming(dimensions.width - VISIBLE_PORTION, {
              duration: 300,
              easing: Easing.inOut(Easing.ease)
            })
          }
        } else if (translateX.value < 0) {
          // Currently collapsed to left or partially moved
          if (translateX.value > -(dimensions.width - VISIBLE_PORTION) / 2) {
            // Expand if dragged more than halfway
            translateX.value = withTiming(0, {
              duration: 300,
              easing: Easing.inOut(Easing.ease)
            })
          } else {
            // Stay collapsed to left
            translateX.value = withTiming(-(dimensions.width - VISIBLE_PORTION), {
              duration: 300,
              easing: Easing.inOut(Easing.ease)
            })
          }
        }
      } else {
        // Complete vertical gesture with spring animation
        translateY.value = withSpring(Math.max(minOffset, Math.min(maxOffset, translateY.value)), SPRING_CONFIG)
      }
    }
  })

  useEffect(() => {
    if (!initialAnimationDone) {
      const timer = setTimeout(() => {
        handleCollapseRight()
        setInitialAnimationDone(true)
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [initialAnimationDone, handleCollapseRight])

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
          <PanGestureHandler
            onGestureEvent={panGestureHandler}
            minDist={5} // Lower threshold for gesture detection on Android
            avgTouches // More stable gesture recognition on Android
          >
            <Animated.View style={styles.gestureContainer}>
              <AnimatedBlurView
                intensity={100}
                tint="dark"
                style={[
                  styles.blurContainer,
                  {
                    borderRadius: isCollapsed ? 36 : 0,
                    borderTopLeftRadius: activeSide === "right" ? (isCollapsed ? 36 : 0) : 0,
                    borderBottomLeftRadius: activeSide === "right" ? (isCollapsed ? 36 : 0) : 0,
                    borderTopRightRadius: activeSide === "left" ? (isCollapsed ? 36 : 0) : 0,
                    borderBottomRightRadius: activeSide === "left" ? (isCollapsed ? 36 : 0) : 0
                  }
                ]}
              >
                {/* Close buttons - different sides */}
                {!isCollapsed && (
                  <>
                    <TouchableOpacity
                      style={styles.closeButtonRight}
                      onPress={handleCollapseRight}
                      hitSlop={{top: 10, right: 10, bottom: 10, left: 10}}
                    >
                      <Right color="#FFC312" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.closeButtonLeft}
                      onPress={handleCollapseLeft}
                      hitSlop={{top: 10, right: 10, bottom: 10, left: 10}}
                    >
                      <Left color="#FFC312" />
                    </TouchableOpacity>
                  </>
                )}

                <View style={styles.content}>{children}</View>

                {/* Expand buttons - show based on which side is active */}
                {isCollapsed && activeSide === "right" && (
                  <View style={styles.expandButtonLeft}>
                    <Left color="#FFC312" />
                  </View>
                )}
                {isCollapsed && activeSide === "left" && (
                  <View style={styles.expandButtonRight}>
                    <Right color="#FFC312" />
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
    alignItems: "center",
    backgroundColor: Platform.OS === "android" ? "rgba(0, 0, 0, 0.7)" : "rgba(0, 0, 0, 0.5)", // Darker background for Android
    shadowColor: "#fff",
    shadowOffset: {width: 13, height: 16},
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: Platform.OS === "android" ? 8 : 0 // Increased elevation for Android
  },
  closeButtonRight: {
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
  closeButtonLeft: {
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
    alignItems: "center"
  },
  expandButtonLeft: {
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
    alignItems: "center"
  },
  expandButtonRight: {
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
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
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
    margin: 0,
    padding: 0
  }
})

export default DraggableToolbar
