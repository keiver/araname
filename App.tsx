import React from "react"
import {SafeAreaView, StatusBar, StyleSheet} from "react-native"
import {GestureHandlerRootView} from "react-native-gesture-handler"
import Game from "./src/Game"
import {COLORS} from "./src/constants"

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.BACKGROUND} />
        <Game />
      </SafeAreaView>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND
  }
})
