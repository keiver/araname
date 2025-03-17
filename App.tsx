import React from "react"
import {SafeAreaView, StatusBar, StyleSheet} from "react-native"
import CircleGameExample from "./src/Game"

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <CircleGameExample />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000"
  }
})
