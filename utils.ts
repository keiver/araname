// utils.ts
import {Dimensions} from "react-native"
import {Skia, SkPath} from "@shopify/react-native-skia"

const {width, height} = Dimensions.get("window")

// generate track path based on level
export const generateTrackPath = (level: number): SkPath => {
  const path = Skia.Path.Make()
  const segments = 3 + level
  const amplitude = 50 + level * 10 // increase wave height with level

  // start at left edge, mid-height
  path.moveTo(0, height / 2)

  // create a path that goes from left to right
  // mix of smooth curves and zigzags based on level
  if (level % 3 === 0) {
    // zigzag pattern
    let direction = 1
    for (let i = 0; i <= segments; i++) {
      const x = (i * width) / segments
      const y = height / 2 + direction * amplitude
      path.lineTo(x, y)
      direction *= -1
    }
  } else if (level % 3 === 1) {
    // sine wave pattern
    for (let i = 0; i <= segments * 4; i++) {
      const x = (i * width) / (segments * 4)
      const y = height / 2 + Math.sin((i / (segments * 4)) * Math.PI * 2 * level) * amplitude
      path.lineTo(x, y)
    }
  } else {
    // curved pattern
    for (let i = 1; i <= segments; i++) {
      const x = i * (width / segments)
      const y = Math.random() * height * 0.6 + height * 0.2

      const cp1x = ((i - 1) * width) / segments + width / segments / 3
      const cp1y = Math.random() * height * 0.6 + height * 0.2

      const cp2x = ((i - 1) * width) / segments + ((width / segments) * 2) / 3
      const cp2y = Math.random() * height * 0.6 + height * 0.2

      path.cubicTo(cp1x, cp1y, cp2x, cp2y, x, y)
    }
  }

  return path
}

// calculate accuracy of player trace compared to track
export const calculateAccuracy = (trackPath: SkPath, playerPath: SkPath): number => {
  if (!trackPath || !playerPath) return 0

  // extract points from paths
  const trackPoints = extractPoints(trackPath)
  const playerPoints = extractPoints(playerPath)

  if (trackPoints.length === 0 || playerPoints.length === 0) {
    return 0
  }

  // sample points for comparison
  const sampleCount = Math.min(40, playerPoints.length)
  const step = Math.max(1, Math.floor(playerPoints.length / sampleCount))

  let totalDistance = 0
  let matchedPoints = 0

  // for each sampled player point, find closest track point
  for (let i = 0; i < playerPoints.length; i += step) {
    const playerPoint = playerPoints[i]
    const closestDistance = findClosestPointDistance(playerPoint, trackPoints)

    // threshold for considering a point on the track
    const threshold = 40

    if (closestDistance < threshold) {
      totalDistance += closestDistance
      matchedPoints++
    }
  }

  // no matches
  if (matchedPoints === 0) return 0

  // calculate score (0-1)
  const avgDistance = totalDistance / matchedPoints
  const accuracyScore = Math.max(0, 1 - avgDistance / 40)

  // factor in coverage (how much of track was traced)
  const coverage = matchedPoints / sampleCount

  return accuracyScore * coverage
}

// helper to extract points from a path
const extractPoints = (path: SkPath): {x: number; y: number}[] => {
  const points: {x: number; y: number}[] = []

  try {
    // naive extraction from SVG string
    const svgString = path.toSVGString()
    const commands = svgString.split(/(?=[MLHVCSQTAZmlhvcsqtaz])/g)

    for (const cmd of commands) {
      if (cmd.startsWith("M") || cmd.startsWith("L")) {
        const values = cmd
          .substring(1)
          .trim()
          .split(/[\s,]+/)
        if (values.length >= 2) {
          points.push({
            x: parseFloat(values[0]),
            y: parseFloat(values[1])
          })
        }
      }
    }
  } catch (e) {
    console.error("Error extracting points", e)
  }

  return points
}

// find distance to closest point
const findClosestPointDistance = (point: {x: number; y: number}, points: {x: number; y: number}[]): number => {
  let minDistance = Number.MAX_VALUE

  for (const trackPoint of points) {
    const distance = Math.sqrt(Math.pow(trackPoint.x - point.x, 2) + Math.pow(trackPoint.y - point.y, 2))

    minDistance = Math.min(minDistance, distance)
  }

  return minDistance
}
