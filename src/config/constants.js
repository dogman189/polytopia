// Shared constants for Voxel Coastal City.
// Plain ES module; imported by world/player/vehicle/input modules and tests.
// Values are approximate tuning knobs; world-unit = 1 meter.

const WORLD = Object.freeze({
  MIN_X: -60,
  MAX_X: 60,
  MIN_Z: -5,
  MAX_Z: 65,
  BLOCK_SIZE: 2,
  ROAD_WIDTH: 4,
  SIDEWALK_WIDTH: 2,
  MAP_WIDTH: 120,
  MAP_DEPTH: 70
});

const PLAYER = Object.freeze({
  RADIUS: 0.4,
  HEIGHT: 1.7,
  EYE_HEIGHT: 1.5,
  WALK_SPEED: 2.5,
  RUN_SPEED: 4.5,
  ACCELERATION: 12,
  DECELERATION: 10,
  // legacy/alias friendly names
  COLLISION_RADIUS: 0.4
});

const VEHICLE = Object.freeze({
  MAX_SPEED: 60 / 3.6, // ~16.67 m/s
  REVERSE_SPEED: 5,
  ACCELERATION: 8,
  BRAKE: 16,
  DRAG: 3,
  STEER_RATE_LOW: 2.8,
  STEER_RATE_HIGH: 1.1,
  STEER_SPEED_THRESHOLD: 4,
  MIN_TURN_SPEED: 0.5
});

const CAMERA = Object.freeze({
  FOV: 60,
  NEAR: 0.1,
  FAR: 500,
  DISTANCE: 7,
  HEIGHT: 3.5,
  MIN_DISTANCE: 4,
  MAX_DISTANCE: 12,
  PITCH_MIN: -0.35,
  PITCH_MAX: 1.2,
  YAW_SENSITIVITY: 0.005,
  PITCH_SENSITIVITY: 0.005
});

const INTERACT_RADIUS = 2.5;
const EXIT_OFFSET = 0.8;

const INTERACTION = Object.freeze({
  INTERACT_RADIUS,
  EXIT_OFFSET
});

const COUNTS = Object.freeze({
  STOREFRONTS_PER_ROW: 11,
  STOREFRONT_ROWS: 2,
  PALMS: 10,
  PARKED_CARS: 8,
  TRAFFIC_ROUTES: 3,
  PED_ROUTES: 2
});

const CONSTANTS = {
  WORLD,
  PLAYER,
  VEHICLE,
  CAMERA,
  // top-level convenience copies of hero constants
  INTERACT_RADIUS,
  EXIT_OFFSET,
  INTERACTION,
  COUNTS,
  // flat aliases for older/alternate call sites
  WORLD_MIN_X: WORLD.MIN_X,
  WORLD_MAX_X: WORLD.MAX_X,
  WORLD_MIN_Z: WORLD.MIN_Z,
  WORLD_MAX_Z: WORLD.MAX_Z,
  MIN_X: WORLD.MIN_X,
  MAX_X: WORLD.MAX_X,
  MIN_Z: WORLD.MIN_Z,
  MAX_Z: WORLD.MAX_Z,
  PLAYER_RADIUS: PLAYER.RADIUS,
  WALK_SPEED: PLAYER.WALK_SPEED,
  RUN_SPEED: PLAYER.RUN_SPEED,
  MAX_SPEED: VEHICLE.MAX_SPEED
};

export { CONSTANTS };
export default CONSTANTS;