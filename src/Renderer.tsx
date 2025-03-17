import React, {useEffect, useState, useCallback} from "react"
import {StyleSheet} from "react-native"
import {
  Canvas,
  Circle,
  Group,
  Paint,
  Rect,
  Line,
  Path,
  RadialGradient,
  vec,
  LinearGradient
} from "@shopify/react-native-skia"

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
  GLOW_DURATION: 2000,
  ROTATION_DURATION: 10000,
  INNER_ROTATION_DURATION: 7000, // Different rotation speed for inner elements
  PANEL_COUNT: {
    NORMAL: 8,
    INTERSECTING: 12
  },
  RING_SEGMENTS: 6
} as const

// Rendering constants
const DIMENSIONS = {
  // Outer elements
  ENERGY_FIELD_SCALE: 1.25,
  ROTATING_CIRCLE_SCALE: 1.12,
  SHIP_MAIN_BODY_SCALE: 0.95,
  SHIP_DOME_SCALE: 0.85,

  // Inner elements
  CORE_SCALE: 0.65,
  CORE_SIZE_SCALE: 0.4,
  INNER_RING_COUNT: 3,

  // Panels and details
  PANEL_INNER_RADIUS: 0.4,
  PANEL_OUTER_RADIUS: 0.95,
  CENTER_CORE_SCALE: 0.3,

  // UI elements
  PROGRESS_BAR: {
    WIDTH: 40,
    HEIGHT: 4,
    OFFSET: 8
  }
} as const

// Color configurations
const COLORS = {
  NORMAL: {
    // Energy and glow
    ENERGY_FIELD: "rgba(64, 224, 255, 0.3)",
    ENERGY_FIELD_OUTER: "rgba(64, 224, 255, 0)",

    // Ship body
    SHIP_BODY: "rgba(50, 70, 90, 0.7)",
    SHIP_DOME: "rgba(180, 255, 220, 0.2)",

    // Core
    CORE: {
      START: "rgba(180, 255, 220, 1)",
      MID: "rgba(100, 255, 180, 0.8)",
      END: "rgba(80, 255, 180, 0.1)"
    },

    // Details
    RING: "rgba(100, 255, 180, 0.6)",
    PANEL: "rgba(80, 180, 220, 0.25)",
    BORDER: "rgba(64, 224, 255, 0.9)",
    PROGRESS: "rgba(100, 255, 180, 0.8)",

    // Highlights
    HIGHLIGHT: "rgba(220, 255, 255, 0.9)"
  },
  INTERSECTING: {
    // Energy and glow
    ENERGY_FIELD: "rgba(255, 100, 100, 0.35)",
    ENERGY_FIELD_OUTER: "rgba(255, 80, 80, 0)",

    // Ship body
    SHIP_BODY: "rgba(90, 50, 70, 0.7)",
    SHIP_DOME: "rgba(255, 180, 180, 0.2)",

    // Core
    CORE: {
      START: "rgba(255, 180, 180, 1)",
      MID: "rgba(255, 100, 100, 0.9)",
      END: "rgba(255, 80, 80, 0.15)"
    },

    // Details
    RING: "rgba(255, 100, 100, 0.7)",
    PANEL: "rgba(220, 100, 100, 0.35)",
    BORDER: "rgba(255, 100, 100, 0.9)",
    PROGRESS: "rgba(255, 100, 100, 0.8)",

    // Highlights
    HIGHLIGHT: "rgba(255, 220, 220, 0.9)"
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
  // Animation state
  const [outerRotation, setOuterRotation] = useState(0)
  const [innerRotation, setInnerRotation] = useState(0)
  const [glowIntensity, setGlowIntensity] = useState(0.3)
  const [now, setNow] = useState(Date.now())

  // Update animation values
  const updateAnimation = useCallback(() => {
    const currentTime = Date.now()
    setNow(currentTime)

    // Update rotations at different speeds (0-360 degrees)
    const outerRotationValue = ((currentTime % ANIMATION.ROTATION_DURATION) / ANIMATION.ROTATION_DURATION) * 360
    setOuterRotation(outerRotationValue)

    const innerRotationValue =
      ((currentTime % ANIMATION.INNER_ROTATION_DURATION) / ANIMATION.INNER_ROTATION_DURATION) * -360
    setInnerRotation(innerRotationValue)

    // Update glow (pulsing effect)
    const glowProgress = (currentTime % ANIMATION.GLOW_DURATION) / ANIMATION.GLOW_DURATION
    const glowValue = 0.3 + Math.sin(glowProgress * Math.PI * 2) * 0.2
    setGlowIntensity(glowValue)
  }, [])

  // Setup animation loop
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

  // Panel count based on state
  const panelCount = circleState?.hasIntersections ? ANIMATION.PANEL_COUNT.INTERSECTING : ANIMATION.PANEL_COUNT.NORMAL

  return (
    <Canvas style={styles.canvas}>
      {/* Outer Energy Field (aura) */}
      <Circle cx={circle.x} cy={circle.y} r={circle.radius * DIMENSIONS.ENERGY_FIELD_SCALE}>
        <RadialGradient
          c={vec(circle.x, circle.y)}
          r={circle.radius * DIMENSIONS.ENERGY_FIELD_SCALE}
          colors={[colors.ENERGY_FIELD, colors.ENERGY_FIELD_OUTER]}
          positions={[0.0, 1.0]}
        />
      </Circle>

      {/* Ship main body */}
      <Circle cx={circle.x} cy={circle.y} r={circle.radius * DIMENSIONS.SHIP_MAIN_BODY_SCALE}>
        <Paint color={colors.SHIP_BODY} />
      </Circle>

      {/* Ship outer rotating ring with segments */}
      <Group transform={[{rotate: (outerRotation * Math.PI) / 180}]} origin={{x: circle.x, y: circle.y}}>
        {Array.from({length: 16}).map((_, i) => {
          const segmentAngle = (Math.PI * 2) / 16
          const startAngle = i * segmentAngle
          const endAngle = startAngle + segmentAngle * 0.65
          const radius = circle.radius * DIMENSIONS.ROTATING_CIRCLE_SCALE

          return (
            <Path
              key={`outer-segment-${i}`}
              path={`M ${circle.x + Math.cos(startAngle) * radius} ${circle.y + Math.sin(startAngle) * radius} 
                     A ${radius} ${radius} 0 0 1 ${circle.x + Math.cos(endAngle) * radius} ${
                circle.y + Math.sin(endAngle) * radius
              }`}
            >
              <Paint color={colors.RING} style="stroke" strokeWidth={2} />
            </Path>
          )
        })}
      </Group>

      {/* Ship top dome */}
      <Circle cx={circle.x} cy={circle.y} r={circle.radius * DIMENSIONS.SHIP_DOME_SCALE}>
        <RadialGradient
          c={vec(circle.x, circle.y)}
          r={circle.radius * DIMENSIONS.SHIP_DOME_SCALE}
          colors={[colors.SHIP_DOME, "rgba(0, 0, 0, 0)"]}
          positions={[0.0, 1.0]}
        />
      </Circle>

      {/* Technical panel lines */}
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
            strokeWidth={1.5}
          />
        )
      })}

      {/* Inner rotating technical elements */}
      <Group transform={[{rotate: (innerRotation * Math.PI) / 180}]} origin={{x: circle.x, y: circle.y}}>
        {/* Inner spinning segments */}
        {Array.from({length: ANIMATION.RING_SEGMENTS}).map((_, i) => {
          const segmentAngle = (Math.PI * 2) / ANIMATION.RING_SEGMENTS
          const startAngle = i * segmentAngle
          const endAngle = startAngle + segmentAngle * 0.7
          const coreSize = circle.radius * DIMENSIONS.CORE_SIZE_SCALE

          return (
            <React.Fragment key={`core-segment-${i}`}>
              <Path
                path={`M ${circle.x + Math.cos(startAngle) * coreSize} ${circle.y + Math.sin(startAngle) * coreSize} 
                       A ${coreSize} ${coreSize} 0 0 1 ${circle.x + Math.cos(endAngle) * coreSize} ${
                  circle.y + Math.sin(endAngle) * coreSize
                }`}
              >
                <Paint color={colors.RING} style="stroke" strokeWidth={2} />
              </Path>

              {/* Small nodes at the ends of each segment */}
              <Circle
                cx={circle.x + Math.cos(startAngle) * coreSize}
                cy={circle.y + Math.sin(startAngle) * coreSize}
                r={3}
              >
                <Paint color={colors.HIGHLIGHT} />
              </Circle>
            </React.Fragment>
          )
        })}
      </Group>

      {/* Core energy center */}
      <Circle cx={circle.x} cy={circle.y} r={circle.radius * DIMENSIONS.CORE_SCALE}>
        <RadialGradient
          c={vec(circle.x, circle.y)}
          r={circle.radius * DIMENSIONS.CORE_SCALE}
          colors={[colors.CORE.START, colors.CORE.MID, colors.CORE.END]}
          positions={[0.0, 0.5, 1.0]}
        />
      </Circle>

      {/* Central energy point - brightest spot */}
      <Circle cx={circle.x} cy={circle.y} r={circle.radius * 0.15}>
        <RadialGradient
          c={vec(circle.x, circle.y)}
          r={circle.radius * 0.15}
          colors={[colors.HIGHLIGHT, "rgba(255, 255, 255, 0)"]}
          positions={[0.0, 1.0]}
          opacity={0.7 * opacity}
        />
      </Circle>

      {/* Glowing ship border */}
      <Circle cx={circle.x} cy={circle.y} r={circle.radius}>
        <Paint
          color={colors.BORDER.replace("0.9", borderOpacity.toString())}
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
            rx={2}
            ry={2}
          >
            <Paint color={`rgba(0, 0, 0, ${0.5 * opacity})`} />
          </Rect>

          {/* Progress */}
          <Rect
            x={circle.x - DIMENSIONS.PROGRESS_BAR.WIDTH / 2}
            y={circle.y + circle.radius + DIMENSIONS.PROGRESS_BAR.OFFSET}
            width={(DIMENSIONS.PROGRESS_BAR.WIDTH * progressPercentage) / 100}
            height={DIMENSIONS.PROGRESS_BAR.HEIGHT}
            rx={2}
            ry={2}
          >
            <Paint color={progressPercentage < 25 && fullyGrown ? COLORS.INTERSECTING.PROGRESS : colors.PROGRESS} />
          </Rect>

          {/* Glow effect for progress bar */}
          <Rect
            x={circle.x - DIMENSIONS.PROGRESS_BAR.WIDTH / 2 - 1}
            y={circle.y + circle.radius + DIMENSIONS.PROGRESS_BAR.OFFSET - 1}
            width={DIMENSIONS.PROGRESS_BAR.WIDTH + 2}
            height={DIMENSIONS.PROGRESS_BAR.HEIGHT + 2}
            rx={3}
            ry={3}
          >
            <Paint color={colors.HIGHLIGHT} opacity={0.3 * opacity} style="stroke" strokeWidth={1} />
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
