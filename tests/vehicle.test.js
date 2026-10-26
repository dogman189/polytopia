import { describe, it, expect } from "vitest";
import { createVehicle, stepVehicle } from "../src/vehicles/Vehicle.js";
import { buildWorldData } from "../src/world/worldConfig.js";
import { CONSTANTS } from "../src/config/constants.js";

const VEHICLE = CONSTANTS.VEHICLE;

describe("createVehicle/stepVehicle", () => {
  it("accelerates and caps at VEHICLE.MAX_SPEED", () => {
    const world = buildWorldData();
    const v = createVehicle({ x: 0, z: 24, yaw: 0 });
    for (let i = 0; i < 100; i += 1) {
      stepVehicle(v, { throttle: true }, 0.1, world);
    }
    expect(v.speed).toBeLessThanOrEqual(VEHICLE.MAX_SPEED + 1e-6);
    expect(v.speed).toBeGreaterThan(VEHICLE.MAX_SPEED - 0.5);
  });

  it("does not change yaw at zero speed with steering input", () => {
    const world = buildWorldData();
    const v = createVehicle({ x: 0, z: 24, yaw: 1.25 });
    const yaw0 = v.yaw;
    stepVehicle(v, { left: true }, 0.1, world);
    stepVehicle(v, { right: true }, 0.1, world);
    expect(v.yaw).toBeCloseTo(yaw0, 10);
    expect(v.speed).toBe(0);
  });

  it("clamps near the east boundary", () => {
    const world = buildWorldData();
    const v = createVehicle({ x: 55, z: 24, yaw: 0 });
    stepVehicle(v, { throttle: true }, 1, world);
    const radius = 2.2;
    expect(v.x).toBeLessThanOrEqual(world.bounds.maxX - radius + 1e-6);
    expect(v.z).toBeDefined();
  });

  it("arrests movement against a collision box", () => {
    const world = {
      bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
      collisionBoxes: [{ minX: -1, maxX: 1, minZ: 3, maxZ: 5 }]
    };
    const v = createVehicle({ x: 0, z: 0, yaw: 0 });
    const beforeZ = v.z;
    stepVehicle(v, { throttle: true }, 1, world);
    // Must not pass through the box (center z=4) plus vehicle radius.
    expect(v.z).toBeLessThan(3 - 2.2 + 1e-6);
    expect(v.z).toBeGreaterThanOrEqual(beforeZ - 1e-9);
  });
});