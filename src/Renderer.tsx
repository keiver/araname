import React, {useEffect, useState, useCallback} from "react"
import {StyleSheet} from "react-native"
import {Canvas, Circle, Group, Paint, Rect, Line, RadialGradient, vec} from "@shopify/react-native-skia"

// Circle and CircleState types
export interface Circle {
  id: string
  x: number
  y: number
  radius: number
  maxRadius: number
  createdAt: number
  opacity?: number
  vx?: number // velocity x component
  vy?: number // velocity y component
}

export interface CircleState {
  hasIntersections: boolean
  isStable: boolean
}

// Utility functions
export const isFullyGrown = (circle: Circle): boolean => {
  return circle.radius >= circle.maxRadius * 0.99
}

// Constants
export const CIRCLE_TIMEOUT = 30000 // 30 seconds

// Animation timing constants
const ANIMATION = {
  PANEL_COUNT: {
    NORMAL: 8,
    INTERSECTING: 12
  }
} as const

// Rendering constants
const DIMENSIONS = {
  ENERGY_FIELD_SCALE: 1.15,
  ROTATING_CIRCLE_SCALE: 1.1,
  CORE_SCALE: 0.85,
  PANEL_INNER_RADIUS: 0.3,
  PANEL_OUTER_RADIUS: 0.85,
  PROGRESS_BAR: {
    WIDTH: 40,
    HEIGHT: 4,
    OFFSET: 8
  }
} as const

// Color configurations
const COLORS = {
  NORMAL: {
    ENERGY_FIELD: "rgba(64, 224, 255, 0.2)",
    ENERGY_FIELD_OUTER: "rgba(64, 224, 255, 0)",
    CORE: {
      START: "rgba(180, 255, 180, 1)",
      MID: "rgba(100, 255, 100, 0.8)",
      END: "rgba(80, 255, 80, 0.1)"
    },
    RING: "rgba(100, 255, 100, 0.4)",
    PANEL: "rgba(50, 50, 50, 0.15)",
    BORDER: "rgba(64, 224, 255, 0.5)",
    PROGRESS: "rgba(100, 255, 100, 0.8)"
  },
  INTERSECTING: {
    ENERGY_FIELD: "rgba(255, 100, 100, 0.2)",
    ENERGY_FIELD_OUTER: "rgba(255, 100, 100, 0)",
    CORE: {
      START: "rgba(255, 180, 180, 1)",
      MID: "rgba(255, 100, 100, 0.8)",
      END: "rgba(255, 80, 80, 0.1)"
    },
    RING: "rgba(255, 100, 100, 0.4)",
    PANEL: "rgba(50, 50, 50, 0.15)",
    BORDER: "rgba(255, 100, 100, 0.5)",
    PROGRESS: "rgba(255, 100, 100, 0.8)"
  }
}

interface CircleRendererProps {
  circle: Circle
  circleState: CircleState
  pulseIntensity: number
  progressBarVisible?: boolean
}

export const CircleRendererSkia: React.FC<CircleRendererProps> = ({
  circle,
  circleState,
  pulseIntensity = 0,
  progressBarVisible = true
}) => {
  // Simplified animation state
  const [rotation, setRotation] = useState(0)
  const [glowIntensity, setGlowIntensity] = useState(0.3)
  const [now, setNow] = useState(Date.now())

  // Update animation values
  const updateAnimation = useCallback(() => {
    const currentTime = Date.now()
    setNow(currentTime)

    // Update rotation (0-360 degrees)
    const rotationValue = ((currentTime % 10000) / 10000) * 360
    setRotation(rotationValue)

    // Update glow (pulsing effect)
    const glowValue = 0.3 + Math.sin(((currentTime % 2000) / 2000) * Math.PI * 2) * 0.2
    setGlowIntensity(glowValue)
  }, [])

  // Setup basic animation loop
  useEffect(() => {
    let animationFrame: number

    const animate = () => {
      updateAnimation()
      animationFrame = requestAnimationFrame(animate)
    }

    animationFrame = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationFrame)
    }
  }, [updateAnimation])

  // Select color scheme based on intersection state
  const colors = circleState?.hasIntersections ? COLORS.INTERSECTING : COLORS.NORMAL
  const opacity = circle.opacity ?? 1

  // Calculate border opacity with glow effect
  const borderOpacity = Math.min(1, (glowIntensity + pulseIntensity * 0.2) * opacity)

  // Calculate if circle is fully grown
  const fullyGrown = isFullyGrown(circle)

  // Calculate progress percentage
  const progressPercentage = fullyGrown
    ? Math.max(0, ((CIRCLE_TIMEOUT - (now - circle.createdAt)) / CIRCLE_TIMEOUT) * 100)
    : (circle.radius / circle.maxRadius) * 100

  // Generate panel lines
  const panelCount = circleState?.hasIntersections ? ANIMATION.PANEL_COUNT.INTERSECTING : ANIMATION.PANEL_COUNT.NORMAL

  return (
    <Canvas style={styles.canvas}>
      {/* Energy Field (outer glow) */}
      <Circle cx={circle.x} cy={circle.y} r={circle.radius * DIMENSIONS.ENERGY_FIELD_SCALE}>
        <RadialGradient
          c={vec(circle.x, circle.y)}
          r={circle.radius * DIMENSIONS.ENERGY_FIELD_SCALE}
          colors={[colors.ENERGY_FIELD, colors.ENERGY_FIELD_OUTER]}
        />
      </Circle>

      {/* Rotating Circle */}
      <Group transform={[{rotate: (rotation * Math.PI) / 180}]} origin={{x: circle.x, y: circle.y}}>
        <Circle cx={circle.x} cy={circle.y} r={circle.radius * DIMENSIONS.ROTATING_CIRCLE_SCALE}>
          <Paint color={colors.RING} style="stroke" strokeWidth={1} />
        </Circle>
      </Group>

      {/* Core */}
      <Circle cx={circle.x} cy={circle.y} r={circle.radius * DIMENSIONS.CORE_SCALE}>
        <Paint color={colors.CORE.MID} />
      </Circle>

      {/* Panel lines */}
      {Array.from({length: panelCount}).map((_, i) => {
        const angle = (i * Math.PI * 2) / panelCount
        const innerX = circle.x + Math.cos(angle) * circle.radius * DIMENSIONS.PANEL_INNER_RADIUS
        const innerY = circle.y + Math.sin(angle) * circle.radius * DIMENSIONS.PANEL_INNER_RADIUS
        const outerX = circle.x + Math.cos(angle) * circle.radius * DIMENSIONS.PANEL_OUTER_RADIUS
        const outerY = circle.y + Math.sin(angle) * circle.radius * DIMENSIONS.PANEL_OUTER_RADIUS

        return (
          <Line
            key={`panel-${i}`}
            p1={{x: innerX, y: innerY}}
            p2={{x: outerX, y: outerY}}
            color={colors.PANEL}
            strokeWidth={1}
          />
        )
      })}

      {/* Border */}
      <Circle cx={circle.x} cy={circle.y} r={circle.radius}>
        <Paint
          color={colors.BORDER.replace("0.5", borderOpacity.toString())}
          style="stroke"
          strokeWidth={fullyGrown ? 3 : 2}
        />
      </Circle>

      {/* Progress bar */}
      {progressBarVisible && (
        <>
          {/* Background */}
          <Rect
            x={circle.x - DIMENSIONS.PROGRESS_BAR.WIDTH / 2}
            y={circle.y + circle.radius + DIMENSIONS.PROGRESS_BAR.OFFSET}
            width={DIMENSIONS.PROGRESS_BAR.WIDTH}
            height={DIMENSIONS.PROGRESS_BAR.HEIGHT}
          >
            <Paint color="rgba(0, 0, 0, 0.3)" />
          </Rect>

          {/* Progress */}
          <Rect
            x={circle.x - DIMENSIONS.PROGRESS_BAR.WIDTH / 2}
            y={circle.y + circle.radius + DIMENSIONS.PROGRESS_BAR.OFFSET}
            width={(DIMENSIONS.PROGRESS_BAR.WIDTH * progressPercentage) / 100}
            height={DIMENSIONS.PROGRESS_BAR.HEIGHT}
          >
            <Paint color={colors.PROGRESS} />
          </Rect>
        </>
      )}
    </Canvas>
  )
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1
  }
})

export default CircleRendererSkia
