/**
 * Main Game component
 */

import React, {memo, useCallback} from "react"
import {View, StyleSheet} from "react-native"
import {GestureDetector, GestureHandlerRootView} from "react-native-gesture-handler"

// Custom hooks
import {useGameLoop} from "./hooks/useGameLoop"
import {useDragGesture} from "./hooks/useDragGesture"

// Components
import CircleComponent from "./components/Circle"
import Slingshot from "./components/Slingshot"
import ScoreDisplay from "./components/ScoreDisplay"
import Instructions from "./components/Instructions"

// Constants
import {COLORS} from "./constants"
import {Vector2D} from "./types/game.types"

export const Game = memo(() => {
  // Game state and logic from custom hook
  const {gameState, pulseIntensity, actions} = useGameLoop()

  // Callback handlers for the drag gesture
  const handleDragStart = useCallback(
    (id: string) => {
      actions.startDragging(id)
    },
    [actions]
  )

  const handleDragUpdate = useCallback(
    (id: string, position: Vector2D) => {
      actions.updateDragPosition(id, position)
    },
    [actions]
  )

  const handleDragEnd = useCallback(
    (id: string, velocity: Vector2D) => {
      actions.endDragging(id, velocity)
    },
    [actions]
  )

  // Gesture handling with custom hook - pass the fixed version
  const {gesture, slingshot} = useDragGesture({
    circles: gameState.circles,
    onDragStart: handleDragStart,
    onDragUpdate: handleDragUpdate,
    onDragEnd: handleDragEnd
  })

  return (
    <View style={styles.container}>
      <GestureDetector gesture={gesture}>
        <View style={styles.gameArea}>
          {/* Render each circle */}
          {gameState.circles.map(circle => (
            <CircleComponent key={circle.id} circle={circle} pulseIntensity={pulseIntensity} />
          ))}

          {/* Fixed slingshot visualization */}
          <Slingshot slingshot={slingshot} />

          {/* UI Elements */}
          <ScoreDisplay score={gameState.score} highScore={gameState.highScore} />

          <Instructions />
        </View>
      </GestureDetector>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND
  },
  gameArea: {
    flex: 1,
    position: "relative"
  }
})

export default Game
