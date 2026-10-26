import * as THREE from "three";

// Procedural pixel/stylized textures for the enhanced graphics scene.
export function makeTexture(kind, size = 64) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Stable deterministic color jitter for "pixel" look.
  const bump = (rng, amount = 0) => Math.max(0, Math.min(255, (rng() * amount) | 0));

  // tiny RNG
  let seed = 19;
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  const paletteFor = {
    wall:   ["#f4e7d3", "#f0ddc0", "#e9cfa2"],
    roof:   ["#c45a3a", "#b04a2d", "#9a3a22"],
    asphalt:["#40444a", "#464a52", "#3b3f45"],
    grass:  ["#74a95a", "#6b9e50", "#5d8c42"],
    sand:   ["#dcc7a0", "#d6be98", "#cbb18e"],
    wood:   ["#7a5230", "#6e4826", "#644021"],
    glass:  ["#3f6a88", "#3b6280", "#446f90"],
    stone:  ["#b2afa8", "#a7a39c", "#9b978f"],
    pavement: ["#e8b0a8", "#e3a79e", "#d99a93"],
    generic:["#d3d3d3", "#c5c5c5", "#b9b9b9"]
  };

  const colors = paletteFor[kind] || paletteFor.generic;
  const base = colors[Math.floor(rng() * colors.length)];
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Pixel blocks.
  const pixels = size / 8;
  for (let y = 0; y < size; y += pixels) {
    for (let x = 0; x < size; x += pixels) {
      ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
      const dx = rng() > 0.5 ? 1 : -1;
      const dy = rng() > 0.5 ? 1 : -1;
      ctx.fillRect(x + ((dx > 0) ? 0 : 1), y + ((dy > 0) ? 0 : 1), pixels - 1, pixels - 1);
    }
  }

  // Surface detail.
  if (kind === "asphalt") {
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 60; i++) {
      const gx = (rng() * size) | 0;
      const gy = (rng() * size) | 0;
      ctx.fillStyle = "#2a2e34";
      ctx.fillRect(gx, gy, rng() > 0.5 ? 2 : 1, rng() > 0.5 ? 2 : 1);
    }
    ctx.globalAlpha = 1;
  } else if (kind === "grass") {
    ctx.globalAlpha = 0.65;
    for (let i = 0; i < 50; i++) {
      const gx = (rng() * size) | 0;
      const gy = (rng() * size) | 0;
      ctx.fillStyle = rng() > 0.5 ? "#88bb55" : "#5a8a38";
      ctx.fillRect(gx, gy, 1, 1);
    }
    ctx.globalAlpha = 1;
  } else if (kind === "wall") {
    // brick seams
    ctx.globalAlpha = 0.5;
    for (let y = 0; y < size; y += pixels) {
      ctx.fillStyle = "#bfa983";
      ctx.fillRect(0, y + 0, size, 1);
      for (let x = 0; x < size; x += pixels * 2) {
        ctx.fillRect(x, y - pixels, 1, pixels);
      }
    }
    ctx.globalAlpha = 1;
  } else if (kind === "roof") {
    // tile seams
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#6a2817";
    for (let y = 0; y < size; y += pixels) {
      for (let x = (y % 16 === 0 ? 0 : pixels); x < size; x += pixels * 2) {
        ctx.fillRect(x + 0, y, 1, pixels);
      }
      ctx.fillRect(0, y, size, 1);
    }
    ctx.globalAlpha = 1;
  } else if (kind === "sand") {
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 80; i++) {
      const gx = (rng() * size) | 0;
      const gy = (rng() * size) | 0;
      ctx.fillStyle = rng() > 0.5 ? "#e0ccab" : "#c2a47a";
      ctx.fillRect(gx, gy, 1, 1);
    }
    ctx.globalAlpha = 1;
  } else if (kind === "pavement") {
    // Large pink/cream sidewalk tiles with grout and light wear.
    const tiles = 4;
    const step = size / tiles;
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#a86f6b";
    for (let i = 0; i <= tiles; i += 1) {
      ctx.fillRect(i * step, 0, 1, size);
      ctx.fillRect(0, i * step, size, 1);
    }
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 50; i += 1) {
      ctx.fillStyle = "#f6d5cf";
      ctx.fillRect((rng() * size) | 0, (rng() * size) | 0, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.anisotropy = 8;
  return texture;
}

// Asphalt tile with a yellow dashed center line and pale edge lines.
export function makeRoadTexture(size = 256) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  let seed = 41;
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  ctx.fillStyle = "#3c4148";
  ctx.fillRect(0, 0, size, 64);
  for (let i = 0; i < 260; i += 1) {
    const shade = ["#343941", "#454b53", "#2e3339", "#4e545c"][(rng() * 4) | 0];
    ctx.fillStyle = shade;
    ctx.fillRect((rng() * size) | 0, (rng() * 64) | 0, rng() > 0.7 ? 2 : 1, 1);
  }

  // Edge lines.
  ctx.fillStyle = "#d8d2bd";
  ctx.fillRect(0, 4, size, 2);
  ctx.fillRect(0, 58, size, 2);

  // Dashed yellow center line.
  ctx.fillStyle = "#e8c14a";
  for (let x = 0; x < size; x += 48) ctx.fillRect(x, 30, 26, 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.anisotropy = 8;
  return texture;
}

// Vertical road texture: yellow dashes running along the road depth.
export function makeRoadTextureVertical(size = 256) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  let seed = 57;
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  ctx.fillStyle = "#3c4148";
  ctx.fillRect(0, 0, 64, size);
  for (let i = 0; i < 260; i += 1) {
    const shade = ["#343941", "#454b53", "#2e3339", "#4e545c"][(rng() * 4) | 0];
    ctx.fillStyle = shade;
    ctx.fillRect((rng() * 64) | 0, (rng() * size) | 0, 1, rng() > 0.7 ? 2 : 1);
  }
  ctx.fillStyle = "#d8d2bd";
  ctx.fillRect(4, 0, 2, size);
  ctx.fillRect(58, 0, 2, size);
  ctx.fillStyle = "#e8c14a";
  for (let y = 0; y < size; y += 48) ctx.fillRect(30, y, 3, 26);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.anisotropy = 8;
  return texture;
}
export default makeTexture;
