import React, {useEffect, useRef} from "react"
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  SafeAreaView,
  useColorScheme
} from "react-native"
import {Ionicons} from "@expo/vector-icons"

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
  appDescription = "A simple tool for finding and downloading media resources from any website. Enter a URL and get instant access to all available images and videos. \n\nThis app is not a video stream downloader, but a general media file inspector for websites."
}) => {
  const theme = useColorScheme()
  return (
    <Modal
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      supportedOrientations={["portrait"]}
      statusBarTranslucent={true}
      shouldRasterizeIOS={true}
      hardwareAccelerated={true}
      visible={visible}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.overlay}>
          <Animated.View
            style={[
              styles.modalContainer,
              {
                backgroundColor: theme === "dark" ? "#333" : "#FFFFFFFD"
              }
            ]}
          >
            {/* Header with title and close button */}

            <View style={styles.header}>
              <Text
                style={[
                  styles.title,
                  {
                    color: theme === "dark" ? "#FFFFFFA8" : "#333"
                  }
                ]}
              >
                Settings
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close-circle" size={30} color="#FFC312" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
              {/* Version Info Section */}
              <View style={styles.section}>
                {/* <Text style={styles.sectionTitle}>App Information</Text> */}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Version</Text>
                  <Text style={styles.infoValue}>{appVersion}</Text>
                </View>
              </View>
              {/* App Description Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.descriptionText}>{appDescription}</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Disclaimer</Text>
                <Text style={styles.descriptionText}>
                  Please note usually the media of websites belong to their owners. Check you have proper usage rights.
                  We claim no ownership of any media found using this tool.
                </Text>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const tab = Platform.OS === "ios" && Platform.isPad

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0)",
    justifyContent: "center"
  },
  modalContainer: {
    height: tab ? height * 0.4 : height * 0.5,
    width: tab ? "60%" : "90%",
    maxWidth: 400,
    borderRadius: 36,
    marginHorizontal: "auto",
    overflow: "hidden",
    padding: 16,
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
    borderBottomWidth: 0,
    borderBottomColor: "#9E2020FF"
  },
  title: {
    fontSize: 20,
    fontWeight: "400",
    color: "#333"
  },
  closeButton: {
    padding: 5
  },
  content: {
    flex: 1
  },
  section: {
    padding: 16,
    borderBottomWidth: 0,
    borderBottomColor: "#f0f0f0"
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#7C7C7CFF"
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#666"
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8
  },
  infoLabel: {
    fontSize: 16,
    color: "#969696FF"
  },
  infoValue: {
    fontSize: 16,
    color: "#7C7C7CFF",
    fontWeight: "500"
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0"
  },
  settingTextContainer: {
    flex: 1
  },
  settingLabel: {
    fontSize: 16,
    color: "#7C7C7CFF",
    marginBottom: 4
  },
  settingDescription: {
    fontSize: 14,
    color: "#999"
  },
  settingControl: {
    marginLeft: 8
  }
})

export default SettingsModal
