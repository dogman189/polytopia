import * as THREE from "three";
import { makeTexture, makeRoadTexture, makeRoadTextureVertical } from "./textures.js";

const TEXTURE_CACHE = new Map();
function tex(kind) {
  if (!TEXTURE_CACHE.has(kind)) TEXTURE_CACHE.set(kind, makeTexture(kind));
  return TEXTURE_CACHE.get(kind);
}

function voxelMaterial(kind, tintHex = 0xffffff, roughness = 0.85, metalness = 0.02, colorMix = null) {
  const base = tex(kind);
  let map = base;
  const color = new THREE.Color(tintHex);
  if (colorMix) color.lerp(new THREE.Color(colorMix), 0.45);

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    map,
    bumpMap: base,
    bumpScale: 0.16,
    normalScale: new THREE.Vector2(0.6, 0.6),
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0,
    envMapIntensity: 0.75
  });
  if (base) {
    // StandardMaterial uses map UVs; no triplanar needed for regular box UVs.
    material.map.repeat.set(base.userData?.repeat || 2, 2);
  }
  return material;
}

function cube(w, h, d, material, x, y, z, cast = true, receive = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.position.set(x, y, z);
  return mesh;
}

export function buildScene(scene, world, opts) {
  const { renderer } = opts || {};
  const anisotropy = (renderer && typeof renderer.getCapabilities === "function")
    ? Math.min(8, renderer.getCapabilities().maxAnisotropy || 8)
    : 8;

  const group = new THREE.Group();
  scene.add(group);

  // Bright, saturated tropical daylight.
  scene.background = new THREE.Color(0x58cbe6);
  scene.fog = new THREE.Fog(0x9fdcea, 80, 210);

  const hemi = new THREE.HemisphereLight(0xd8f3ff, 0x8c7a5c, 0.82);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x4b5f72, 0.22);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffe7bd, 1.75);
  sun.position.set(42, 64, 22);
  sun.target.position.set(0, 0, 66);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 190;
  sun.shadow.camera.left = -74;
  sun.shadow.camera.right = 74;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -30;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);

  // Ground: tropical lawn, with a beach promenade along the water.
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.98,
    metalness: 0,
    map: tex("grass")
  });
  groundMat.map = groundMat.map.clone();
  groundMat.map.repeat.set(62, 40);
  groundMat.map.needsUpdate = true;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 175), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, 70);
  ground.castShadow = false;
  ground.receiveShadow = true;
  ground.name = "ground";
  group.add(ground);

  // Beach sand under and around the pink waterfront promenade.
  const sandMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.98,
    metalness: 0,
    map: tex("sand")
  });
  sandMat.map = sandMat.map.clone();
  sandMat.map.repeat.set(58, 10);
  sandMat.map.needsUpdate = true;
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(220, 18), sandMat);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, -0.005, 126);
  beach.receiveShadow = true;
  group.add(beach);

  // Road and sidewalk network (visual; collisions remain building-based).
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0,
    map: makeRoadTexture()
  });
  roadMat.map = roadMat.map.clone();
  roadMat.map.repeat.set(8, 1);

  function addRoad(width, depth, x, z, repeatX, vertical = false) {
    const mat = roadMat.clone();
    if (vertical) {
      mat.map = makeRoadTextureVertical();
      mat.map.repeat.set(1, 1);
    } else {
      mat.map = roadMat.map.clone();
      mat.map.repeat.set(repeatX, 1);
    }
    const road = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, vertical ? 0.03 : 0.025, z);
    road.receiveShadow = true;
    group.add(road);
    return road;
  }

  addRoad(120, 5.5, 0, 8, 8);
  addRoad(120, 5.5, 0, 30.5, 8);
  addRoad(4, 44, -55.2, 28, 11, true);
  addRoad(4, 44, 55.2, 28, 11, true);

  const pavementMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0,
    map: tex("pavement")
  });

  function addSidewalk(width, depth, x, z, repeatX, repeatY) {
    const mat = pavementMat.clone();
    mat.map = pavementMat.map.clone();
    mat.map.repeat.set(repeatX, repeatY);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(x, 0.035, z);
    strip.receiveShadow = true;
    group.add(strip);
    return strip;
  }

  addSidewalk(120, 1.3, 0, 11.4, 60, 1);
  addSidewalk(120, 1.3, 0, 4.6, 60, 1);
  addSidewalk(120, 1.3, 0, 33.7, 60, 1);
  addSidewalk(120, 1.3, 0, 27.1, 60, 1);
  addSidewalk(120, 7.0, 0, 56.5, 60, 4);

  // Crosswalk stripes at the central and west/east crossings.
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf5efe0, roughness: 0.9 });
  const stripeGeo = new THREE.BoxGeometry(0.42, 0.015, 4.9);
  for (const x of [-30, 0, 30]) {
    for (const z of [8, 30.5]) {
      for (let s = -2; s <= 2; s += 1) {
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.set(x + s * 0.9, 0.045, z);
        stripe.receiveShadow = true;
        group.add(stripe);
      }
    }
  }

  // Coastal boulevard that keeps traffic and strollers off the sand.
  addRoad(200, 5.5, 0, 124, 8);
  addSidewalk(120, 1.3, 0, 41.2, 60, 1);
  addSidewalk(120, 1.3, 0, 46.8, 60, 1);

  // Ocean: a big turquoise plane to the horizon.
  const oceanMaterial = new THREE.MeshStandardMaterial({
    color: 0x1cb6d4,
    roughness: 0.22,
    metalness: 0.08,
    emissive: new THREE.Color(0x0a6f88),
    emissiveIntensity: 0.08
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(260, 120, 32, 16), oceanMaterial);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.08, 175);
  ocean.receiveShadow = false;
  ocean.castShadow = false;
  ocean.name = "ocean";
  group.add(ocean);

  // Foam line along the shore.
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.55, roughness: 0.8 })
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.02, 125.5);
  group.add(foam);

  // Low sea wall / promenade edge.
  const wall = cube(210, 0.85, 0.9, voxelMaterial("stone", 0xc8c0b2, 0.94), 0, 0.425, 126.0, true, true);
  // wall
  group.add(wall);

  // Buildings with facade texture and correctly grounded placement.
  const buildingsGroup = new THREE.Group();
  group.add(buildingsGroup);
  const glassMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x2f5d7c),
    roughness: 0.18,
    metalness: 0.08,
    map: tex("glass"),
    emissive: new THREE.Color(0x193048),
    emissiveIntensity: 0.16
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf3efe2, roughness: 0.85 });
  const roofTrimMat = new THREE.MeshStandardMaterial({ color: 0xe8e1d0, roughness: 0.9 });

  (world.buildings || []).forEach((b, buildingIndex) => {
    const w = Math.max(2, b.w || 2);
    const d = Math.max(2, b.d || b.depth || 2);
    const h = Math.max(2, b.h || 2);
    const wallMat = voxelMaterial("wall", b.color || 0xf0e0d0, 0.88, 0.02, 0xd4c2a8);
    const baseBody = cube(w, h, d, wallMat, b.x, h / 2, b.z, true, true);
    baseBody.name = b.id || "building";
    buildingsGroup.add(baseBody);

    // Roof slab sits on the building, with an overhanging pale trim.
    const roofMat = voxelMaterial("roof", 0xc56a4a, 0.82, 0.01, 0x9a4430);
    const roof = cube(w + 0.3, 0.45, d + 0.3, roofMat, b.x, h + 0.225, b.z, true, true);
    buildingsGroup.add(roof);
    const roofTrim = cube(w + 0.45, 0.12, d + 0.45, roofTrimMat, b.x, h + 0.03, b.z, true, true);
    buildingsGroup.add(roofTrim);

    const isStorefront = b.type === "storefront";
    const frontZ = b.z - d / 2;

    if (isStorefront) {
      // Shop door and window band, facing the road (-Z).
      buildingsGroup.add(cube(0.95, 1.45, 0.06, glassMat, b.x, 0.78, frontZ - 0.035, true, false));
      buildingsGroup.add(cube(1.1, 1.58, 0.04, trimMat, b.x, 0.8, frontZ - 0.005, true, false));
      buildingsGroup.add(cube(0.72, 0.95, 0.06, glassMat, b.x - 1.55, 1.15, frontZ - 0.035, true, false));
      buildingsGroup.add(cube(0.72, 0.95, 0.06, glassMat, b.x + 1.55, 1.15, frontZ - 0.035, true, false));

      // Striped awning.
      const awningMat = voxelMaterial("roof", 0xd9785b, 0.8, 0, 0xb14b36);
      const awning = cube(Math.max(1.5, w - 1.0), 0.14, 1.05, awningMat, b.x, Math.min(2.2, h - 0.4), frontZ - 0.55, true, true);
      buildingsGroup.add(awning);
      buildingsGroup.add(cube(Math.max(1.5, w - 1.0), 0.08, 0.08, trimMat, b.x, Math.min(2.2, h - 0.4) - 0.09, frontZ - 1.06, true, true));

      // Simple sign band above the awning.
      const signMat = new THREE.MeshStandardMaterial({ color: 0xf7f0df, roughness: 0.8 });
      const sign = cube(Math.min(3.4, w - 1.4), 0.42, 0.10, signMat, b.x, Math.min(2.9, h - 0.25), frontZ - 0.09, true, true);
      buildingsGroup.add(sign);
    }

    // Upper-floor windows on all four faces.
    const rows = Math.max(1, Math.floor((h - 1.2) / 2.2));
    const cols = Math.max(1, Math.floor(w / 2.6));
    const depthSide = Math.max(1, Math.floor(d / 2.6));
    for (let r = 0; r < rows; r += 1) {
      const y = 1.65 + r * 2.2;
      if (y >= h - 0.4) continue;
      for (let c = 0; c < cols; c += 1) {
        const x = b.x - w / 2 + 1.3 + c * 2.6;
        if (x > b.x + w / 2 - 0.4) continue;
        buildingsGroup.add(cube(0.82, 0.92, 0.06, glassMat, x, y, b.z - d / 2 - 0.035, true, false));
        buildingsGroup.add(cube(0.82, 0.92, 0.06, glassMat, x, y, b.z + d / 2 + 0.035, true, false));
      }
      for (let c = 0; c < depthSide; c += 1) {
        const z = b.z - d / 2 + 1.3 + c * 2.6;
        if (z > b.z + d / 2 - 0.4) continue;
        buildingsGroup.add(cube(0.06, 0.92, 0.82, glassMat, b.x - w / 2 - 0.035, y, z, true, false));
        buildingsGroup.add(cube(0.06, 0.92, 0.82, glassMat, b.x + w / 2 + 0.035, y, z, true, false));
      }
    }

    // Rooftop utility boxes break up the skyline.
    if (h >= 3 && buildingIndex % 3 !== 0) {
      const unitMat = new THREE.MeshStandardMaterial({ color: 0xaeb4b4, roughness: 0.82 });
      const ux = b.x + (buildingIndex % 2 === 0 ? -w * 0.2 : w * 0.2);
      buildingsGroup.add(cube(1.1, 0.75, 0.95, unitMat, ux, h + 0.9, b.z + d * 0.1, true, true));
    }
  });

  // Lush voxel palms.
  const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x755237, roughness: 0.95 });
  const palmLeafMat = new THREE.MeshStandardMaterial({ color: 0x2f9147, roughness: 0.9 });
  const palmLeafLightMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.88 });
  const coconutMat = new THREE.MeshStandardMaterial({ color: 0x4a321f, roughness: 0.9 });
  const palmCrownGeo = new THREE.SphereGeometry(0.55, 8, 6);
  const frondGeo = new THREE.BoxGeometry(2.2, 0.10, 0.38);
  const coconutGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);

  (world.props || []).forEach((p, palmIndex) => {
    const x = Number.isFinite(p.x) ? p.x : 0;
    const z = Number.isFinite(p.z) ? p.z : 0;
    const s = Number.isFinite(p.scale) ? p.scale : 1;
    const height = (Number.isFinite(p.height) ? p.height : 4.5) * s;
    const palm = new THREE.Group();
    palm.name = p.id || "palm";
    palm.position.set(x, 0, z);

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15 * s, 0.27 * s, height, 6),
      palmTrunkMat
    );
    trunk.position.y = height / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    palm.add(trunk);

    const crown = new THREE.Mesh(palmCrownGeo, palmLeafMat);
    crown.position.y = height + 0.08;
    crown.castShadow = true;
    palm.add(crown);

    for (let i = 0; i < 7; i += 1) {
      const angle = (i / 7) * Math.PI * 2 + palmIndex * 0.4;
      const frond = new THREE.Mesh(frondGeo, i % 2 === 0 ? palmLeafMat : palmLeafLightMat);
      frond.position.set(Math.cos(angle) * 0.95, height + 0.22 - (i % 2) * 0.08, Math.sin(angle) * 0.95);
      frond.rotation.y = -angle;
      frond.rotation.z = 0.16;
      frond.castShadow = true;
      palm.add(frond);
    }

    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * Math.PI * 2;
      const coconut = new THREE.Mesh(coconutGeo, coconutMat);
      coconut.position.set(Math.cos(angle) * 0.26, height - 0.06, Math.sin(angle) * 0.26);
      coconut.castShadow = true;
      palm.add(coconut);
    }

    buildingsGroup.add(palm);
  });

  // Street lamps along the main roads and promenade (emissive only; no expensive lights).
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3f474e, roughness: 0.7, metalness: 0.25 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff3cf,
    emissive: 0xffd07a,
    emissiveIntensity: 0.7,
    roughness: 0.3
  });
  const lampGeo = new THREE.SphereGeometry(0.2, 8, 6);
  const lampPositions = (world && Array.isArray(world.lamps))
    ? world.lamps.map((l) => [l.x, l.z])
    : [];
  for (const [x, z] of lampPositions) {
    const pole = cube(0.10, 3.4, 0.10, poleMat, x, 1.7, z, true, true);
    buildingsGroup.add(pole);
    const arm = cube(0.55, 0.08, 0.08, poleMat, x + 0.24, 3.35, z, true, true);
    buildingsGroup.add(arm);
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(x + 0.5, 3.28, z);
    buildingsGroup.add(lamp);
  }

  // materials fields (will be filled below)
  const materials = {
    ground: groundMat,
    ocean: oceanMaterial,
    wall,
    sun,
    hemi
  };

  // helper functions bound after declaration to avoid TDZ.
  // fill caches for vertex bump anisotropy
  if (renderer && renderer.getCapabilities) {
    for (const [k, t] of TEXTURE_CACHE.entries()) {
      if (t && Number.isFinite(anisotropy)) t.anisotropy = anisotropy;
    }
  }

  const lights = { hemi, ambient, sun };

  return { group, buildingsGroup, ocean, ground, wall, lights, materials };
}
