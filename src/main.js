import * as THREE from "three";
import "./style.css";
import { CONSTANTS } from "./config/constants.js";
import { buildWorldData } from "./world/worldConfig.js";
import { buildScene } from "./world/sceneBuilder.js";
import { stepFoot } from "./player/playerController.js";
import { stepVehicle } from "./vehicles/Vehicle.js";
import { nearestVehicle, canEnter, exitPosition, INTERACT_RADIUS } from "./vehicles/carjacking.js";
import { createCarEntities, updateTraffic } from "./traffic/ambientCars.js";
import { spinCarWheels } from "./vehicles/carModel.js";
import { createPedestrianEntities, updatePedestrians } from "./peds/pedestrians.js";
import { updateFollowCamera } from "./camera/followCamera.js";
import { createKeyboardState } from "./input/keyboard.js";
import { createMouseState } from "./input/mouse.js";
import { resolveMovement, circleBoxOverlap } from "./world/collision.js";
import { createCharacter, animateCharacter } from "./world/characterModel.js";
import { updateHUD } from "./ui/hud.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
if (app) app.appendChild(renderer.domElement);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const world = buildWorldData();
world.staticCollisionBoxes = Array.isArray(world.collisionBoxes) ? world.collisionBoxes.slice() : [];
const { group, buildingsGroup, ocean } = buildScene(scene, world, { renderer });

const brokenProps = new Set();
const propMeshes = new Map();

(function registerProps() {
  for (const prop of [...(world.props || []), ...(world.lamps || [])]) {
    prop.fallen = false;
  }
  scene.traverse((obj) => {
    if (obj.isGroup && obj.name && (obj.name.startsWith("palm-") || obj.name.startsWith("street-lamp-"))) {
      propMeshes.set(obj.name, obj);
    }
  });
})();

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

const playerAvatar = createCharacter({
  name: "player",
  seed: 7,
  skin: 0xd99a6c,
  hair: 0x241711,
  shirt: 0xf3f0e5,
  shorts: 0x2f7d55,
  shoes: 0x2ca8a0,
  cap: 0xb23a2a
});
playerAvatar.position.set(player.position.x, 0, player.position.z);
scene.add(playerAvatar);

const PLAYER_RADIUS = (CONSTANTS && (CONSTANTS.PLAYER_RADIUS || (CONSTANTS.PLAYER && CONSTANTS.PLAYER.RADIUS))) || 0.4;

let gameMode = "onFoot"; // 'onFoot' | 'driving'
let composer = null;
let ssaoPass = null;

// after playerAvatar block (marker ensure origin point)
try {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
  ssaoPass.kernelRadius = 10;
  ssaoPass.minDistance = 0.005;
  ssaoPass.maxDistance = 0.18;
  composer.addPass(ssaoPass);
  composer.addPass(new OutputPass());
} catch (err) {
  console.warn("Post-processing disabled:", err);
  composer = null;
  ssaoPass = null;
}

let activeVehicle = null;
let transitionCooldown = 0;
let eWas = false;
let avatarTime = 0;
const VEHICLE_RADIUS = 1.3;

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

function carDimensions(variant) {
  const v = String(variant || "sport").toLowerCase();
  if (v === "suv") return { width: 2.04, length: 4.36 };
  if (v === "compact") return { width: 1.64, length: 3.55 };
  if (v === "pickup") return { width: 1.9, length: 4.28 };
  return { width: 1.98, length: 4.24 };
}

function carCollisionBox(car, index) {
  const variant = (car && (car.variant || (car.data && car.data.variant))) || "sport";
  const dims = carDimensions(variant);
  const yaw = Number.isFinite(car && car.yaw) ? car.yaw : 0;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const hx = dims.width / 2 + 0.08; // small fender allowance
  const hz = dims.length / 2 + 0.08;
  const corners = [
    { x: hx * cos - hz * sin, z: hx * sin + hz * cos },
    { x: hx * cos + hz * sin, z: hx * sin - hz * cos },
    { x: -hx * cos - hz * sin, z: -hx * sin + hz * cos },
    { x: -hx * cos + hz * sin, z: -hx * sin - hz * cos }
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const c of corners) {
    minX = Math.min(minX, c.x);
    maxX = Math.max(maxX, c.x);
    minZ = Math.min(minZ, c.z);
    maxZ = Math.max(maxZ, c.z);
  }
  const x = Number.isFinite(car && car.x) ? car.x : 0;
  const z = Number.isFinite(car && car.z) ? car.z : 0;
  return {
    id: car && car.id ? String(car.id) : ("car-" + index),
    type: "car",
    shape: "rotated-rect",
    x,
    z,
    yaw: Number.isFinite(car && car.yaw) ? car.yaw : 0,
    w: dims.width,
    d: dims.length,
    hx: dims.width / 2 + 0.08,
    hd: dims.length / 2 + 0.08,
    cx: x,
    cz: z,
    hw: dims.width / 2 + 0.08,
    height: 1.1,
    cy: x,
    cd: z,
    minX: x + minX,
    maxX: x + maxX,
    minZ: z + minZ,
    maxZ: z + maxZ,
    minY: 0,
    maxY: 1.1
  };
}

function onResize() {
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  if (ssaoPass && typeof ssaoPass.setSize === "function") ssaoPass.setSize(window.innerWidth, window.innerHeight);
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
            vehicle.speed = 0;
            if (vehicle.velocity) { vehicle.velocity.x = 0; vehicle.velocity.z = 0; }
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
          (world.collisionBoxes || []).filter((box) => !(box && box.type === "car" && String(box.id) === String(activeVehicle ? activeVehicle.id : ""))),
          world.bounds
        );
        player.position.x = Number.isFinite(safe && safe.x) ? safe.x : exit.x;
        player.position.y = 0;
        player.position.z = Number.isFinite(safe && safe.z) ? safe.z : exit.z;
        player.yaw = Number.isFinite(vehicle.yaw) ? vehicle.yaw : player.yaw;
        player.velocity.x = 0;
        player.velocity.z = 0;
        if (vehicle.speed !== undefined) { vehicle.speed = 0; }
        if (vehicle.velocity) { vehicle.velocity.x = 0; vehicle.velocity.z = 0; }
        vehicle.parked = true;
        vehicle.idling = true;
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
    const driveSpeed = (activeVehicle && Number.isFinite(activeVehicle.speed)) ? activeVehicle.speed : 0;
    const carInput = {
      throttle: kbSnapshot.forward,
      left: kbSnapshot.left,
      right: kbSnapshot.right
    };
    if (kbSnapshot.backward) {
      if (driveSpeed > 0.35) carInput.brake = true;
      else carInput.reverse = true;
    }
    // Avoid self-collision: the active car must not treat its own collider as a wall.
    const allCollisionBoxes = world.collisionBoxes;
    const previousCollisionBoxes = allCollisionBoxes;
    if (Array.isArray(allCollisionBoxes) && activeVehicle) {
      world.collisionBoxes = allCollisionBoxes.filter(
        (box) => !(box && box.type === "car" && String(box.id) === String(activeVehicle.id))
      );
    }
    stepVehicle(activeVehicle, carInput, dt, world);
    if (previousCollisionBoxes) world.collisionBoxes = previousCollisionBoxes;
    // Detect and topple props when the driven car hits them at speed.
    if (activeVehicle) {
      const speedAbs = Math.abs(activeVehicle.speed || 0);
      if (speedAbs > 1) {
        const propIds = [].concat(
          (world.props || []).map((p) => p.id),
          (world.lamps || []).map((l) => l.id)
        );
        for (const id of propIds) {
          const box = (world.collisionBoxes || []).find(
            (b) => b && b.type !== "car" && String(b.id) === String(id)
          );
          if (!box) continue;
          const anyProp = (world.props || []).concat(world.lamps || []).find((p) => p.id === id);
          if (!anyProp || anyProp.fallen) continue;
          if (circleBoxOverlap(activeVehicle.x, activeVehicle.z, VEHICLE_RADIUS + 0.15, box)) {
            anyProp.fallen = true;
            brokenProps.add(anyProp.id);
            const mesh = propMeshes.get(anyProp.id);
            if (mesh) {
              mesh.userData.falling = true;
              mesh.userData.fallDone = false;
            }
            // hard crash: shed most speed on impact.
            if (Math.abs(activeVehicle.speed) > 4) activeVehicle.speed = 0;
            else activeVehicle.speed *= 0.25;
          }
        }
      }
    }
    syncPlayerToVehicle();
    spinCarWheels(activeVehicle, activeVehicle.speed, dt);
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
  // Keep ped and vehicle collision boxes roughly in sync for the next frame's resolvers.
  const carCollisionBoxes = cars.map((car, index) => carCollisionBox(car, index));
  const staticBoxes = (world.staticCollisionBoxes || []).filter((b) => !brokenProps.has(String(b.id)));
  world.collisionBoxes = staticBoxes
    .concat(carCollisionBoxes)
    .concat(
      peds.map((ped) => ({
        type: "pedestrian",
        id: ped.id,
        minX: ped.x - 0.35,
        maxX: ped.x + 0.35,
        minZ: ped.z - 0.35,
        maxZ: ped.z + 0.35,
        minY: 0,
        maxY: 1.8,
        height: 1.8
      }))
    );

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

  // Animate fallen props/trees/lamps toppling to the ground.
  for (const mesh of propMeshes.values()) {
    if (mesh.userData && mesh.userData.falling && !mesh.userData.fallDone) {
      mesh.rotation.z = Math.min(Math.PI / 2, mesh.rotation.z + dt * 4.5);
      if (mesh.rotation.z >= Math.PI / 2 - 0.001) {
        mesh.userData.fallDone = true;
        mesh.rotation.z = Math.PI / 2;
      }
    }
  }

  // camera
  const cameraTarget = (gameMode === "driving" && activeVehicle) ? activeVehicle : player;
  updateFollowCamera(camera, cameraTarget, mouse, dt, {
    distance: 6.4,
    height: 2.95,
    lookHeight: 1.25,
    shoulder: -0.45,
    followSpeed: 12,
    obstacles: world.collisionBoxes.filter((box) => box.type !== "pedestrian"),
    minDistance: 1.5,
    collisionPadding: 0.4
  });

  // sync and animate the player avatar
  if (playerAvatar) {
    playerAvatar.position.x = player.position.x;
    playerAvatar.position.y = 0;
    playerAvatar.position.z = player.position.z;
    playerAvatar.rotation.y = player.yaw;
    playerAvatar.visible = gameMode === "onFoot";
    const footSpeed = gameMode === "onFoot" ? currentSpeed() : 0;
    avatarTime += dt;
    animateCharacter(playerAvatar, footSpeed, avatarTime);
  }

  if (composer) composer.render();
  else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

if (import.meta.env && import.meta.env.DEV && typeof window !== "undefined") {
  // Development-only inspection handle used by visual QA tooling.
  window.__voxelCity = { scene, camera, renderer, world, player, playerAvatar, cars, peds, mouse };
}

requestAnimationFrame(frame);

// Keep exports that tests/other modules may reference.
export { world, group, buildingsGroup, ocean, cars, peds, player, camera, renderer };
