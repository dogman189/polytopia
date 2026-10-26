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

  // Two rows of storefronts (11 per row).
  const storeColumns = 11;
  const storeSpacing = 10;
  const storeStartX = -50;
  const storefrontRows = [14, 36];
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

  // Collision boxes for every building plus the ocean retaining wall.
  const collisionBoxes = buildings.map(buildingBox);

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

  // Traffic routes: 3 rectangular loops.
  const routePointsA = [
    point(-55, 8),
    point(55, 8),
    point(55, 50),
    point(-55, 50),
    point(-55, 8)
  ];
  const routePointsB = [
    point(-55, 10),
    point(55, 10),
    point(55, 32),
    point(-55, 32),
    point(-55, 10)
  ];
  const routePointsC = [
    point(-20, 40),
    point(25, 40),
    point(25, 57),
    point(-20, 57),
    point(-20, 40)
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
    point(-55, 8),
    point(55, 8),
    point(55, 46),
    point(-55, 46),
    point(-55, 8)
  ];
  const pedPointsB = [
    point(-55, 10),
    point(55, 10),
    point(55, 40),
    point(-55, 40),
    point(-55, 10)
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
    [-45, 6, 0],
    [-15, 6, 0],
    [15, 6, 0],
    [45, 6, 0],
    [-35, 28, Math.PI],
    [-5, 28, Math.PI],
    [25, 28, Math.PI],
    [50, 28, Math.PI]
  ];

  const carColors = ["#d64045", "#3b7ddd", "#f2c14e", "#7a9e7e", "#9b5de5", "#f77f00", "#4cc9f0", "#90be6d"];

  const parkedCars = parkedPositions.map(([x, z, yaw], i) => ({
    id: `parked-car-${i + 1}`,
    type: "car",
    x,
    z,
    yaw: yaw || 0,
    heading: yaw || 0,
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

  const playerSpawn = { x: 0, z: 24, y: 0, yaw: 0 };

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
    ocean,
    spawns,
    trafficRoutes,
    pedRoutes,
    parkedCars
  };
}

export default buildWorldData;
