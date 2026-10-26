// Ambient car entities for Voxel Coastal City.
// createCarEntities builds one mesh per car and exposes route metadata.
// updateTraffic advances traffic cars along their routes and syncs meshes.
import * as THREE from "three";
import { CONSTANTS } from "../config/constants.js";

function num(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function trafficFlag(value) {
  if (value === true || value === 1) return true;
  if (typeof value === "string" && value.toLowerCase() === "true") return true;
  return false;
}

function colorToThree(value, fallback = 0x808080) {
  try {
    return new THREE.Color(value == null ? fallback : value);
  } catch (e) {
    return new THREE.Color(fallback);
  }
}

function pointFrom(xLike, zLike) {
  return { x: num(xLike, 0), z: num(zLike, 0) };
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
  const result = { x: points[0].x, z: points[0].z, yaw: 0, segmentIndex: 0 };
  if (!Array.isArray(points) || points.length === 0) return result;
  if (points.length === 1) {
    result.x = points[0].x;
    result.z = points[0].z;
    return result;
  }

  const total = routeLength(points);
  let p = progress;
  if (total > 0) {
    // wrap safety
    while (p >= total) p -= total;
    while (p < 0) p += total;
  }

  let acc = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const seg = Math.hypot(b.x - a.x, b.z - a.z);
    if (p <= acc + seg || i === points.length - 2) {
      const local = seg > 0 ? (p - acc) / seg : 0;
      const t = Math.min(1, Math.max(0, local));
      result.x = a.x + (b.x - a.x) * t;
      result.z = a.z + (b.z - a.z) * t;
      result.segmentIndex = i;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      if (Math.hypot(dx, dz) > 1e-9) {
        result.yaw = Math.atan2(dx, dz); // x=sin(yaw), z=cos(yaw)
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

function normalizeCarList(input) {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object") {
    if (Array.isArray(input.cars)) return input.cars;
    if (Array.isArray(input.entities)) return input.entities;
    if (Array.isArray(input.trafficCars)) return input.trafficCars;
    if (Array.isArray(input.ambientCars)) return input.ambientCars;
    if (Array.isArray(input.items)) return input.items;
    if (Array.isArray(input.value)) return input.value;
    // Support a single entity-like object only if it has a mesh/x.
    if (isFiniteNumber(input.x) || isFiniteNumber(input.z) || input.mesh) return [input];
  }
  return [];
}

function isTraffic(car) {
  if (!car || typeof car !== "object") return false;
  if (trafficFlag(car.traffic)) return true;
  if (car.type === "traffic" || car.kind === "traffic" || car.category === "traffic") return true;
  // cars on a route are treated as traffic-capable
  if (car.routeId != null || car.routeIndex != null) {
    if (car.parked === false && (car.routePoints || car.route || car.waypoints)) return true;
  }
  return false;
}

function getRoutes(world) {
  if (!world || typeof world !== "object" || Array.isArray(world)) return [];
  return (
    (Array.isArray(world.trafficRoutes) && world.trafficRoutes) ||
    (Array.isArray(world.routes) && world.routes) ||
    (Array.isArray(world.carRoutes) && world.carRoutes) ||
    (Array.isArray(world.paths) && world.paths) ||
    []
  );
}

function getCars(world) {
  if (Array.isArray(world)) return world.slice();
  if (!world || typeof world !== "object") return [];
  const candidates = [
    world.parkedCars,
    world.cars,
    world.vehicles,
    world.trafficCars,
    world.ambientCars,
    world.carEntities
  ];
  const seen = new Set();
  const out = [];
  for (const list of candidates) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const key = item.id != null ? `id:${item.id}` : `ptr:${out.length}`;
      // De-dup by id across lists.
      if (item.id != null && seen.has(`id:${item.id}`)) continue;
      if (item.id != null) seen.add(`id:${item.id}`);
      out.push(item);
    }
  }
  return out;
}

function resolveRoute(spec, routes) {
  if (!spec || typeof spec !== "object") return null;
  if (spec.route && (Array.isArray(spec.route) || (spec.route.points || spec.route.waypoints || spec.route.path))) {
    // if it has route geometry, use directly
    if (spec.route.id || spec.route.points || spec.route.waypoints || spec.route.path || Array.isArray(spec.route)) {
      return spec.route;
    }
  }
  if (!Array.isArray(routes) || routes.length === 0) return spec.route || null;
  if (spec.routeId != null) {
    const found = routes.find((r) => r && r.id === spec.routeId);
    if (found) return found;
  }
  if (isFiniteNumber(spec.routeIndex)) {
    const idx = Math.trunc(spec.routeIndex);
    if (idx >= 0 && idx < routes.length) return routes[idx];
  }
  if (isFiniteNumber(spec.route)) {
    const idx = Math.trunc(spec.route);
    if (idx >= 0 && idx < routes.length) return routes[idx];
  }
  return null;
}

function syncMesh(car, fallbackY) {
  if (!car || !car.mesh || typeof car.mesh !== "object") return;
  const mesh = car.mesh;
  if (mesh.position && typeof mesh.position === "object") {
    mesh.position.x = num(car.x, mesh.position.x ?? 0);
    mesh.position.z = num(car.z, mesh.position.z ?? 0);
    if (!Number.isFinite(mesh.position.y)) mesh.position.y = num(fallbackY, 0.5);
  } else {
    mesh.position = { x: num(car.x, 0), y: num(fallbackY, 0.5), z: num(car.z, 0) };
  }
  if ("rotation" in mesh && mesh.rotation && typeof mesh.rotation === "object") {
    mesh.rotation.y = num(car.yaw ?? car.heading, mesh.rotation.y ?? 0);
  } else if (mesh.rotation !== undefined) {
    mesh.rotation = num(car.yaw ?? car.heading, 0);
  }
}

export function createCarEntities(world, scene, options = {}) {
  const w = (world && typeof world === "object" && !Array.isArray(world)) ? world : null;
  const sourceWorld = w || (Array.isArray(world) ? { parkedCars: world } : {});
  const routes = getRoutes(sourceWorld);

  const opts = (options && typeof options === "object") ? options : {};
  const defaultSpeed = num(opts.trafficSpeed, 6);
  const width = num(opts.width, 1.8);
  const height = num(opts.height, 1.0);
  const depth = num(opts.depth, 3.4);

  const specs = getCars(sourceWorld);
  const entities = [];

  specs.forEach((spec, i) => {
    const s = (spec && typeof spec === "object") ? spec : {};
    const x = num(s.x, 0);
    const z = num(s.z, 0);
    const yaw = num(s.yaw ?? s.heading, 0);
    const traffic = trafficFlag(s.traffic);
    let speed = num(s.speed, traffic ? defaultSpeed : 0);
    if (traffic && !(speed > 0)) speed = defaultSpeed;

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({
        color: colorToThree(s.color, traffic ? 0x3b7ddd : 0xd64045),
        roughness: 0.75,
        metalness: 0.05
      })
    );
    mesh.position.set(x, height / 2, z);
    mesh.rotation.y = yaw;

    if (scene && typeof scene.add === "function") {
      try { scene.add(mesh); } catch (e) { /* ignore */ }
    }

    let route = null;
    let routePoints = null;
    if (traffic) {
      route = resolveRoute(s, routes);
      if (!route && routes.length > 0) route = routes[i % routes.length];
      routePoints = normalizeRoutePoints(route);
      if (!routePoints || routePoints.length === 0) {
        routePoints = normalizeRoutePoints(s.routePoints || s.waypoints || s.path || s.points);
      }
    } else {
      if (s.route && (s.route.id || Array.isArray(s.route) ||
          s.route.points || s.route.waypoints || s.route.path)) {
        route = s.route;
      }
      routePoints = normalizeRoutePoints(s.routePoints || s.waypoints || s.path || s.points);
      if ((!routePoints || routePoints.length === 0) && route) {
        routePoints = normalizeRoutePoints(route);
      }
    }

    const progressValue = s.routeProgress;
    let routeProgress = 0;
    if (typeof progressValue === "number" && Number.isFinite(progressValue)) {
      routeProgress = progressValue;
    } else if (traffic && routePoints && routePoints.length > 1) {
      // spread cars along the route deterministically
      const total = routeLength(routePoints);
      const positionIndex = i + 1;
      routeProgress = (positionIndex / Math.max(1, specs.length + 1)) * total;
      if (Number.isFinite(s.routeProgressStart)) routeProgress = s.routeProgressStart;
    }

    // initial position for traffic should follow routeProgress if route available
    let finalX = x;
    let finalZ = z;
    let finalYaw = yaw;
    if (traffic && routePoints && routePoints.length > 0) {
      const located = locateProgress(routePoints, routeProgress);
      finalX = located.x;
      finalZ = located.z;
      finalYaw = located.yaw;
      mesh.position.set(finalX, height / 2, finalZ);
      mesh.rotation.y = finalYaw;
    }

    const entity = {
      id: s.id != null ? s.id : (traffic ? `traffic-car-${i + 1}` : `parked-car-${i + 1}`),
      type: s.type || (traffic ? "traffic-car" : "car"),
      car: true,
      traffic,
      parked: s.parked != null ? !!s.parked : !traffic,
      enterable: s.enterable != null ? !!s.enterable : !traffic,
      stealable: s.stealable != null ? !!s.stealable : !traffic,
      x: finalX,
      y: 0,
      z: finalZ,
      yaw: finalYaw,
      heading: finalYaw,
      speed,
      color: s.color,
      mesh,
      routeId: route && route.id != null ? route.id : (s.routeId != null ? s.routeId : null),
      routeIndex: isFiniteNumber(s.routeIndex)
        ? Math.trunc(s.routeIndex)
        : (Array.isArray(routes) ? routes.indexOf(route) : -1),
      route,
      routePoints: routePoints || [],
      waypoints: routePoints || [],
      path: routePoints || [],
      routeProgress,
      segmentIndex: 0,
      lane: s.lane,
      // preserve original spec for consumers
      data: s
    };

    entities.push(entity);
  });

  return entities;
}

export function updateTraffic(cars, dt, world) {
  const list = normalizeCarList(cars);
  let safeDt = num(dt, 0);
  if (safeDt > 100) safeDt = safeDt / 1000; // tolerate ms just in case
  if (safeDt < 0) safeDt = 0;

  for (let i = 0; i < list.length; i += 1) {
    const car = list[i];
    if (!car || typeof car !== "object") continue;

    if (!Number.isFinite(car.x)) car.x = 0;
    if (!Number.isFinite(car.z)) car.z = 0;
    if (!Number.isFinite(car.y)) car.y = 0;
    if (!Number.isFinite(car.yaw)) car.yaw = 0;
    if (!Number.isFinite(car.speed)) car.speed = isTraffic(car) ? 6 : 0;

    // resolve route points lazily
    let points = car.routePoints || car.waypoints || car.path;
    if ((!Array.isArray(points) || points.length === 0) && car.route) {
      points = normalizeRoutePoints(car.route);
    }
    points = normalizeRoutePoints(points);
    if (Array.isArray(points) && points.length > 0) {
      car.routePoints = points;
      car.waypoints = car.waypoints || points;
      car.path = car.path || points;
    }

    const traffic = isTraffic(car);
    if (traffic && Array.isArray(points) && points.length >= 2) {
      if (!Number.isFinite(car.routeProgress)) car.routeProgress = 0;
      const total = routeLength(points);
      if (total > 0) {
        let progress = car.routeProgress + (car.speed || 0) * safeDt;
        while (progress >= total) progress -= total;
        while (progress < 0) progress += total;
        car.routeProgress = progress;

        const located = locateProgress(points, progress);
        car.x = located.x;
        car.z = located.z;
        car.yaw = located.yaw;
        car.heading = located.yaw;
        car.segmentIndex = located.segmentIndex;
      }
    }

    syncMesh(car, 0.5);
  }

  return list;
}

// Aliases / compatibility
export const updateCars = updateTraffic;
export const stepTraffic = updateTraffic;
export const tickTraffic = updateTraffic;

function defaultExport(world, scene, options) {
  return createCarEntities(world, scene, options);
}
Object.assign(defaultExport, {
  createCarEntities,
  updateTraffic,
  updateCars,
  stepTraffic,
  tickTraffic,
  normalizeRoutePoints,
  routeLength,
  locateProgress
});
export default defaultExport;