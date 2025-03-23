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
          <Ionicons name="chatbox" size={30} color="#FFC312" />
          <Text style={{fontSize: 10, color: "#FFC312"}}>Remove Ads</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onAdSettings}>
          <Ionicons name="pricetag-outline" size={30} color="#FFC312" />
          <Text style={{fontSize: 10, color: "#FFC312"}}>Restore Purchases</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onSettings}>
          <Ionicons name="settings-outline" size={30} color="#FFC312" />
          <Text style={{fontSize: 10, color: "#FFC312"}}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center"
    // padding: 10
    // marginTop: -23
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
    gap: 10
  },
  actionButton: {
    width: 106,
    height: 66,
    borderRadius: 0,
    backgroundColor: "#E4582E00",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    borderWidth: 0,
    borderColor: "#FFC312",
    marginTop: 7
  }
})

export default Header
