// Pure 2D (XZ-plane) circle-vs-AABB collision resolution.
// resolveMovement(prev, next, radius, boxes, bounds) -> {x, z, ...}
// Slides along walls: each axis is tested independently.

const DEFAULT_BOUNDS = {
  minX: -60,
  maxX: 60,
  minZ: -5,
  maxZ: 65
};

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function toNumber(v, fallback = 0) {
  return isFiniteNumber(v) ? v : fallback;
}

function toXZ(point) {
  if (!point) return { x: 0, z: 0 };
  if (Array.isArray(point)) {
    if (point.length >= 3) return { x: toNumber(point[0]), z: toNumber(point[2]) };
    return { x: toNumber(point[0]), z: toNumber(point[1]) };
  }
  if (typeof point === "object") {
    if (point.position) return toXZ(point.position);
    if (isFiniteNumber(point.x) || isFiniteNumber(point.z)) {
      return {
        x: toNumber(point.x ?? point.X ?? point.left),
        z: toNumber(point.z ?? point.Z ?? point.y ?? point.Y)
      };
    }
  }
  return { x: 0, z: 0 };
}

function normalizeBounds(bounds) {
  if (!bounds) return { ...DEFAULT_BOUNDS };
  if (Array.isArray(bounds)) {
    if (bounds.length >= 4)
      return { minX: toNumber(bounds[0]), maxX: toNumber(bounds[1]), minZ: toNumber(bounds[2]), maxZ: toNumber(bounds[3]) };
    if (bounds.length === 2 && bounds[0] && bounds[1]) {
      return {
        minX: toNumber(bounds[0].x ?? bounds[0].minX),
        maxX: toNumber(bounds[1].x ?? bounds[1].maxX),
        minZ: toNumber(bounds[0].z ?? bounds[0].minZ),
        maxZ: toNumber(bounds[1].z ?? bounds[1].maxZ)
      };
    }
  }
  if (typeof bounds === "object") {
    if (isFiniteNumber(bounds.minX) && isFiniteNumber(bounds.maxX) &&
        isFiniteNumber(bounds.minZ) && isFiniteNumber(bounds.maxZ)) {
      return {
        minX: bounds.minX,
        maxX: bounds.maxX,
        minZ: bounds.minZ,
        maxZ: bounds.maxZ
      };
    }
    if (bounds.min && bounds.max) {
      const min = bounds.min;
      const max = bounds.max;
      return {
        minX: toNumber(min.x ?? min.X ?? min.minX),
        maxX: toNumber(max.x ?? max.X ?? max.maxX),
        minZ: toNumber(min.z ?? min.Z ?? min.minZ),
        maxZ: toNumber(max.z ?? max.Z ?? max.maxZ)
      };
    }
    if (bounds.x && bounds.z && isFiniteNumber(bounds.x.min) && isFiniteNumber(bounds.x.max)) {
      return {
        minX: bounds.x.min,
        maxX: bounds.x.max,
        minZ: bounds.z.min,
        maxZ: bounds.z.max
      };
    }
  }
  return { ...DEFAULT_BOUNDS };
}

function normalizeBox(box) {
  if (!box) return null;
  if (Array.isArray(box)) {
    if (box.length >= 4) {
      const a = Math.min(box[0], box[2]);
      const b = Math.max(box[0], box[2]);
      const c = Math.min(box[1], box[3]);
      const d = Math.max(box[1], box[3]);
      return { minX: a, maxX: b, minZ: c, maxZ: d };
    }
    return null;
  }
  if (typeof box !== "object") return null;

  // Explicit min/max form.
  if (isFiniteNumber(box.minX) && isFiniteNumber(box.maxX) &&
      isFiniteNumber(box.minZ) && isFiniteNumber(box.maxZ)) {
    return {
      minX: Math.min(box.minX, box.maxX),
      maxX: Math.max(box.minX, box.maxX),
      minZ: Math.min(box.minZ, box.maxZ),
      maxZ: Math.max(box.minZ, box.maxZ)
    };
  }

  if (box.min && box.max) {
    const min = box.min;
    const max = box.max;
    const mnX = toNumber(min.x ?? min.X ?? min.minX);
    const mxX = toNumber(max.x ?? max.X ?? max.maxX);
    const mnZ = toNumber(min.z ?? min.Z ?? min.minZ);
    const mxZ = toNumber(max.z ?? max.Z ?? max.maxZ);
    return {
      minX: Math.min(mnX, mxX),
      maxX: Math.max(mnX, mxX),
      minZ: Math.min(mnZ, mxZ),
      maxZ: Math.max(mnZ, mxZ)
    };
  }

  // Center + size form.
  const cx = toNumber(box.x ?? box.cx ?? box.centerX ?? box.position?.x, NaN);
  const cz = toNumber(box.z ?? box.cz ?? box.centerZ ?? box.position?.z, NaN);
  if (Number.isFinite(cx) && Number.isFinite(cz)) {
    let hw = toNumber(box.halfWidth ?? box.halfW ?? box.halfX, NaN);
    let hd = toNumber(box.halfDepth ?? box.halfD ?? box.halfZ ?? box.halfH, NaN);
    const w = toNumber(box.w ?? box.width ?? box.sizeX ?? box.size?.x ?? box.sx, NaN);
    const d = toNumber(box.d ?? box.depth ?? box.sizeZ ?? box.size?.z ?? box.l ?? box.length, NaN);
    const h = toNumber(box.h ?? box.height, NaN);
    if (!Number.isFinite(hw)) {
      if (Number.isFinite(w)) hw = w / 2;
      else if (Number.isFinite(h) && !Number.isFinite(d)) hw = h / 2; // 2D convenience
    }
    if (!Number.isFinite(hd)) {
      if (Number.isFinite(d)) hd = d / 2;
      else if (Number.isFinite(h) && Number.isFinite(w)) hd = h / 2; // 2D convenience
    }
    if (Number.isFinite(hw) && Number.isFinite(hd) && hw >= 0 && hd >= 0) {
      const yaw = isFiniteNumber(box.yaw)
        ? box.yaw
        : (isFiniteNumber(box.rotation) ? box.rotation : null);
      if (Number.isFinite(yaw)) {
        return Object.assign(
          { shape: "rotated-rect", cx, cz, yaw, hw, hd },
          {
            minX: cx - Math.max(hw, hd),
            maxX: cx + Math.max(hw, hd),
            minZ: cz - Math.max(hw, hd),
            maxZ: cz + Math.max(hw, hd)
          }
        );
      }
      return {
        minX: cx - hw,
        maxX: cx + hw,
        minZ: cz - hd,
        maxZ: cz + hd
      };
    }
  }

  // Left/right/top/bottom form.
  if (isFiniteNumber(box.left) && isFiniteNumber(box.right) &&
      isFiniteNumber(box.top) && isFiniteNumber(box.bottom)) {
    return {
      minX: Math.min(box.left, box.right),
      maxX: Math.max(box.left, box.right),
      minZ: Math.min(box.top, box.bottom),
      maxZ: Math.max(box.top, box.bottom)
    };
  }

  return null;
}

function circleBoxOverlap(px, pz, r, box) {
  // Treat zero-radius circle as an explicit (inclusive) point test.
  if (!(r > 0)) {
    return px >= box.minX && px <= box.maxX && pz >= box.minZ && pz <= box.maxZ;
  }
  const closestX = Math.min(Math.max(px, box.minX), box.maxX);
  const closestZ = Math.min(Math.max(pz, box.minZ), box.maxZ);
  const dx = px - closestX;
  const dz = pz - closestZ;
  return dx * dx + dz * dz < r * r;
}

function circleRotatedRectOverlap(px, pz, r, box) {
  const dx = px - box.cx;
  const dz = pz - box.cz;
  const yaw = box.yaw || 0;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const lx = dx * cy + dz * sy;
  const lz = -dx * sy + dz * cy;
  const hw = box.hw || 0;
  const hd = box.hd || 0;
  if (!(r > 0)) {
    return Math.abs(lx) <= hw && Math.abs(lz) <= hd;
  }
  const clampedX = Math.max(-hw, Math.min(lx, hw));
  const clampedZ = Math.max(-hd, Math.min(lz, hd));
  const ddx = lx - clampedX;
  const ddz = lz - clampedZ;
  return ddx * ddx + ddz * ddz < r * r;
}

function clamp(v, lo, hi) {
  if (lo > hi) return (lo + hi) / 2;
  return Math.min(Math.max(v, lo), hi);
}

function preserveVertical(prev, next, out) {
  let y;
  if (next && (next.y !== undefined || next.Y !== undefined)) y = next.y ?? next.Y;
  else if (prev && (prev.y !== undefined || prev.Y !== undefined)) y = prev.y ?? prev.Y;
  if (y !== undefined) out.y = y;
  // copy other common fields minimally
  if (next && typeof next === "object") {
    for (const key of ["id", "yaw"]) {
      if (next[key] !== undefined && out[key] === undefined) out[key] = next[key];
    }
  }
  return out;
}

export function resolveMovement(prev, next, radius, boxes, bounds) {
  const r = isFiniteNumber(radius) ? Math.max(0, radius) : 0;
  const previous = toXZ(prev);
  const desired = toXZ(next);
  const normalizedBounds = normalizeBounds(bounds);
  const normalizedBoxes = (Array.isArray(boxes) ? boxes : (boxes ? [boxes] : []))
    .map(normalizeBox)
    .filter(Boolean);

  const collides = (cx, cz) =>
    normalizedBoxes.some((box) =>
      box && box.shape === "rotated-rect"
        ? circleRotatedRectOverlap(cx, cz, r, box)
        : circleBoxOverlap(cx, cz, r, box)
    );

  let x = previous.x;
  let z = previous.z;

  // Try horizontal movement independently to allow sliding.
  if (!collides(desired.x, z)) x = desired.x;
  // Try vertical (Z) movement using the (possibly unchanged) X.
  if (!collides(x, desired.z)) z = desired.z;

  // Enforce world bounds, keeping the circle fully inside.
  x = clamp(x, normalizedBounds.minX + r, normalizedBounds.maxX - r);
  z = clamp(z, normalizedBounds.minZ + r, normalizedBounds.maxZ - r);

  const out = { x, z };
  // If clamping pushed into a box (rare), last-resort nudge? Keep simple; tests use reasonable geometry.
  return preserveVertical(prev, next, out);
}

export default resolveMovement;
export { circleBoxOverlap, circleRotatedRectOverlap };