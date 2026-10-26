import * as THREE from "three";
import "./style.css";
import { CONSTANTS } from "./config/constants.js";
import { buildWorldData } from "./world/worldConfig.js";
import { buildScene } from "./world/sceneBuilder.js";
import { stepFoot } from "./player/playerController.js";
import { stepVehicle } from "./vehicles/Vehicle.js";
import { nearestVehicle, canEnter, exitPosition, INTERACT_RADIUS } from "./vehicles/carjacking.js";
import { createCarEntities, updateTraffic } from "./traffic/ambientCars.js";
import { createPedestrianEntities, updatePedestrians } from "./peds/pedestrians.js";
import { updateFollowCamera } from "./camera/followCamera.js";
import { createKeyboardState } from "./input/keyboard.js";
import { createMouseState } from "./input/mouse.js";
import { resolveMovement } from "./world/collision.js";
import updateHUD from "./ui/hud.js";

const app = document.querySelector("#app");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const cameraFov = (CONSTANTS && CONSTANTS.CAMERA && CONSTANTS.CAMERA.FOV) || 60;
const cameraNear = (CONSTANTS && CONSTANTS.CAMERA && CONSTANTS.CAMERA.NEAR) || 0.1;
const cameraFar = (CONSTANTS && CONSTANTS.CAMERA && CONSTANTS.CAMERA.FAR) || 500;

const camera = new THREE.PerspectiveCamera(cameraFov, window.innerWidth / Math.max(1, window.innerHeight), cameraNear, cameraFar);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
if (app) app.appendChild(renderer.domElement);

const world = buildWorldData();
const { group, buildingsGroup, ocean } = buildScene(scene, world, { renderer });

const cars = createCarEntities(world, scene);
const peds = createPedestrianEntities(world, scene);

const keyboard = createKeyboardState();
const mouse = createMouseState(renderer.domElement);

// HUD is rendered directly via updateHUD(mode, prompt, speed). No persistent handle needed.

const spawn = (world && world.spawns && (world.spawns.player || world.spawns.playerStart || world.spawns.start || world.spawns.spawn)) || { x: 0, z: 24, y: 0, yaw: 0 };
const player = {
  position: { x: spawn.x, y: Number.isFinite(spawn.y) ? spawn.y : 0, z: spawn.z },
  yaw: Number.isFinite(spawn.yaw) ? spawn.yaw : 0,
  velocity: { x: 0, z: 0 }
};

const PLAYER_RADIUS = (CONSTANTS && (CONSTANTS.PLAYER_RADIUS || (CONSTANTS.PLAYER && CONSTANTS.PLAYER.RADIUS))) || 0.4;

let gameMode = "onFoot"; // 'onFoot' | 'driving'
let activeVehicle = null;
let transitionCooldown = 0;
let eWas = false;

function isEPressed(keyboardState) {
  return !!(keyboardState && keyboardState.isDown && keyboardState.isDown("KeyE"));
}

function getKeyboardSnapshot(kb) {
  const shiftDown = !!(kb && kb.isDown && (kb.isDown("ShiftLeft") || kb.isDown("ShiftRight") || kb.isDown("Shift")));
  return {
    forward: !!(kb && kb.isDown && kb.isDown("KeyW")),
    backward: !!(kb && kb.isDown && kb.isDown("KeyS")),
    left: !!(kb && kb.isDown && kb.isDown("KeyA")),
    right: !!(kb && kb.isDown && kb.isDown("KeyD")),
    shift: shiftDown
  };
}

function syncPlayerToVehicle() {
  if (!activeVehicle) return;
  player.position.x = activeVehicle.x;
  player.position.y = 0;
  player.position.z = activeVehicle.z;
  player.yaw = activeVehicle.yaw;
  player.velocity.x = 0;
  player.velocity.z = 0;
}

function currentSpeed() {
  if (gameMode === "driving" && activeVehicle) {
    const v = activeVehicle;
    const speed = Number.isFinite(v.speed) ? v.speed : Math.hypot((v.velocity && v.velocity.x) || 0, (v.velocity && v.velocity.z) || 0);
    return Math.abs(speed);
  }
  return Math.hypot(player.velocity.x || 0, player.velocity.z || 0);
}

function nearestEnterableVehicle() {
  return nearestVehicle(player.position, cars, INTERACT_RADIUS);
}

function onResize() {
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);

let lastTime = (typeof performance !== "undefined" && performance && typeof performance.now === "function") ? performance.now() : Date.now();

function frame(now) {
  const referenceTime = (typeof performance !== "undefined" && performance && typeof performance.now === "function") ? performance.now() : Date.now();
  const rawDelta = Number.isFinite(now) ? (now - lastTime) / 1000 : (referenceTime - lastTime) / 1000;
  lastTime = Number.isFinite(now) ? now : referenceTime;
  let dt = Number.isFinite(rawDelta) ? rawDelta : 0;
  if (dt < 0) dt = 0;
  if (dt > 0.05) dt = 0.05;

  // transition cooldown
  if (transitionCooldown > 0) {
    transitionCooldown = Math.max(0, transitionCooldown - dt);
  }

  // E rising edge handling
  const eDown = isEPressed(keyboard);
  if (eDown && !eWas) {
    eWas = true;
    if (transitionCooldown <= 0) {
      if (gameMode === "onFoot") {
        const idx = nearestEnterableVehicle();
        if (idx >= 0 && idx < cars.length) {
          const vehicle = cars[idx];
          if (canEnter(player, vehicle)) {
            // mount
            gameMode = "driving";
            activeVehicle = vehicle;
            vehicle.stolen = true;
            player.velocity.x = 0;
            player.velocity.z = 0;
            transitionCooldown = 0.3;
          }
        }
      } else if (gameMode === "driving" && activeVehicle) {
        // exit
        const vehicle = activeVehicle;
        const exit = exitPosition(vehicle);
        const safe = resolveMovement(
          { x: vehicle.x, y: 0, z: vehicle.z },
          { x: exit.x, y: 0, z: exit.z },
          PLAYER_RADIUS,
          world.collisionBoxes,
          world.bounds
        );
        player.position.x = Number.isFinite(safe && safe.x) ? safe.x : exit.x;
        player.position.y = 0;
        player.position.z = Number.isFinite(safe && safe.z) ? safe.z : exit.z;
        player.yaw = Number.isFinite(vehicle.yaw) ? vehicle.yaw : player.yaw;
        player.velocity.x = 0;
        player.velocity.z = 0;
        activeVehicle = null;
        gameMode = "onFoot";
        transitionCooldown = 0.3;
      }
    }
  }
  if (!eDown) {
    eWas = false;
  }

  if (gameMode === "driving" && activeVehicle) {
    // driving
    const kbSnapshot = getKeyboardSnapshot(keyboard);
    const carInput = {
      throttle: kbSnapshot.forward,
      brake: kbSnapshot.backward,
      left: kbSnapshot.left,
      right: kbSnapshot.right
    };
    stepVehicle(activeVehicle, carInput, dt, world);
    syncPlayerToVehicle();
  } else {
    // on foot
    const kbSnapshot = getKeyboardSnapshot(keyboard);
    const stepInput = {
      forward: kbSnapshot.forward,
      backward: kbSnapshot.backward,
      left: kbSnapshot.left,
      right: kbSnapshot.right,
      shift: kbSnapshot.shift,
      mouseYaw: (mouse && Number.isFinite(mouse.yaw)) ? mouse.yaw : 0
    };
    stepFoot(player, stepInput, dt, world);
  }

  // world simulations
  updateTraffic(cars, dt, world);
  updatePedestrians(peds, dt);

  // HUD prompt
  const nearIdx = (gameMode === "onFoot") ? nearestEnterableVehicle() : -1;
  const nearby = gameMode === "onFoot" && nearIdx >= 0 && nearIdx < cars.length && canEnter(player, cars[nearIdx]);
  let promptText = "Explore the city on foot";
  if (gameMode === "onFoot") {
    promptText = nearby ? "Press E to enter" : "Explore the city on foot";
  } else {
    promptText = "Press E to exit vehicle";
  }

  try {
    updateHUD(gameMode, promptText, currentSpeed());
  } catch (e) {
    // ignore HUD errors to keep frame loop alive
  }

  // camera
  const cameraTarget = (gameMode === "driving" && activeVehicle) ? activeVehicle : player;
  updateFollowCamera(camera, cameraTarget, mouse, dt, {
    distance: (CONSTANTS && CONSTANTS.CAMERA && CONSTANTS.CAMERA.DISTANCE) || 7,
    height: (CONSTANTS && CONSTANTS.CAMERA && CONSTANTS.CAMERA.HEIGHT) || 3.5,
    lookHeight: 1.2,
    followSpeed: 8
  });

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Keep exports that tests/other modules may reference.
export { world, group, buildingsGroup, ocean, cars, peds, player, camera, renderer };
