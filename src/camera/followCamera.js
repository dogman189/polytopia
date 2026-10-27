// Third-person follow camera for Voxel Coastal City.
// Mouse-driven yaw (and optional pitch) orbit around a target {x,y,z}.
// No renderer dependencies; safe to call per frame.
import * as THREE from "three";
import { CONSTANTS } from "../config/constants.js";

const C = (CONSTANTS && CONSTANTS.CAMERA) ? CONSTANTS.CAMERA : {};

function num(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  if (min > max) return (min + max) / 2;
  return Math.min(Math.max(value, min), max);
}

function rayBoxEntry(origin, direction, box) {
  const minY = Number.isFinite(box.minY) ? box.minY : 0;
  const maxY = Number.isFinite(box.maxY) ? box.maxY : (Number.isFinite(box.height) ? box.height : Infinity);
  let tMin = 0;
  let tMax = 1;
  const axes = [
    ["x", box.minX, box.maxX],
    ["y", minY, maxY],
    ["z", box.minZ, box.maxZ]
  ];
  for (const [axis, min, max] of axes) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
    const originValue = origin[axis];
    const directionValue = direction[axis];
    if (Math.abs(directionValue) < 1e-8) {
      if (originValue < min || originValue > max) return null;
      continue;
    }
    let t1 = (min - originValue) / directionValue;
    let t2 = (max - originValue) / directionValue;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  return tMin;
}

function pullCameraIn(targetEye, cameraPosition, obstacles, minDistance, padding) {
  if (!Array.isArray(obstacles) || obstacles.length === 0) return cameraPosition;
  const direction = {
    x: cameraPosition.x - targetEye.x,
    y: cameraPosition.y - targetEye.y,
    z: cameraPosition.z - targetEye.z
  };
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (length < 1e-5) return cameraPosition;

  let maxT = 1;
  for (const box of obstacles) {
    if (!box || box.type === "pedestrian") continue;
    const entry = rayBoxEntry(targetEye, direction, box);
    if (entry !== null && entry > 0.001 && entry < maxT) maxT = entry;
  }
  if (maxT >= 1) return cameraPosition;

  const allowed = Math.max(minDistance, maxT * length - padding);
  const scale = allowed / length;
  return {
    x: targetEye.x + direction.x * scale,
    y: Math.max(0.5, targetEye.y + direction.y * scale),
    z: targetEye.z + direction.z * scale
  };
}


function targetXYZ(target) {
  if (!target || typeof target !== "object") {
    return { x: 0, y: 0, z: 0 };
  }
  if (target.position && typeof target.position === "object") {
    const p = target.position;
    return {
      x: num(p.x, num(target.x, 0)),
      y: num(p.y, num(target.y, 0)),
      z: num(p.z, num(target.z, 0))
    };
  }
  return {
    x: num(target.x),
    y: num(target.y),
    z: num(target.z, num(target.z, 0))
  };
}

function mouseValues(mouseState, camera) {
  const state = (mouseState && typeof mouseState === "object") ? mouseState : {};
  const yaw = num(
    state.yaw,
    num(camera && camera.userData && camera.userData.cameraYaw, 0)
  );
  const pitchMin = num(C.PITCH_MIN, -0.35);
  const pitchMax = num(C.PITCH_MAX, 1.2);
  const pitch = clamp(
    num(state.pitch, num(camera && camera.userData && camera.userData.cameraPitch, 0)),
    pitchMin,
    pitchMax
  );
  return { yaw, pitch };
}

export function updateFollowCamera(camera, target, mouseState, dt, options = {}) {
  if (!camera) return camera;

  // Ensure numeric position.
  if (!camera.position || typeof camera.position !== "object") {
    camera.position = new THREE.Vector3(0, 0, 0);
  }
  if (!Number.isFinite(camera.position.x)) camera.position.x = 0;
  if (!Number.isFinite(camera.position.y)) camera.position.y = 0;
  if (!Number.isFinite(camera.position.z)) camera.position.z = 0;

  const t = targetXYZ(target);
  const { yaw, pitch } = mouseValues(mouseState, camera);
  const safeDt = Math.max(0, num(dt, 0));

  const opts = (options && typeof options === "object") ? options : {};
  const distance = Math.max(0.5, num(opts.distance, num(C.DISTANCE, 7)));
  const height = num(opts.height, num(C.HEIGHT, 3.5));
  const lookHeight = num(opts.lookHeight, 1.2);
  const followSpeed = Math.max(0.01, num(opts.followSpeed, 6));
  const shoulder = num(opts.shoulder, -0.55);
  const obstacles = Array.isArray(opts.obstacles) ? opts.obstacles : [];
  const minDistance = Math.max(0.8, num(opts.minDistance, 1.5));
  const collisionPadding = Math.max(0, num(opts.collisionPadding, 0.35));

  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const horizontal = distance * cosPitch;

  // The camera sits behind the facing direction (yaw 0 faces +Z), with a
  // small lateral offset for an over-the-shoulder framing.
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  const targetEye = { x: t.x, y: t.y + lookHeight, z: t.z };
  const desired = {
    x: t.x - Math.sin(yaw) * horizontal + rightX * shoulder,
    y: t.y + height + distance * sinPitch,
    z: t.z - Math.cos(yaw) * horizontal + rightZ * shoulder
  };
  const resolved = pullCameraIn(targetEye, desired, obstacles, minDistance, collisionPadding);

  if (safeDt > 0) {
    const alpha = 1 - Math.exp(-followSpeed * safeDt);
    camera.position.x += (resolved.x - camera.position.x) * alpha;
    camera.position.y += (resolved.y - camera.position.y) * alpha;
    camera.position.z += (resolved.z - camera.position.z) * alpha;
  } else {
    camera.position.x = resolved.x;
    camera.position.y = resolved.y;
    camera.position.z = resolved.z;
  }

  // Never let smoothing carry the camera through a wall.
  const clamped = pullCameraIn(targetEye, camera.position, obstacles, minDistance, collisionPadding);
  if (clamped !== camera.position) {
    camera.position.x = clamped.x;
    camera.position.y = clamped.y;
    camera.position.z = clamped.z;
  }
  if (camera.position.y < 0.5) camera.position.y = 0.5;

  if (camera.userData && typeof camera.userData === "object") {
    camera.userData.cameraYaw = yaw;
    camera.userData.cameraPitch = pitch;
  } else {
    camera.userData = { cameraYaw: yaw, cameraPitch: pitch };
  }

  try {
    camera.lookAt(t.x, t.y + lookHeight, t.z);
  } catch (e) {
    // ignore lookAt failures in minimal/test environments
  }

  return camera;
}

export const updateCamera = updateFollowCamera;
export const stepCamera = updateFollowCamera;
export const followCamera = updateFollowCamera;

export function createCameraState(initial = {}) {
  const src = (initial && typeof initial === "object") ? initial : {};
  return {
    yaw: num(src.yaw, 0),
    pitch: clamp(num(src.pitch, 0), num(C.PITCH_MIN, -0.35), num(C.PITCH_MAX, 1.2)),
    distance: Math.max(0.5, num(src.distance, num(C.DISTANCE, 7))),
    height: num(src.height, num(C.HEIGHT, 3.5))
  };
}

export function createFollowCamera(options = {}) {
  const opts = (options && typeof options === "object") ? options : {};
  const fov = num(opts.fov, num(C.FOV, 60));
  const near = num(opts.near, num(C.NEAR, 0.1));
  const far = num(opts.far, num(C.FAR, 500));
  const camera = new THREE.PerspectiveCamera(fov, 1, near, far);
  const state = createCameraState(opts);
  camera.userData = {
    ...(camera.userData || {}),
    cameraYaw: state.yaw,
    cameraPitch: state.pitch,
    distance: state.distance,
    height: state.height
  };
  if (opts.aspect && Number.isFinite(opts.aspect)) {
    camera.aspect = opts.aspect;
    try { camera.updateProjectionMatrix(); } catch (e) { /* ignore */ }
  }
  return camera;
}

// Default export is callable and also carries named helpers.
function defaultExport(camera, target, mouseState, dt, options) {
  return updateFollowCamera(camera, target, mouseState, dt, options);
}
Object.assign(defaultExport, {
  updateFollowCamera,
  updateCamera,
  stepCamera,
  followCamera,
  createCameraState,
  createFollowCamera
});
export default defaultExport;