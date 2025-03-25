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

// Get screen dimensions
const {width, height} = Dimensions.get("window")

interface SettingsModalProps {
  appVersion?: string
  appDescription?: string
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  appVersion = "1.0.0",
  appDescription = "A simple tool for developers and designers to inspect and analyze resources used on websites."
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
        <Text style={[styles.descriptionText, {color: isDark ? "#CCCCCC" : "#666"}]}>{appDescription}</Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.policyButton, {backgroundColor: isDark ? "#9090904D" : "#87878714"}]}
          onPress={openPolicyPage}
        >
          <Ionicons name="document-text-outline" size={20} color="#317EE3FF" style={{marginRight: 8}} />
          <Text style={[styles.policyButtonText, {color: isDark ? "#317EE3FF" : "#317EE3FF"}]}>
            Read Download Policy
          </Text>
        </TouchableOpacity>

        <View style={{flexDirection: "row", alignItems: "center", marginTop: 23}}>
          <Text style={[styles.descriptionText, {color: isDark ? "#CCCCCC" : "#666", flex: 1}]}>
            You are responsible for ensuring you have proper rights before saving or using any media resources not owned
            by you.
          </Text>
        </View>
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
