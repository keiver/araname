/**
 * Game constants
 */

import {Dimensions} from "react-native"

const {width, height} = Dimensions.get("window")

// Colors
export const COLORS = {
  BACKGROUND: "#000000",
  TEXT: "#FFFFFF",

  // UI elements
  PANEL_BACKGROUND: "rgba(0, 0, 0, 0.7)",
  SCORE_TEXT: "#FFFFFF",
  HIGH_SCORE_TEXT: "rgba(64, 224, 255, 0.9)",
  INSTRUCTIONS_TEXT: "#FFFFFF",

  // Game elements
  SLINGSHOT: "rgba(100, 255, 180, 0.7)",
  HIGHLIGHT: "rgba(64, 224, 255, 0.8)",

  // Circle states
  CIRCLE_NORMAL: {
    GLOW: "rgba(64, 224, 255, 0.3)",
    GLOW_OUTER: "rgba(64, 224, 255, 0)",
    BODY: "rgba(50, 70, 90, 0.7)",
    BORDER: "rgba(64, 224, 255, 0.9)",
    CORE: "rgba(100, 255, 180, 0.8)",
    HIGHLIGHT: "rgba(220, 255, 255, 0.9)"
  },

  CIRCLE_COLLISION: {
    GLOW: "rgba(255, 100, 100, 0.35)",
    GLOW_OUTER: "rgba(255, 80, 80, 0)",
    BODY: "rgba(90, 50, 70, 0.7)",
    BORDER: "rgba(255, 100, 100, 0.9)",
    CORE: "rgba(255, 100, 100, 0.9)",
    HIGHLIGHT: "rgba(255, 220, 220, 0.9)"
  }
}

// Physics constants
export const PHYSICS = {
  GRAVITY: 0, // Zero gravity for a space-like environment
  FRICTION: 0.98, // Slow deceleration
  BOUNCE: 0.7, // Bounce coefficient (elasticity)
  MAX_VELOCITY: 20, // Maximum velocity cap
  MIN_VELOCITY: 0.1, // Minimum velocity before stopping
  COLLISION_IMPULSE: 0.05, // Collision response strength
  SLINGSHOT_POWER: 0.15, // Slingshot pull to velocity multiplier
  MAX_PULL_DISTANCE: Math.max(width, height) * 0.4, // Maximum slingshot pull distance
  COLLISION_COOLDOWN: 200 // Minimum ms between collision effects for same circle
}

// Dimensions and layout
export const DIMENSIONS = {
  SCREEN_WIDTH: width,
  SCREEN_HEIGHT: height,

  // Circle properties
  DEFAULT_CIRCLE_RADIUS: 60,
  LARGE_CIRCLE_RADIUS: 80,

  // UI elements
  SCORE_CONTAINER_TOP: 40,
  SCORE_CONTAINER_LEFT: 20,
  INSTRUCTIONS_BOTTOM: 40,

  // Collision detection
  TOUCH_RADIUS_MULTIPLIER: 1.2, // Multiply circle radius for easier touch detection

  // Visual effects
  CIRCLE_GLOW_SCALE: 1.25,
  CIRCLE_BODY_SCALE: 0.95,
  CIRCLE_CORE_SCALE: 0.65,
  CIRCLE_BORDER_WIDTH: 2,
  CIRCLE_BORDER_WIDTH_ACTIVE: 3,

  // Animation timing
  COLLISION_FLASH_DURATION: 500,
  GLOW_ANIMATION_DURATION: 2000,
  ROTATION_ANIMATION_DURATION: 10000
}

// Time constants
export const TIME = {
  PHYSICS_STEP: 1 / 60, // 60 FPS physics simulation
  MAX_DELTA_TIME: 30, // Maximum time step to prevent large jumps
  COLLISION_EFFECT_DURATION: 500,
  CIRCLE_LIFETIME: 30000 // 30 seconds
}
