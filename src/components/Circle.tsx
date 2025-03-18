/**
 * Circle component for rendering futuristic spaceship circles
 */

import React, {useRef, useState, useEffect, memo} from "react"
import {StyleSheet} from "react-native"
import {
  Canvas,
  Circle as SkiaCircle,
  Group,
  Paint,
  Path,
  RadialGradient,
  vec,
  Line,
  Rect
} from "@shopify/react-native-skia"
import {Circle as CircleType} from "../types/game.types"
import {COLORS, DIMENSIONS, TIME} from "../constants"

interface CircleProps {
  circle: CircleType
  pulseIntensity: number
}

const CircleComponent = memo(({circle, pulseIntensity}: CircleProps) => {
  // Animation state
  const [rotation, setRotation] = useState(0)
  const [innerRotation, setInnerRotation] = useState(0)
  const [glowIntensity, setGlowIntensity] = useState(0.3)

  // Animation frame tracking
  const animationFrameRef = useRef<number | null>(null)
  const isMountedRef = useRef(true)

  // Calculate circle age and progress
  const circleAge = Date.now() - circle.createdAt
  const progressPercentage = Math.max(0, ((TIME.CIRCLE_LIFETIME - circleAge) / TIME.CIRCLE_LIFETIME) * 100)

  // Determine if circle has recently collided
  const hasCollision =
    circle.lastCollision !== null && Date.now() - circle.lastCollision < TIME.COLLISION_EFFECT_DURATION

  // Select color theme based on collision state
  const colorTheme = hasCollision ? COLORS.CIRCLE_COLLISION : COLORS.CIRCLE_NORMAL

  // Calculate border opacity with glow effect and pulse
  const borderOpacity = Math.min(1, glowIntensity + pulseIntensity * 0.2)

  // Setup animation loop
  useEffect(() => {
    isMountedRef.current = true

    const updateAnimation = () => {
      if (!isMountedRef.current) return

      const currentTime = Date.now()

      // Update rotations
      const outerRotationValue =
        ((currentTime % DIMENSIONS.ROTATION_ANIMATION_DURATION) / DIMENSIONS.ROTATION_ANIMATION_DURATION) * 360
      setRotation(outerRotationValue)

      const innerRotationValue =
        ((currentTime % (DIMENSIONS.ROTATION_ANIMATION_DURATION * 0.7)) /
          (DIMENSIONS.ROTATION_ANIMATION_DURATION * 0.7)) *
        -360
      setInnerRotation(innerRotationValue)

      // Update glow pulsing effect
      const glowProgress = (currentTime % DIMENSIONS.GLOW_ANIMATION_DURATION) / DIMENSIONS.GLOW_ANIMATION_DURATION
      const glowValue = 0.3 + Math.sin(glowProgress * Math.PI * 2) * 0.2
      setGlowIntensity(glowValue)

      // Continue animation if component is still mounted
      if (isMountedRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateAnimation)
      }
    }

    // Start animation loop
    animationFrameRef.current = requestAnimationFrame(updateAnimation)

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [])

  // Constants for rendering
  const x = circle.position.x
  const y = circle.position.y
  const r = circle.radius

  // Define panel lines - technical looking details
  const panelCount = hasCollision ? 12 : 8
  const panelLines = Array.from({length: panelCount}).map((_, i) => {
    const angle = (i * Math.PI * 2) / panelCount
    const innerX = x + Math.cos(angle) * r * 0.4
    const innerY = y + Math.sin(angle) * r * 0.4
    const outerX = x + Math.cos(angle) * r * 0.95
    const outerY = y + Math.sin(angle) * r * 0.95

    return {p1: {x: innerX, y: innerY}, p2: {x: outerX, y: outerY}}
  })

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {/* Outer Energy Field (aura) */}
      <SkiaCircle cx={x} cy={y} r={r * 1.25}>
        <RadialGradient
          c={vec(x, y)}
          r={r * 1.25}
          colors={[colorTheme.GLOW, colorTheme.GLOW_OUTER]}
          positions={[0.0, 1.0]}
        />
      </SkiaCircle>

      {/* Ship main body */}
      <SkiaCircle cx={x} cy={y} r={r * 0.95}>
        <Paint color={colorTheme.BODY} />
      </SkiaCircle>

      {/* Ship dome/canopy */}
      <SkiaCircle cx={x} cy={y} r={r * 0.85}>
        <RadialGradient
          c={vec(x, y)}
          r={r * 0.85}
          colors={[circle.isDragging ? "rgba(220, 255, 255, 0.3)" : "rgba(180, 255, 220, 0.2)", "rgba(0, 0, 0, 0)"]}
          positions={[0.0, 1.0]}
        />
      </SkiaCircle>

      {/* Technical panel lines */}
      {panelLines.map((line, i) => (
        <Line
          key={`panel-${i}`}
          p1={line.p1}
          p2={line.p2}
          color={colorTheme.PANEL || "rgba(80, 180, 220, 0.25)"}
          strokeWidth={1.5}
        />
      ))}

      {/* Ship outer rotating ring with segments */}
      <Group transform={[{rotate: (rotation * Math.PI) / 180}]} origin={{x, y}}>
        {Array.from({length: 16}).map((_, i) => {
          const segmentAngle = (Math.PI * 2) / 16
          const startAngle = i * segmentAngle
          const endAngle = startAngle + segmentAngle * 0.65
          const radius = r * 1.12

          return (
            <Path
              key={`outer-segment-${i}`}
              path={`M ${x + Math.cos(startAngle) * radius} ${y + Math.sin(startAngle) * radius} 
                     A ${radius} ${radius} 0 0 1 ${x + Math.cos(endAngle) * radius} ${y + Math.sin(endAngle) * radius}`}
            >
              <Paint color={colorTheme.RING || "rgba(100, 255, 180, 0.6)"} style="stroke" strokeWidth={2} />
            </Path>
          )
        })}
      </Group>

      {/* Core energy center */}
      <SkiaCircle cx={x} cy={y} r={r * 0.65}>
        <RadialGradient
          c={vec(x, y)}
          r={r * 0.65}
          colors={[
            colorTheme.HIGHLIGHT || "rgba(220, 255, 255, 0.9)",
            colorTheme.CORE || "rgba(100, 255, 180, 0.8)",
            "rgba(80, 255, 180, 0.1)"
          ]}
          positions={[0.0, 0.5, 1.0]}
        />
      </SkiaCircle>

      {/* Inner rotating technical elements */}
      <Group transform={[{rotate: (innerRotation * Math.PI) / 180}]} origin={{x, y}}>
        {/* Inner spinning segments */}
        {Array.from({length: 6}).map((_, i) => {
          const segmentAngle = (Math.PI * 2) / 6
          const startAngle = i * segmentAngle
          const endAngle = startAngle + segmentAngle * 0.7
          const coreSize = r * 0.4

          return (
            <React.Fragment key={`core-segment-${i}`}>
              <Path
                path={`M ${x + Math.cos(startAngle) * coreSize} ${y + Math.sin(startAngle) * coreSize} 
                       A ${coreSize} ${coreSize} 0 0 1 ${x + Math.cos(endAngle) * coreSize} ${
                  y + Math.sin(endAngle) * coreSize
                }`}
              >
                <Paint color={colorTheme.RING || "rgba(100, 255, 180, 0.6)"} style="stroke" strokeWidth={2} />
              </Path>

              {/* Small nodes at the ends of each segment */}
              <SkiaCircle cx={x + Math.cos(startAngle) * coreSize} cy={y + Math.sin(startAngle) * coreSize} r={3}>
                <Paint color={colorTheme.HIGHLIGHT || "rgba(220, 255, 255, 0.9)"} />
              </SkiaCircle>
            </React.Fragment>
          )
        })}
      </Group>

      {/* Central energy point - brightest spot */}
      <SkiaCircle cx={x} cy={y} r={r * 0.15}>
        <RadialGradient
          c={vec(x, y)}
          r={r * 0.15}
          colors={[colorTheme.HIGHLIGHT || "rgba(220, 255, 255, 0.9)", "rgba(255, 255, 255, 0)"]}
          positions={[0.0, 1.0]}
          opacity={0.7}
        />
      </SkiaCircle>

      {/* Glowing ship border */}
      <SkiaCircle cx={x} cy={y} r={r}>
        <Paint
          color={(colorTheme.BORDER || "rgba(64, 224, 255, 0.9)").replace("0.9", borderOpacity.toString())}
          style="stroke"
          strokeWidth={circle.isDragging ? 3 : 2}
        />
      </SkiaCircle>

      {/* Progress bar */}
      {progressPercentage < 100 && (
        <>
          {/* Background */}
          <Rect x={x - 20} y={y + r + 8} width={40} height={4} rx={2} ry={2}>
            <Paint color="rgba(0, 0, 0, 0.5)" />
          </Rect>

          {/* Progress */}
          <Rect x={x - 20} y={y + r + 8} width={(40 * progressPercentage) / 100} height={4} rx={2} ry={2}>
            <Paint
              color={
                progressPercentage < 25 ? "rgba(255, 100, 100, 0.8)" : colorTheme.CORE || "rgba(100, 255, 180, 0.8)"
              }
            />
          </Rect>

          {/* Glow effect for progress bar */}
          <Rect x={x - 21} y={y + r + 7} width={42} height={6} rx={3} ry={3}>
            <Paint
              color={colorTheme.HIGHLIGHT || "rgba(220, 255, 255, 0.9)"}
              opacity={0.3}
              style="stroke"
              strokeWidth={1}
            />
          </Rect>
        </>
      )}
    </Canvas>
  )
})

export default CircleComponent
