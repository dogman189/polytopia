// Pedestrian entities for Voxel Coastal City.
// createPedestrianEntities builds one mesh per pedestrian and route progress.
// updatePedestrians advances walk loops and applies bobbing.
import * as THREE from "three";
import { CONSTANTS } from "../config/constants.js";

const DEFAULT_PED_COUNT = 8;
const PED_COLORS = ["#f2c6a0", "#f7d4b0", "#d9a066", "#c9845a", "#f5e1c8", "#b6845c"];

function num(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function colorToThree(value, fallback = 0xb6845c) {
  try {
    return new THREE.Color(value == null ? fallback : value);
  } catch (e) {
    return new THREE.Color(fallback);
  }
}

function fromRawPoint(raw) {
  if (raw == null) return { x: 0, z: 0 };
  if (Array.isArray(raw)) {
    if (raw.length >= 3) return { x: num(raw[0], 0), z: num(raw[2], 0) };
    if (raw.length >= 2) return { x: num(raw[0], 0), z: num(raw[1], 0) };
    if (raw.length === 1) return { x: num(raw[0], 0), z: 0 };
    return { x: 0, z: 0 };
  }
  if (typeof raw === "object") {
    if (Number.isFinite(raw.x) || Number.isFinite(raw.z) ||
        Number.isFinite(raw.X) || Number.isFinite(raw.Z)) {
      return {
        x: num(raw.x ?? raw.X ?? raw.cx ?? raw.centerX, 0),
        z: num(raw.z ?? raw.Z ?? raw.y ?? raw.Y ?? raw.cz ?? raw.centerZ, 0)
      };
    }
    if (raw.position && typeof raw.position === "object") return fromRawPoint(raw.position);
  }
  return { x: 0, z: 0 };
}

function normalizeRoutePoints(source) {
  if (!source) return [];
  let arr = source;
  if (typeof source === "object" && !Array.isArray(source)) {
    arr = source.points || source.waypoints || source.path ||
          source.routePoints || source.nodes || source.pts || source.segments;
  }
  if (!Array.isArray(arr)) {
    if (Array.isArray(source)) arr = source;
    else return [];
  }
  return arr.map(fromRawPoint);
}

function routeLength(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    total += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return total;
}

function locateProgress(points, progress) {
  const result = { x: 0, z: 0, yaw: 0, segmentIndex: 0 };
  if (!Array.isArray(points) || points.length === 0) return result;
  if (points.length === 1) {
    result.x = points[0].x;
    result.z = points[0].z;
    return result;
  }

  const total = routeLength(points);
  let p = progress;
  if (total > 0) {
    while (p >= total) p -= total;
    while (p < 0) p += total;
  }

  let acc = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const seg = Math.hypot(b.x - a.x, b.z - a.z);
    if (p <= acc + seg || i === points.length - 2) {
      const t = seg > 0 ? Math.min(1, Math.max(0, (p - acc) / seg)) : 0;
      result.x = a.x + (b.x - a.x) * t;
      result.z = a.z + (b.z - a.z) * t;
      result.segmentIndex = i;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      if (Math.hypot(dx, dz) > 1e-9) {
        result.yaw = Math.atan2(dx, dz);
      }
      return result;
    }
    acc += seg;
  }
  const last = points[points.length - 1];
  result.x = last.x;
  result.z = last.z;
  return result;
}

function normalizePedList(input) {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object") {
    if (Array.isArray(input.peds)) return input.peds;
    if (Array.isArray(input.pedestrians)) return input.pedestrians;
    if (Array.isArray(input.entities)) return input.entities;
    if (Array.isArray(input.items)) return input.items;
    if (Array.isArray(input.value)) return input.value;
    if (isFiniteNumber(input.x) || isFiniteNumber(input.z) || input.mesh) return [input];
  }
  return [];
}

function getPedRoutes(world) {
  if (!world || typeof world !== "object" || Array.isArray(world)) return [];
  return (
    (Array.isArray(world.pedRoutes) && world.pedRoutes) ||
    (Array.isArray(world.pedestrianRoutes) && world.pedestrianRoutes) ||
    (Array.isArray(world.routes) && world.routes) ||
    (Array.isArray(world.pedPaths) && world.pedPaths) ||
    []
  );
}

function fallbackRoutes(world) {
  const w = world || {};
  const b = w.bounds || {};
  const minX = num(b.minX ?? w.minX, -55);
  const maxX = num(b.maxX ?? w.maxX, 55);
  const minZ = num(b.minZ ?? w.minZ, 8);
  const maxZ = num(b.maxZ ?? w.maxZ, 46);
  return [
    {
      id: "ped-route-fallback",
      points: [
        { x: minX, z: minZ },
        { x: maxX, z: minZ },
        { x: maxX, z: maxZ },
        { x: minX, z: maxZ },
        { x: minX, z: minZ }
      ]
    }
  ];
}

function syncMesh(ped) {
  if (!ped || !ped.mesh || typeof ped.mesh !== "object") return;
  const mesh = ped.mesh;
  if (mesh.position && typeof mesh.position === "object") {
    mesh.position.x = num(ped.x, mesh.position.x ?? 0);
    mesh.position.z = num(ped.z, mesh.position.z ?? 0);
    const height = num(ped.meshHeight, 0.85);
    const bob = num(ped.bob, 0);
    mesh.position.y = height + bob;
  }
  if (mesh.rotation && typeof mesh.rotation === "object") {
    mesh.rotation.y = num(ped.yaw, mesh.rotation.y ?? 0);
  }
}

export function createPedestrianEntities(world, scene, options = {}) {
  const w = (world && typeof world === "object" && !Array.isArray(world)) ? world : null;
  const sourceWorld = w || {};
  let routes = getPedRoutes(sourceWorld);
  if (!routes || routes.length === 0) routes = fallbackRoutes(sourceWorld);

  const opts = (options && typeof options === "object") ? options : {};
  const count = Math.max(1, Math.trunc(num(
    sourceWorld.pedestrianCount ?? sourceWorld.pedCount ?? opts.count,
    DEFAULT_PED_COUNT
  )));

  // Normalize routes first.
  const normalizedRoutes = routes.map((r, ri) => {
    const points = normalizeRoutePoints(r);
    return {
      id: (r && r.id != null) ? r.id : `ped-route-${ri + 1}`,
      name: (r && r.name != null) ? r.name : `ped-route-${ri + 1}`,
      points,
      total: routeLength(points)
    };
  }).filter((r) => r.points.length > 0);
  const finalRoutes = normalizedRoutes.length > 0 ? normalizedRoutes : fallbackRoutes(sourceWorld).map((r, ri) => ({
    id: r.id,
    name: r.id,
    points: normalizeRoutePoints(r),
    total: routeLength(normalizeRoutePoints(r))
  }));

  const width = num(opts.width, 0.7);
  const height = num(opts.height, 1.7);

  // Distribute count across routes.
  const routeCount = finalRoutes.length;
  const base = Math.floor(count / routeCount);
  const rem = count % routeCount;
  const routeCounts = finalRoutes.map((_, ri) => base + (ri < rem ? 1 : 0));

  const entities = [];
  let index = 0;
  for (let ri = 0; ri < finalRoutes.length; ri += 1) {
    const route = finalRoutes[ri];
    const n = routeCounts[ri];
    if (n <= 0) continue;
    const total = route.total;
    for (let k = 0; k < n; k += 1) {
      const i = index;
      index += 1;
      // spacing along route
      let progress = 0;
      if (total > 0) {
        progress = ((k + 1) / (n + 1)) * total;
      }

      const located = locateProgress(route.points, progress);
      const yaw = Number.isFinite(located.yaw) ? located.yaw : 0;
      const x = located.x;
      const z = located.z;

      const color = PED_COLORS[i % PED_COLORS.length];
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, width * 0.8),
        new THREE.MeshStandardMaterial({
          color: colorToThree(color, 0xb6845c),
          roughness: 0.85,
          metalness: 0
        })
      );
      mesh.position.set(x, height / 2, z);
      mesh.rotation.y = yaw;

      if (scene && typeof scene.add === "function") {
        try { scene.add(mesh); } catch (e) { /* ignore */ }
      }

      const speed = 1.1 + ((i % 3) * 0.1);
      const entity = {
        id: `ped-${i + 1}`,
        type: "pedestrian",
        pedestrian: true,
        x,
        y: 0,
        z,
        yaw,
        heading: yaw,
        speed,
        color,
        mesh,
        meshHeight: height / 2,
        routeId: route.id,
        routeIndex: ri,
        route: route,
        routePoints: route.points,
        waypoints: route.points,
        path: route.points,
        routeProgress: progress,
        segmentIndex: located.segmentIndex,
        phase: i * 0.9,
        bob: 0,
        bobAmplitude: 0.07,
        bobSpeed: 1.8 + (i % 4) * 0.2
      };
      entities.push(entity);
    }
  }

  // Guard: ensure count.
  if (entities.length === 0) {
    // fallback one
    const route = finalRoutes[0];
    if (route) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, width * 0.8),
        new THREE.MeshStandardMaterial({ color: colorToThree(PED_COLORS[0], 0xb6845c), roughness: 0.85, metalness: 0 })
      );
      mesh.position.set(route.points[0].x, height / 2, route.points[0].z);
      if (scene && typeof scene.add === "function") try { scene.add(mesh); } catch (e) {}
      entities.push({
        id: "ped-1",
        type: "pedestrian",
        pedestrian: true,
        x: route.points[0].x, y: 0, z: route.points[0].z, yaw: 0, heading: 0,
        speed: 1.1, color: PED_COLORS[0], mesh, meshHeight: height / 2,
        routeId: route.id, routeIndex: 0, route, routePoints: route.points,
        waypoints: route.points, path: route.points, routeProgress: 0, segmentIndex: 0,
        phase: 0, bob: 0, bobAmplitude: 0.07, bobSpeed: 1.8
      });
    }
  }

  return entities;
}

export function updatePedestrians(peds, dt, options = {}) {
  const list = normalizePedList(peds);
  let safeDt = num(dt, 0);
  if (safeDt > 100) safeDt = safeDt / 1000;
  if (safeDt < 0) safeDt = 0;

  const opts = (options && typeof options === "object") ? options : {};

  for (let i = 0; i < list.length; i += 1) {
    const ped = list[i];
    if (!ped || typeof ped !== "object") continue;

    if (!Number.isFinite(ped.x)) ped.x = 0;
    if (!Number.isFinite(ped.z)) ped.z = 0;
    if (!Number.isFinite(ped.yaw)) ped.yaw = 0;
    if (!Number.isFinite(ped.speed)) ped.speed = 1.1;
    if (!Number.isFinite(ped.phase)) ped.phase = i * 0.9;
    if (!Number.isFinite(ped.bobAmplitude)) ped.bobAmplitude = num(opts.bobAmplitude, 0.07);
    if (!Number.isFinite(ped.bobSpeed)) ped.bobSpeed = num(opts.bobSpeed, 1.8);

    // resolve route points
    let points = ped.routePoints || ped.waypoints || ped.path;
    if ((!Array.isArray(points) || points.length === 0) && ped.route) {
      points = normalizeRoutePoints(ped.route);
    }
    if (Array.isArray(points) && points.length > 0) {
      points = normalizeRoutePoints(points);
      ped.routePoints = points;
      ped.waypoints = ped.waypoints || points;
      ped.path = ped.path || points;
    } else {
      points = [];
    }

    if (points.length >= 2) {
      if (!Number.isFinite(ped.routeProgress)) ped.routeProgress = 0;
      const total = routeLength(points);
      if (total > 0) {
        let progress = ped.routeProgress + (ped.speed || 0) * safeDt;
        while (progress >= total) progress -= total;
        while (progress < 0) progress += total;
        ped.routeProgress = progress;

        const located = locateProgress(points, progress);
        ped.x = located.x;
        ped.z = located.z;
        ped.yaw = located.yaw;
        ped.heading = located.yaw;
        ped.segmentIndex = located.segmentIndex;
      }
    }

    // bobbing
    ped.phase += safeDt * ped.bobSpeed;
    ped.bob = Math.sin(ped.phase) * ped.bobAmplitude;

    syncMesh(ped);
  }

  return list;
}

// Aliases / compatibility
export const updatePeds = updatePedestrians;
export const stepPedestrians = updatePedestrians;
export const tickPedestrians = updatePedestrians;

function defaultExport(world, scene, options) {
  return createPedestrianEntities(world, scene, options);
}
Object.assign(defaultExport, {
  createPedestrianEntities,
  updatePedestrians,
  updatePeds,
  stepPedestrians,
  tickPedestrians
});
export default defaultExport;