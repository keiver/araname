import React, {useState, useEffect, useRef, useCallback} from "react"
import {View, StyleSheet, Dimensions, Text, Animated} from "react-native"
import {Gesture, GestureDetector, GestureHandlerRootView} from "react-native-gesture-handler"
import Reanimated, {useSharedValue, runOnJS} from "react-native-reanimated"
import CircleRendererSkia, {Circle, CircleState} from "./Renderer"

const {width, height} = Dimensions.get("window")

// Physics constants
const GRAVITY = 0 // Set to 0 to remove gravity effect
const BOUNCE = 0.7
const FRICTION = 0.98
const MAX_PULL_DISTANCE = 150

// Color configurations for styling
const COLORS = {
  BACKGROUND: "#000000",
  PANEL_BACKGROUND: "rgba(0, 0, 0, 0.7)",
  TEXT: "#ffffff",
  SLINGSHOT: "rgba(100, 255, 100, 0.7)",
  SCORE_TEXT: "#ffffff",
  INSTRUCTIONS_TEXT: "#ffffff",
  HIGHLIGHT: "rgba(64, 224, 255, 0.8)"
}

const CircleGameExample: React.FC = () => {
  // Game state
  const [circles, setCircles] = useState<Circle[]>([])
  const [circleStates, setCircleStates] = useState<{[key: string]: CircleState}>({})
  const [pulseIntensity, setPulseIntensity] = useState(0)
  const [score, setScore] = useState(0)
  const [slingshotVisible, setSlingshotVisible] = useState(false)
  const [slingshotProps, setSlingshotProps] = useState({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0
  })

  // Animation frame reference
  const animationRef = useRef<number>()
  const lastTimeRef = useRef<number>(Date.now())

  // For tracking high score
  const [highScore, setHighScore] = useState<number>(0)

  // Shared values for interaction
  const activeDragId = useSharedValue<string | null>(null)
  const dragActive = useSharedValue(false)
  const dragStartX = useSharedValue(0)
  const dragStartY = useSharedValue(0)
  const dragX = useSharedValue(0)
  const dragY = useSharedValue(0)

  // For slingshot line
  const slingshotOpacity = useRef(new Animated.Value(0)).current

  // Helper to find which circle was touched - defined outside of gesture handler
  const findTouchedCircleIndex = useCallback((x: number, y: number, currentCircles: Circle[]) => {
    return currentCircles.findIndex(circle => {
      const dx = circle.x - x
      const dy = circle.y - y
      return Math.sqrt(dx * dx + dy * dy) <= circle.radius * 1.2
    })
  }, [])

  // Initialize game
  useEffect(() => {
    // Create two circles with different sizes
    const circle1: Circle = {
      id: "circle1",
      x: width * 0.3,
      y: height * 0.5,
      radius: 60,
      maxRadius: 60,
      createdAt: Date.now(),
      opacity: 1,
      vx: 0,
      vy: 0
    }

    const circle2: Circle = {
      id: "circle2",
      x: width * 0.7,
      y: height * 0.5,
      radius: 80,
      maxRadius: 80,
      createdAt: Date.now() - 5000, // Started 5 seconds ago
      opacity: 1,
      vx: 0,
      vy: 0
    }

    // Set initial states
    const initialStates = {
      circle1: {
        hasIntersections: false,
        isStable: true
      },
      circle2: {
        hasIntersections: false,
        isStable: true
      }
    }

    setCircles([circle1, circle2])
    setCircleStates(initialStates)

    // Start game loop
    startGameLoop()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  // Handle circle drag start
  const handleDragStart = useCallback(
    (touchX: number, touchY: number) => {
      const index = findTouchedCircleIndex(touchX, touchY, circles)

      if (index !== -1) {
        const circle = circles[index]

        // Update shared values without reading in render
        activeDragId.value = circle.id
        dragActive.value = true
        dragStartX.value = circle.x
        dragStartY.value = circle.y
        dragX.value = circle.x
        dragY.value = circle.y

        // Update React state for UI
        setSlingshotProps({
          startX: circle.x,
          startY: circle.y,
          currentX: circle.x,
          currentY: circle.y
        })
        setSlingshotVisible(true)

        // Show slingshot line
        Animated.timing(slingshotOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }).start()

        return true
      }
      return false
    },
    [circles, activeDragId, dragActive, dragStartX, dragStartY, dragX, dragY, findTouchedCircleIndex]
  )

  // Handle drag update
  const handleDragUpdate = useCallback(
    (touchX: number, touchY: number) => {
      if (!dragActive.value || !activeDragId.value) return

      // Calculate distance from start
      const dx = touchX - dragStartX.value
      const dy = touchY - dragStartY.value
      const distance = Math.sqrt(dx * dx + dy * dy)

      let newX, newY

      if (distance > MAX_PULL_DISTANCE) {
        // Limit drag distance
        const angle = Math.atan2(dy, dx)
        newX = dragStartX.value + Math.cos(angle) * MAX_PULL_DISTANCE
        newY = dragStartY.value + Math.sin(angle) * MAX_PULL_DISTANCE
      } else {
        newX = touchX
        newY = touchY
      }

      // Update shared values without reading in render
      dragX.value = newX
      dragY.value = newY

      // Update React state for UI
      setSlingshotProps(prev => ({
        ...prev,
        currentX: newX,
        currentY: newY
      }))

      // Update circle position
      const index = circles.findIndex(c => c.id === activeDragId.value)
      if (index !== -1) {
        const newCircles = [...circles]
        newCircles[index] = {
          ...newCircles[index],
          x: newX,
          y: newY
        }
        setCircles(newCircles)
      }
    },
    [circles, dragActive, activeDragId, dragStartX, dragStartY, dragX, dragY]
  )

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (!dragActive.value || !activeDragId.value) return

    const index = circles.findIndex(c => c.id === activeDragId.value)
    if (index !== -1) {
      // Calculate velocity
      const dx = dragStartX.value - dragX.value
      const dy = dragStartY.value - dragY.value

      // Update circle with velocity
      const newCircles = [...circles]
      newCircles[index] = {
        ...newCircles[index],
        vx: dx * 0.2,
        vy: dy * 0.2
      }
      setCircles(newCircles)
    }

    // Hide slingshot line
    setSlingshotVisible(false)
    Animated.timing(slingshotOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true
    }).start()

    // Reset drag state
    dragActive.value = false
    activeDragId.value = null
  }, [circles, dragActive, activeDragId, dragStartX, dragStartY, dragX, dragY])

  // Setup the gesture
  const gesture = Gesture.Pan()
    .onStart(event => {
      runOnJS(handleDragStart)(event.x, event.y)
    })
    .onUpdate(event => {
      runOnJS(handleDragUpdate)(event.x, event.y)
    })
    .onEnd(() => {
      runOnJS(handleDragEnd)()
    })

  // Game loop
  const startGameLoop = useCallback(() => {
    const update = () => {
      const now = Date.now()
      const deltaTime = now - lastTimeRef.current
      lastTimeRef.current = now

      // Limit delta time to prevent large jumps
      const dt = Math.min(deltaTime, 30) / 16

      setCircles(prevCircles => {
        // Skip physics update if no changes needed
        if (!prevCircles.some(c => c.vx || c.vy)) {
          return prevCircles
        }

        // Create a copy to modify
        const newCircles = [...prevCircles]
        let circlesChanged = false
        let collisionDetected = false

        // Store active drag ID locally to avoid reading .value in render
        const currentDragId = activeDragId.value

        // Update circle positions based on physics
        for (let i = 0; i < newCircles.length; i++) {
          const circle = newCircles[i]

          // Skip circle being dragged - use currentDragId instead of reading .value
          if (circle.id === currentDragId) {
            continue
          }

          // Apply velocity
          if (circle.vx || circle.vy) {
            circle.vx = (circle.vx || 0) * FRICTION
            circle.vy = (circle.vy || 0) * FRICTION // Removed gravity effect

            // Apply minimum threshold to stop very small movements
            if (Math.abs(circle.vx) < 0.1) circle.vx = 0
            if (Math.abs(circle.vy) < 0.1) circle.vy = 0

            circle.x += circle.vx * dt
            circle.y += circle.vy * dt
            circlesChanged = true
          }

          // Boundary collision
          if (circle.x - circle.radius < 0) {
            circle.x = circle.radius
            circle.vx = Math.abs(circle.vx) * BOUNCE
            circlesChanged = true
          } else if (circle.x + circle.radius > width) {
            circle.x = width - circle.radius
            circle.vx = -Math.abs(circle.vx) * BOUNCE
            circlesChanged = true
          }

          if (circle.y - circle.radius < 0) {
            circle.y = circle.radius
            circle.vy = Math.abs(circle.vy) * BOUNCE
            circlesChanged = true
          } else if (circle.y + circle.radius > height) {
            circle.y = height - circle.radius
            circle.vy = -Math.abs(circle.vy) * BOUNCE
            circlesChanged = true
          }
        }

        // Check for collisions between circles
        for (let i = 0; i < newCircles.length; i++) {
          for (let j = i + 1; j < newCircles.length; j++) {
            const circleA = newCircles[i]
            const circleB = newCircles[j]

            const dx = circleB.x - circleA.x
            const dy = circleB.y - circleA.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            const minDistance = circleA.radius + circleB.radius

            if (distance < minDistance) {
              collisionDetected = true

              // Handle collision
              const angle = Math.atan2(dy, dx)
              const ax = Math.cos(angle) * (minDistance - distance)
              const ay = Math.sin(angle) * (minDistance - distance)

              // Don't move the dragged circle - use currentDragId instead of reading .value
              if (circleA.id !== currentDragId) {
                circleA.vx = (circleA.vx || 0) - ax * 0.05
                circleA.vy = (circleA.vy || 0) - ay * 0.05
                circleA.x -= ax * 0.5
                circleA.y -= ay * 0.5
              }

              if (circleB.id !== currentDragId) {
                circleB.vx = (circleB.vx || 0) + ax * 0.05
                circleB.vy = (circleB.vy || 0) + ay * 0.05
                circleB.x += ax * 0.5
                circleB.y += ay * 0.5
              }

              circlesChanged = true
            }
          }
        }

        // Handle collision effects
        if (collisionDetected) {
          // Increment score
          setScore(prev => {
            const newScore = prev + 1
            // Update high score if needed
            if (newScore > highScore) {
              setHighScore(newScore)
            }
            return newScore
          })

          // Set pulse effect
          setPulseIntensity(0.8)

          // Update circle states
          setCircleStates(prev => {
            const newStates = {...prev}
            for (const circle of newCircles) {
              newStates[circle.id] = {
                ...newStates[circle.id],
                hasIntersections: true
              }
            }
            return newStates
          })

          // Reset pulse and intersection after a delay
          setTimeout(() => {
            setPulseIntensity(0)
            setCircleStates(prev => {
              const newStates = {...prev}
              for (const circle of newCircles) {
                newStates[circle.id] = {
                  ...newStates[circle.id],
                  hasIntersections: false
                }
              }
              return newStates
            })
          }, 500)
        }

        return circlesChanged ? newCircles : prevCircles
      })

      // Continue game loop
      animationRef.current = requestAnimationFrame(update)
    }

    animationRef.current = requestAnimationFrame(update)
  }, [activeDragId, highScore])

  // Render slingshot line using React state, not shared values
  const renderSlingshot = () => {
    if (!slingshotVisible) return null

    const dx = slingshotProps.currentX - slingshotProps.startX
    const dy = slingshotProps.currentY - slingshotProps.startY
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)
    const length = Math.sqrt(dx * dx + dy * dy)

    return (
      <Animated.View
        style={[
          styles.slingshot,
          {
            position: "absolute",
            left: slingshotProps.startX,
            top: slingshotProps.startY,
            width: length,
            height: 3,
            backgroundColor: COLORS.HIGHLIGHT,
            borderRadius: 3,
            transform: [{translateX: 0}, {translateY: -1.5}, {rotate: `${angle}deg`}, {translateX: 0}],
            opacity: slingshotOpacity,
            zIndex: 1000,
            transformOrigin: "left center"
          }
        ]}
      />
    )
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill}>
          {/* Each circle gets its own renderer */}
          {circles.map(circle => (
            <View key={circle.id} style={StyleSheet.absoluteFill}>
              <CircleRendererSkia
                circle={circle}
                circleState={circleStates[circle.id]}
                pulseIntensity={pulseIntensity}
                progressBarVisible={true}
              />
            </View>
          ))}

          {/* Slingshot visualization */}
          {renderSlingshot()}

          {/* Score display */}
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreText}>Score: {score}</Text>
            {highScore > 0 && <Text style={styles.highScoreText}>Best: {highScore}</Text>}
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsText}>
              Drag and release circles to launch them. Collisions score points!
            </Text>
          </View>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND
  },
  scoreContainer: {
    position: "absolute",
    top: 40,
    left: 20,
    backgroundColor: COLORS.PANEL_BACKGROUND,
    padding: 10,
    borderRadius: 5
  },
  scoreText: {
    color: COLORS.SCORE_TEXT,
    fontSize: 18,
    fontWeight: "bold"
  },
  highScoreText: {
    color: COLORS.HIGHLIGHT,
    fontSize: 14,
    marginTop: 4
  },
  instructionsContainer: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: COLORS.PANEL_BACKGROUND,
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(75, 75, 75, 0.5)"
  },
  instructionsText: {
    color: COLORS.INSTRUCTIONS_TEXT,
    textAlign: "center"
  },
  slingshot: {
    position: "absolute",
    height: 3,
    backgroundColor: COLORS.SLINGSHOT,
    borderRadius: 3,
    zIndex: 1000,
    shadowColor: COLORS.SLINGSHOT,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 5
  }
})

export default CircleGameExample
