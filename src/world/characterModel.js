// High-detail voxel character model for players and pedestrians.
// Coordinates: origin at the feet, character faces +Z.
import * as THREE from "three";

const GEOMETRY_CACHE = new Map();
const MATERIAL_CACHE = new Map();

const SKIN_TONES = [0xe0a878, 0xc98a5e, 0x8b5a3c, 0xf0c8a0, 0xb87a52];
const HAIR_COLORS = [0x2b1d16, 0x4a2f1d, 0x151515, 0xd9b26f, 0x6b4423];

function boxGeometry(w, h, d) {
  const key = `${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}`;
  if (!GEOMETRY_CACHE.has(key)) GEOMETRY_CACHE.set(key, new THREE.BoxGeometry(w, h, d));
  return GEOMETRY_CACHE.get(key);
}

function material(color, options = {}) {
  const key = [
    color,
    options.roughness ?? 0.82,
    options.metalness ?? 0,
    options.emissive ?? 0,
    options.emissiveIntensity ?? 1
  ].join(":");
  if (!MATERIAL_CACHE.has(key)) {
    MATERIAL_CACHE.set(key, new THREE.MeshStandardMaterial({
      color,
      roughness: options.roughness ?? 0.82,
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

function makeFaceTexture({ skin, hair, stubble = true, eyes = 0x2a1c16 }) {
  if (typeof document === "undefined") return null;
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const skinColor = new THREE.Color(skin).getStyle();
  ctx.fillStyle = skinColor;
  ctx.fillRect(0, 0, size, size);

  // Soft pixel shading around the edges of the face.
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#6b3c1f";
  ctx.fillRect(0, 0, 6, size);
  ctx.fillRect(size - 6, 0, 6, size);
  ctx.fillRect(0, size - 8, size, 8);
  ctx.globalAlpha = 1;

  // Brows.
  ctx.fillStyle = "#3a2418";
  ctx.fillRect(18, 33, 21, 4);
  ctx.fillRect(57, 33, 21, 4);

  // Eyes with white sclera and dark pupils.
  ctx.fillStyle = "#f5efe2";
  ctx.fillRect(21, 40, 18, 11);
  ctx.fillRect(57, 40, 18, 11);
  ctx.fillStyle = eyes;
  ctx.fillRect(28, 40, 8, 11);
  ctx.fillRect(63, 40, 8, 11);
  ctx.fillStyle = "#1b100b";
  ctx.fillRect(30, 43, 5, 7);
  ctx.fillRect(64, 43, 5, 7);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(30, 43, 2, 2);
  ctx.fillRect(64, 43, 2, 2);

  // Nose.
  ctx.fillStyle = "#c7865a";
  ctx.fillRect(45, 51, 6, 15);
  ctx.fillStyle = "#b4734a";
  ctx.fillRect(50, 51, 2, 13);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#8b4f2c";
  ctx.fillRect(13, 52, 6, 12);
  ctx.fillRect(77, 52, 6, 12);
  ctx.globalAlpha = 1;

  // Mouth.
  ctx.fillStyle = "#6d2f26";
  ctx.fillRect(40, 73, 18, 4);
  ctx.fillStyle = "#f0c7a4";
  ctx.fillRect(40, 77, 18, 2);

  // Stubble along the jaw.
  if (stubble) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#4a2b1b";
    for (let x = 15; x < 81; x += 6) {
      ctx.fillRect(x, 84 + ((x / 6) % 2), 3, 3);
    }
    for (let x = 21; x < 75; x += 9) {
      ctx.fillRect(x, 66, 2, 3);
      ctx.fillRect(x + 3, 90, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  // Hairline at the top of the face.
  ctx.fillStyle = new THREE.Color(hair).getStyle();
  ctx.fillRect(0, 0, size, 12);
  ctx.fillRect(0, 12, 7, 15);
  ctx.fillRect(size - 7, 12, 7, 15);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function addLeg(root, side, shortsColor, skinColor, shoeColor) {
  const x = side * 0.155;
  const leg = new THREE.Group();
  leg.position.set(x, 0.84, 0);
  root.add(leg);

  // Baggy shorts cuff, then a chunky thigh, knee, calf and ankle.
  addBox(leg, 0.26, 0.18, 0.30, material(shortsColor), 0, -0.02, 0);
  addBox(leg, 0.23, 0.28, 0.26, material(skinColor), 0, -0.12, 0);
  addBox(leg, 0.20, 0.08, 0.22, material(skinColor), 0, -0.30, 0);
  addBox(leg, 0.20, 0.30, 0.23, material(skinColor), 0, -0.48, 0);
  addBox(leg, 0.18, 0.12, 0.20, material(skinColor), 0, -0.66, 0);

  // Sneaker with a bright sole.
  addBox(leg, 0.24, 0.10, 0.36, material(shoeColor, { roughness: 0.65 }), 0, -0.75, 0.05);
  addBox(leg, 0.26, 0.05, 0.38, material(0xf4f0df, { roughness: 0.8 }), 0, -0.815, 0.05);

  return leg;
}

function addArm(root, side, skinColor, watch = false) {
  const x = side * 0.41;
  const arm = new THREE.Group();
  arm.position.set(x, 1.33, 0);
  arm.rotation.z = side * 0.055;
  root.add(arm);

  // Shoulder cap fills the gap against the chest.
  addBox(arm, 0.26, 0.19, 0.28, material(skinColor), 0, -0.015, 0);
  addBox(arm, 0.20, 0.26, 0.22, material(skinColor), 0, -0.20, 0);
  addBox(arm, 0.18, 0.06, 0.20, material(skinColor), 0, -0.355, 0);
  addBox(arm, 0.17, 0.24, 0.20, material(skinColor), 0, -0.50, 0);
  addBox(arm, 0.16, 0.13, 0.18, material(skinColor), 0, -0.685, 0);

  if (watch) {
    addBox(arm, 0.19, 0.05, 0.21, material(0x24211d), 0, -0.42, 0);
    addBox(arm, 0.04, 0.10, 0.11, material(0xd8d4c8, { metalness: 0.35, roughness: 0.35 }), side * 0.09, -0.42, 0);
  }

  return arm;
}

/**
 * Create a chunky high-detail voxel human.
 * @param {object} options
 * @returns {THREE.Group}
 */
export function createCharacter(options = {}) {
  const opts = options || {};
  const seed = Number.isFinite(opts.seed) ? Math.abs(Math.trunc(opts.seed)) : 0;
  const skin = opts.skin ?? SKIN_TONES[seed % SKIN_TONES.length];
  const hair = opts.hair ?? HAIR_COLORS[(seed + 1) % HAIR_COLORS.length];
  const shirt = opts.shirt ?? 0xf3f1e6;
  const shorts = opts.shorts ?? 0x2f7d55;
  const shoes = opts.shoes ?? 0x2ca8a0;
  const cap = opts.cap === undefined ? null : opts.cap;
  const scale = Number.isFinite(opts.scale) ? opts.scale : 0.95;
  const stubble = opts.stubble !== false;

  const root = new THREE.Group();
  root.name = opts.name || "character";
  root.scale.setScalar(scale);

  const leftLeg = addLeg(root, -1, shorts, skin, shoes);
  const rightLeg = addLeg(root, 1, shorts, skin, shoes);

  // Hips, belt, waist and chest give a shaped torso instead of one slab.
  addBox(root, 0.62, 0.28, 0.40, material(shorts, { roughness: 0.88 }), 0, 0.77, 0);
  addBox(root, 0.60, 0.06, 0.38, material(0x273c31, { roughness: 0.8 }), 0, 0.895, 0);
  addBox(root, 0.56, 0.20, 0.34, material(shirt, { roughness: 0.9 }), 0, 0.99, 0);
  addBox(root, 0.66, 0.26, 0.36, material(shirt, { roughness: 0.9 }), 0, 1.17, 0);

  // Exposed shoulders/upper chest for the tank-top silhouette.
  addBox(root, 0.50, 0.10, 0.34, material(skin), 0, 1.325, 0);
  addBox(root, 0.20, 0.10, 0.20, material(skin), 0, 1.42, 0);

  const leftArm = addArm(root, -1, skin, true);
  const rightArm = addArm(root, 1, skin, false);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.44, 0);
  root.add(headGroup);

  const faceTexture = makeFaceTexture({ skin, hair, stubble });
  const skinMat = material(skin);
  const hairMat = material(hair, { roughness: 0.95 });
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTexture,
    color: 0xffffff,
    roughness: 0.75,
    metalness: 0
  });
  if (faceMat.map) faceMat.map.colorSpace = THREE.SRGBColorSpace;

  const head = new THREE.Mesh(
    boxGeometry(0.46, 0.44, 0.44),
    [skinMat, skinMat, hairMat, skinMat, faceMat, hairMat]
  );
  head.position.set(0, 0.22, 0);
  head.castShadow = true;
  head.receiveShadow = true;
  headGroup.add(head);

  // Ears and a chunky voxel nose.
  addBox(headGroup, 0.05, 0.14, 0.12, skinMat, -0.255, 0.20, 0);
  addBox(headGroup, 0.05, 0.14, 0.12, skinMat, 0.255, 0.20, 0);
  addBox(headGroup, 0.08, 0.11, 0.05, material(0xcf8e60), 0, 0.16, 0.235);

  // Hair shell: top, back and short sideburns.
  addBox(headGroup, 0.48, 0.10, 0.46, hairMat, 0, 0.47, 0);
  addBox(headGroup, 0.48, 0.28, 0.10, hairMat, 0, 0.30, -0.20);
  addBox(headGroup, 0.04, 0.16, 0.10, hairMat, -0.235, 0.30, 0.08);
  addBox(headGroup, 0.04, 0.16, 0.10, hairMat, 0.235, 0.30, 0.08);

  if (cap != null) {
    const capColor = cap === true ? 0xb23a2a : cap;
    const capMat = material(capColor, { roughness: 0.72 });
    // Crown, button and a forward brim. The brim does not cast a shadow so the
    // face stays readable in the tropical sun.
    addBox(headGroup, 0.50, 0.14, 0.48, capMat, 0, 0.50, 0);
    addBox(headGroup, 0.06, 0.04, 0.06, capMat, 0, 0.585, 0);
    addBox(headGroup, 0.48, 0.05, 0.23, capMat, 0, 0.445, 0.315, { castShadow: false });
    addBox(headGroup, 0.48, 0.06, 0.05, capMat, 0, 0.45, 0.075, { castShadow: false });
  }

  root.userData = {
    kind: "character",
    limbs: { leftLeg, rightLeg, leftArm, rightArm, head: headGroup },
    height: 1.98 * scale,
    palette: { skin, hair, shirt, shorts, shoes, cap }
  };

  return root;
}

/**
 * Animate a character in place. Pure with respect to movement state; mutates
 * only limb rotations, which is the model's presentation layer.
 */
export function animateCharacter(character, speed = 0, time = 0) {
  const limbs = character && character.userData && character.userData.limbs;
  if (!limbs) return character;

  const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const walk = Math.min(1, safeSpeed / 3.2);
  // Stride cadence scales with movement speed so feet never glide.
  const cadence = 0.7 + safeSpeed * 1.0;
  const stride = Math.sin(time * cadence) * 0.55 * walk;
  const sway = Math.sin(time * cadence) * 0.012 * (1 - walk);

  if (limbs.leftLeg) limbs.leftLeg.rotation.x = stride;
  if (limbs.rightLeg) limbs.rightLeg.rotation.x = -stride;
  if (limbs.leftArm) {
    limbs.leftArm.rotation.x = -stride * 0.78;
    limbs.leftArm.rotation.z = -0.055 - sway;
  }
  if (limbs.rightArm) {
    limbs.rightArm.rotation.x = stride * 0.78;
    limbs.rightArm.rotation.z = 0.055 + sway;
  }
  if (limbs.head) {
    limbs.head.rotation.y = Math.sin(time * (0.45 + safeSpeed * 1.2)) * 0.045 * (1 - walk);
    limbs.head.rotation.x = Math.sin(time * (0.7 + safeSpeed * 1.4)) * 0.012 * (1 - walk);
  }

  return character;
}

export default createCharacter;
