import React, {useCallback, useMemo} from "react"
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Platform,
  useColorScheme
} from "react-native"
import {Ionicons} from "@expo/vector-icons"
import {BlurView} from "expo-blur"

interface ReusableModalProps {
  visible: boolean
  title?: string
  onClose: () => void
  children: React.ReactNode
  onOk?: () => void
  okText?: string
}

export const ReusableModal: React.FC<ReusableModalProps> = ({
  visible,
  title = "File Information",
  onClose,
  children,
  onOk,
  okText = "OK"
}) => {
  const theme = useColorScheme()
  const isDark = theme === "dark"

  // Color scheme based on theme
  const colors = useMemo(
    () => ({
      background: isDark ? "#1C1C1E" : "#F2F2F7CA",
      card: isDark ? "#2C2C2E" : "#FFFFFF93",
      text: isDark ? "#FFFFFF" : "#000000",
      subText: isDark ? "#8E8E93" : "#3C3C43",
      headerBackground: isDark ? "#1C1C1E" : "#F2F2F752",
      separator: isDark ? "#38383A" : "#C6C6C8",
      primary: "#FFC814FF",
      success: "#4CD964",
      error: "#FF3B30"
    }),
    [isDark]
  )

  // Handle OK button press
  const handleOk = useCallback(() => {
    if (onOk) {
      onOk()
    }
    onClose()
  }, [onOk, onClose])

  // Header component
  const ModalHeader = useCallback(
    () => (
      <View style={[styles.header, {backgroundColor: colors.headerBackground}]}>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, {color: colors.text}]}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [colors.headerBackground, colors.text, title, onClose]
  )

  // Action buttons component
  const ActionButtons = useCallback(
    () => (
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity style={[styles.actionButton, {backgroundColor: colors.primary}]} onPress={handleOk}>
          <Text style={styles.actionButtonText}>{okText}</Text>
        </TouchableOpacity>
      </View>
    ),
    [colors.primary, handleOk, okText]
  )

  if (!visible) return null

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.blurContainer}>
        <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
          <ModalHeader />

          <ScrollView style={styles.scrollContent}>
            <View style={[styles.contentContainer, {backgroundColor: colors.card}]}>{children}</View>
          </ScrollView>

          <ActionButtons />
        </SafeAreaView>
      </BlurView>
    </Modal>
  )
}

const {width, height} = Dimensions.get("window")
const isTablet = (Platform.OS === "ios" && Platform.isPad) || (Platform.OS === "android" && width / height < 1.6)
const isPortrait = height > width

const styles = StyleSheet.create({
  blurContainer: {
    flex: 1,
    justifyContent: "center"
  },
  container: {
    height: isTablet && isPortrait ? height * 0.4 : Math.min(height * 0.8, 610),
    overflow: "hidden",
    width: "100%",
    maxWidth: isTablet ? 500 : 400,
    borderRadius: 36,
    marginHorizontal: "auto"
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)"
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 24
  },
  closeButton: {
    padding: 4
  },
  scrollContent: {
    flex: 1,
    padding: 25
  },
  contentContainer: {
    borderRadius: 12,
    overflow: "hidden",
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 8
      },
      android: {
        elevation: 2
      }
    })
  },
  actionButtonsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)"
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 1230,
    minWidth: width * 0.25
  },
  actionButtonText: {
    color: "#2e282ae6",
    fontWeight: "600",
    marginLeft: 8
  }
})
export default ReusableModal
