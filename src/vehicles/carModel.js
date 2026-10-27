// High-detail voxel sports car. Origin is at ground level, center of the car.
// The car faces +Z so traffic yaw (atan2(dx, dz)) points the nose correctly.
import * as THREE from "three";

const GEOMETRY_CACHE = new Map();
const MATERIAL_CACHE = new Map();

function boxGeometry(w, h, d) {
  const key = `b:${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}`;
  if (!GEOMETRY_CACHE.has(key)) GEOMETRY_CACHE.set(key, new THREE.BoxGeometry(w, h, d));
  return GEOMETRY_CACHE.get(key);
}

function cylinderGeometry(radiusTop, radiusBottom, height, segments) {
  const key = `c:${radiusTop}:${radiusBottom}:${height}:${segments}`;
  if (!GEOMETRY_CACHE.has(key)) {
    GEOMETRY_CACHE.set(key, new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments));
  }
  return GEOMETRY_CACHE.get(key);
}

function material(color, options = {}) {
  const key = [
    color,
    options.roughness ?? 0.7,
    options.metalness ?? 0,
    options.emissive ?? 0,
    options.emissiveIntensity ?? 1
  ].join(":");
  if (!MATERIAL_CACHE.has(key)) {
    MATERIAL_CACHE.set(key, new THREE.MeshStandardMaterial({
      color,
      roughness: options.roughness ?? 0.7,
      metalness: options.metalness ?? 0,
      emissive: options.emissive ?? 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 1
    }));
  }
  return MATERIAL_CACHE.get(key);
}

function addBox(parent, w, h, d, mat, x, y, z, options = {}) {
  const mesh = new THREE.Mesh(boxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  parent.add(mesh);
  return mesh;
}

function addWheel(parent, x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0.37, z);
  group.rotation.z = Math.PI / 2;
  parent.add(group);

  const tire = new THREE.Mesh(
    cylinderGeometry(0.37, 0.37, 0.28, 18),
    material(0x15161a, { roughness: 0.92, metalness: 0.05 })
  );
  tire.castShadow = true;
  tire.receiveShadow = true;
  group.add(tire);

  const sidewall = new THREE.Mesh(
    cylinderGeometry(0.34, 0.34, 0.30, 18),
    material(0x101114, { roughness: 0.95 })
  );
  sidewall.castShadow = true;
  group.add(sidewall);

  const rim = new THREE.Mesh(
    cylinderGeometry(0.22, 0.22, 0.31, 12),
    material(0xcfd2d6, { metalness: 0.7, roughness: 0.25 })
  );
  rim.castShadow = true;
  group.add(rim);

  const hub = new THREE.Mesh(
    cylinderGeometry(0.07, 0.07, 0.33, 8),
    material(0x2f3236, { metalness: 0.4, roughness: 0.45 })
  );
  group.add(hub);

  return group;
}

/**
 * Create a detailed voxel sports car.
 * @param {object} options - { color, accent, name }
 */
export function createCarModel(options = {}) {
  const opts = options || {};
  try { const _v = dispatchCreateCarVariant(opts); if (_v) return _v; } catch (e) {}
  const color = opts.color ?? 0xf1efe6;
  const accent = opts.accent ?? 0x1c2024;

  const root = new THREE.Group();
  root.name = opts.name || "voxel-car";

  const bodyMat = material(color, { roughness: 0.32, metalness: 0.32 });
  const bodyShadeMat = material(color, { roughness: 0.38, metalness: 0.28 });
  const darkMat = material(accent, { roughness: 0.75, metalness: 0.1 });
  const glassMat = material(0x0b1620, { roughness: 0.06, metalness: 0.5 });
  const chromeMat = material(0xcfd2d6, { metalness: 0.85, roughness: 0.18 });
  const lightMat = material(0xfff1c2, { emissive: 0xffe6a0, emissiveIntensity: 0.8, roughness: 0.3 });
  const tailMat = material(0xff160c, { emissive: 0xff160c, emissiveIntensity: 1.4, roughness: 0.35 });
  const amberMat = material(0xf7a02b, { emissive: 0xf28a00, emissiveIntensity: 0.9, roughness: 0.35 });
  const whiteMat = material(0xf8f6ef, { roughness: 0.75 });

  // ---- Lower hull ---------------------------------------------------------
  addBox(root, 1.98, 0.30, 4.24, bodyMat, 0, 0.55, 0);
  addBox(root, 1.92, 0.16, 4.08, bodyShadeMat, 0, 0.77, 0);

  // Hood and rear deck step the silhouette.
  addBox(root, 1.84, 0.10, 1.40, bodyMat, 0, 0.885, 1.32);
  addBox(root, 1.84, 0.12, 1.10, bodyMat, 0, 0.89, -1.58);
  addBox(root, 1.94, 0.20, 0.34, bodyMat, 0, 0.80, 2.03);
  addBox(root, 1.94, 0.20, 0.34, bodyMat, 0, 0.80, -2.03);

  // Cabin.
  addBox(root, 1.64, 0.10, 1.82, bodyMat, 0, 0.90, -0.10);
  addBox(root, 1.50, 0.26, 1.54, glassMat, 0, 1.06, -0.12);
  addBox(root, 1.64, 0.10, 1.32, bodyMat, 0, 1.235, -0.14);

  // Pillars and roof arch.
  addBox(root, 0.08, 0.27, 0.09, bodyMat, -0.71, 1.06, 0.58);
  addBox(root, 0.08, 0.27, 0.09, bodyMat, 0.71, 1.06, 0.58);
  addBox(root, 0.05, 0.26, 0.09, bodyMat, -0.74, 1.06, -0.10);
  addBox(root, 0.05, 0.26, 0.09, bodyMat, 0.74, 1.06, -0.10);
  addBox(root, 0.09, 0.27, 0.14, bodyMat, -0.69, 1.06, -0.82);
  addBox(root, 0.09, 0.27, 0.14, bodyMat, 0.69, 1.06, -0.82);

  // Windshield and rear glass (tilted).
  const windshield = addBox(root, 1.38, 0.26, 0.05, glassMat, 0, 1.06, 0.605);
  windshield.rotation.x = -0.22;
  const rearGlass = addBox(root, 1.40, 0.24, 0.05, glassMat, 0, 1.06, -0.845);
  rearGlass.rotation.x = 0.24;

  // Side skirts, creases and door seams.
  addBox(root, 0.05, 0.14, 2.50, darkMat, -0.995, 0.45, 0);
  addBox(root, 0.05, 0.14, 2.50, darkMat, 0.995, 0.45, 0);
  addBox(root, 0.012, 0.34, 0.02, darkMat, -0.996, 0.66, 0.32);
  addBox(root, 0.012, 0.34, 0.02, darkMat, -0.996, 0.66, -0.62);
  addBox(root, 0.012, 0.30, 0.02, darkMat, 0.996, 0.66, 0.32);
  addBox(root, 0.012, 0.30, 0.02, darkMat, 0.996, 0.66, -0.62);
  addBox(root, 0.012, 0.02, 2.30, darkMat, -0.996, 0.76, 0);
  addBox(root, 0.012, 0.02, 2.30, darkMat, 0.996, 0.76, 0);
  addBox(root, 0.032, 0.032, 0.14, chromeMat, -1.01, 0.79, 0.02);
  addBox(root, 0.032, 0.032, 0.14, chromeMat, 1.01, 0.79, 0.02);

  // Fender shoulders above the wheels.
  for (const side of [-1, 1]) {
    const sx = side * 0.98;
    addBox(root, 0.10, 0.16, 1.05, bodyMat, sx, 0.83, 1.40);
    addBox(root, 0.10, 0.16, 1.05, bodyMat, sx, 0.83, -1.40);
  }

  // Mirrors.
  addBox(root, 0.08, 0.03, 0.04, bodyMat, -1.00, 1.00, 0.58);
  addBox(root, 0.08, 0.03, 0.04, bodyMat, 1.00, 1.00, 0.58);
  addBox(root, 0.12, 0.09, 0.16, bodyMat, -1.06, 1.02, 0.56);
  addBox(root, 0.12, 0.09, 0.16, bodyMat, 1.06, 1.02, 0.56);
  addBox(root, 0.02, 0.06, 0.13, glassMat, -1.125, 1.02, 0.56);
  addBox(root, 0.02, 0.06, 0.13, glassMat, 1.125, 1.02, 0.56);

  // Front bumper, splitter, grille and lights.
  addBox(root, 1.96, 0.20, 0.18, bodyMat, 0, 0.53, 2.16);
  addBox(root, 1.92, 0.05, 0.20, darkMat, 0, 0.43, 2.18);
  addBox(root, 1.16, 0.12, 0.04, darkMat, 0, 0.66, 2.24);
  addBox(root, 1.20, 0.03, 0.02, chromeMat, 0, 0.71, 2.26);
  addBox(root, 0.42, 0.16, 0.04, darkMat, -0.63, 0.80, 2.22);
  addBox(root, 0.42, 0.16, 0.04, darkMat, 0.63, 0.80, 2.22);
  addBox(root, 0.36, 0.11, 0.06, lightMat, -0.63, 0.80, 2.24);
  addBox(root, 0.36, 0.11, 0.06, lightMat, 0.63, 0.80, 2.24);
  addBox(root, 0.12, 0.06, 0.06, amberMat, -0.91, 0.68, 2.23);
  addBox(root, 0.12, 0.06, 0.06, amberMat, 0.91, 0.68, 2.23);
  addBox(root, 0.10, 0.02, 0.40, darkMat, -0.36, 0.89, 1.58);
  addBox(root, 0.10, 0.02, 0.40, darkMat, 0.36, 0.89, 1.58);

  // Rear bumper, diffuser, tail lights, plate, exhausts and spoiler.
  addBox(root, 1.96, 0.20, 0.18, bodyMat, 0, 0.53, -2.16);
  addBox(root, 1.80, 0.06, 0.18, darkMat, 0, 0.41, -2.19);
  addBox(root, 1.52, 0.10, 0.04, tailMat, 0, 0.79, -2.22);
  addBox(root, 0.12, 0.06, 0.05, whiteMat, -0.84, 0.64, -2.23);
  addBox(root, 0.12, 0.06, 0.05, whiteMat, 0.84, 0.64, -2.23);
  addBox(root, 0.52, 0.14, 0.03, whiteMat, 0, 0.55, -2.21);
  addBox(root, 0.34, 0.06, 0.02, bodyMat, 0, 0.55, -2.23);
  const exhaustGeo = cylinderGeometry(0.055, 0.055, 0.18, 8);
  const exhaustMat = material(0x383a3e, { metalness: 0.55, roughness: 0.4 });
  for (const x of [-0.52, 0.52]) {
    const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(x, 0.34, -2.24);
    exhaust.castShadow = true;
    root.add(exhaust);
  }
  addBox(root, 1.42, 0.05, 0.24, bodyMat, 0, 0.99, -1.98);
  addBox(root, 0.06, 0.10, 0.06, darkMat, -0.58, 0.91, -1.98);
  addBox(root, 0.06, 0.10, 0.06, darkMat, 0.58, 0.91, -1.98);

  // Wheels.
  const wheels = [
    addWheel(root, -0.90, 1.38),
    addWheel(root, 0.90, 1.38),
    addWheel(root, -0.90, -1.38),
    addWheel(root, 0.90, -1.38)
  ];

  root.userData = { kind: "car", wheels, color };
  return root;
}

export function spinCarWheels(carOrMesh, speed, dt) {
  const mesh = (carOrMesh && carOrMesh.mesh) ? carOrMesh.mesh : carOrMesh;
  const wheels = (mesh && mesh.userData && Array.isArray(mesh.userData.wheels)) ? mesh.userData.wheels : [];
  const safeSpeed = Number.isFinite(speed) ? speed : 0;
  const safeDt = Number.isFinite(dt) ? dt : 0;
  const angularSpeed = safeSpeed / 0.37;
  for (const wheel of wheels) {
    if (wheel && wheel.rotation) {
      wheel.rotation.x += angularSpeed * safeDt;
    }
  }
}

export default createCarModel;

function baseMaterials(color) {
  return {
    bodyMat: material(color, { roughness: 0.32, metalness: 0.28 }),
    bodyShadeMat: material(color, { roughness: 0.38, metalness: 0.22 }),
    glassMat: material(0x0b1620, { roughness: 0.06, metalness: 0.5 }),
    darkMat: material(0x1c2024, { roughness: 0.75, metalness: 0.1 }),
    lightMat: material(0xfff1c2, { emissive: 0xffe6a0, emissiveIntensity: 0.8, roughness: 0.3 }),
    tailMat: material(0xff160c, { emissive: 0xff160c, emissiveIntensity: 1.4, roughness: 0.35 }),
    amberMat: material(0xf7a02b, { emissive: 0xf28a00, emissiveIntensity: 0.9, roughness: 0.35 })
  };
}

// ---- appended variants ----
function makeSuvCar({ color = 0xf1efe6, name = "suv" }) {
  const root = new THREE.Group(); root.name = name;
  const m = baseMaterials(color);
  addBox(root, 2.04, 0.52, 4.36, m.bodyMat, 0, 0.64, 0);
  addBox(root, 1.98, 0.18, 4.2, m.bodyShadeMat, 0, 0.94, 0);
  addBox(root, 1.84, 0.24, 1.56, m.bodyMat, 0, 1.1, 1.28);
  addBox(root, 1.84, 0.24, 1.32, m.bodyMat, 0, 1.12, -1.52);
  addBox(root, 1.66, 0.32, 1.72, m.glassMat, 0, 1.28, -0.12);
  addBox(root, 1.72, 0.1, 1.46, m.bodyMat, 0, 1.47, -0.16);
  addBox(root, 1.6, 0.04, 1.7, m.darkMat, 0, 1.6, -0.16);
  for (const side of [-1, 1]) { addBox(root, 0.09, 0.3, 0.1, m.bodyShadeMat, side*0.78, 1.26, 0.52); addBox(root, 0.09, 0.3, 0.1, m.bodyShadeMat, side*0.78, 1.26, -0.82); }
  addBox(root, 2, 0.22, 0.2, m.bodyMat, 0, 0.58, 2.22);
  addBox(root, 1.96, 0.05, 0.22, m.darkMat, 0, 0.46, 2.24);
  addBox(root, 1.4, 0.12, 0.04, m.lightMat, 0, 0.84, 2.26);
  addBox(root, 0.14, 0.06, 0.04, m.amberMat, -0.92, 0.66, 2.25);
  addBox(root, 0.14, 0.06, 0.04, m.amberMat, 0.92, 0.66, 2.25);
  addBox(root, 2, 0.22, 0.2, m.bodyMat, 0, 0.58, -2.22);
  addBox(root, 1.52, 0.1, 0.04, m.tailMat, 0, 0.88, -2.24);
  const wheels = [];
  for (const sx of [-0.92, 0.92]) for (const sz of [1.48, -1.48]) wheels.push(addWheel(root, sx, sz));
  root.userData = { kind: "car", wheels, color };
  return root;
}
function makeCompactCar({ color = 0xefeff0, name="compact" }) {
  const root=new THREE.Group(); root.name=name;
  const m=baseMaterials(color);
  addBox(root,1.64,0.26,3.55,m.bodyMat,0,0.56,0);
  addBox(root,1.58,0.14,3.42,m.bodyShadeMat,0,0.76,0);
  addBox(root,1.42,0.16,1.12,m.bodyMat,0,0.84,-1.32);
  addBox(root,1.46,0.17,0.98,m.bodyMat,0,0.86,1.28);
  addBox(root,1.38,0.26,1.38,m.glassMat,0,1.0,-0.16);
  addBox(root,1.46,0.1,1.1,m.bodyMat,0,1.18,-0.24);
  addBox(root,1.6,0.18,0.18,m.bodyMat,0,0.58,1.76);
  addBox(root,1.6,0.18,0.18,m.bodyMat,0,0.58,-1.76);
  addBox(root,1.34,0.1,0.04,m.lightMat,0,0.82,1.78);
  addBox(root,0.12,0.06,0.04,m.amberMat,-0.66,0.66,1.77);
  addBox(root,0.12,0.06,0.04,m.amberMat,0.66,0.66,1.77);
  addBox(root,1.34,0.08,0.04,m.tailMat,0,0.78,-1.77);
  addBox(root,0.12,0.06,0.04,m.tailMat,0.66,0.64,-1.77);
  addBox(root,0.12,0.06,0.04,m.tailMat,-0.66,0.64,-1.77);
  const wheels = [];
  for (const sx of [-0.72, 0.72]) for (const sz of [1.1, -1.1]) wheels.push(addWheel(root, sx, sz));
  root.userData = { kind: "car", wheels, color };
  return root;
}
function makePickupCar({ color = 0x2f6f4a, name="pickup" }) {
  const root=new THREE.Group(); root.name=name;
  const m=baseMaterials(color);
  addBox(root,1.9,0.34,2.12,m.bodyMat,0,0.56,0.62);
  addBox(root,1.86,0.16,2,m.bodyShadeMat,0,0.79,0.6);
  addBox(root,1.6,0.3,1.1,m.glassMat,0,1.02,0.96);
  addBox(root,1.7,0.1,1,m.bodyMat,0,1.2,0.98);
  addBox(root,0.02,0.28,1.05,m.darkMat,-0.94,0.72,0.62);
  addBox(root,0.02,0.28,1.05,m.darkMat,0.94,0.72,0.62);
  addBox(root,1.92,0.18,2.16,m.bodyMat,0,0.54,-1.62);
  addBox(root,1.72,0.16,2,m.darkMat,0,0.46,-1.62);
  addBox(root,0.05,0.12,2.04,m.bodyShadeMat,-0.9,0.7,-1.62);
  addBox(root,0.05,0.12,2.04,m.bodyShadeMat,0.9,0.7,-1.62);
  addBox(root,1.8,0.1,0.05,m.bodyShadeMat,0,0.7,-0.56);
  addBox(root,1.8,0.1,0.05,m.bodyShadeMat,0,0.7,-2.62);
  addBox(root,1.9,0.2,0.2,m.bodyMat,0,0.58,1.68);
  addBox(root,1.8,0.05,0.22,m.darkMat,0,0.46,1.7);
  addBox(root,1.2,0.14,0.06,m.lightMat,-0.34,0.84,1.74);
  addBox(root,1.2,0.14,0.06,m.lightMat,0.34,0.84,1.74);
  addBox(root,0.12,0.06,0.06,m.amberMat,-0.86,0.66,1.73);
  addBox(root,0.12,0.06,0.06,m.amberMat,0.86,0.66,1.73);
  addBox(root,1.92,0.5,0.12,m.bodyMat,0,0.58,-2.72);
  addBox(root,1.52,0.08,0.04,m.tailMat,0,0.66,-2.78);
  const wheels = [];
  for (const sx of [-0.88, 0.88]) for (const sz of [1.2, -2.08]) wheels.push(addWheel(root, sx, sz));
  root.userData = { kind: "car", wheels, color };
  return root;
}
function dispatchCreateCarVariant(opts) {
  const variant=String(opts.variant||opts.type||'sport').toLowerCase();
  if (variant==='suv') return makeSuvCar(opts);
  if (variant==='compact') return makeCompactCar(opts);
  if (variant==='pickup') return makePickupCar(opts);
  return null;
}
