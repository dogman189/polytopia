// Vehicle physics for Voxel Coastal City.
// Pure-ish stateful integration: throttle/brake, drag, speed-scaled steering,
// world bounds and AABB collision resolution.
import { resolveMovement } from "../world/collision.js";
import { buildWorldData } from "../world/worldConfig.js";
import { CONSTANTS } from "../config/constants.js";

const VEHICLE = (CONSTANTS && CONSTANTS.VEHICLE) || {};
const WORLD = (CONSTANTS && CONSTANTS.WORLD) || {};

const DEFAULTS = {
  MAX_SPEED: VEHICLE.MAX_SPEED ?? 60 / 3.6,
  REVERSE_SPEED: VEHICLE.REVERSE_SPEED ?? 5,
  ACCELERATION: VEHICLE.ACCELERATION ?? 8,
  BRAKE: VEHICLE.BRAKE ?? 16,
  DRAG: VEHICLE.DRAG ?? 3,
  STEER_RATE_LOW: VEHICLE.STEER_RATE_LOW ?? 2.8,
  STEER_RATE_HIGH: VEHICLE.STEER_RATE_HIGH ?? 1.1,
  STEER_SPEED_THRESHOLD: VEHICLE.STEER_SPEED_THRESHOLD ?? 4,
  MIN_TURN_SPEED: VEHICLE.MIN_TURN_SPEED ?? 0.5
};

const VEHICLE_RADIUS = 2.2;

const DEFAULT_BOUNDS = {
  minX: (WORLD && WORLD.MIN_X) ?? -60,
  maxX: (WORLD && WORLD.MAX_X) ?? 60,
  minZ: (WORLD && WORLD.MIN_Z) ?? -5,
  maxZ: (WORLD && WORLD.MAX_Z) ?? 65
};

function toFinite(v, fallback = 0) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function numOr(v, fallback) {
  return Number.isFinite(v) ? v : fallback;
}

function hasFlag(input, names) {
  if (!input) return 0;
  for (const name of names) {
    const v = input[name];
    if (v === true) return 1;
    if (v === 1) return 1;
    if (typeof v === "string" && v.toLowerCase() === "true") return 1;
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  if (input.keys instanceof Set) {
    for (const name of names) {
      const lowered = String(name).toLowerCase();
      for (const key of input.keys) {
        if (String(key).toLowerCase() === lowered) return 1;
      }
    }
  }
  if (Array.isArray(input.keys)) {
    for (const name of names) {
      if (input.keys.includes(name)) return 1;
    }
  }
  if (typeof input.isDown === "function") {
    for (const name of names) {
      try {
        const r = input.isDown(name);
        if (r === true || r === 1) return 1;
        if (typeof r === "number" && Number.isFinite(r)) return r;
      } catch {
        // ignore unsupported probe names
      }
    }
  }
  return 0;
}

function worldBoxes(world) {
  if (!world) return [];
  if (Array.isArray(world)) return world;
  return (
    world.collisionBoxes ||
    world.boxes ||
    world.obstacles ||
    world.colliders ||
    world.collisions ||
    []
  );
}

function worldBounds(world) {
  if (!world) return undefined;
  if (world.bounds) return world.bounds;
  if (
    Number.isFinite(world.minX) &&
    Number.isFinite(world.maxX) &&
    Number.isFinite(world.minZ) &&
    Number.isFinite(world.maxZ)
  ) {
    return {
      minX: world.minX,
      maxX: world.maxX,
      minZ: world.minZ,
      maxZ: world.maxZ
    };
  }
  if (world.min && world.max) {
    return {
      minX: toFinite(world.min.x ?? world.min.X ?? world.min.minX, DEFAULT_BOUNDS.minX),
      maxX: toFinite(world.max.x ?? world.max.X ?? world.max.maxX, DEFAULT_BOUNDS.maxX),
      minZ: toFinite(world.min.z ?? world.min.Z ?? world.min.minZ, DEFAULT_BOUNDS.minZ),
      maxZ: toFinite(world.max.z ?? world.max.Z ?? world.max.maxZ, DEFAULT_BOUNDS.maxZ)
    };
  }
  return undefined;
}

function getBounds(world) {
  const b = worldBounds(world);
  if (b) return b;
  return { ...DEFAULT_BOUNDS };
}

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi);
}

function approach(current, target, maxDelta) {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return target;
}

export function createVehicle(spec = {}) {
  const s = spec || {};
  const x = numOr(s.x, 0);
  const z = numOr(s.z, 0);
  const yaw = numOr(s.yaw, 0);
  const speed = numOr(s.speed, 0);

  const vehicle = {
    x,
    z,
    y: 0,
    yaw,
    speed,
    velocity: {
      x: Math.sin(yaw) * speed,
      z: Math.cos(yaw) * speed
    },
    position: { x, y: 0, z }
  };

  // Keep top-level and nested position in sync on future writes by marking helper.
  return vehicle;
}

export function stepVehicle(vehicle, input, dt, world) {
  if (!vehicle) return vehicle;

  const w = (world === undefined || world === null) ? buildWorldData() : world;
  const safeDt = Math.max(0, toFinite(dt, 0));

  // Ensure finite numeric state.
  if (!Number.isFinite(vehicle.x)) vehicle.x = 0;
  if (!Number.isFinite(vehicle.z)) vehicle.z = 0;
  if (!Number.isFinite(vehicle.y)) vehicle.y = 0;
  if (!Number.isFinite(vehicle.yaw)) vehicle.yaw = 0;
  if (!Number.isFinite(vehicle.speed)) vehicle.speed = 0;
  if (!vehicle.velocity || typeof vehicle.velocity !== "object") {
    vehicle.velocity = { x: 0, z: 0 };
  }
  if (!Number.isFinite(vehicle.velocity.x)) vehicle.velocity.x = 0;
  if (!Number.isFinite(vehicle.velocity.z)) vehicle.velocity.z = 0;
  if (!vehicle.position || typeof vehicle.position !== "object") {
    vehicle.position = { x: vehicle.x, y: 0, z: vehicle.z };
  }

  const inp = input || {};
  const throttle = hasFlag(inp, ["throttle", "accelerate", "accel", "gas", "forward", "w"]);
  const brake = hasFlag(inp, ["brake", "braking"]);
  const reverse = hasFlag(inp, ["reverse", "backward", "back", "reverseGear"]);
  const left = hasFlag(inp, ["left", "steerLeft", "a"]);
  const right = hasFlag(inp, ["right", "steerRight", "d"]);

  let steerInput = right - left;
  if (Number.isFinite(inp.steer)) steerInput += inp.steer;
  if (Number.isFinite(inp.steering)) steerInput += inp.steering;
  steerInput = clamp(steerInput, -1, 1);

  let speed = vehicle.speed;

  const acceleration = toFinite(VEHICLE.ACCELERATION ?? DEFAULTS.ACCELERATION, DEFAULTS.ACCELERATION);
  const brakeForce = toFinite(VEHICLE.BRAKE ?? DEFAULTS.BRAKE, DEFAULTS.BRAKE);
  const drag = toFinite(VEHICLE.DRAG ?? DEFAULTS.DRAG, DEFAULTS.DRAG);
  const maxSpeed = toFinite(VEHICLE.MAX_SPEED ?? DEFAULTS.MAX_SPEED, DEFAULTS.MAX_SPEED);
  const reverseSpeed = toFinite(VEHICLE.REVERSE_SPEED ?? DEFAULTS.REVERSE_SPEED, DEFAULTS.REVERSE_SPEED);

  // Throttle / reverse longitudinal input.
  if (throttle) {
    const intensity = Math.abs(toFinite(throttle, 1)) > 0 ? Math.abs(toFinite(throttle, 1)) : 1;
    speed += acceleration * Math.min(1, intensity) * safeDt;
  } else if (reverse) {
    const intensity = Math.abs(toFinite(reverse, 1)) > 0 ? Math.abs(toFinite(reverse, 1)) : 1;
    speed -= acceleration * Math.min(1, intensity) * safeDt;
  }

  // Brake: decelerate toward zero (does not auto-reverse).
  if (brake) {
    if (speed > 0) {
      speed = Math.max(0, speed - brakeForce * safeDt);
    } else if (speed < 0) {
      speed = Math.min(0, speed + brakeForce * safeDt);
    }
  }

  // Drag when no longitudinal pedal input.
  if (!throttle && !brake && !reverse) {
    speed = approach(speed, 0, Math.max(0, drag) * safeDt);
  }

  // Clamp speed range.
  speed = clamp(speed, -reverseSpeed, maxSpeed);

  // Speed-scaled steering. No steering at near-zero speed.
  let yaw = vehicle.yaw;
  const turnSpeed = Math.abs(speed);
  const minTurn = toFinite(VEHICLE.MIN_TURN_SPEED ?? DEFAULTS.MIN_TURN_SPEED, DEFAULTS.MIN_TURN_SPEED);
  const threshold = toFinite(VEHICLE.STEER_SPEED_THRESHOLD ?? DEFAULTS.STEER_SPEED_THRESHOLD, DEFAULTS.STEER_SPEED_THRESHOLD);
  const lowRate = toFinite(VEHICLE.STEER_RATE_LOW ?? DEFAULTS.STEER_RATE_LOW, DEFAULTS.STEER_RATE_LOW);
  const highRate = toFinite(VEHICLE.STEER_RATE_HIGH ?? DEFAULTS.STEER_RATE_HIGH, DEFAULTS.STEER_RATE_HIGH);

  let turnRate = 0;
  if (turnSpeed >= minTurn) {
    if (turnSpeed >= threshold) {
      turnRate = highRate;
    } else {
      const t = threshold > minTurn
        ? (turnSpeed - minTurn) / (threshold - minTurn)
        : 1;
      turnRate = lowRate + (highRate - lowRate) * clamp(t, 0, 1);
    }
  }

  if (steerInput !== 0 && turnRate !== 0 && safeDt > 0) {
    yaw += steerInput * turnRate * safeDt;
  }

  // Sub-step integration to avoid tunneling and to honor collision boxes.
  const bounds = getBounds(w);
  const boxes = worldBoxes(w);
  const MOVE_MAX_STEP = 0.1;
  const totalDistance = Math.abs(speed * safeDt);
  const steps = Math.max(1, Math.ceil(totalDistance / MOVE_MAX_STEP));
  const stepDt = safeDt / steps;
  const sinYaw = Math.sin(yaw);
  const cosYaw = Math.cos(yaw);
  let x = vehicle.x;
  let z = vehicle.z;
  for (let i = 0; i < steps; i += 1) {
    const prev = { x, y: vehicle.y, z };
    const nx = x + sinYaw * speed * stepDt;
    const nz = z + cosYaw * speed * stepDt;
    const resolved = resolveMovement(prev, { x: nx, y: vehicle.y, z: nz }, VEHICLE_RADIUS, boxes, bounds);
    x = toFinite(resolved && resolved.x, x);
    z = toFinite(resolved && resolved.z, z);
  }
  const prevX = vehicle.x;
  const prevZ = vehicle.z;
  const prev = { x: prevX, y: vehicle.y, z: prevZ };
  const nextX = x;
  const nextZ = z;
  const next = { x: nextX, y: vehicle.y, z: nextZ };
  const resolvedX = toFinite(next.x, prevX);
  const resolvedZ = toFinite(next.z, prevZ);
  const resolvedY = toFinite(vehicle.y, vehicle.y);

  vehicle.yaw = yaw;
  vehicle.speed = speed;
  vehicle.x = resolvedX;
  vehicle.z = resolvedZ;
  vehicle.y = Number.isFinite(resolvedY) ? resolvedY : 0;
  if (vehicle.y !== 0) vehicle.y = 0; // preserve ground plane
  vehicle.position = vehicle.position || { x: 0, y: 0, z: 0 };
  vehicle.position.x = vehicle.x;
  vehicle.position.y = 0;
  vehicle.position.z = vehicle.z;
  vehicle.velocity.x = Math.sin(yaw) * speed;
  vehicle.velocity.z = Math.cos(yaw) * speed;

  // resolved is no longer a single object after sub-step integration; yaw is tracked above.
  return vehicle;
}

class Vehicle {
  constructor(spec) {
    Object.assign(this, createVehicle(spec));
  }
  step(input, dt, world) {
    return stepVehicle(this, input, dt, world);
  }
}

export { Vehicle };
export default stepVehicle;