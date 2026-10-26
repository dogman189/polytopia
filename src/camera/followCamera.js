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

  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const horizontal = distance * cosPitch;

  const desired = {
    x: t.x + Math.sin(yaw) * horizontal,
    y: t.y + height + distance * sinPitch,
    z: t.z + Math.cos(yaw) * horizontal
  };

  if (safeDt > 0) {
    const alpha = 1 - Math.exp(-followSpeed * safeDt);
    camera.position.x += (desired.x - camera.position.x) * alpha;
    camera.position.y += (desired.y - camera.position.y) * alpha;
    camera.position.z += (desired.z - camera.position.z) * alpha;
  } else {
    camera.position.x = desired.x;
    camera.position.y = desired.y;
    camera.position.z = desired.z;
  }

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