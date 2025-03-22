import {Ionicons} from "@expo/vector-icons"
import React, {useCallback} from "react"
import {TouchableOpacity, Text, StyleSheet} from "react-native"

interface ButtonProps {
  onPress: (e?: any) => void
  label: string
  variant?: "primary" | "secondary" | "gray"
  accessibilityLabel?: string
  width?: number
  icon?: typeof Ionicons | string | null | undefined
  iconSize?: number
  iconColor?: string
  centerText?: boolean
  circled?: boolean
  iconComponent?: React.ReactNode
}

const Button: React.FC<ButtonProps> = ({
  onPress,
  label,
  variant = "primary",
  accessibilityLabel,
  width,
  icon,
  iconSize,
  iconColor,
  centerText,
  circled,
  iconComponent
}) => {
  const buttonStyle = useCallback(() => {
    switch (variant) {
      case "primary":
        return {
          backgroundColor: "#F79F1F"
        }
      case "secondary":
        return {
          backgroundColor: "#EE5A24"
        }
      case "gray":
        return {
          backgroundColor: "#797979FF"
        }
    }
  }, [variant])

  return (
    <TouchableOpacity
      style={[
        styles.button,
        buttonStyle(),
        {
          justifyContent: centerText ? "center" : "flex-start"
        },
        width
          ? {
              width
            }
          : {},
        circled
          ? {
              height: width,
              width: width,
              alignItems: "center",
              justifyContent: "center",
              display: "flex"
            }
          : {}
      ]}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel || label}
    >
      {iconComponent || null}
      {icon && <Ionicons name={icon as any} size={iconSize || 20} color={iconColor} />}
      {!circled && <Text style={[styles.buttonText]}>{label}</Text>}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    display: "flex",
    gap: 8,
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 1,
    borderRadius: 2213,
    marginTop: 25,
    width: "80%",
    marginHorizontal: "auto",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF"
  }
})

export default Button
