/**
 * Physics utilities for the game
 */

import {Vector2D, Circle, Collision} from "../types/game.types"
import {PHYSICS, DIMENSIONS} from "../constants"

/**
 * Vector operations
 */
export const Vector = {
  add: (v1: Vector2D, v2: Vector2D): Vector2D => ({
    x: v1.x + v2.x,
    y: v1.y + v2.y
  }),

  subtract: (v1: Vector2D, v2: Vector2D): Vector2D => ({
    x: v1.x - v2.x,
    y: v1.y - v2.y
  }),

  scale: (v: Vector2D, scale: number): Vector2D => ({
    x: v.x * scale,
    y: v.y * scale
  }),

  length: (v: Vector2D): number => Math.sqrt(v.x * v.x + v.y * v.y),

  normalize: (v: Vector2D): Vector2D => {
    const len = Vector.length(v)
    if (len === 0) return {x: 0, y: 0}
    return {x: v.x / len, y: v.y / len}
  },

  dot: (v1: Vector2D, v2: Vector2D): number => v1.x * v2.x + v1.y * v2.y,

  distance: (v1: Vector2D, v2: Vector2D): number => {
    const dx = v2.x - v1.x
    const dy = v2.y - v1.y
    return Math.sqrt(dx * dx + dy * dy)
  },

  angle: (v: Vector2D): number => Math.atan2(v.y, v.x)
}

/**
 * Apply physics to a circle
 */
export function updateCirclePhysics(circle: Circle, deltaTime: number): Circle {
  // Skip if circle is being dragged
  if (circle.isDragging) return circle

  const dt = Math.min(deltaTime, PHYSICS.MAX_VELOCITY) / 16 // Normalize time step

  // Apply friction
  const vx = circle.velocity.x * PHYSICS.FRICTION
  const vy = circle.velocity.y * PHYSICS.FRICTION

  // Apply minimum velocity threshold
  const newVx = Math.abs(vx) < PHYSICS.MIN_VELOCITY ? 0 : vx
  const newVy = Math.abs(vy) < PHYSICS.MIN_VELOCITY ? 0 : vy

  // Update position
  const newPosition = {
    x: circle.position.x + newVx * dt,
    y: circle.position.y + newVy * dt
  }

  // Check boundary collisions
  let finalVx = newVx
  let finalVy = newVy
  let finalX = newPosition.x
  let finalY = newPosition.y

  // Left/right boundaries
  if (finalX - circle.radius < 0) {
    finalX = circle.radius
    finalVx = Math.abs(newVx) * PHYSICS.BOUNCE
  } else if (finalX + circle.radius > DIMENSIONS.SCREEN_WIDTH) {
    finalX = DIMENSIONS.SCREEN_WIDTH - circle.radius
    finalVx = -Math.abs(newVx) * PHYSICS.BOUNCE
  }

  // Top/bottom boundaries
  if (finalY - circle.radius < 0) {
    finalY = circle.radius
    finalVy = Math.abs(newVy) * PHYSICS.BOUNCE
  } else if (finalY + circle.radius > DIMENSIONS.SCREEN_HEIGHT) {
    finalY = DIMENSIONS.SCREEN_HEIGHT - circle.radius
    finalVy = -Math.abs(newVy) * PHYSICS.BOUNCE
  }

  return {
    ...circle,
    position: {x: finalX, y: finalY},
    velocity: {x: finalVx, y: finalVy}
  }
}

/**
 * Check for collision between two circles
 */
export function checkCircleCollision(circleA: Circle, circleB: Circle): Collision | null {
  // Skip if either circle is being dragged
  if (circleA.isDragging || circleB.isDragging) return null

  const distance = Vector.distance(circleA.position, circleB.position)
  const minDistance = circleA.radius + circleB.radius

  if (distance < minDistance) {
    // Calculate collision data
    const collisionNormal = Vector.normalize({
      x: circleB.position.x - circleA.position.x,
      y: circleB.position.y - circleA.position.y
    })

    return {
      circleA: circleA.id,
      circleB: circleB.id,
      point: {
        x: circleA.position.x + collisionNormal.x * circleA.radius,
        y: circleA.position.y + collisionNormal.y * circleA.radius
      },
      normal: collisionNormal,
      depth: minDistance - distance
    }
  }

  return null
}

/**
 * Resolve a collision between two circles
 */
export function resolveCollision(circleA: Circle, circleB: Circle, collision: Collision): [Circle, Circle] {
  // Calculate masses (can be based on radius or predefined)
  const massA = circleA.mass
  const massB = circleB.mass

  // First, separate the circles (prevent overlap)
  const percent = 0.6 // Penetration resolution percentage
  const separation = Vector.scale(collision.normal, collision.depth * percent)

  // Only move circles that aren't being dragged
  const newPositionA = !circleA.isDragging
    ? Vector.subtract(circleA.position, Vector.scale(separation, massB / (massA + massB)))
    : circleA.position

  const newPositionB = !circleB.isDragging
    ? Vector.add(circleB.position, Vector.scale(separation, massA / (massA + massB)))
    : circleB.position

  // Calculate new velocities based on conservation of momentum
  const relativeVelocity = Vector.subtract(circleB.velocity, circleA.velocity)
  const velocityAlongNormal = Vector.dot(relativeVelocity, collision.normal)

  // Don't resolve if velocities are separating
  if (velocityAlongNormal > 0) {
    return [
      {...circleA, position: newPositionA},
      {...circleB, position: newPositionB}
    ]
  }

  // Calculate impulse scalar
  const restitution = PHYSICS.BOUNCE // "bounciness" of collision
  const impulseMagnitude = -(1 + restitution) * velocityAlongNormal
  const totalMass = massA + massB
  const impulse = impulseMagnitude / totalMass

  // Apply impulse
  const impulseVector = Vector.scale(collision.normal, impulse)

  const newVelocityA = !circleA.isDragging
    ? Vector.subtract(circleA.velocity, Vector.scale(impulseVector, massB))
    : circleA.velocity

  const newVelocityB = !circleB.isDragging
    ? Vector.add(circleB.velocity, Vector.scale(impulseVector, massA))
    : circleB.velocity

  // Create new circle objects with updated physics
  const newCircleA: Circle = {
    ...circleA,
    position: newPositionA,
    velocity: newVelocityA,
    lastCollision: Date.now()
  }

  const newCircleB: Circle = {
    ...circleB,
    position: newPositionB,
    velocity: newVelocityB,
    lastCollision: Date.now()
  }

  return [newCircleA, newCircleB]
}

/**
 * Calculate slingshot velocity based on drag
 */
export function calculateSlingshotVelocity(startPoint: Vector2D, endPoint: Vector2D): Vector2D {
  const direction = Vector.subtract(startPoint, endPoint)

  // Add a minimum velocity to make sure small drags still have an effect
  const length = Vector.length(direction)
  if (length < 5) {
    // If the drag is very small, return zero velocity
    return {x: 0, y: 0}
  }

  return Vector.scale(direction, PHYSICS.SLINGSHOT_POWER)
}
