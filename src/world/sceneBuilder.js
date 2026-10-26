import * as THREE from "three";
import { makeTexture } from "./textures.js";

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

  // Enrich lighting.
  const hemi = new THREE.HemisphereLight(0xbfe4ff, 0x5d7ea3, 0.56);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x253345, 0.26);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff0d6, 1.06);
  sun.position.set(52, 64, 28);
  sun.target.position.set(0, 0, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 180;
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 65;
  sun.shadow.camera.bottom = -25;
  sun.shadow.bias = -0.00007;
  sun.shadow.normalBias = 0.01;
  scene.add(sun);
  scene.add(sun.target);

  // Sky fill via background gradient. Uses scene.background to avoid duplicate sky clutter.
  if (!scene.background) {
    scene.background = new THREE.Color(0x92c7ea);
  }

  // Ground beach/sand/dirt transition.
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xdec8aa,
    roughness: 0.95,
    metalness: 0.02,
    map: tex("sand"),
    receivingShadowPlane: false
  });
  groundMat.map.repeat.set(18, 10);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 90), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.01, 30);
  ground.castShadow = false;
  ground.receiveShadow = true;
  group.add(ground);

  // Ocean with slight depth and specular reflection feel.
  const oceanMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f7fb8,
    roughness: 0.24,
    metalness: 0.05,
    map: tex("glass"),
    emissive: new THREE.Color(0x1a6fa5),
    emissiveIntensity: 0.08
  });
  oceanMaterial.map.repeat.set(30, 8);

  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(140, 50), oceanMaterial);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.1, -15);
  ocean.receiveShadow = false;
  ocean.castShadow = false;
  group.add(ocean);

  // Retaining wall blends with stone texture.
  const wall = cube(120, 1.2, 1, voxelMaterial("stone", 0x898378, 0.92), 0, 0.6, -4.5, true, true);
  group.add(wall);

  // Buildings with better facade detail.
  const buildingsGroup = new THREE.Group();
  group.add(buildingsGroup);

  (world.buildings || []).forEach((b) => {
    const w = Math.max(2, b.w || 2);
    const d = Math.max(2, b.d || d.w ? b.d : 2);
    const h = Math.max(2, b.h || 2);
    const wallMat = voxelMaterial("wall", b.color || 0xf0e0d0, 0.88, 0.02, 0xd4c2a8);
    base.buildingFacadelight = 0;

    const baseBody = cube(w, h, d, wallMat, b.x, 0, b.z, true, true);
    buildingsGroup.add(baseBody);

    // Rooftop with terracotta texture.
    const roofMat = voxelMaterial("roof", 0xb9543c, 0.78, 0.01, 0x7a2f20);
    const roof = cube(w + 0.2, 0.7, d + 0.2, roofMat, b.x, h, b.z, true, true);
    buildingsGroup.add(roof);

    // Awning.
    if (h > 3) {
      const awningMat = voxelMaterial("roof", 0xc76a50, 0.72, 0, 0x9a3a22);
      const awning = cube(Math.max(1, w - 1), 0.2, Math.max(1, d - 1), awningMat, b.x, Math.min(h, 3) + 0.2, b.z + Math.max(1, d * 0.35), true, true);
      buildingsGroup.add(awning);
    }

    // Windows around building.
    const glassMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x2f5d7c),
      roughness: 0.18,
      metalness: 0.05,
      map: tex("glass"),
      emissive: new THREE.Color(0x193048),
      emissiveIntensity: 0.18
    });

    const rows = Math.max(1, Math.floor(h / 3));
    const cols = Math.max(1, Math.floor(w / 2.6));
    const depthSide = Math.max(1, Math.floor(d / 2.6));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = b.x - w / 2 + 1.3 + c * 2.6;
        const y = 1.8 + r * 2.8;
        if (y < h - 0.5) {
          // front + back windows
          buildingsGroup.add(cube(0.8, 0.9, 0.06, glassMat, x, y, b.z + d / 2 + 0.04));
          buildingsGroup.add(cube(0.8, 0.9, 0.06, glassMat, x, y, b.z - d / 2 - 0.04));
        }
      }
      // side windows
      for (let c = 0; c < depthSide; c++) {
        const z = b.z - d / 2 + 1.3 + c * 2.6;
        const y = 1.8 + r * 2.8;
        if (y < h - 0.5) {
          const x = b.x + w / 2 + 0.04;
          buildingsGroup.add(cube(0.06, 0.9, 0.8, glassMat, x, y, z));
        }
      }
    }

    // Point light in a handful of townhall/fuel shop entrances.
    if (b.type === "landmark" && h >= 4) {
      const pl = new THREE.PointLight(0xffdc9f, 0.8, 22, 2);
      pl.position.set(b.x, 3, b.z + d * 0.4 + 1.2);
      pl.castShadow = true;
      pl.shadow.mapSize.set(512, 512);
      scene.add(pl);
    }
  });

  // props - improve palms and street lamps
  const trunkMat = voucher("wood");
  const frondMat = voucher("grass");

  // We need import? no, keep existing function name typo intentionally? use local.
  // palms fallback simple
  (world.props || []).forEach((p) => {
    const x = (Number.isFinite(p.x) ? p.x : 0);
    const z = (Number.isFinite(p.z) ? p.z : 0);
    const s = p.scale || 1;
    const trunk = cube(0.4 * s, 4 * s, 0.4 * s, materialsLike("wood", 0x7a5230), x, 2 * s, z, true, true);
    buildingsGroup.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.2 * s, 10, 8), voucherLike("grass", 0x4f8f36));
    crown.position.set(x, 5.2 * s, z);
    crown.castShadow = true;
    crown.receiveShadow = true;
    buildingsGroup.add(crown);
  });

  // street lamps every 8 on the coast
  for (let i = -7; i <= 7; i++) {
    const x = i * 9 + (i % 2) * 1;
    const z = -4.2;
    const pole = cube(0.12, 4, 0.12, materialsLike("generic", 0x464a50), x, 2, z, true, true);
    buildingsGroup.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff3cf, emissive: 0xffd07a, emissiveIntensity: 0.85, roughness: 0.25 }));
    lamp.position.set(x, 4.1, z);
    buildingsGroup.add(lamp);
    const point = new THREE.PointLight(0xffdc8c, 0.6, 16, 2);
    point.position.set(x, 4.1, z);
    point.castShadow = true;
    scene.add(point);
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

  const lights = {
    hemi,
    ambient,
    sun
    // point lights already added to scene
  };

  return { group, buildingsGroup, ocean, ground, wall, lights, materials };
}

// --- helper aliases (hoisted function declarations) ---
function voucher(kind) {
  // fallback mapper if we forget alias; not used in main path.
  return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, map: tex(kind) });
}

function voucherLike(kind, tint) {
  return new THREE.MeshStandardMaterial({ color: tint, roughness: 0.85, map: tex(kind) });
}

function materialsLike(kind, tint) {
  return new THREE.MeshStandardMaterial({ color: tint, roughness: 0.85, metalness: 0.03, map: tex(kind) });
}
