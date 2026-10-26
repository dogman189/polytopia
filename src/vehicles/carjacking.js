// Carjacking helpers for Voxel Coastal City.
// Pure helpers: nearest-vehicle search, enterability checks, and exit placement.
// No module side effects; constants are resolved from config with safe fallbacks.
import { CONSTANTS } from "../config/constants.js";

const FALLBACK_INTERACT_RADIUS = 2.5;
const FALLBACK_EXIT_OFFSET = 0.8;

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function pickConstant(name, fallback) {
  if (CONSTANTS && finite(CONSTANTS[name])) return CONSTANTS[name];
  if (CONSTANTS && CONSTANTS.INTERACTION && finite(CONSTANTS.INTERACTION[name])) {
    return CONSTANTS.INTERACTION[name];
  }
  if (CONSTANTS && CONSTANTS.interaction && finite(CONSTANTS.interaction[name])) {
    return CONSTANTS.interaction[name];
  }
  return fallback;
}

export const INTERACT_RADIUS = pickConstant("INTERACT_RADIUS", FALLBACK_INTERACT_RADIUS);
export const EXIT_OFFSET = pickConstant("EXIT_OFFSET", FALLBACK_EXIT_OFFSET);

function toNumber(value, fallback = 0) {
  return finite(value) ? value : fallback;
}

function toPosition(value) {
  if (Array.isArray(value)) {
    if (value.length >= 3) return { x: toNumber(value[0]), z: toNumber(value[2]) };
    if (value.length >= 2) return { x: toNumber(value[0]), z: toNumber(value[1]) };
    return { x: 0, z: 0 };
  }

  if (value && typeof value === "object") {
    if (value.position && typeof value.position === "object") {
      return toPosition(value.position);
    }
    if (
      finite(value.x) || finite(value.z) ||
      finite(value.X) || finite(value.Z) ||
      finite(value.left) || finite(value.top)
    ) {
      return {
        x: toNumber(value.x ?? value.X ?? value.left ?? value.cx ?? value.centerX),
        z: toNumber(value.z ?? value.Z ?? value.y ?? value.Y ?? value.top ?? value.cz ?? value.centerZ)
      };
    }
  }

  return { x: 0, z: 0 };
}

function isDestroyed(vehicle) {
  if (!vehicle || typeof vehicle !== "object") return true;
  if (vehicle.destroyed === true || vehicle.dead === true || vehicle.disabled === true) return true;
  if (vehicle.removed === true || vehicle.active === false || vehicle.isDestroyed === true) return true;
  if (vehicle.alive === false) return true;
  if (finite(vehicle.health) && vehicle.health <= 0) return true;
  return false;
}

function isTraffic(vehicle) {
  if (!vehicle || typeof vehicle !== "object") return false;
  if (vehicle.traffic === true || vehicle.traffic === 1) return true;
  if (typeof vehicle.traffic === "string" && vehicle.traffic.toLowerCase() === "true") return true;
  if (vehicle.type === "traffic" || vehicle.kind === "traffic") return true;
  return false;
}

function velocityMagnitude(vehicle) {
  if (!vehicle || typeof vehicle !== "object") return 0;
  if (finite(vehicle.speed)) return Math.abs(vehicle.speed);
  const vx = toNumber(vehicle.velocity && vehicle.velocity.x, 0);
  const vz = toNumber(vehicle.velocity && vehicle.velocity.z, 0);
  if (vehicle.velocity) return Math.hypot(vx, vz);
  return 0;
}

function isMoving(vehicle) {
  if (!vehicle || typeof vehicle !== "object") return false;
  if (vehicle.moving === true || vehicle.isMoving === true) return true;
  return velocityMagnitude(vehicle) > 0.5;
}

function parkingAllowed(vehicle) {
  if (!vehicle || typeof vehicle !== "object") return false;
  if (isMoving(vehicle)) return false;
  if (vehicle.parked === true || vehicle.idling === true || vehicle.idle === true) return true;
  if (vehicle.stopped === true || vehicle.stationary === true) return true;

  const state = typeof vehicle.state === "string" ? vehicle.state.toLowerCase() : "";
  if (state && ["parked", "idling", "idle", "stopped", "stationary"].includes(state)) return true;
  if (state && !["parked", "idling", "idle", "stopped", "stationary"].includes(state)) return false;

  if (vehicle.parked === false && vehicle.idling !== true && vehicle.idle !== true) return false;

  return !isMoving(vehicle);
}

function isEnterable(vehicle) {
  if (!vehicle || typeof vehicle !== "object") return false;
  if (vehicle.enterable === false || vehicle.stealable === false || vehicle.interactable === false) return false;
  return true;
}

export function nearestVehicle(playerPos, vehicles, maxDistance) {
  if (!Array.isArray(vehicles) || vehicles.length === 0) return -1;

  const playerPosition = toPosition(playerPos);
  const limit = finite(maxDistance) ? maxDistance : INTERACT_RADIUS;
  let bestIndex = -1;
  let bestDistance = Infinity;

  for (let i = 0; i < vehicles.length; i += 1) {
    const vehicle = vehicles[i];
    if (!vehicle || typeof vehicle !== "object") continue;
    if (isDestroyed(vehicle) || isTraffic(vehicle)) continue;
    if (!isEnterable(vehicle)) continue;
    if (!parkingAllowed(vehicle)) continue;

    const vehiclePosition = toPosition(vehicle);
    const distance = Math.hypot(
      playerPosition.x - vehiclePosition.x,
      playerPosition.z - vehiclePosition.z
    );

    if (distance <= limit + 1e-9 && distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

export function canEnter(player, vehicle) {
  if (!vehicle || typeof vehicle !== "object") return false;
  if (isDestroyed(vehicle) || isTraffic(vehicle)) return false;
  if (!isEnterable(vehicle)) return false;
  if (!parkingAllowed(vehicle)) return false;

  // Moving vehicles are never enterable, even without an explicit parked flag.
  if (isMoving(vehicle)) return false;

  const playerPosition = toPosition(player);
  const vehiclePosition = toPosition(vehicle);
  const distance = Math.hypot(
    playerPosition.x - vehiclePosition.x,
    playerPosition.z - vehiclePosition.z
  );

  return distance <= INTERACT_RADIUS + 1e-9;
}

export function exitPosition(vehicle) {
  const position = toPosition(vehicle);
  const yaw = finite(vehicle && vehicle.yaw) ? vehicle.yaw : 0;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);

  return {
    x: position.x + cosYaw * EXIT_OFFSET,
    z: position.z - sinYaw * EXIT_OFFSET
  };
}

const carjacking = { nearestVehicle, canEnter, exitPosition, INTERACT_RADIUS, EXIT_OFFSET };
export default carjacking;