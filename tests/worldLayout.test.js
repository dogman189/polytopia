import { describe, it, expect } from "vitest";
import { buildWorldData } from "../src/world/worldConfig.js";
import { CONSTANTS } from "../src/config/constants.js";

const world = buildWorldData();

function buildingRect(b) {
  return {
    minX: b.x - b.w / 2,
    maxX: b.x + b.w / 2,
    minZ: b.z - b.d / 2,
    maxZ: b.z + b.d / 2
  };
}

function overlapArea(a, b) {
  const w = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const d = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
  return w > 0 && d > 0 ? w * d : 0;
}

function pointInRect(x, z, rect, pad = 0) {
  return x >= rect.minX - pad && x <= rect.maxX + pad &&
    z >= rect.minZ - pad && z <= rect.maxZ + pad;
}

function rectFromCenter(r) {
  return {
    minX: r.x - r.w / 2,
    maxX: r.x + r.w / 2,
    minZ: r.z - r.d / 2,
    maxZ: r.z + r.d / 2
  };
}

function pointInAny(x, z, rects, pad = 0) {
  return rects.some((r) => pointInRect(x, z, rectFromCenter(r), pad));
}

function sampleSegment(a, b, step, predicate) {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  const count = Math.max(1, Math.ceil(length / step));
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    if (!predicate(x, z)) return { x, z };
  }
  return null;
}

const roadRects = (world.roads || []).map(rectFromCenter);
const sidewalkRects = (world.sidewalks || []).map(rectFromCenter);
const plazaRects = (world.plazas || []).map(rectFromCenter);

describe("world layout", () => {
  it("builds roads that cover the full map width and connect the coast", () => {
    const { minX, maxX } = world.bounds;
    const horizontal = (world.roads || []).filter((r) => r.orientation === "horizontal");
    const vertical = (world.roads || []).filter((r) => r.orientation === "vertical");

    expect(horizontal.length).toBeGreaterThanOrEqual(4);
    for (const road of horizontal) {
      expect(road.x - road.w / 2).toBeLessThanOrEqual(minX + 0.01);
      expect(road.x + road.w / 2).toBeGreaterThanOrEqual(maxX - 0.01);
      expect(road.d).toBeGreaterThanOrEqual(6);
    }
    expect(vertical.length).toBeGreaterThanOrEqual(2);
    for (const road of vertical) {
      expect(road.d).toBeGreaterThanOrEqual(110);
    }
  });

  it("keeps every building out of every other building", () => {
    const buildings = world.buildings || [];
    for (let i = 0; i < buildings.length; i += 1) {
      for (let j = i + 1; j < buildings.length; j += 1) {
        const a = buildings[i];
        const b = buildings[j];
        const area = overlapArea(buildingRect(a), buildingRect(b));
        expect(area, `${a.id} overlaps ${b.id}`).toBeLessThanOrEqual(0.05);
      }
    }
  });

  it("keeps buildings off roads and sidewalks", () => {
    for (const b of world.buildings || []) {
      const rect = buildingRect(b);
      for (const road of roadRects) {
        expect(overlapArea(rect, road), `${b.id} overlaps a road`).toBeLessThanOrEqual(0.05);
      }
      for (const walk of sidewalkRects) {
        expect(overlapArea(rect, walk), `${b.id} overlaps a sidewalk`).toBeLessThanOrEqual(0.05);
      }
    }
  });

  it("places parked cars on a road", () => {
    const parked = (world.parkedCars || []).filter((c) => !c.traffic);
    expect(parked.length).toBeGreaterThanOrEqual(8);
    for (const car of parked) {
      expect(pointInAny(car.x, car.z, world.roads || []), `${car.id} is off-road`).toBe(true);
    }
  });

  it("keeps traffic routes on roads for every segment", () => {
    for (const route of world.trafficRoutes || []) {
      const points = route.points || [];
      for (let i = 0; i < points.length - 1; i += 1) {
        const off = sampleSegment(points[i], points[i + 1], 2, (x, z) => pointInAny(x, z, world.roads || []));
        expect(off, `${route.id} leaves the road at ${JSON.stringify(off)}`).toBeNull();
      }
    }
  });

  it("keeps pedestrian routes on sidewalks and plazas", () => {
    for (const route of world.pedRoutes || []) {
      const points = route.points || [];
      for (let i = 0; i < points.length - 1; i += 1) {
        const off = sampleSegment(
          points[i],
          points[i + 1],
          1,
          (x, z) => pointInAny(x, z, world.sidewalks || []) || pointInAny(x, z, world.plazas || [])
        );
        expect(off, `${route.id} leaves the sidewalk at ${JSON.stringify(off)}`).toBeNull();
      }
    }
  });

  it("spawns the player in a clear plaza", () => {
    const spawn = world.spawns.player;
    expect(pointInAny(spawn.x, spawn.z, world.plazas || [])).toBe(true);
    for (const box of world.collisionBoxes || []) {
      const inside = spawn.x > box.minX - CONSTANTS.PLAYER.RADIUS &&
        spawn.x < box.maxX + CONSTANTS.PLAYER.RADIUS &&
        spawn.z > box.minZ - CONSTANTS.PLAYER.RADIUS &&
        spawn.z < box.maxZ + CONSTANTS.PLAYER.RADIUS;
      expect(inside, `spawn overlaps ${box.id}`).toBe(false);
    }
    // Nothing blocking the view straight ahead.
    const forward = { minX: spawn.x - 1, maxX: spawn.x + 1, minZ: spawn.z + 0.5, maxZ: spawn.z + 7 };
    for (const b of world.buildings || []) {
      expect(overlapArea(forward, buildingRect(b)), `${b.id} blocks the spawn view`).toBeLessThanOrEqual(0.05);
    }
  });

  it("orders the ground, beach, ocean wall and water correctly", () => {
    const beach = world.beach;
    const ocean = world.ocean;
    const wall = ocean.wall;
    expect(world.ground.maxZ).toBeLessThanOrEqual(beach.minZ + 0.01);
    expect(beach.maxZ).toBeLessThanOrEqual(ocean.minZ + 0.01);
    expect(wall.minZ).toBeGreaterThanOrEqual(beach.minZ);
    expect(wall.minZ).toBeLessThanOrEqual(ocean.maxZ);
    expect(wall.minZ).toBeGreaterThanOrEqual(120);
  });

  it("puts the lighthouse and pier on the coast", () => {
    const lighthouse = world.buildings.find((b) => b.id === "lighthouse");
    const pier = world.buildings.find((b) => b.id === "pier");
    expect(lighthouse.z).toBeGreaterThanOrEqual(120);
    expect(pier.z).toBeGreaterThanOrEqual(130);
  });

  it("keeps palms and lamps off the roads", () => {
    for (const palm of world.props || []) {
      expect(pointInAny(palm.x, palm.z, world.roads || []), `${palm.id} is on a road`).toBe(false);
      for (const b of world.buildings || []) {
        expect(overlapArea(
          { minX: palm.x - 0.3, maxX: palm.x + 0.3, minZ: palm.z - 0.3, maxZ: palm.z + 0.3 },
          buildingRect(b)
        ), `${palm.id} overlaps ${b.id}`).toBeLessThanOrEqual(0.01);
      }
    }
    for (const lamp of world.lamps || []) {
      expect(pointInAny(lamp.x, lamp.z, world.roads || []), `${lamp.id} is on a road`).toBe(false);
    }
  });

  it("keeps every collision box aligned with a building footprint and height", () => {
    for (const b of world.buildings || []) {
      const box = (world.collisionBoxes || []).find((c) => c.id === b.id);
      expect(box, `${b.id} has no collision box`).toBeDefined();
      expect(box.minX).toBeCloseTo(b.x - b.w / 2, 5);
      expect(box.maxX).toBeCloseTo(b.x + b.w / 2, 5);
      expect(box.minZ).toBeCloseTo(b.z - b.d / 2, 5);
      expect(box.maxZ).toBeCloseTo(b.z + b.d / 2, 5);
      expect(box.maxY).toBeCloseTo(b.h, 5);
    }
  });

  it("covers all requested building types", () => {
    const types = new Set((world.buildings || []).map((b) => b.type));
    for (const type of ["storefront", "residential", "hotel", "tower", "warehouse", "house", "retail-mall", "pavilion", "utility", "landmark"]) {
      expect(types.has(type), `missing building type ${type}`).toBe(true);
    }
  });
});
