import React from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  useColorScheme,
  Linking
} from "react-native"
import {Ionicons} from "@expo/vector-icons"
import {Link} from "expo-router"

// Get screen dimensions
const {width, height} = Dimensions.get("window")

interface SettingsModalProps {
  appVersion?: string
  appDescription?: string
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  appVersion = "1.0.0",
  appDescription = "A simple tool for developers, designers and enthusiasts to inspect and analyze resources used on websites. The app loads the website and collects images and other media resources as seen by the browser to detect opportunities for optimization."
}) => {
  const theme = useColorScheme()
  const isDark = theme === "dark"

  const openPolicyPage = () => {
    Linking.openURL("https://keiver.dev/lab/araname#media-download-policy")
  }

  return (
    <ScrollView style={styles.content}>
      {/* App Description Section */}
      <View style={styles.section}>
        <Text style={[styles.descriptionText, {color: isDark ? "#CCCCCC" : "#666"}]}> {appDescription}</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.descriptionText, {color: isDark ? "#CCCCCC" : "#666", flex: 1}]}>
          You are responsible for ensuring you have proper rights before saving or using any media resources not owned
          by you.{" "}
          <Link
            style={[
              {
                color: isDark ? "#007AFF" : "#007AFF",
                textDecorationLine: "none",
                fontWeight: "300"
              }
            ]}
            href={"https://keiver.dev/lab/araname#media-download-policy"}
          >
            Read download policy here.
          </Link>
        </Text>
      </View>

      {/* <View style={styles.section}>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, {color: isDark ? "#BBBBBB" : "#969696FF"}]}>Version</Text>
          <Text style={[styles.infoValue, {color: isDark ? "#DDDDDD" : "#7C7C7CFF"}]}>{appVersion}</Text>
        </View>
      </View> */}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
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
    fontSize: 14,
    lineHeight: 22
  },
  policyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 228,
    marginVertical: 8
  },
  policyButtonText: {
    fontSize: 15,
    fontWeight: "600"
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
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10
  }
})

export default SettingsModal
