import React, {useCallback, useState} from "react"
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

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get("window")
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

export function DraggableToolbar({
  children,
  onPositionChange,
  initialPosition = SCREEN_HEIGHT - TOOLBAR_HEIGHT
}: DraggableToolbarProps) {
  const minOffset = 0
  const maxOffset = SCREEN_HEIGHT - TOOLBAR_HEIGHT

  const translateY = useSharedValue(initialPosition)
  const translateX = useSharedValue(0)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useAnimatedReaction(
    () => translateX.value,
    value => {
      runOnJS(setIsCollapsed)(value > 0)
    }
  )

  const handleCollapse = useCallback(() => {
    translateX.value = withTiming(SCREEN_WIDTH - VISIBLE_PORTION, {
      duration: 300,
      easing: Easing.inOut(Easing.ease)
    })
  }, [])

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
          if (newX > SCREEN_WIDTH / 4) {
            // If swiped more than 1/4 of screen width, snap to collapsed state
            translateX.value = withTiming(SCREEN_WIDTH - VISIBLE_PORTION, {
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
          if (newX < SCREEN_WIDTH - VISIBLE_PORTION - SCREEN_WIDTH / 4) {
            // If swiped more than 1/4 of screen width toward left, snap to expanded state
            translateX.value = withTiming(0, {
              duration: 300,
              easing: Easing.inOut(Easing.ease)
            })
          } else {
            // Otherwise, follow finger but don't go past fully expanded
            translateX.value = Math.min(SCREEN_WIDTH - VISIBLE_PORTION, newX)
          }
        }
      }
    },
    onEnd: (event, context) => {
      if (context.isHorizontalSwipe) {
        // Horizontal gesture ended - snap to expanded or collapsed state
        if (translateX.value > (SCREEN_WIDTH - VISIBLE_PORTION) / 2) {
          // Collapse if dragged more than halfway
          translateX.value = withTiming(SCREEN_WIDTH - VISIBLE_PORTION, {
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
      <Animated.View style={[styles.container, animatedStyle]}>
        <View style={styles.handleContainer}>
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
    width: SCREEN_WIDTH,
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
    gap: 0,
    width: Dimensions.get("window").width
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
