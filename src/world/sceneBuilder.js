// Scene builder for Voxel Coastal City.
import * as THREE from "three";

function color(value, fallback = 0xffffff) {
  try { return new THREE.Color(value); } catch (e) { return new THREE.Color(fallback); }
}

function num(v, fallback = 0) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function buildScene(scene, world = {}, options = {}) {
  const { renderer } = options || {};

  if (renderer && renderer.shadowMap) renderer.shadowMap.enabled = false;
  if (scene) scene.background = scene.background || new THREE.Color(0x87ceeb);

  const group = new THREE.Group();
  group.name = "city";
  if (scene) scene.add(group);

  const bounds = (world && world.bounds) || {};
  const minX = num(bounds.minX, -60);
  const maxX = num(bounds.maxX, 60);
  const minZ = num(bounds.minZ, -5);
  const maxZ = num(bounds.maxZ, 65);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 90),
    new THREE.MeshStandardMaterial({ color: 0x7ec850, roughness: 0.95, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 30);
  group.add(ground);

  const oceanData = (world && world.ocean) || {};
  const oceanMinX = num(oceanData.minX, minX);
  const oceanMaxX = num(oceanData.maxX, maxX);
  const oceanMinZ = num(oceanData.minZ, 60);
  const oceanMaxZ = num(oceanData.maxZ, maxZ);
  const oceanWidth = Math.max(10, oceanMaxX - oceanMinX + 4);
  const oceanDepth = Math.max(10, oceanMaxZ - oceanMinZ + 20);
  const oceanCenterX = (oceanMinX + oceanMaxX) / 2;
  const oceanCenterZ = (oceanMinZ + oceanMaxZ) / 2 + 10;
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(oceanWidth, oceanDepth),
    new THREE.MeshStandardMaterial({ color: 0x3a8ee6, roughness: 0.4, metalness: 0.1 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(oceanCenterX, num(oceanData.level ?? oceanData.waterLevel, 0) - 0.05, oceanCenterZ);
  group.add(ocean);

  const oceanWall = oceanData.wall || {};
  const wallMinX = num(oceanWall.minX, oceanMinX);
  const wallMaxX = num(oceanWall.maxX, oceanMaxX);
  const wallMinZ = num(oceanWall.minZ, 60);
  const wallMaxZ = num(oceanWall.maxZ, 62);
  const retainingWall = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(1, wallMaxX - wallMinX), 1.4, Math.max(0.5, wallMaxZ - wallMinZ)),
    new THREE.MeshStandardMaterial({ color: 0x8a857a, roughness: 0.9, metalness: 0 })
  );
  retainingWall.position.set((wallMinX + wallMaxX) / 2, 0.7, (wallMinZ + wallMaxZ) / 2);
  group.add(retainingWall);

  const buildingsGroup = new THREE.Group();
  buildingsGroup.name = "buildings";
  group.add(buildingsGroup);

  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b5a3c, roughness: 0.9, metalness: 0 });
  const buildings = Array.isArray(world && world.buildings) ? world.buildings : [];
  for (const b of buildings) {
    const w = num(b.w ?? b.width, 2);
    const d = num(b.d ?? b.depth, 2);
    const h = num(b.h ?? b.height, 2);
    const cx = num(b.x, 0);
    const cz = num(b.z, 0);
    const rotY = num(b.rotation, 0);

    const buildingGroup = new THREE.Group();
    buildingGroup.name = b.id || "building";

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: color(b.color, 0xd9d3c7), roughness: 0.9, metalness: 0 })
    );
    base.position.set(0, h / 2, 0);
    buildingGroup.add(base);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.25, d + 0.4), roofMat);
    roof.position.set(0, h + 0.125, 0);
    buildingGroup.add(roof);

    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.15, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xe8a87c, roughness: 0.8, metalness: 0 })
    );
    awning.position.set(0, Math.max(0.4, h * 0.35), d / 2 + 0.3);
    buildingGroup.add(awning);

    buildingGroup.position.set(cx, 0, cz);
    if (rotY) buildingGroup.rotation.y = rotY;

    buildingsGroup.add(buildingGroup);
  }

  const props = Array.isArray(world && world.props) ? world.props : [];
  for (const p of props) {
    if (p.type && p.type !== "palm") continue;
    const height = num(p.height, 4);
    const radius = num(p.radius, 0.6);
    const px = num(p.x, 0);
    const pz = num(p.z, 0);

    const palmGroup = new THREE.Group();
    palmGroup.name = p.id || "palm";

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.22, height, 8),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9, metalness: 0 })
    );
    trunk.position.set(0, height / 2, 0);
    palmGroup.add(trunk);

    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 1.6, 1.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x3fa34d, roughness: 0.85, metalness: 0 })
    );
    crown.position.set(0, height + 0.7, 0);
    palmGroup.add(crown);

    for (let i = 0; i < 4; i++) {
      const frond = new THREE.Mesh(
        new THREE.BoxGeometry(radius * 2.4, 0.15, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x2f8f46, roughness: 0.85, metalness: 0 })
      );
      frond.position.set(0, height + 0.4, 0);
      frond.rotation.y = (i * Math.PI) / 2;
      frond.rotation.z = 0.2;
      palmGroup.add(frond);
    }

    palmGroup.position.set(px, 0, pz);
    group.add(palmGroup);
  }

  const hemi = new THREE.HemisphereLight(0x87ceeb, 0x7ec850, 0.7);
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(50, 80, 30);
  if (scene) { scene.add(hemi); scene.add(sun); }
  else { group.add(hemi); group.add(sun); }

  return { group, buildingsGroup, ocean };
}

export default buildScene;
