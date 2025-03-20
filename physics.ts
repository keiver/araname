import Matter from "matter-js"
import {Dimensions} from "react-native"
import {ShipEntity, TrackEntity} from "./entities"

const {width, height} = Dimensions.get("window")

interface Entities {
  physics: {
    engine: Matter.Engine
    world: Matter.World
  }
  ship: ShipEntity
  track: TrackEntity
  [key: string]: any
}

interface GameEvent {
  type: string
  points?: number
}

interface TouchEvent {
  type: "start" | "move" | "end"
  event: {
    pageX: number
    pageY: number
  }
}

interface GameUpdateArgs {
  touches: TouchEvent[]
  time: {
    delta: number
  }
  dispatch: (event: GameEvent) => void
}

// Create a new engine for each game instance
export const createPhysicsEngine = () => {
  const engine = Matter.Engine.create({enableSleeping: false})
  const world = engine.world

  // Set up world properties
  world.gravity.y = 0.5

  return {
    engine,
    world
  }
}

export const physics = (entities: Entities, {touches, time, dispatch}: GameUpdateArgs) => {
  const engine = entities.physics.engine
  const world = entities.physics.world
  const ship = entities.ship
  const track = entities.track

  // Update Matter engine with capped delta to prevent instability
  const cappedDelta = Math.min(time.delta, 16.667)
  Matter.Engine.update(engine, cappedDelta)

  // Handle touches for slingshot mechanic
  touches
    .filter(t => t.type === "start")
    .forEach(t => {
      console.log("Touch start at:", t.event.pageX, t.event.pageY)

      // Force ship to stay in place until launched
      if (!ship.launched) {
        // Keep ship in place
        Matter.Body.setVelocity(ship.body, {x: 0, y: 0})
        Matter.Body.setPosition(ship.body, ship.position)

        // Check if touch is near the ship (very forgiving distance)
        const touchX = t.event.pageX
        const touchY = t.event.pageY
        const shipX = ship.body.position.x
        const shipY = ship.body.position.y
        const distance = Math.sqrt(Math.pow(touchX - shipX, 2) + Math.pow(touchY - shipY, 2))

        // Make touch detection very generous
        if (distance < ship.radius * 4) {
          ship.slingPositionStart = {x: shipX, y: shipY} // Start from ship center
          ship.slingPositionCurrent = {x: touchX, y: touchY}
          console.log("Slingshot started")
        }
      }
    })

  touches
    .filter(t => t.type === "move")
    .forEach(t => {
      if (ship.slingPositionStart && !ship.launched) {
        ship.slingPositionCurrent = {x: t.event.pageX, y: t.event.pageY}
        console.log("Slingshot dragging", ship.slingPositionCurrent)

        // Keep ship in place during dragging
        Matter.Body.setVelocity(ship.body, {x: 0, y: 0})
        Matter.Body.setPosition(ship.body, ship.position)
      }
    })

  touches
    .filter(t => t.type === "end")
    .forEach(t => {
      if (ship.slingPositionStart && !ship.launched) {
        // Calculate more powerful force for better feedback
        const force = {
          x: (ship.slingPositionStart.x - t.event.pageX) * 0.2,
          y: (ship.slingPositionStart.y - t.event.pageY) * 0.2
        }

        console.log("Launching ship with force:", force)

        // Apply force to ship for slingshot effect
        Matter.Body.applyForce(ship.body, ship.body.position, force)

        ship.slingPositionStart = null
        ship.slingPositionCurrent = null
        ship.launched = true

        // Add small event for feedback
        dispatch({type: "score", points: 5})
      }
    })

  // Extend track as ship moves upward
  if (ship.body.position.y < height / 3 && track.segments.length < 50) {
    // Add new track segment
    track.extendTrack(ship.body.position.y)

    // Get the latest added segment and body
    const lastSegmentIndex = track.segments.length - 1
    const lastBody = track.bodies[track.bodies.length - 1]

    // Add the new body to the world
    Matter.World.add(world, lastBody)

    // Award points for progress
    dispatch({type: "score", points: 10})
  }

  // Remove offscreen track segments to improve performance
  if (track.segments.length > 20) {
    const offscreenIndex = track.segments.findIndex(segment => segment.y > ship.body.position.y + height)

    if (offscreenIndex > 0) {
      // Remove offscreen segment and body
      const removedSegments = track.segments.splice(0, offscreenIndex)
      const removedBodies = track.bodies.splice(0, offscreenIndex)

      // Remove bodies from the world
      removedBodies.forEach(body => {
        if (body) Matter.World.remove(world, body)
      })
    }
  }

  // Check for collision with track
  const shipCollisions = Matter.Query.collides(ship.body, track.bodies)
  if (shipCollisions.length > 0) {
    // Handle collision effects
    console.log(
      "Ship collided with track at positions:",
      shipCollisions.map(c => `(${c.bodyA.position.x}, ${c.bodyA.position.y})`)
    )
    // Add bounce effect
    Matter.Body.setVelocity(ship.body, {
      x: ship.body.velocity.x * 0.8,
      y: ship.body.velocity.y * -0.5
    })
  }

  // Check for game over conditions
  if (ship.body.position.y > height + 100) {
    dispatch({type: "game-over"})
  }

  // Update positions of all entities
  Object.keys(entities).forEach(key => {
    if (entities[key].body) {
      entities[key].position = entities[key].body.position
      entities[key].rotation = entities[key].body.angle
    }
  })

  return entities
}
