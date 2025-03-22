import React from "react"
import {StyleSheet, View, Text, TouchableOpacity} from "react-native"
import {Ionicons} from "@expo/vector-icons"

interface HeaderProps {
  onSettings: () => void
  onBulkDownload: () => void
  onAdSettings: () => void
}

const Header: React.FC<HeaderProps> = ({onSettings, onBulkDownload, onAdSettings}) => {
  return (
    <View style={styles.headerContainer}>
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={onBulkDownload}>
          <Ionicons name="download-outline" size={30} color="#FFC312" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onAdSettings}>
          <Ionicons name="pricetag-outline" size={30} color="#FFC312" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onSettings}>
          <Ionicons name="settings-outline" size={30} color="#FFC312" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    marginTop: -23
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333"
  },
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20
  },
  actionButton: {
    width: 66,
    height: 66,
    borderRadius: 3318,
    backgroundColor: "#E4582E00",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFC312",
    marginLeft: 10
  }
})

export default Header
