// World data for Voxel Coastal City.
// buildWorldData() returns a plain data object consumed by scene/player/vehicle/
// traffic/pedestrian modules. All coordinates are world units (1 unit = 1 meter).
//
// Layout is authored on a 200 x 145 map (x -100..100, z -5..140):
//   4 horizontal roads (z = 8, 44, 80, 116) and 2 vertical roads (x = +/-75.2)
//   create three walkable blocks, a town-hall plaza, and a beach at z ~121..133.
// The beach, ocean, roads, sidewalks and plazas are the single source of truth
// for both rendering and gameplay checks.

import { CONSTANTS } from "../config/constants.js";

const ROAD_WIDTH = 7;
const SIDEWALK_WIDTH = 2.2;
const SIDEWALK_OFFSET = ROAD_WIDTH / 2 + SIDEWALK_WIDTH / 2; // 4.6
const HORIZONTAL_ROAD_Z = [8, 44, 80, 116];
const VERTICAL_ROAD_X = [-75.2, 75.2];
const VERTICAL_ROAD_Z = 62;
const VERTICAL_ROAD_DEPTH = 115; // z 4.5..119.5, joins the first and last road
const GROUND_MAX_Z = 121.7;
const BEACH_MIN_Z = 121.7;
const BEACH_MAX_Z = 133.2;
const OCEAN_MIN_Z = 133.2;
const OCEAN_MAX_Z = 293;
const MAP_EDGE = 200;
const BEACH_WIDTH = 220;

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
    facing: extras.facing || "south",
    rotation: extras.rotation || 0,
    ...extras
  };
}

function buildingBox(b) {
  return {
    id: b.id,
    type: "building",
    buildingType: b.type,
    minX: b.x - b.w / 2,
    maxX: b.x + b.w / 2,
    minZ: b.z - b.d / 2,
    maxZ: b.z + b.d / 2,
    minY: 0,
    maxY: b.h,
    height: b.h
  };
}

function point(x, z) {
  return { x, z };
}

function makeRoads() {
  const roads = [];
  for (const z of HORIZONTAL_ROAD_Z) {
    roads.push({
      id: `road-h-${z}`,
      x: 0,
      z,
      w: MAP_EDGE,
      d: ROAD_WIDTH,
      orientation: "horizontal"
    });
  }
  for (const x of VERTICAL_ROAD_X) {
    roads.push({
      id: `road-v-${x}`,
      x,
      z: VERTICAL_ROAD_Z,
      w: ROAD_WIDTH,
      d: VERTICAL_ROAD_DEPTH,
      orientation: "vertical"
    });
  }
  return roads;
}

function makeSidewalks() {
  const sidewalks = [];
  // Horizontal sidewalks skip the vertical-road intersections instead of
  // painting pavement across the asphalt.
  const horizontalSegments = [
    { x: 0, w: 143.4 },
    { x: -89.35, w: 21.3 },
    { x: 89.35, w: 21.3 }
  ];
  for (const z of HORIZONTAL_ROAD_Z) {
    for (const offset of [-SIDEWALK_OFFSET, SIDEWALK_OFFSET]) {
      for (const segment of horizontalSegments) {
        sidewalks.push({
          id: `sidewalk-h-${z}-${offset}-${segment.x}`,
          x: segment.x,
          z: z + offset,
          w: segment.w,
          d: SIDEWALK_WIDTH,
          orientation: "horizontal"
        });
      }
    }
  }
  // Vertical sidewalks are split between intersections so they never paint
  // pavement across a road.
  const verticalSegments = [
    { z: 26, d: 29 },
    { z: 62, d: 29 },
    { z: 98, d: 29 }
  ];
  for (const x of VERTICAL_ROAD_X) {
    for (const offset of [-SIDEWALK_OFFSET, SIDEWALK_OFFSET]) {
      for (const segment of verticalSegments) {
        sidewalks.push({
          id: `sidewalk-v-${x}-${offset}-${segment.z}`,
          x: x + offset,
          z: segment.z,
          w: SIDEWALK_WIDTH,
          d: segment.d,
          orientation: "vertical"
        });
      }
    }
  }
  return sidewalks;
}

function makeCrosswalks() {
  const crosswalks = [];
  for (const z of HORIZONTAL_ROAD_Z) {
    for (const x of [-75.2, 0, 75.2]) {
      crosswalks.push({
        id: `crosswalk-${x}-${z}`,
        x,
        z,
        w: 5.2,
        d: ROAD_WIDTH - 0.5,
        stripes: 5
      });
    }
  }
  return crosswalks;
}

function makeStorefronts() {
  const rows = [
    { z: 15.9, facing: "south", xs: [-66, -54, -42, -30, 30, 42, 54, 66] },
    { z: 36.1, facing: "north", xs: [-66, -54, -42, -30, 30, 42, 54, 66] },
    { z: 51.9, facing: "south", xs: [-66, -54, -42, -30, 30, 42, 54, 66] },
    { z: 72.1, facing: "north", xs: [-66, -54, -42, -30, 30, 42, 54, 66] },
    { z: 87.9, facing: "south", xs: [-66, -54, -42, -30, -18, -6, 6, 18, 30, 42, 54, 66] },
    { z: 108.1, facing: "north", xs: [-38, -26, 26, 38] }
  ];
  const palette = ["#f7b267", "#f4845f", "#f25c54", "#70a9a1", "#8fbcd4"];
  const buildings = [];
  rows.forEach((row, rowIndex) => {
    row.xs.forEach((x, index) => {
      buildings.push(makeBuilding(
        `storefront-r${rowIndex + 1}-${index + 1}`,
        "storefront",
        x,
        row.z,
        6.8,
        4,
        2.7 + (index % 3) * 0.45,
        {
          row: rowIndex + 1,
          index: index + 1,
          name: `Storefront ${rowIndex + 1}-${index + 1}`,
          color: palette[(index + rowIndex) % palette.length],
          facing: row.facing
        }
      ));
    });
  });
  return buildings;
}

function makeCatalogBuildings() {
  return [
    // Landmarks around the town-hall plaza.
    makeBuilding("town-hall", "landmark", 0, 23, 14, 12, 7, {
      name: "Town Hall", color: "#f6f2e9", facing: "north"
    }),
    makeBuilding("market", "landmark", -50, 26, 12, 9, 4, {
      name: "Market", color: "#f2d6a2", facing: "north"
    }),
    makeBuilding("library-1", "landmark", 17, 24, 14, 9, 6, {
      name: "Library", color: "#fff3d6", facing: "south"
    }),
    // Residential block A.
    makeBuilding("apt-1", "residential", -34, 26, 10, 8, 9, { color: "#f3e7df", facing: "south" }),
    makeBuilding("apt-2", "residential", 43, 26, 10, 8, 10, { color: "#e8f0f0", facing: "north" }),
    makeBuilding("house-block-1", "house", -65.5, 26, 7, 7, 4, { color: "#f7e6d5", facing: "south" }),
    makeBuilding("pavilion-1", "pavilion", 59, 26, 12, 12, 6, { color: "#f5efe2", facing: "south" }),
    // Block B: hotel and office towers.
    makeBuilding("hotel-1", "hotel", 0, 61, 20, 13, 16, { color: "#cfe1f0", facing: "south" }),
    makeBuilding("office-tower-1", "tower", -38, 61, 16, 11, 18, { color: "#ecf2f7", facing: "south" }),
    makeBuilding("office-tower-2", "tower", 38, 61, 16, 11, 15, { color: "#ecf2f7", facing: "south" }),
    makeBuilding("apt-3", "residential", -62, 61, 11, 8, 10, { color: "#f1e3d4", facing: "east" }),
    // Block C: retail, warehouses and utilities.
    makeBuilding("mall-1", "retail-mall", 0, 99, 36, 14, 7, { color: "#f4e9d8", facing: "south" }),
    makeBuilding("warehouse-1", "warehouse", -56, 100, 24, 14, 6, { color: "#f6e2b6", facing: "south" }),
    makeBuilding("warehouse-2", "warehouse", 56, 100, 24, 14, 6, { color: "#f6e2b6", facing: "south" }),
    makeBuilding("industry-stack-1", "utility", -40, 100, 5, 5, 10, { color: "#c7d1d8", facing: "south" }),
    // Houses on the quiet grass margins.
    makeBuilding("coast-house-1", "house", -89, 26, 8, 7, 4, { color: "#f6d3c4", facing: "east" }),
    makeBuilding("coast-house-2", "house", -89, 60, 8, 7, 4, { color: "#ecf3e8", facing: "east" }),
    makeBuilding("coast-house-3", "house", -89, 96, 8, 7, 4, { color: "#f7e6d5", facing: "east" }),
    makeBuilding("coast-house-4", "house", 89, 26, 8, 7, 4, { color: "#e9e1f2", facing: "west" }),
    makeBuilding("coast-house-5", "house", 89, 60, 8, 7, 4, { color: "#f4e3c4", facing: "west" }),
    makeBuilding("coast-house-6", "house", 89, 96, 8, 7, 4, { color: "#ddeaf2", facing: "west" }),
    // Coast landmarks.
    makeBuilding("lighthouse", "landmark", 92, 126, 5, 5, 13, {
      name: "Lighthouse", color: "#ffffff", facing: "south"
    }),
    makeBuilding("pier", "landmark", 12, 137, 4, 10, 0.7, {
      name: "Pier", color: "#c9a46b", facing: "south"
    })
  ];
}

export function buildWorldData() {
  const C = CONSTANTS;
  const W = C.WORLD || {};
  const minX = W.MIN_X ?? C.MIN_X ?? -100;
  const maxX = W.MAX_X ?? C.MAX_X ?? 100;
  const minZ = W.MIN_Z ?? C.MIN_Z ?? -5;
  const maxZ = W.MAX_Z ?? C.MAX_Z ?? 140;

  const roads = makeRoads();
  const sidewalks = makeSidewalks();
  const crosswalks = makeCrosswalks();
  const plazas = [
    { id: "town-hall-plaza", x: 0, z: 34.3, w: 48, d: 10.2 },
    { id: "hotel-forecourt", x: 0, z: 52.1, w: 26, d: 4.8 }
  ];

  const buildings = [...makeCatalogBuildings(), ...makeStorefronts()];

  // Street lamps live on sidewalks, never in a traffic lane.
  const lampPositions = [];
  const lampRows = [
    { z: 13.1, xs: [-64, -44, -24, -4, 16, 36, 56] },
    { z: 48.0, xs: [-64, -44, -24, -4, 16, 36, 56] },
    { z: 74.7, xs: [-64, -44, -24, -4, 16, 36, 56] },
    { z: 120.6, xs: [-64, -44, -24, -4, 16, 36, 56] },
    { z: 26, xs: [-80.2, 80.2] },
    { z: 62, xs: [-80.2, 80.2] },
    { z: 98, xs: [-80.2, 80.2] }
  ];
  for (const row of lampRows) {
    for (const x of row.xs) lampPositions.push([x, row.z]);
  }
  const lamps = lampPositions.map(([x, z], i) => ({
    id: `street-lamp-${i + 1}`,
    type: "street-lamp",
    x,
    z
  }));

  // Palms: beach line plus the town-hall plaza. All are clear of roads.
  const palmPositions = [
    ...[-94, -80, -66, -52, -38, -24, 32, 46, 60, 74, 86].map((x) => [x, 124.5]),
    [-20, 31.5],
    [20, 31.5],
    [-20, 37],
    [20, 37]
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

  const oceanWall = {
    id: "ocean-wall",
    type: "ocean-wall",
    minX: minX - 1,
    maxX: maxX + 1,
    minZ: OCEAN_MIN_Z,
    maxZ: OCEAN_MIN_Z + 0.6,
    minY: 0,
    maxY: 0.6,
    height: 0.6
  };

  const collisionBoxes = buildings.map(buildingBox);
  lamps.forEach((l) => collisionBoxes.push({
    id: l.id,
    type: "street-lamp",
    minX: l.x - 0.2,
    maxX: l.x + 0.2,
    minZ: l.z - 0.2,
    maxZ: l.z + 0.2,
    minY: 0,
    maxY: 3.4,
    height: 3.4
  }));
  props.forEach((p) => collisionBoxes.push({
    id: p.id,
    type: "palm",
    minX: p.x - 0.28,
    maxX: p.x + 0.28,
    minZ: p.z - 0.28,
    maxZ: p.z + 0.28,
    minY: 0,
    maxY: p.height,
    height: p.height
  }));
  collisionBoxes.push(oceanWall);

  const beach = {
    id: "beach",
    x: 0,
    z: (BEACH_MIN_Z + BEACH_MAX_Z) / 2,
    w: BEACH_WIDTH,
    d: BEACH_MAX_Z - BEACH_MIN_Z,
    minX: -BEACH_WIDTH / 2,
    maxX: BEACH_WIDTH / 2,
    minZ: BEACH_MIN_Z,
    maxZ: BEACH_MAX_Z
  };

  const ocean = {
    id: "ocean",
    name: "Ocean",
    minX: -160,
    maxX: 160,
    minZ: OCEAN_MIN_Z,
    maxZ: OCEAN_MAX_Z,
    width: 320,
    depth: OCEAN_MAX_Z - OCEAN_MIN_Z,
    level: 0,
    waterLevel: -0.05,
    wall: { ...oceanWall }
  };

  const ground = {
    id: "ground",
    x: 0,
    z: (minZ + GROUND_MAX_Z) / 2,
    w: 220,
    d: GROUND_MAX_Z - minZ,
    minZ,
    maxZ: GROUND_MAX_Z
  };

  // Traffic routes stay in the lanes: horizontal legs sit inside a road band,
  // vertical legs sit inside a vertical road band.
  const routeDefinitions = [
    {
      id: "traffic-route-1",
      points: [point(-73, 9.8), point(73, 9.8), point(73, 114.2), point(-73, 114.2), point(-73, 9.8)]
    },
    {
      id: "traffic-route-2",
      points: [point(-77.4, 45.8), point(77.4, 45.8), point(77.4, 78.2), point(-77.4, 78.2), point(-77.4, 45.8)]
    },
    {
      id: "traffic-route-3",
      points: [point(-77.4, 42.4), point(77.4, 42.4), point(77.4, 113.6), point(-77.4, 113.6), point(-77.4, 42.4)]
    }
  ];
  const trafficRoutes = routeDefinitions.map((route) => {
    const points = route.points.map((p) => ({ x: p.x, z: p.z }));
    return { id: route.id, name: route.id, points, waypoints: points, path: points };
  });

  // Pedestrian loops follow the sidewalks around each city block.
  const pedDefinitions = [
    {
      id: "ped-route-1",
      points: [point(-70.6, 12.6), point(70.6, 12.6), point(70.6, 39.4), point(-70.6, 39.4), point(-70.6, 12.6)]
    },
    {
      id: "ped-route-2",
      points: [point(-70.6, 48.6), point(70.6, 48.6), point(70.6, 75.4), point(-70.6, 75.4), point(-70.6, 48.6)]
    },
    {
      id: "ped-route-3",
      points: [point(-70.6, 84.6), point(70.6, 84.6), point(70.6, 111.4), point(-70.6, 111.4), point(-70.6, 84.6)]
    }
  ];
  const pedRoutes = pedDefinitions.map((route) => {
    const points = route.points.map((p) => ({ x: p.x, z: p.z }));
    return { id: route.id, name: route.id, points, waypoints: points, path: points };
  });

  // Parked cars sit in the curb lane of each road. Variants rotate by index.
  const parkedPositions = [
    [-90, 10.2, Math.PI / 2, "sport"],
    [90, 10.2, -Math.PI / 2, "suv"],
    [-56, 45.8, Math.PI / 2, "compact"],
    [56, 45.8, -Math.PI / 2, "pickup"],
    [-90, 77.8, Math.PI / 2, "suv"],
    [90, 77.8, -Math.PI / 2, "sport"],
    [-30, 113.8, Math.PI / 2, "compact"],
    [30, 113.8, -Math.PI / 2, "pickup"]
  ];
  const carColors = ["#d64045", "#3b7ddd", "#f2c14e", "#7a9e7e", "#9b5de5", "#f77f00", "#4cc9f0", "#90be6d"];

  const parkedCars = parkedPositions.map(([x, z, yaw, variant], i) => ({
    id: `parked-car-${i + 1}`,
    type: "car",
    x,
    z,
    yaw,
    heading: yaw,
    variant,
    color: carColors[i % carColors.length],
    traffic: false,
    parked: true,
    stealable: true,
    enterable: true
  }));

  trafficRoutes.forEach((route, i) => {
    const start = route.points[0] || { x: 0, z: 0 };
    parkedCars.push({
      id: `traffic-car-${i + 1}`,
      type: "car",
      variant: ["sport", "suv", "compact", "pickup"][(parkedPositions.length + i) % 4],
      x: start.x,
      z: start.z,
      yaw: 0,
      heading: 0,
      color: carColors[(parkedPositions.length + i) % carColors.length],
      traffic: true,
      parked: false,
      stealable: false,
      enterable: false,
      routeId: route.id,
      routeIndex: i,
      route,
      routePoints: route.points,
      waypoints: route.points,
      routeProgress: 0
    });
  });

  const playerSpawn = { x: 0, z: 36.5, y: 0, yaw: 0 };
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
    roads,
    sidewalks,
    crosswalks,
    plazas,
    beach,
    ocean,
    ground,
    collisionBoxes,
    buildings,
    props,
    palms: props,
    lamps,
    spawns,
    trafficRoutes,
    pedRoutes,
    parkedCars
  };
}

export default buildWorldData;
