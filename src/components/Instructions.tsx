/**
 * Game instructions component
 */

import React, {memo} from "react"
import {View, Text, StyleSheet} from "react-native"
import {COLORS, DIMENSIONS} from "../constants"

export const Instructions = memo(() => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Drag and release circles to launch them. Collisions score points!</Text>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    opacity: 0.8,
    bottom: DIMENSIONS.INSTRUCTIONS_BOTTOM,
    left: 20,
    right: 20,
    backgroundColor: COLORS.PANEL_BACKGROUND,
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(75, 75, 75, 0.5)",
    zIndex: 5,
    // Add subtle shadow
    shadowColor: "#000",
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3
  },
  text: {
    color: COLORS.INSTRUCTIONS_TEXT,
    textAlign: "center",
    fontSize: 16
  }
})

export default Instructions
