import React from "react"
import {Canvas, Circle, Path, Paint, Group} from "@shopify/react-native-skia"
import {StyleSheet, View} from "react-native"
import Matter from "matter-js"
import {ShipEntity, TrackEntity, TrackSegment} from "./entities"

export const ShipRenderer = (props: ShipEntity) => {
  if (!props.body) {
    console.warn("Ship body is undefined in renderer")
    return null
  }

  const x = props.body.position.x
  const y = props.body.position.y
  const {color, radius, slingPositionStart, slingPositionCurrent} = props

  console.log("Rendering ship at:", x, y, "with color:", color)

  return (
    <View style={styles.container}>
      <Canvas style={styles.canvas}>
        <Group>
          {/* Ship body */}
          <Circle cx={x} cy={y} r={radius}>
            <Paint color={color} />
          </Circle>

          {/* Draw slingshot line when dragging */}
          {slingPositionStart && slingPositionCurrent && (
            <Path
              path={`M ${slingPositionStart.x} ${slingPositionStart.y} L ${slingPositionCurrent.x} ${slingPositionCurrent.y}`}
              strokeWidth={5}
              style="stroke"
              color="#FFFFFF"
            />
          )}
        </Group>
      </Canvas>
    </View>
  )
}

export const TrackRenderer = (props: TrackEntity) => {
  console.log("Rendering track with segments:", props.segments.length)

  // Create path for the track
  const pathData = props.segments.reduce((path, segment, index) => {
    if (index === 0) {
      return `M ${segment.x} ${segment.y}`
    }
    return `${path} L ${segment.x} ${segment.y}`
  }, "")

  return (
    <View style={styles.container}>
      <Canvas style={styles.canvas}>
        <Path path={pathData} style="stroke" strokeWidth={8} color="#FF00FF" />
      </Canvas>
    </View>
  )
}

interface ExplosionEffectProps {
  x: number
  y: number
  size: number
  intensity: number
  lifespan: number
}

export const ExplosionEffect = ({x, y, size, intensity, lifespan}: ExplosionEffectProps) => {
  // Create explosion particles
  const particles = Array(intensity)
    .fill(0)
    .map((_, i) => {
      const angle = (i / intensity) * Math.PI * 2
      const distance = Math.random() * size
      return {
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        radius: Math.random() * 5 + 2,
        opacity: Math.random() * 0.8 + 0.2,
        color: "#FFA500"
      }
    })

  return (
    <View style={styles.container}>
      <Canvas style={styles.canvas}>
        {particles.map((particle, i) => (
          <Circle key={i} cx={particle.x} cy={particle.y} r={particle.radius}>
            <Paint color={particle.color} opacity={particle.opacity} />
          </Circle>
        ))}
      </Canvas>
    </View>
  )
}

// Shared styles for all renderers
const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10
  },
  canvas: {
    flex: 1,
    width: "100%",
    height: "100%"
  }
})
