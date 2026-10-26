import * as THREE from 'three';
import './style.css';
import { buildWorldData } from './world/worldConfig.js';
import { buildScene } from './world/sceneBuilder.js';

const app = document.querySelector('#app');
const hud = document.querySelector('#hud');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / Math.max(1, window.innerHeight), 0.1, 1000);
camera.position.set(0, 80, 70);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
app.appendChild(renderer.domElement);

const world = buildWorldData();
const { group, buildingsGroup, ocean } = buildScene(scene, world, { renderer });

// Dev overlook camera.
camera.lookAt(0, 0, 30);

if (hud) {
  hud.textContent = 'Voxel Coastal City - controls coming soon';
}

function onResize() {
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

let last = performance.now();
function animate(now) {
  const dt = (now - last) / 1000;
  last = now;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// Keep references for future modules (traffic/peds) without using them yet.
export { world, group, buildingsGroup, ocean };
