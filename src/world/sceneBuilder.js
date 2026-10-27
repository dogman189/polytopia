import * as THREE from "three";
import {
  makeTexture,
  makeRoadTexture,
  makeRoadTextureVertical,
  makeWindowTexture,
  makeDoorTexture,
  makeCurtainWallTexture
} from "./textures.js";

const TEXTURE_CACHE = new Map();
function tex(kind) {
  if (!TEXTURE_CACHE.has(kind)) TEXTURE_CACHE.set(kind, makeTexture(kind));
  return TEXTURE_CACHE.get(kind);
}

const GEOMETRY_CACHE = new Map();
function boxGeo(w, h, d) {
  const key = `b:${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}`;
  if (!GEOMETRY_CACHE.has(key)) GEOMETRY_CACHE.set(key, new THREE.BoxGeometry(w, h, d));
  return GEOMETRY_CACHE.get(key);
}
function cylGeo(rTop, rBottom, height, segments = 10) {
  const key = `c:${rTop}:${rBottom}:${height}:${segments}`;
  if (!GEOMETRY_CACHE.has(key)) {
    GEOMETRY_CACHE.set(key, new THREE.CylinderGeometry(rTop, rBottom, height, segments));
  }
  return GEOMETRY_CACHE.get(key);
}
function gableGeo(w, d, rise) {
  const key = `g:${w.toFixed(2)}:${d.toFixed(2)}:${rise.toFixed(2)}`;
  if (GEOMETRY_CACHE.has(key)) return GEOMETRY_CACHE.get(key);
  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -d / 2;
  const z1 = d / 2;
  const verts = [
    // south slope
    x0, 0, z1, x1, 0, z1, x1, rise, 0,
    x0, 0, z1, x1, rise, 0, x0, rise, 0,
    // north slope
    x0, 0, z0, x1, 0, z0, x1, rise, 0,
    x0, 0, z0, x1, rise, 0, x0, rise, 0,
    // east cap
    x1, 0, z0, x1, rise, 0, x1, 0, z1,
    // west cap
    x0, 0, z0, x0, 0, z1, x0, rise, 0
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  GEOMETRY_CACHE.set(key, geo);
  return geo;
}

const MATERIAL_CACHE = new Map();
function plainMaterial(color, roughness = 0.85, metalness = 0.02) {
  const key = `p:${color}:${roughness}:${metalness}`;
  if (!MATERIAL_CACHE.has(key)) {
    MATERIAL_CACHE.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  }
  return MATERIAL_CACHE.get(key);
}
function voxelMaterial(kind, tintHex = 0xffffff, roughness = 0.85, metalness = 0.02, colorMix = null, repeat = 2) {
  const key = `v:${kind}:${tintHex}:${roughness}:${metalness}:${colorMix}:${repeat}`;
  if (MATERIAL_CACHE.has(key)) return MATERIAL_CACHE.get(key);
  const base = tex(kind);
  const color = new THREE.Color(tintHex);
  if (colorMix) color.lerp(new THREE.Color(colorMix), 0.35);
  let map = null;
  if (base) {
    map = base.clone();
    map.needsUpdate = true;
    map.repeat.set(repeat, repeat);
  }
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    map,
    bumpMap: map,
    bumpScale: 0.06,
    envMapIntensity: 0.75
  });
  MATERIAL_CACHE.set(key, material);
  return material;
}

function cube(w, h, d, material, x, y, z, cast = true, receive = true) {
  const mesh = new THREE.Mesh(boxGeo(w, h, d), material);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.position.set(x, y, z);
  return mesh;
}

function cylinder(rTop, rBottom, height, material, x, y, z, segments = 10, cast = true) {
  const mesh = new THREE.Mesh(cylGeo(rTop, rBottom, height, segments), material);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  mesh.position.set(x, y, z);
  return mesh;
}

// Facade direction helpers: north = +Z, south = -Z, east = +X, west = -X.
function faceInfo(b, face = b.facing || "south", inset = 0.05) {
  switch (face) {
    case "north":
      return { axis: "z", sign: 1, x: b.x, z: b.z + b.d / 2 + inset };
    case "east":
      return { axis: "x", sign: 1, x: b.x + b.w / 2 + inset, z: b.z };
    case "west":
      return { axis: "x", sign: -1, x: b.x - b.w / 2 - inset, z: b.z };
    case "south":
    default:
      return { axis: "z", sign: -1, x: b.x, z: b.z - b.d / 2 - inset };
  }
}

function addFacadePanel(group, b, face, along, y, width, height, thickness, material) {
  const info = faceInfo(b, face, 0.04);
  if (info.axis === "z") {
    group.add(cube(width, height, thickness, material, b.x + along, y, info.z, false, false));
  } else {
    group.add(cube(thickness, height, width, material, info.x, y, b.z + along, false, false));
  }
}

function addFrontBox(group, b, along, y, width, height, depth, material, outward = 0, face = b.facing) {
  const info = faceInfo(b, face, 0);
  if (info.axis === "z") {
    group.add(cube(width, height, depth, material, b.x + along, y, info.z + info.sign * (outward + depth / 2), true, true));
  } else {
    group.add(cube(depth, height, width, material, info.x + info.sign * (outward + depth / 2), y, b.z + along, true, true));
  }
}

function addWindowGrid(group, b, faces, mats, options) {
  const opts = options || {};
  const yStart = opts.yStart ?? 2.2;
  const yStep = opts.yStep ?? 2.3;
  const spacing = opts.spacing ?? 2.4;
  const winW = opts.winW ?? 1.05;
  const winH = opts.winH ?? 1.2;
  const maxRows = opts.maxRows ?? 99;
  const rows = Math.min(maxRows, Math.max(1, Math.floor((b.h - yStart - 0.4) / yStep) + 1));

  for (const face of faces) {
    const span = (face === "north" || face === "south") ? b.w : b.d;
    const usable = span - 1.5;
    if (usable < winW) continue;
    const count = Math.max(1, Math.floor(usable / spacing) + 1);
    const step = count > 1 ? usable / (count - 1) : 0;
    for (let r = 0; r < rows; r += 1) {
      const y = yStart + r * yStep;
      if (y + winH / 2 > b.h - 0.3) continue;
      for (let c = 0; c < count; c += 1) {
        const along = (c - (count - 1) / 2) * step;
        addFacadePanel(group, b, face, along, y, winW, winH, 0.08, mats.window);
      }
    }
  }
}

function addDoor(group, b, mats, width = 1.05, height = 1.75, face = b.facing, inset = 0.055) {
  const info = faceInfo(b, face, inset);
  if (info.axis === "z") {
    group.add(cube(width, height, 0.09, mats.door, b.x, height / 2 + 0.03, info.z, false, false));
  } else {
    group.add(cube(0.09, height, width, mats.door, info.x, height / 2 + 0.03, b.z, false, false));
  }
  addFrontBox(group, b, 0, 0.08, width + 0.5, 0.16, 0.65, mats.stone, 0, face);
}

function addShopFront(group, b, mats) {
  const face = b.facing;
  const w = b.w;
  const signY = Math.min(b.h - 0.35, 2.55);
  const awningY = Math.min(b.h - 0.7, 2.0);
  const winW = Math.max(0.9, w * 0.22);
  const winH = Math.min(1.35, b.h - 1.3);

  addDoor(group, b, mats, 1.0, Math.min(1.7, b.h - 1.2), face);
  addFacadePanel(group, b, face, -w * 0.28, 1.15, winW, winH, 0.08, mats.window);
  addFacadePanel(group, b, face, w * 0.28, 1.15, winW, winH, 0.08, mats.window);
  addFacadePanel(group, b, face, 0, signY, Math.max(1.6, w - 1.5), 0.4, 0.09, mats.trim);
  addFacadePanel(group, b, face, 0, signY, Math.max(1.3, w - 2.1), 0.22, 0.11, plainMaterial(0x3a4f63, 0.55, 0.1));
  addFrontBox(group, b, 0, awningY, Math.max(1.8, w - 1.0), 0.15, 1.0, mats.awning, 0.02, face);
  const sides = (face === "north" || face === "south") ? ["east", "west"] : ["north", "south"];
  addWindowGrid(group, b, sides, mats, {
    yStart: 1.25, yStep: 2, spacing: 2.5, winW: 0.8, winH: 0.9, maxRows: 1
  });
}

function addBalconies(group, b, mats, floors) {
  const span = b.w * 0.7;
  for (let f = 0; f < floors; f += 1) {
    const y = 3.0 + f * 2.5;
    if (y > b.h - 0.8) break;
    addFrontBox(group, b, 0, y, span, 0.12, 0.95, mats.trim, 0.03);
    addFrontBox(group, b, 0, y + 0.5, span, 0.07, 0.07, mats.rail, 0.95);
    addFrontBox(group, b, 0, y + 0.3, 0.07, 0.55, 0.07, mats.rail, 0.95);
    addFrontBox(group, b, -span * 0.35, y + 0.3, 0.07, 0.55, 0.07, mats.rail, 0.95);
    addFrontBox(group, b, span * 0.35, y + 0.3, 0.07, 0.55, 0.07, mats.rail, 0.95);
  }
}

function addFlatRoof(group, b, mats, index, roofMat) {
  group.add(cube(b.w + 0.3, 0.32, b.d + 0.3, roofMat, b.x, b.h + 0.16, b.z, true, true));
  group.add(cube(b.w + 0.46, 0.12, b.d + 0.46, mats.roofTrim, b.x, b.h + 0.3, b.z, true, true));
  if (b.h >= 3 && index % 3 !== 0) {
    const ux = b.x + (index % 2 === 0 ? -b.w * 0.2 : b.w * 0.2);
    group.add(cube(1.15, 0.7, 0.95, mats.unit, ux, b.h + 0.7, b.z + b.d * 0.12, true, true));
  }
}

function addGableRoof(group, b, material, rise, overhang = 0.8) {
  const roof = new THREE.Mesh(gableGeo(b.w + overhang, b.d + overhang, rise), material);
  // Sit the roof eaves exactly on the wall top (b.h) to avoid z-fighting
  // from the roof penetrating the building's top 0.04 units.
  roof.position.set(b.x, b.h, b.z);
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);
}

function addResidential(group, b, mats, index) {
  addDoor(group, b, mats, 1.15, 1.9);
  addFrontBox(group, b, 0, 2.8, 3.2, 0.18, 1.3, mats.trim, 0.02);
  addWindowGrid(group, b, ["north", "south", "east", "west"], mats, {
    yStart: 2.2, yStep: 2.35, spacing: 2.6, winW: 1.05, winH: 1.2
  });
  addBalconies(group, b, mats, Math.max(1, Math.floor((b.h - 3) / 2.5)));
  addFlatRoof(group, b, mats, index, mats.roofTerracotta);
}

function addHotel(group, b, mats, index) {
  addWindowGrid(group, b, ["north", "south", "east", "west"], mats, {
    yStart: 2.6, yStep: 2.55, spacing: 2.7, winW: 1.15, winH: 1.35
  });
  addBalconies(group, b, mats, 4);
  addDoor(group, b, mats, 2.4, 2.5);
  addFrontBox(group, b, 0, 3.3, 7.5, 0.22, 2.4, mats.trim, 0.02);
  addFrontBox(group, b, -2.6, 1.65, 0.26, 3.1, 0.26, mats.rail, 0);
  addFrontBox(group, b, 2.6, 1.65, 0.26, 3.1, 0.26, mats.rail, 0);
  addFrontBox(group, b, 0, b.h - 1.4, 9.5, 1.3, 0.28, mats.hotelSign, 0.04);
  addFlatRoof(group, b, mats, index, mats.roofPale);
}

function addTower(group, b, mats, index) {
  const map = mats.curtain.map.clone();
  map.needsUpdate = true;
  map.repeat.set(Math.max(1, Math.round(b.w / 4)), Math.max(1, Math.round(b.h / 4)));
  const towerMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.22,
    metalness: 0.3,
    map,
    emissive: new THREE.Color(0x0a1720),
    emissiveIntensity: 0.16
  });
  group.add(cube(b.w, b.h, b.d, towerMat, b.x, b.h / 2, b.z, true, true));

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      group.add(cube(0.35, b.h, 0.35, mats.trim, b.x + sx * (b.w / 2 - 0.12), b.h / 2, b.z + sz * (b.d / 2 - 0.12), true, true));
    }
  }
  const bands = Math.max(1, Math.floor(b.h / 6));
  for (let i = 1; i <= bands; i += 1) {
    const y = (b.h / (bands + 1)) * i;
    group.add(cube(b.w + 0.18, 0.12, b.d + 0.18, mats.trim, b.x, y, b.z, true, false));
  }
  addDoor(group, b, mats, 2.2, 2.4);
  addFrontBox(group, b, 0, 2.65, 5.2, 0.18, 1.8, mats.trim, 0.02);
  addFlatRoof(group, b, mats, index, mats.roofDark);
  const antenna = cylinder(0.06, 0.08, 4.2, mats.darkMetal, b.x, b.h + 2.4, b.z, 6, false);
  group.add(antenna);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mats.beacon);
  beacon.position.set(b.x, b.h + 4.55, b.z);
  group.add(beacon);
}

function addWarehouse(group, b, mats, index) {
  addFacadePanel(group, b, b.facing, 0, 1.7, b.w * 0.46, 3.3, 0.16, mats.dock);
  addFrontBox(group, b, 0, 0.18, b.w * 0.58, 0.3, 1.5, mats.stone, 0.02);
  addFacadePanel(group, b, b.facing, 0, 1.7, b.w * 0.5, 3.5, 0.08, mats.trim);
  addWindowGrid(group, b, ["north", "south", "east", "west"], mats, {
    yStart: b.h - 1.05, yStep: 2, spacing: 3.2, winW: 0.9, winH: 0.6, maxRows: 1
  });
  addGableRoof(group, b, mats.roofMetal, 1.1, 0.5);
  for (const sx of [-0.32, 0.32]) {
    const vent = cylinder(0.38, 0.46, 1.5, mats.unit, b.x + sx * b.w, b.h + 0.6, b.z - b.d * 0.18, 8, true);
    group.add(vent);
  }
}

function addHouse(group, b, mats, index) {
  const span = (b.facing === "east" || b.facing === "west") ? b.d : b.w;
  addDoor(group, b, mats, 1.0, 1.75);
  addFacadePanel(group, b, b.facing, -span * 0.27, 1.35, 1.0, 1.05, 0.08, mats.window);
  addFacadePanel(group, b, b.facing, span * 0.27, 1.35, 1.0, 1.05, 0.08, mats.window);
  const shutter = mats.shutter;
  for (const side of [-1, 1]) {
    addFrontBox(group, b, side * span * 0.27 - 0.64, 1.35, 0.22, 1.15, 0.08, shutter, 0.03, b.facing);
    addFrontBox(group, b, side * span * 0.27 + 0.64, 1.35, 0.22, 1.15, 0.08, shutter, 0.03, b.facing);
  }
  const otherFaces = ["north", "south", "east", "west"].filter((face) => face !== b.facing);
  addWindowGrid(group, b, otherFaces, mats, {
    yStart: 1.35, yStep: 2, spacing: 2.4, winW: 0.85, winH: 1.0, maxRows: 1
  });
  addFrontBox(group, b, 0, 2.35, 3.1, 0.18, 1.3, mats.trim, 0.02);
  addFrontBox(group, b, -1.25, 1.15, 0.16, 2.3, 0.16, mats.rail, 0);
  addFrontBox(group, b, 1.25, 1.15, 0.16, 2.3, 0.16, mats.rail, 0);
  const roofColor = ["#b8583f", "#4f7d9c", "#8a5a3b"][index % 3];
  addGableRoof(group, b, plainMaterial(new THREE.Color(roofColor).getHex(), 0.85), Math.min(2.0, b.h * 0.5), 0.9);
  const chimneyX = b.x + b.w * 0.28;
  group.add(cube(0.65, 1.5, 0.65, mats.brick, chimneyX, b.h + 1.0, b.z + b.d * 0.12, true, true));
}

function addMall(group, b, mats, index) {
  const front = faceInfo(b, b.facing, 0.02);
  const glassMat = mats.mallGlass.clone();
  glassMat.map = mats.mallGlass.map.clone();
  glassMat.map.needsUpdate = true;
  glassMat.map.repeat.set(4, 2);
  group.add(cube(10, 4.1, 0.16, glassMat, b.x, 2.35, front.z, true, false));
  addDoor(group, b, mats, 2.2, 2.5, b.facing, 0.12);
  addFacadePanel(group, b, b.facing, -13, 2.6, 2.4, 1.6, 0.09, mats.window);
  addFacadePanel(group, b, b.facing, 13, 2.6, 2.4, 1.6, 0.09, mats.window);
  const otherFaces = ["north", "south", "east", "west"].filter((face) => face !== b.facing);
  addWindowGrid(group, b, otherFaces, mats, {
    yStart: 3.0, yStep: 2.4, spacing: 3.1, winW: 1.3, winH: 1.5, maxRows: 1
  });
  addFrontBox(group, b, 0, 5.1, 17, 1.1, 0.3, mats.hotelSign, 0.04);
  addFrontBox(group, b, 0, 4.5, 13, 0.22, 2.6, mats.trim, 0.02);
  for (const x of [-5.2, -1.8, 1.8, 5.2]) {
    const col = cylinder(0.22, 0.26, 4.3, mats.trim, b.x + x, 2.15, front.z + front.sign * 1.8, 8, true);
    group.add(col);
  }
  addFlatRoof(group, b, mats, index, mats.roofPale);
  for (const x of [-8, 0, 8]) {
    group.add(cube(3.2, 0.35, 3.2, mats.skylight, b.x + x, b.h + 0.55, b.z - 2, true, false));
  }
}

function addPavilion(group, b, mats) {
  group.add(cube(b.w + 0.6, 0.25, b.d + 0.6, mats.stone, b.x, 0.125, b.z, true, true));
  const columns = [
    [-b.w / 2 + 0.5, -b.d / 2 + 0.5],
    [b.w / 2 - 0.5, -b.d / 2 + 0.5],
    [-b.w / 2 + 0.5, b.d / 2 - 0.5],
    [b.w / 2 - 0.5, b.d / 2 - 0.5],
    [0, -b.d / 2 + 0.5],
    [0, b.d / 2 - 0.5]
  ];
  for (const [dx, dz] of columns) {
    group.add(cylinder(0.24, 0.3, b.h, mats.trim, b.x + dx, b.h / 2, b.z + dz, 8, true));
  }
  addGableRoof(group, b, plainMaterial(0x8fae9a, 0.8), 1.15, 1.5);
  for (const dz of [-b.d * 0.3, b.d * 0.3]) {
    group.add(cube(b.w * 0.55, 0.35, 0.55, mats.bench, b.x, 0.42, b.z + dz, true, true));
  }
}

function addUtility(group, b, mats) {
  group.add(cube(b.w, 4.2, b.d, mats.metal, b.x, 2.1, b.z, true, true));
  group.add(cube(b.w + 0.3, 0.28, b.d + 0.3, mats.roofMetal, b.x, 4.34, b.z, true, true));
  group.add(cylinder(1.7, 1.9, 3.2, mats.tank, b.x - 0.6, 4.9, b.z, 12, true));
  group.add(cylinder(0.34, 0.42, b.h + 2, mats.darkMetal, b.x + 1.7, (b.h + 2) / 2, b.z - 0.8, 8, true));
  group.add(cube(0.18, 1.8, 0.18, mats.darkMetal, b.x + 1.7, b.h + 2.7, b.z - 0.8, true, true));
  addDoor(group, b, mats, 1.4, 2.0);
}

function addTownHall(group, b, mats, index) {
  addFlatRoof(group, b, mats, 0, mats.roofPale);
  addDoor(group, b, mats, 2.0, 2.6);
  const info = faceInfo(b, b.facing, 0);
  for (const x of [-5.2, -3.1, -1.0, 1.0, 3.1, 5.2]) {
    group.add(cylinder(0.27, 0.32, 4.6, mats.trim, b.x + x, 2.3, info.z - info.sign * 0.1, 8, true));
  }
  addFrontBox(group, b, 0, 4.75, 11.6, 0.65, 1.1, mats.trim, 0.02);
  for (let i = 0; i < 3; i += 1) {
    addFrontBox(group, b, 0, 0.16 + i * 0.16, 8.4 - i * 1.4, 0.16, 0.6 + i * 0.45, mats.stone, 0);
  }
  // Clock tower.
  group.add(cube(3.6, 5.0, 3.6, mats.stone, b.x, b.h + 2.5, b.z + 1.2, true, true));
  group.add(cube(4.0, 0.3, 4.0, mats.trim, b.x, b.h + 5.05, b.z + 1.2, true, true));
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.82, 16), mats.clockFace);
  face.position.set(b.x, b.h + 3.3, b.z + 1.2 + 1.83);
  group.add(face);
  group.add(cube(0.07, 0.55, 0.04, mats.clockHand, b.x, b.h + 3.55, b.z + 1.2 + 1.86, false, false));
  group.add(cube(0.4, 0.07, 0.04, mats.clockHand, b.x + 0.2, b.h + 3.3, b.z + 1.2 + 1.86, false, false));
  const spire = cylinder(0.05, 2.3, 1.6, mats.roofTerracotta, b.x, b.h + 6.0, b.z + 1.2, 4, true);
  spire.rotation.y = Math.PI / 4;
  group.add(spire);
}

function addLibrary(group, b, mats, index) {
  addFlatRoof(group, b, mats, index, mats.roofPale);
  const info = faceInfo(b, b.facing, 0);
  for (const x of [-4.8, -1.6, 1.6, 4.8]) {
    group.add(cylinder(0.26, 0.3, 4.2, mats.trim, b.x + x, 2.1, info.z - info.sign * 0.1, 8, true));
  }
  addDoor(group, b, mats, 1.8, 2.3);
  for (const x of [-3.2, 3.2]) {
    addFacadePanel(group, b, b.facing, x, 2.1, 1.5, 1.8, 0.09, mats.window);
  }
  addFrontBox(group, b, 0, 4.55, 10.5, 0.5, 1.0, mats.trim, 0.02);
  for (let i = 0; i < 2; i += 1) {
    addFrontBox(group, b, 0, 0.16 + i * 0.16, 7.2 - i * 1.2, 0.16, 0.5 + i * 0.4, mats.stone, 0);
  }
}

function addMarket(group, b, mats, index) {
  addFlatRoof(group, b, mats, index, mats.roofTerracotta);
  addDoor(group, b, mats, 2.6, 2.1);
  addFrontBox(group, b, 0, 2.9, b.w - 1.4, 0.16, 1.4, mats.awning, 0.02);
  for (const x of [-3.5, 0, 3.5]) {
    addFacadePanel(group, b, b.facing, x, 1.3, 1.9, 1.1, 0.08, mats.window);
  }
  for (const x of [-4.2, 0, 4.2]) {
    group.add(cube(1.2, 0.7, 0.9, mats.crate, b.x + x, 0.35, faceInfo(b, b.facing, 0).z + 0.9, true, true));
  }
}

function addLighthouse(group, b, mats) {
  group.add(cylinder(2.5, 2.8, 1.0, mats.stone, b.x, 0.5, b.z, 12, true));
  const segments = 4;
  for (let i = 0; i < segments; i += 1) {
    const rb = 1.8 - i * 0.18;
    const rt = rb - 0.18;
    const material = i % 2 === 0 ? mats.lighthouseWhite : mats.lighthouseRed;
    group.add(cylinder(rt, rb, 2.0, material, b.x, 1.0 + i * 2.0 + 1.0, b.z, 12, true));
  }
  group.add(cylinder(1.3, 1.35, 0.25, mats.trim, b.x, 9.0, b.z, 12, true));
  const lantern = cylinder(1.05, 1.05, 1.6, mats.lantern, b.x, 10.05, b.z, 10, true);
  group.add(lantern);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mats.lamp);
  glow.position.set(b.x, 10.05, b.z);
  group.add(glow);
  const roof = cylinder(0.08, 1.45, 1.3, mats.lighthouseRed, b.x, 11.5, b.z, 12, true);
  group.add(roof);
  group.add(cube(0.95, 1.7, 0.12, mats.door, b.x, 0.88, b.z - 2.56, false, false));
}

function addPier(group, b, mats) {
  const plankMat = mats.wood;
  group.add(cube(b.w, 0.22, b.d, plankMat, b.x, 0.35, b.z, true, true));
  for (let i = 0; i < 5; i += 1) {
    const z = b.z - b.d / 2 + 0.8 + i * (b.d - 1.6) / 4;
    for (const sx of [-1, 1]) {
      group.add(cylinder(0.16, 0.2, 1.4, mats.wood, b.x + sx * (b.w / 2 - 0.25), -0.2, z, 6, false));
    }
  }
  for (const sx of [-1, 1]) {
    group.add(cube(0.12, 0.9, b.d, plankMat, b.x + sx * (b.w / 2 - 0.15), 0.9, b.z, true, true));
  }
}

function createBuilding(b, index, mats) {
  const group = new THREE.Group();
  group.name = b.id;
  const w = Math.max(2, b.w || 2);
  const d = Math.max(2, b.d || 2);
  const h = Math.max(2, b.h || 2);
  const shaped = { ...b, w, d, h };

  if (b.id === "pier") {
    addPier(group, shaped, mats);
    return group;
  }
  if (b.id === "lighthouse") {
    addLighthouse(group, shaped, mats);
    return group;
  }
  if (b.type === "pavilion") {
    addPavilion(group, shaped, mats);
    return group;
  }

  const wallMat = (b.type === "warehouse" || b.type === "utility")
    ? voxelMaterial("metal", b.color, 0.62, 0.28, 0xb9c0c4)
    : voxelMaterial("wall", b.color, 0.86, 0.02, b.type === "landmark" ? null : 0xe8dcc4);

  group.add(cube(w + 0.18, 0.32, d + 0.18, mats.stone, b.x, 0.16, b.z, true, true));

  if (b.type === "tower") {
    addTower(group, shaped, mats, index);
    return group;
  }

  group.add(cube(w, h, d, wallMat, b.x, h / 2, b.z, true, true));

  switch (b.type) {
    case "storefront":
      addShopFront(group, shaped, mats);
      addFlatRoof(group, shaped, mats, index, mats.roofTerracotta);
      break;
    case "residential":
      addResidential(group, shaped, mats, index);
      break;
    case "hotel":
      addHotel(group, shaped, mats, index);
      break;
    case "warehouse":
      addWarehouse(group, shaped, mats, index);
      break;
    case "house":
      addHouse(group, shaped, mats, index);
      break;
    case "retail-mall":
      addMall(group, shaped, mats, index);
      break;
    case "utility":
      addUtility(group, shaped, mats);
      break;
    case "landmark":
      if (b.id === "town-hall") addTownHall(group, shaped, mats, index);
      else if (b.id === "library-1") addLibrary(group, shaped, mats, index);
      else if (b.id === "market") addMarket(group, shaped, mats, index);
      else addFlatRoof(group, shaped, mats, index, mats.roofPale);
      break;
    default:
      addFlatRoof(group, shaped, mats, index, mats.roofPale);
      break;
  }
  return group;
}

function createPalmGeometry(length, width, drop, segments = 4) {
  const key = `frond:${length}:${width}:${drop}:${segments}`;
  if (GEOMETRY_CACHE.has(key)) return GEOMETRY_CACHE.get(key);
  const positions = [];
  const indices = [];
  let index = 0;
  for (let i = 0; i < segments; i += 1) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const x0 = t0 * length;
    const x1 = t1 * length;
    const y0 = -drop * t0 * t0;
    const y1 = -drop * t1 * t1;
    const w0 = width * (1 - t0 * 0.85);
    const w1 = width * (1 - t1 * 0.85);
    positions.push(
      x0, y0, -w0 / 2,
      x0, y0, w0 / 2,
      x1, y1, w1 / 2,
      x1, y1, -w1 / 2
    );
    indices.push(index, index + 1, index + 2, index, index + 2, index + 3);
    index += 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  GEOMETRY_CACHE.set(key, geo);
  return geo;
}

function addPalm(group, p, index, mats) {
  const palm = new THREE.Group();
  palm.name = p.id || "palm";
  palm.position.set(p.x, 0, p.z);
  const height = Number.isFinite(p.height) ? p.height : 4.5;
  const segments = 4;
  const segHeight = height / segments;
  for (let i = 0; i < segments; i += 1) {
    const rb = 0.28 - i * 0.035;
    const rt = rb - 0.035;
    const bend = (i / segments) * 0.55;
    const trunk = cylinder(rt, rb, segHeight + 0.05, mats.palmTrunk, bend, segHeight * (i + 0.5), 0, 7, true);
    trunk.rotation.z = -0.08 * i;
    palm.add(trunk);
  }
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), mats.palmLeafDark);
  crown.position.set(0.55, height + 0.05, 0);
  crown.castShadow = true;
  palm.add(crown);

  const fronds = 9;
  for (let i = 0; i < fronds; i += 1) {
    const angle = (i / fronds) * Math.PI * 2 + index * 0.35;
    const frond = new THREE.Mesh(
      createPalmGeometry(2.2 + (i % 2) * 0.25, 0.46, 0.75 - (i % 3) * 0.12),
      i % 2 === 0 ? mats.palmLeaf : mats.palmLeafLight
    );
    frond.position.set(0.55, height + 0.1 - (i % 2) * 0.06, 0);
    frond.rotation.y = -angle;
    frond.rotation.z = -0.12 + (i % 3) * 0.06;
    frond.castShadow = true;
    palm.add(frond);
  }
  for (let i = 0; i < 3; i += 1) {
    const angle = (i / 3) * Math.PI * 2;
    const coconut = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), mats.coconut);
    coconut.position.set(0.55 + Math.cos(angle) * 0.28, height - 0.08, Math.sin(angle) * 0.28);
    coconut.castShadow = true;
    palm.add(coconut);
  }
  group.add(palm);
}

export function buildScene(scene, world, opts) {
  const { renderer } = opts || {};
  const anisotropy = (renderer && typeof renderer.getCapabilities === "function")
    ? Math.min(8, renderer.getCapabilities().maxAnisotropy || 8)
    : 8;

  const group = new THREE.Group();
  scene.add(group);

  scene.background = new THREE.Color(0x58cbe6);
  scene.fog = new THREE.Fog(0x9fdcea, 90, 230);

  const hemi = new THREE.HemisphereLight(0xd8f3ff, 0x8c7a5c, 0.82);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x4b5f72, 0.22);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffe7bd, 1.8);
  sun.position.set(58, 92, 22);
  sun.target.position.set(0, 0, 68);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 280;
  sun.shadow.camera.left = -115;
  sun.shadow.camera.right = 115;
  sun.shadow.camera.top = 100;
  sun.shadow.camera.bottom = -90;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);

  const grass = tex("grass");
  const sand = tex("sand");
  const pavement = tex("pavement");

  // Ground stops at the beach; it must never cover the ocean.
  const groundData = world.ground || { x: 0, z: 70, w: 220, d: 175, minZ: -5, maxZ: 121.7 };
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.98,
    metalness: 0,
    map: grass ? grass.clone() : null
  });
  if (groundMat.map) {
    groundMat.map.needsUpdate = true;
    groundMat.map.repeat.set(Math.max(1, Math.round(groundData.w / 3)), Math.max(1, Math.round(groundData.d / 3)));
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundData.w, groundData.d), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(groundData.x, -0.02, groundData.z);
  ground.receiveShadow = true;
  ground.name = "ground";
  group.add(ground);

  // Beach sand between the promenade and the sea wall.
  const beachData = world.beach || { x: 0, z: 127.45, w: 220, d: 11.5 };
  const sandMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.98,
    metalness: 0,
    map: sand ? sand.clone() : null
  });
  if (sandMat.map) {
    sandMat.map.needsUpdate = true;
    sandMat.map.repeat.set(Math.max(1, Math.round(beachData.w / 4)), Math.max(1, Math.round(beachData.d / 2.5)));
  }
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(beachData.w, beachData.d), sandMat);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(beachData.x, 0, beachData.z);
  beach.receiveShadow = true;
  beach.name = "beach";
  group.add(beach);

  // Ocean, visible directly beyond the beach.
  const oceanData = world.ocean || { minZ: 133.2, maxZ: 293, width: 320, depth: 160 };
  const oceanMaterial = new THREE.MeshStandardMaterial({
    color: 0x1cb6d4,
    roughness: 0.2,
    metalness: 0.06,
    emissive: new THREE.Color(0x0a6f88),
    emissiveIntensity: 0.1
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(oceanData.width || 320, oceanData.depth || 160, 32, 16), oceanMaterial);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.06, (oceanData.minZ + oceanData.maxZ) / 2);
  ocean.receiveShadow = false;
  ocean.castShadow = false;
  ocean.name = "ocean";
  group.add(ocean);

  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.55, roughness: 0.8 })
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.03, beachData.z + beachData.d / 2 - 0.35);
  group.add(foam);

  const stoneMat = voxelMaterial("stone", 0xc8c0b2, 0.94);
  const wall = cube(210, 0.6, 0.55, stoneMat, 0, 0.3, beachData.z + beachData.d / 2 + 0.2, true, true);
  wall.name = "sea-wall";
  group.add(wall);

  // Roads.
  const asphalt = tex("asphalt");
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0,
    map: makeRoadTexture()
  });
  const verticalRoadMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0,
    map: makeRoadTextureVertical()
  });
  for (const road of world.roads || []) {
    const vertical = road.orientation === "vertical";
    const material = vertical ? verticalRoadMat.clone() : roadMat.clone();
    if (material.map) {
      material.map = material.map.clone();
      material.map.needsUpdate = true;
      if (vertical) material.map.repeat.set(1, Math.max(1, Math.round(road.d / 14)));
      else material.map.repeat.set(Math.max(1, Math.round(road.w / 24)), 1);
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(road.w, road.d), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(road.x, vertical ? 0.03 : 0.025, road.z);
    mesh.receiveShadow = true;
    mesh.name = road.id;
    group.add(mesh);
  }

  // Intersection asphalt hides the crossing lane markings.
  const intersectionMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0,
    map: asphalt ? asphalt.clone() : null
  });
  if (intersectionMat.map) {
    intersectionMat.map.needsUpdate = true;
    intersectionMat.map.repeat.set(2, 2);
  }
  for (const x of [-75.2, 75.2]) {
    for (const z of [8, 44, 80, 116]) {
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(7.1, 7.1), intersectionMat);
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(x, 0.032, z);
      patch.receiveShadow = true;
      group.add(patch);
    }
  }

  // Sidewalks.
  for (const walk of world.sidewalks || []) {
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0,
      map: pavement ? pavement.clone() : null
    });
    if (material.map) {
      material.map.needsUpdate = true;
      material.map.repeat.set(Math.max(1, Math.round(walk.w / 2.8)), Math.max(1, Math.round(walk.d / 2.8)));
    }
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(walk.w, walk.d), material);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(walk.x, 0.037, walk.z);
    strip.receiveShadow = true;
    strip.name = walk.id;
    group.add(strip);
  }

  // Plazas.
  for (const plaza of world.plazas || []) {
    const material = new THREE.MeshStandardMaterial({
      color: 0xf4ded2,
      roughness: 0.9,
      metalness: 0,
      map: pavement ? pavement.clone() : null
    });
    if (material.map) {
      material.map.needsUpdate = true;
      material.map.repeat.set(Math.max(1, Math.round(plaza.w / 2.4)), Math.max(1, Math.round(plaza.d / 2.4)));
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(plaza.w, plaza.d), material);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(plaza.x, 0.045, plaza.z);
    floor.receiveShadow = true;
    floor.name = plaza.id;
    group.add(floor);
    const borderMat = plainMaterial(0xc9a79a, 0.9);
    const border = 0.18;
    for (const side of [-1, 1]) {
      group.add(cube(plaza.w + border * 2, 0.08, border, borderMat, plaza.x, 0.055, plaza.z + side * (plaza.d / 2), false, true));
      group.add(cube(border, 0.08, plaza.d, borderMat, plaza.x + side * (plaza.w / 2), 0.055, plaza.z, false, true));
    }
  }

  // Crosswalk stripes.
  const stripeMat = plainMaterial(0xf5efe0, 0.9);
  for (const crosswalk of world.crosswalks || []) {
    for (let s = -(crosswalk.stripes - 1) / 2; s <= (crosswalk.stripes - 1) / 2; s += 1) {
      group.add(cube(0.42, 0.02, crosswalk.d, stripeMat, crosswalk.x + s * 0.9, 0.048, crosswalk.z, false, true));
    }
  }

  const buildingsGroup = new THREE.Group();
  buildingsGroup.name = "buildings";
  group.add(buildingsGroup);

  const windowTexture = makeWindowTexture();
  const curtainTexture = makeCurtainWallTexture();
  const mats = {
    window: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.28,
      metalness: 0.15,
      map: windowTexture,
      emissive: new THREE.Color(0x10242f),
      emissiveIntensity: 0.16
    }),
    door: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, map: makeDoorTexture() }),
    curtain: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.24, metalness: 0.28, map: curtainTexture }),
    trim: plainMaterial(0xf3efe2, 0.85),
    roofTrim: plainMaterial(0xe8e1d0, 0.9),
    stone: voxelMaterial("stone", 0xc8c0b2, 0.94),
    rail: plainMaterial(0x4d5960, 0.55, 0.35),
    awning: voxelMaterial("roof", 0xd9785b, 0.8, 0.01, 0xb14b36),
    roofTerracotta: voxelMaterial("roof", 0xc56a4a, 0.82, 0.01, 0x9a4430),
    roofPale: plainMaterial(0xe8e1d0, 0.88),
    roofDark: plainMaterial(0x39424b, 0.65, 0.2),
    roofMetal: voxelMaterial("metal", 0x9aa4ab, 0.62, 0.3),
    metal: voxelMaterial("metal", 0xaab4ba, 0.6, 0.32),
    darkMetal: plainMaterial(0x3f474e, 0.55, 0.4),
    tank: voxelMaterial("metal", 0xc7d1d8, 0.55, 0.35),
    dock: voxelMaterial("metal", 0x6f7a82, 0.7, 0.25),
    unit: plainMaterial(0xaeb4b4, 0.82),
    bench: plainMaterial(0x8a5a3b, 0.85),
    brick: voxelMaterial("wall", 0xb46a52, 0.9, 0.01, 0x8a4a36),
    shutter: plainMaterial(0x39576b, 0.8),
    crate: plainMaterial(0xb98850, 0.9),
    hotelSign: plainMaterial(0xd9b26a, 0.55, 0.2),
    skylight: new THREE.MeshStandardMaterial({
      color: 0xa8d8ee,
      roughness: 0.15,
      metalness: 0.25,
      transparent: true,
      opacity: 0.72
    }),
    mallGlass: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.2,
      map: windowTexture.clone()
    }),
    lighthouseWhite: plainMaterial(0xf7f4ea, 0.8),
    lighthouseRed: plainMaterial(0xc94a3f, 0.75),
    lantern: new THREE.MeshStandardMaterial({
      color: 0xfff0b8,
      emissive: 0xffd166,
      emissiveIntensity: 0.75,
      roughness: 0.25,
      transparent: true,
      opacity: 0.82
    }),
    lamp: new THREE.MeshStandardMaterial({
      color: 0xfff3cf,
      emissive: 0xffd07a,
      emissiveIntensity: 0.8,
      roughness: 0.3
    }),
    beacon: new THREE.MeshStandardMaterial({
      color: 0xff4d3d,
      emissive: 0xff2a1a,
      emissiveIntensity: 1.1,
      roughness: 0.3
    }),
    clockFace: plainMaterial(0xf7f1df, 0.8),
    clockHand: plainMaterial(0x2d353b, 0.6),
    wood: voxelMaterial("wood", 0x9a6b3f, 0.92, 0.01, 0x6e4826),
    palmTrunk: plainMaterial(0x755237, 0.95),
    palmLeaf: plainMaterial(0x2f9147, 0.92),
    palmLeafLight: plainMaterial(0x4caf50, 0.9),
    palmLeafDark: plainMaterial(0x247a3b, 0.92),
    coconut: plainMaterial(0x4a321f, 0.9)
  };
  mats.mallGlass.map.needsUpdate = true;
  mats.mallGlass.map.wrapS = mats.mallGlass.map.wrapT = THREE.RepeatWrapping;
  mats.curtain.map.wrapS = mats.curtain.map.wrapT = THREE.RepeatWrapping;

  (world.buildings || []).forEach((building, index) => {
    buildingsGroup.add(createBuilding(building, index, mats));
  });

  // Palms.
  const palmsGroup = new THREE.Group();
  palmsGroup.name = "palms";
  group.add(palmsGroup);
  (world.props || []).forEach((palm, index) => addPalm(palmsGroup, palm, index, mats));

  const lampsGroup = new THREE.Group();
  lampsGroup.name = "street-lamps";
  group.add(lampsGroup);
  const poleMat = plainMaterial(0x3f474e, 0.7, 0.25);
  const lampGeo = new THREE.SphereGeometry(0.2, 8, 6);
  for (const lampData of world.lamps || []) {
    const x = lampData.x;
    const z = lampData.z;
    const lampGroup = new THREE.Group();
    lampGroup.name = lampData.id;
    lampGroup.position.set(x, 0, z);
    lampGroup.add(cube(0.4, 0.32, 0.4, stoneMat, 0, 0.16, 0, true, true));
    lampGroup.add(cube(0.12, 3.4, 0.12, poleMat, 0, 1.86, 0, true, true));
    lampGroup.add(cube(0.62, 0.08, 0.08, poleMat, 0.27, 3.5, 0, true, true));
    const lamp = new THREE.Mesh(lampGeo, mats.lamp);
    lamp.position.set(0.55, 3.42, 0);
    lamp.castShadow = false;
    lampGroup.add(lamp);
    lampsGroup.add(lampGroup);
  }

  if (renderer && renderer.getCapabilities) {
    for (const [k, t] of TEXTURE_CACHE.entries()) {
      if (t && Number.isFinite(anisotropy)) t.anisotropy = anisotropy;
    }
  }

  const materials = {
    ground: groundMat,
    ocean: oceanMaterial,
    wall,
    sun,
    hemi
  };
  const lights = { hemi, ambient, sun };

  return { group, buildingsGroup, ocean, ground, wall, lights, materials };
}
