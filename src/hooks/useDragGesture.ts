/**
 * Hook for handling drag gestures with position fix
 */

import {useCallback, useState} from "react"
import {Gesture} from "react-native-gesture-handler"
import {runOnJS} from "react-native-reanimated"
import {Vector2D, Circle, SlingshotState} from "../types/game.types"
import {DIMENSIONS, PHYSICS} from "../constants"
import {Vector, calculateSlingshotVelocity} from "../utils/physics"

interface UseDragGestureProps {
  circles: Circle[]
  onDragStart: (id: string) => void
  onDragUpdate: (id: string, position: Vector2D) => void
  onDragEnd: (id: string, velocity: Vector2D) => void
}

export function useDragGesture({circles, onDragStart, onDragUpdate, onDragEnd}: UseDragGestureProps) {
  // Slingshot state
  const [slingshot, setSlingshot] = useState<SlingshotState>({
    isActive: false,
    startPoint: {x: 0, y: 0},
    endPoint: {x: 0, y: 0},
    circleId: null
  })

  // Instead of using refs that get passed to worklets, use state
  const [activeDrag, setActiveDrag] = useState<{
    circleId: string | null
    startPoint: Vector2D
  }>({
    circleId: null,
    startPoint: {x: 0, y: 0}
  })

  // Find which circle was touched
  const findTouchedCircle = useCallback(
    (x: number, y: number): [string | null, Vector2D | null] => {
      for (const circle of circles) {
        // Skip circles being dragged already
        if (circle.isDragging) continue

        const dx = circle.position.x - x
        const dy = circle.position.y - y
        const distanceSquared = dx * dx + dy * dy
        const touchRadius = circle.radius * DIMENSIONS.TOUCH_RADIUS_MULTIPLIER

        if (distanceSquared <= touchRadius * touchRadius) {
          return [circle.id, circle.position]
        }
      }
      return [null, null]
    },
    [circles]
  )

  // Handle drag start
  const handleDragStart = useCallback(
    (x: number, y: number) => {
      const [circleId, position] = findTouchedCircle(x, y)

      if (circleId && position) {
        // Start dragging the circle
        onDragStart(circleId)

        // Set up the slingshot visual - important: use the circle's actual position
        setSlingshot({
          isActive: true,
          startPoint: {...position},
          endPoint: {...position},
          circleId
        })

        // Store the drag state
        setActiveDrag({
          circleId,
          startPoint: {...position}
        })

        return true
      }
      return false
    },
    [circles, findTouchedCircle, onDragStart]
  )

  // Handle drag update
  const handleDragUpdate = useCallback(
    (x: number, y: number) => {
      const {circleId, startPoint} = activeDrag

      if (!circleId) return

      // Calculate distance from start
      const dx = x - startPoint.x
      const dy = y - startPoint.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      let newPosition: Vector2D

      if (distance > PHYSICS.MAX_PULL_DISTANCE) {
        // Limit drag distance
        const angle = Math.atan2(dy, dx)
        newPosition = {
          x: startPoint.x + Math.cos(angle) * PHYSICS.MAX_PULL_DISTANCE,
          y: startPoint.y + Math.sin(angle) * PHYSICS.MAX_PULL_DISTANCE
        }
      } else {
        newPosition = {x, y}
      }

      // Update the circle position
      onDragUpdate(circleId, newPosition)

      // Update the slingshot visual - use the exact same position
      setSlingshot(prev => ({
        ...prev,
        endPoint: {...newPosition}
      }))
    },
    [activeDrag, onDragUpdate]
  )

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    const {circleId, startPoint} = activeDrag

    if (!circleId) return

    // Find the current end point from the slingshot
    const endPoint = slingshot.endPoint

    // Calculate velocity based on distance from start point
    const velocity = calculateSlingshotVelocity(startPoint, endPoint)

    // Apply velocity to the circle
    onDragEnd(circleId, velocity)

    // Reset the slingshot
    setSlingshot({
      isActive: false,
      startPoint: {x: 0, y: 0},
      endPoint: {x: 0, y: 0},
      circleId: null
    })

    // Reset the active drag
    setActiveDrag({
      circleId: null,
      startPoint: {x: 0, y: 0}
    })
  }, [activeDrag, slingshot.endPoint, onDragEnd])

  // Create a gesture handler for dragging
  const panGesture = Gesture.Pan()
    .onStart(event => {
      runOnJS(handleDragStart)(event.x, event.y)
    })
    .onUpdate(event => {
      runOnJS(handleDragUpdate)(event.x, event.y)
    })
    .onEnd(() => {
      runOnJS(handleDragEnd)()
    })
    .onFinalize(() => {
      // Ensure we clean up even if the gesture is interrupted
      if (activeDrag.circleId) {
        runOnJS(handleDragEnd)()
      }
    })

  return {
    gesture: panGesture,
    slingshot
  }
}
