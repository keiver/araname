/**
 * Game loop hook - handles physics and game state updates
 * With memory leak fixes
 */

import {useState, useRef, useEffect, useCallback} from "react"
import {PHYSICS, DIMENSIONS, TIME} from "../constants"
import {GameState, Circle, Collision, Vector2D} from "../types/game.types"
import {updateCirclePhysics, checkCircleCollision, resolveCollision} from "../utils/physics"

// Initial state
const initialState: GameState = {
  circles: [],
  score: 0,
  highScore: 0
}

export function useGameLoop() {
  // Game state
  const [gameState, setGameState] = useState<GameState>(initialState)
  const [pulseIntensity, setPulseIntensity] = useState(0)

  // Refs to avoid unnecessary re-renders
  const animationFrameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(Date.now())
  const isMountedRef = useRef(true)
  const activeTimeoutsRef = useRef<NodeJS.Timeout[]>([])
  const gameStateRef = useRef(gameState)

  // Keep gameStateRef updated
  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  // Initialize the game with starting circles
  const initializeGame = useCallback(() => {
    const now = Date.now()

    // Create initial circles
    const circle1: Circle = {
      id: "circle1",
      position: {
        x: DIMENSIONS.SCREEN_WIDTH * 0.3,
        y: DIMENSIONS.SCREEN_HEIGHT * 0.5
      },
      velocity: {x: 0, y: 0},
      radius: DIMENSIONS.DEFAULT_CIRCLE_RADIUS,
      mass: 1,
      color: "primary",
      glowColor: "primary",
      isActive: true,
      isDragging: false,
      createdAt: now,
      lastCollision: null
    }

    const circle2: Circle = {
      id: "circle2",
      position: {
        x: DIMENSIONS.SCREEN_WIDTH * 0.7,
        y: DIMENSIONS.SCREEN_HEIGHT * 0.5
      },
      velocity: {x: 0, y: 0},
      radius: DIMENSIONS.LARGE_CIRCLE_RADIUS,
      mass: 1.5,
      color: "primary",
      glowColor: "primary",
      isActive: true,
      isDragging: false,
      createdAt: now - 5000, // Started 5 seconds ago
      lastCollision: null
    }

    setGameState({
      ...initialState,
      circles: [circle1, circle2]
    })
  }, [])

  // Clear all timeouts to prevent memory leaks
  const clearAllTimeouts = useCallback(() => {
    activeTimeoutsRef.current.forEach(timeout => clearTimeout(timeout))
    activeTimeoutsRef.current = []
  }, [])

  // Start dragging a circle
  const startDragging = useCallback((circleId: string) => {
    // Skip if already dragging this circle (prevent duplicate handlers)
    if (gameStateRef.current.circles.find(c => c.id === circleId)?.isDragging) {
      return
    }

    console.log("Starting drag for circle:", circleId)
    setGameState(prev => {
      const newCircles = prev.circles.map(circle =>
        circle.id === circleId ? {...circle, isDragging: true, velocity: {x: 0, y: 0}} : circle
      )
      return {...prev, circles: newCircles}
    })
  }, [])

  // Update circle position during drag
  const updateDragPosition = useCallback((circleId: string, position: Vector2D) => {
    setGameState(prev => {
      const newCircles = prev.circles.map(circle =>
        circle.id === circleId ? {...circle, position, isDragging: true} : circle
      )
      return {...prev, circles: newCircles}
    })
  }, [])

  // End dragging and apply velocity
  const endDragging = useCallback((circleId: string, velocity: Vector2D) => {
    // Skip if not dragging this circle (prevent duplicate handlers)
    if (!gameStateRef.current.circles.find(c => c.id === circleId)?.isDragging) {
      return
    }

    console.log("Ending drag for circle:", circleId, "with velocity:", velocity)
    setGameState(prev => {
      const newCircles = prev.circles.map(circle =>
        circle.id === circleId ? {...circle, isDragging: false, velocity} : circle
      )
      return {...prev, circles: newCircles}
    })
  }, [])

  // Handle collisions between circles
  const handleCollisions = useCallback((circles: Circle[]): [Circle[], boolean] => {
    let newCircles = [...circles]
    let hadCollision = false

    // Check all possible pairs of circles
    for (let i = 0; i < newCircles.length; i++) {
      for (let j = i + 1; j < newCircles.length; j++) {
        const circleA = newCircles[i]
        const circleB = newCircles[j]

        const collision = checkCircleCollision(circleA, circleB)

        if (collision) {
          const now = Date.now()
          const cooldownA = circleA.lastCollision ? now - circleA.lastCollision < PHYSICS.COLLISION_COOLDOWN : false
          const cooldownB = circleB.lastCollision ? now - circleB.lastCollision < PHYSICS.COLLISION_COOLDOWN : false

          // Only count for score if not in cooldown
          if (!cooldownA && !cooldownB) {
            hadCollision = true
          }

          // Resolve the collision physics
          const [updatedCircleA, updatedCircleB] = resolveCollision(circleA, circleB, collision)

          // Update the circles in our working array
          newCircles[i] = updatedCircleA
          newCircles[j] = updatedCircleB
        }
      }
    }

    return [newCircles, hadCollision]
  }, [])

  // Update game logic - separated from render for performance
  const updateGameState = useCallback(() => {
    if (!isMountedRef.current) return

    const now = Date.now()
    const deltaTime = now - lastTimeRef.current
    lastTimeRef.current = now

    // Limit delta time to prevent large jumps
    const dt = Math.min(deltaTime, TIME.MAX_DELTA_TIME)

    setGameState(prev => {
      // Apply physics to each circle
      let newCircles = prev.circles.map(circle => updateCirclePhysics(circle, dt))

      // Check and resolve collisions
      const [collidedCircles, hadCollision] = handleCollisions(newCircles)
      newCircles = collidedCircles

      // Update score if there was a collision
      let newScore = prev.score
      let newHighScore = prev.highScore

      if (hadCollision) {
        newScore += 1

        // Update high score if needed
        if (newScore > newHighScore) {
          newHighScore = newScore
        }

        // Set pulse effect - this will be handled in the component rendering
        setPulseIntensity(0.8)

        // Reset pulse effect after a delay - use a ref to track the timeout
        const timeoutId = setTimeout(() => {
          if (isMountedRef.current) {
            setPulseIntensity(0)
          }
        }, TIME.COLLISION_EFFECT_DURATION)

        // Store the timeout ID so we can clear it on unmount
        activeTimeoutsRef.current.push(timeoutId)
      }

      return {
        ...prev,
        circles: newCircles,
        score: newScore,
        highScore: newHighScore
      }
    })

    // Continue the game loop only if component is still mounted
    if (isMountedRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateGameState)
    }
  }, [handleCollisions])

  // Start and stop the game loop
  useEffect(() => {
    isMountedRef.current = true

    // Initialize the game
    initializeGame()

    // Start the game loop - only once
    if (animationFrameRef.current === null) {
      animationFrameRef.current = requestAnimationFrame(updateGameState)
    }

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }

      // Clear all active timeouts
      clearAllTimeouts()
    }
  }, [initializeGame, updateGameState, clearAllTimeouts])

  return {
    gameState,
    pulseIntensity,
    actions: {
      startDragging,
      updateDragPosition,
      endDragging,
      resetGame: initializeGame
    }
  }
}
