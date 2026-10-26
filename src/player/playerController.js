// Foot controller. Pure-ish movement integration with yaw-space WASD,
// velocity easing, and world collision resolution.
import { resolveMovement } from "../world/collision.js";
import { buildWorldData } from "../world/worldConfig.js";
import { CONSTANTS } from "../config/constants.js";

const PLAYER = (CONSTANTS && CONSTANTS.PLAYER) || {};
const WORLD_BOUNDS_DEFAULT = {
  minX: -60,
  maxX: 60,
  minZ: -5,
  maxZ: 65
};

const MAX_STEP_DISTANCE = 0.1;

function toFinite(v, fallback = 0) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function hasFlag(input, names) {
  if (!input) return false;
  for (const name of names) {
    if (input[name] === true) return true;
    if (input[name] === 1) return true;
  }
  if (input.keys instanceof Set) {
    for (const name of names) {
      const lowered = String(name).toLowerCase();
      for (const key of input.keys) {
        if (String(key).toLowerCase() === lowered) return true;
      }
    }
  }
  if (Array.isArray(input.keys)) {
    for (const name of names) {
      if (input.keys.includes(name)) return true;
    }
  }
  if (typeof input.isDown === "function") {
    for (const name of names) {
      try {
        if (input.isDown(name)) return true;
      } catch {
        // ignore unsupported probe names
      }
    }
  }
  return false;
}

function positionOf(state) {
  if (state && state.position && typeof state.position === "object") return state.position;
  return state;
}

function velocityOf(state) {
  if (!state.velocity || typeof state.velocity !== "object") {
    state.velocity = { x: 0, z: 0 };
  }
  return state.velocity;
}

function worldBoxes(world) {
  if (!world) return [];
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
  if (!world || !world.bounds) return undefined;
  return world.bounds;
}

function approach(current, target, maxDelta) {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return target;
}

export function stepFoot(state, input, dt, world) {
  if (!state) return state;
  const w = world || buildWorldData();
  const position = positionOf(state);
  if (!position || typeof position !== "object") return state;

  if (!Number.isFinite(position.x)) position.x = 0;
  if (!Number.isFinite(position.y)) position.y = 0;
  if (!Number.isFinite(position.z)) position.z = 0;

  const velocity = velocityOf(state);
  if (!Number.isFinite(velocity.x)) velocity.x = 0;
  if (!Number.isFinite(velocity.z)) velocity.z = 0;

  const safeDt = toFinite(dt, 0);
  const inputObj = input || {};

  // Direct yaw assignment requested by mouse input.
  if (Object.prototype.hasOwnProperty.call(inputObj, "mouseYaw")) {
    if (Number.isFinite(inputObj.mouseYaw)) {
      const targetYaw = inputObj.mouseYaw;
      state.yaw = targetYaw;
    }
  } else if (Object.prototype.hasOwnProperty.call(inputObj, "yaw")) {
    if (Number.isFinite(inputObj.yaw)) state.yaw = inputObj.yaw;
  }

  let yaw = Number.isFinite(state.yaw) ? state.yaw : 0;

  const forwardInput = hasFlag(inputObj, ["forward", "w", "KeyW", "up", "ArrowUp"]) ? 1 : 0;
  const backwardInput = hasFlag(inputObj, ["backward", "s", "KeyS", "down", "ArrowDown"]) ? 1 : 0;
  const leftInput = hasFlag(inputObj, ["left", "a", "KeyA", "ArrowLeft"]) ? 1 : 0;
  const rightInput = hasFlag(inputObj, ["right", "d", "KeyD", "ArrowRight"]) ? 1 : 0;

  let strafe = leftInput - rightInput;
  let forward = forwardInput - backwardInput;

  if (inputObj.move && typeof inputObj.move === "object") {
    const mx = toFinite(inputObj.move.x, 0);
    const mz = toFinite(inputObj.move.z, toFinite(inputObj.move.forward, 0));
    strafe += mx;
    forward += mz;
  }

  const magnitude = Math.hypot(strafe, forward);
  if (magnitude > 1) {
    strafe /= magnitude;
    forward /= magnitude;
  }

  const sprint = hasFlag(inputObj, ["shift", "sprint", "run"]);
  const walkSpeed = toFinite(PLAYER.WALK_SPEED, 2.5);
  const runSpeed = toFinite(PLAYER.RUN_SPEED, 4.5);
  const baseSpeed = sprint ? runSpeed : walkSpeed;
  const speed = baseSpeed * Math.min(1, Math.hypot(strafe, forward));

  // Rotate local movement (strafe, forward) into world yaw space.
  // yaw 0 means +Z forward and +X right.
  const sinYaw = Math.sin(yaw);
  const cosYaw = Math.cos(yaw);
  const targetVx = speed * (forward * sinYaw + strafe * cosYaw);
  const targetVz = speed * (forward * cosYaw - strafe * sinYaw);

  const acceleration = toFinite(PLAYER.ACCELERATION, 12);
  const deceleration = toFinite(PLAYER.DECELERATION, 10);
  const accel = Math.hypot(strafe, forward) > 0 ? acceleration : deceleration;
  const maxDelta = Math.max(0, accel) * Math.max(0, safeDt);

  velocity.x = approach(velocity.x, targetVx, maxDelta);
  velocity.z = approach(velocity.z, targetVz, maxDelta);
  if (Math.hypot(velocity.x, velocity.z) < 0.04) {
    velocity.x = 0;
    velocity.z = 0;
  }

  const radius = toFinite(PLAYER.RADIUS ?? PLAYER.COLLISION_RADIUS, 0.4);
  const boxes = worldBoxes(w);
  const bounds = worldBounds(w);

  // Move in small sub-steps to avoid tunneling through obstacles.
  if (safeDt > 0) {
    const totalDistance = Math.hypot(velocity.x * safeDt, velocity.z * safeDt);
    const steps = Math.max(1, Math.ceil(totalDistance / MAX_STEP_DISTANCE));
    const stepDt = safeDt / steps;
    const posX = position.x;
    const posZ = position.z;
    const posY = position.y;
    let curX = posX;
    let curZ = posZ;

    for (let i = 0; i < steps; i += 1) {
      const nextX = curX + velocity.x * stepDt;
      const nextZ = curZ + velocity.z * stepDt;
      const prevPoint = { x: curX, y: posY, z: curZ };
      const nextPoint = { x: nextX, y: posY, z: nextZ };
      const resolved = resolveMovement(prevPoint, nextPoint, radius, boxes, bounds);

      const resolvedX = toFinite(resolved && resolved.x, curX);
      const resolvedZ = toFinite(resolved && resolved.z, curZ);
      const resolvedY = toFinite(resolved && resolved.y, posY);

      // If a step is blocked, drop that velocity component.
      if (Math.abs(resolvedX - curX) <= 1e-9 && Math.abs(velocity.x * stepDt) > 1e-9) {
        velocity.x = 0;
      }
      if (Math.abs(resolvedZ - curZ) <= 1e-9 && Math.abs(velocity.z * stepDt) > 1e-9) {
        velocity.z = 0;
      }

      curX = resolvedX;
      curZ = resolvedZ;
      if (Number.isFinite(resolvedY)) position.y = resolvedY;
    }

    position.x = curX;
    position.z = curZ;
  }

  // Keep state.yaw clean numeric.
  if (!Number.isFinite(state.yaw)) state.yaw = yaw;

  return state;
}

export default stepFoot;
