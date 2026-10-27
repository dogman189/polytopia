// World data for Voxel Coastal City.
// buildWorldData() returns a plain data object consumed by scene/player/vehicle/
// traffic/pedestrian modules. All coordinates are world units (1 unit = 1 meter).
// Layout is hand-authored to fit a ~120 x 70 playable map (bounds -60..60, -5..65).

import { CONSTANTS } from "../config/constants.js";

function makeBuilding(id, type, x, z, w, d, h, extras = {}) {
  return {
    id,
    type,
    name: extras.name || id,
    x,
    z,
    // size aliases for renderers/collision consumers
    w,
    width: w,
    d,
    depth: d,
    h,
    height: h,
    color: extras.color || "#d9d3c7",
    rotation: extras.rotation || 0,
    ...extras
  };
}

function buildingBox(b) {
  return {
    id: b.id,
    type: "building",
    minX: b.x - b.w / 2,
    maxX: b.x + b.w / 2,
    minZ: b.z - b.d / 2,
    maxZ: b.z + b.d / 2
  };
}

function point(x, z) {
  return { x, z };
}

export function buildWorldData() {
  const C = CONSTANTS;
  const W = C.WORLD || {};
  const minX = W.MIN_X ?? C.MIN_X ?? -60;
  const maxX = W.MAX_X ?? C.MAX_X ?? 60;
  const minZ = W.MIN_Z ?? C.MIN_Z ?? -5;
  const maxZ = W.MAX_Z ?? C.MAX_Z ?? 65;

  const buildings = [];

  // Four anchors.
  buildings.push(
    makeBuilding("town-hall", "landmark", 0, 0, 12, 10, 6, {
      name: "Town Hall",
      color: "#f6f2e9"
    })
  );
  buildings.push(
    makeBuilding("market", "landmark", -42, 22, 14, 12, 4, {
      name: "Market",
      color: "#f2d6a2"
    })
  );
  buildings.push(
    makeBuilding("lighthouse", "landmark", 48, 56, 4, 4, 12, {
      name: "Lighthouse",
      color: "#ffffff"
    })
  );
  buildings.push(
    makeBuilding("pier", "landmark", 12, 59, 24, 2, 1, {
      name: "Pier",
      color: "#c9a46b"
    })
  );

  // Rows of storefronts across the expanded neighborhood.
  const storeColumns = 17;
  const storeSpacing = 10;
  const storeStartX = -80;
  const storefrontRows = [16, 40, 64, 88];
  for (let row = 0; row < storefrontRows.length; row += 1) {
    for (let i = 0; i < storeColumns; i += 1) {
      const x = storeStartX + i * storeSpacing;
      const z = storefrontRows[row];
      const palette = ["#f7b267", "#f4845f", "#f25c54", "#70a9a1", "#8fbcd4"][
        (i + row) % 5
      ];
      buildings.push(
        makeBuilding(`storefront-r${row + 1}-${i + 1}`, "storefront", x, z, 6, 4, 2 + (i % 3), {
          row: row + 1,
          index: i + 1,
          name: `Storefront ${row * storeColumns + i + 1}`,
          color: palette
        })
      );
    }
  }

  // Bigger catalog of varied building styles added across the city.
  const catalogBuildings = [
    // Residential apartments along the first avenue.
    { id: "apt-1", type: "residential", x: -74, z: 18, w: 12, d: 9, h: 9, color: "#f3e7df" },
    { id: "apt-2", type: "residential", x: -6, z: 18, w: 10, d: 8, h: 11, color: "#e8f0f0" },
    { id: "apt-3", type: "residential", x: 58, z: 18, w: 11, d: 9, h: 10, color: "#f1e3d4" },
    // Grand hotel and offices near the central plaza.
    { id: "hotel-1", type: "hotel", x: -20, z: 62, w: 18, d: 12, h: 13, color: "#cfe1f0" },
    { id: "office-tower-1", type: "tower", x: 46, z: 62, w: 16, d: 12, h: 16, color: "#ecf2f7" },
    { id: "office-tower-2", type: "tower", x: 86, z: 62, w: 14, d: 11, h: 14, color: "#ecf2f7" },
    { id: "library-1", type: "landmark", x: 12, z: 62, w: 20, d: 14, h: 6, color: "#fff3d6" },
    // Heavy industry and warehouses near the back lots.
    { id: "warehouse-1", type: "warehouse", x: -76, z: 90, w: 24, d: 14, h: 5, color: "#f6e2b6" },
    { id: "warehouse-2", type: "warehouse", x: 52, z: 90, w: 26, d: 16, h: 6, color: "#f6e2b6" },
    { id: "industry-stack-1", type: "utility", x: 84, z: 92, w: 6, d: 6, h: 14, color: "#c7d1d8" },
    // Coastal housing and seaside plaza.
    { id: "coast-house-1", type: "house", x: -88, z: 118, w: 8, d: 7, h: 4, color: "#f6d3c4" },
    { id: "coast-house-2", type: "house", x: -58, z: 118, w: 8, d: 7, h: 4, color: "#ecf3e8" },
    { id: "coast-house-3", type: "house", x: -28, z: 118, w: 9, d: 7, h: 5, color: "#f7e6d5" },
    { id: "coast-house-4", type: "house", x:  2, z: 118, w: 9, d: 7, h: 5, color: "#e9e1f2" },
    { id: "coast-house-5", type: "house", x:  32, z: 118, w: 8, d: 7, h: 4, color: "#f4e3c4" },
    { id: "coast-house-6", type: "house", x:  62, z: 118, w: 8, d: 7, h: 4, color: "#ddeaf2" },
    { id: "mall-1", type: "retail-mall", x: -30, z: 8, w: 40, d: 20, h: 5, color: "#f4e9d8" },
    { id: "pavilion-1", type: "pavilion", x: 74, z: 8, w: 14, d: 14, h: 7, color: "#f5efe2" },
  ];
  catalogBuildings.forEach((spec, idx) => {
    buildings.push(makeBuilding(spec.id, spec.type, spec.x, spec.z, spec.w, spec.d, spec.h, {
      ...spec, name: spec.id, h: spec.h, w: spec.w, d: spec.d
    }));
  });

  // Street-lamp positions (consistent with scene builder) used for props and collision.
  const lampPositions = [];
  for (let x = -48; x <= 48; x += 16) {
    lampPositions.push([x, 11.0]);
    lampPositions.push([x, 27.8]);
  }
  for (let x = -56; x <= 56; x += 28) {
    lampPositions.push([x, 58.8]);
  }
  const lamps = lampPositions.map(([x, z], i) => ({
    id: `street-lamp-${i + 1}`,
    type: "street-lamp",
    x,
    z
  }));

  // Collision boxes for every building plus static props (palms + lamps).
  const collisionBoxes = buildings.map(buildingBox);
  lamps.forEach((l) => collisionBoxes.push({
    id: l.id,
    type: "street-lamp",
    minX: l.x - 0.26,
    maxX: l.x + 0.26,
    minZ: l.z - 0.26,
    maxZ: l.z + 0.26
  }));

  const oceanWall = {
    id: "ocean-wall",
    type: "ocean-wall",
    minX: minX - 1,
    maxX: maxX + 1,
    minZ: 60,
    maxZ: 62
  };
  collisionBoxes.push(oceanWall);

  // Scenic ocean boundary.
  const ocean = {
    id: "ocean",
    name: "Ocean",
    minX,
    maxX,
    minZ: 60,
    maxZ,
    level: 0,
    waterLevel: 0,
    wall: { ...oceanWall }
  };

  // Props: ten palms.
  const palmPositions = [
    [-55, 5],
    [-25, 5],
    [5, 5],
    [35, 5],
    [55, 5],
    [-50, 30],
    [-20, 30],
    [10, 30],
    [40, 30],
    [50, 55]
  ];
  const props = palmPositions.map(([x, z], i) => ({
    id: `palm-${i + 1}`,
    type: "palm",
    name: `Palm ${i + 1}`,
    x,
    z,
    height: 4 + (i % 3),
    radius: 0.6
  }));
  // Palm prop collision boxes.
  props.forEach((p) => collisionBoxes.push({
    id: p.id,
    type: "palm",
    minX: p.x - 0.35,
    maxX: p.x + 0.35,
    minZ: p.z - 0.35,
    maxZ: p.z + 0.35
  }));

  // Traffic routes: 3 rectangular loops.
  const routePointsA = [
    point(-94, 10),
    point(94, 10),
    point(94, 100),
    point(-94, 100),
    point(-94, 10)
  ];
  const routePointsB = [
    point(-94, 16),
    point(94, 16),
    point(94, 60),
    point(-94, 60),
    point(-94, 16)
  ];
  const routePointsC = [
    point(-30, 46),
    point(70, 46),
    point(70, 94),
    point(-30, 94),
    point(-30, 46)
  ];

  const routeDefinitions = [
    { id: "traffic-route-1", points: routePointsA },
    { id: "traffic-route-2", points: routePointsB },
    { id: "traffic-route-3", points: routePointsC }
  ];

  const trafficRoutes = routeDefinitions.map((r) => {
    const points = r.points.map((p) => ({ x: p.x, z: p.z }));
    return {
      id: r.id,
      name: r.id,
      points,
      waypoints: points,
      path: points
    };
  });

  // Two pedestrian loops.
  const pedPointsA = [
    point(-90, 12),
    point(90, 12),
    point(90, 100),
    point(-90, 100),
    point(-90, 12)
  ];
  const pedPointsB = [
    point(-90, 30),
    point(90, 30),
    point(90, 86),
    point(-90, 86),
    point(-90, 30)
  ];

  const makePedRoute = (id, points) => {
    const pts = points.map((p) => ({ x: p.x, z: p.z }));
    return { id, name: id, points: pts, waypoints: pts, path: pts };
  };

  const pedRoutes = [
    makePedRoute("ped-route-1", pedPointsA),
    makePedRoute("ped-route-2", pedPointsB)
  ];

  // Cars: 8 parked (non-traffic) + 3 traffic cars appended.
  const parkedPositions = [
    [-90, 6.3, Math.PI / 2],
    [-30, 6.3, Math.PI / 2],
    [30, 6.3, Math.PI / 2],
    [90, 6.3, Math.PI / 2],
    [-70, 32.3, -Math.PI / 2],
    [-10, 32.3, -Math.PI / 2],
    [50, 32.3, -Math.PI / 2],
    [90, 80.3, -Math.PI / 2]
  ];

  const carColors = ["#d64045", "#3b7ddd", "#f2c14e", "#7a9e7e", "#9b5de5", "#f77f00", "#4cc9f0", "#90be6d"];

  const parkedCars = parkedPositions.map(([x, z, yaw, variant], i) => ({
    id: `parked-car-${i + 1}`,
    type: "car",
    x,
    z,
    yaw: yaw || 0,
    heading: yaw || 0,
    variant: variant || ["sport","suv","compact","pickup"][(i) % 4],
    color: carColors[i % carColors.length],
    traffic: false,
    parked: true,
    stealable: true,
    enterable: true
  }));

  // Append traffic cars as entries with traffic:true and route metadata.
  trafficRoutes.forEach((route, i) => {
    const start = route.points[0] || { x: 0, z: 0 };
    parkedCars.push({
      id: `traffic-car-${i + 1}`,
      type: "car",
      variant: ["sport","suv","compact","pickup"][(parkedPositions.length + i) % 4],
      x: start.x,
      z: start.z,
      yaw: 0,
      heading: 0,
      color: carColors[(parkedPositions.length + i) % carColors.length],
      traffic: true,
      parked: false,
      stealable: false,
      enterable: false,
      // Route metadata (multiple aliases for consumers).
      routeId: route.id,
      routeIndex: i,
      route: route,
      routePoints: route.points,
      waypoints: route.points,
      routeProgress: 0
    });
  });

  const playerSpawn = { x: 0, z: 36, y: 0, yaw: 0 };

  const spawns = {
    player: playerSpawn,
    playerStart: playerSpawn,
    start: playerSpawn,
    spawn: playerSpawn
  };

  const bounds = {
    minX,
    maxX,
    minZ,
    maxZ,
    width: maxX - minX,
    depth: maxZ - minZ,
    min: { x: minX, z: minZ },
    max: { x: maxX, z: maxZ }
  };

  return {
    bounds,
    collisionBoxes,
    buildings,
    props,
    lamps,
    ocean,
    spawns,
    trafficRoutes,
    pedRoutes,
    parkedCars
  };
}

export default buildWorldData;
