import React from "react"
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  useColorScheme
} from "react-native"
import {Ionicons} from "@expo/vector-icons"
import {BlurView} from "expo-blur"

// Get screen dimensions
const {width, height} = Dimensions.get("window")

interface SettingsModalProps {
  visible: boolean
  onClose: () => void
  appVersion?: string
  appDescription?: string
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  appVersion = "1.0.0",
  appDescription = "A simple and professional tool for web developers and designers to inspect, analyze, and test media resources on websites. Identify optimization opportunities, analyze resource dimensions, and verify content implementation across different environments."
}) => {
  const theme = useColorScheme()
  const isDark = theme === "dark"

  return (
    <ScrollView style={styles.content}>
      {/* App Description Section */}
      <View style={styles.section}>
        <Text
          style={[
            styles.sectionTitle,
            {
              color: isDark ? "#FFFFFF" : "#00000093",
              textShadowColor: "#C8C8C854",
              textShadowOffset: {width: 0, height: 1},
              textShadowRadius: 1
            }
          ]}
        >
          About
        </Text>
        <Text style={[styles.descriptionText, {color: isDark ? "#CCCCCC" : "#666"}]}>{appDescription}</Text>
      </View>

      <View style={styles.section}>
        <Text
          style={[
            styles.sectionTitle,
            {
              color: isDark ? "#FFFFFF" : "#00000093",
              textShadowColor: "#C8C8C854",
              textShadowOffset: {width: 0, height: 1},
              textShadowRadius: 1
            }
          ]}
        >
          Intended Usage & Legal Notice
        </Text>
        <View style={{flexDirection: "row", alignItems: "center", marginBottom: 12}}>
          <Ionicons
            name="information-circle"
            size={22}
            color={isDark ? "#FFC814FF" : "#FFC814FF"}
            style={{marginRight: 8}}
          />
          <Text style={[styles.descriptionText, {color: isDark ? "#CCCCCC" : "#666", flex: 1}]}>
            Araname is intended for professional web development, testing, and optimization purposes only.
          </Text>
        </View>

        <View style={{flexDirection: "row", alignItems: "flex-start", marginBottom: 12}}>
          <Ionicons
            name="alert-circle"
            size={22}
            color={isDark ? "#FF3B30" : "#FF3B30"}
            style={{marginRight: 8, marginTop: 2}}
          />
          <Text style={[styles.descriptionText, {color: isDark ? "#FF6B60" : "#FF3B30", flex: 1, fontWeight: "500"}]}>
            DO NOT DOWNLOAD COPYRIGHTED MATERIAL
          </Text>
        </View>

        <Text style={[styles.descriptionText, {color: isDark ? "#CCCCCC" : "#666"}]}>
          All media assets accessed through this tool are likely protected by copyright laws. Downloading, storing, or
          distributing these assets without permission is ILLEGAL and may result in legal action against you.
        </Text>

        <View style={{flexDirection: "row", alignItems: "center", marginTop: 12}}>
          <Ionicons name="shield-checkmark" size={22} color={isDark ? "#4CD964" : "#4CD964"} style={{marginRight: 8}} />
          <Text style={[styles.descriptionText, {color: isDark ? "#CCCCCC" : "#666", flex: 1}]}>
            You are solely responsible for ensuring you have proper rights or permissions before saving or using any
            media resources.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text
          style={[
            styles.sectionTitle,
            {
              color: isDark ? "#FFFFFF" : "#00000093",
              textShadowColor: "#C8C8C854",
              textShadowOffset: {width: 0, height: 1},
              textShadowRadius: 1
            }
          ]}
        >
          Developer Resources
        </Text>
        <Text style={[styles.descriptionText, {color: isDark ? "#CCCCCC" : "#666"}]}>
          For optimal web resource inspection, we recommend using this tool alongside other web development tools such
          as browser inspectors, performance testing suites, and accessibility checkers to ensure comprehensive analysis
          of your web projects.
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, {color: isDark ? "#BBBBBB" : "#969696FF"}]}>Version</Text>
          <Text style={[styles.infoValue, {color: isDark ? "#DDDDDD" : "#7C7C7CFF"}]}>{appVersion}</Text>
        </View>
      </View>
    </ScrollView>
  )
}

const tab = Platform.OS === "ios" && Platform.isPad

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0)" // Re-added background color
  },
  blurContainer: {
    width: tab ? "60%" : "90%",
    maxWidth: 500,
    maxHeight: height * 0.8,
    borderRadius: 36,
    overflow: "hidden"
  },
  modalContainer: {
    width: "100%",
    height: "100%",
    borderRadius: 36,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)"
  },
  title: {
    fontSize: 20,
    fontWeight: "600"
  },
  closeButton: {
    padding: 5
  },
  content: {
    flex: 1,
    padding: 15
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8
  },
  infoLabel: {
    fontSize: 16
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "500"
  }
})

export default SettingsModal
