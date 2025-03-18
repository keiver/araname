/**
 * Core game types
 */

export interface Vector2D {
  x: number
  y: number
}

export interface Circle {
  id: string
  position: Vector2D
  velocity: Vector2D
  radius: number
  mass: number
  color: string
  glowColor: string
  isActive: boolean
  isDragging: boolean
  createdAt: number
  lastCollision: number | null
}

export interface GameState {
  circles: Circle[]
  score: number
  highScore: number
}

export interface Collision {
  circleA: string
  circleB: string
  point: Vector2D
  normal: Vector2D
  depth: number
}

export interface SlingshotState {
  isActive: boolean
  startPoint: Vector2D
  endPoint: Vector2D
  circleId: string | null
}

export type GameStatus = "ready" | "playing" | "paused"
