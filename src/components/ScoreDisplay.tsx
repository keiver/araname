/**
 * Score display component
 */

import React, {memo} from "react"
import {View, Text, StyleSheet} from "react-native"
import {COLORS, DIMENSIONS} from "../constants"

interface ScoreDisplayProps {
  score: number
  highScore: number
}

export const ScoreDisplay = memo(({score, highScore}: ScoreDisplayProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.scoreText}>Score: {score}</Text>
      {highScore > 0 && <Text style={styles.highScoreText}>Best: {highScore}</Text>}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: DIMENSIONS.SCORE_CONTAINER_TOP,
    left: DIMENSIONS.SCORE_CONTAINER_LEFT,
    backgroundColor: COLORS.PANEL_BACKGROUND,
    padding: 10,
    borderRadius: 5,
    zIndex: 10,
    // Add subtle shadow for depth
    shadowColor: "#000",
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5
  },
  scoreText: {
    color: COLORS.SCORE_TEXT,
    fontSize: 18,
    fontWeight: "bold"
  },
  highScoreText: {
    color: COLORS.HIGH_SCORE_TEXT,
    fontSize: 14,
    marginTop: 4
  }
})

export default ScoreDisplay
