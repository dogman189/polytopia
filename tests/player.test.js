import { describe, it, expect } from "vitest";
import { stepFoot } from "../src/player/playerController.js";
import { buildWorldData } from "../src/world/worldConfig.js";

describe("stepFoot", () => {
  it("applies mouseYaw directly to state.yaw", () => {
    const world = buildWorldData();
    const state = { position: { x: 0, y: 0, z: 24 }, yaw: 0.4, velocity: { x: 0, z: 0 } };
    stepFoot(state, { mouseYaw: 2.75 }, 0.1, world);
    expect(state.yaw).toBe(2.75);
  });

  it("keeps the player inside world bounds", () => {
    const world = buildWorldData();
    const state = { position: { x: 0, y: 0, z: 0 }, yaw: 0, velocity: { x: 0, z: 0 } };
    stepFoot(state, { forward: true, shift: true }, 100, world);
    const b = world.bounds;
    const r = 0.4;
    expect(state.position.x).toBeGreaterThanOrEqual(b.minX + r - 1e-6);
    expect(state.position.x).toBeLessThanOrEqual(b.maxX - r + 1e-6);
    expect(state.position.z).toBeGreaterThanOrEqual(b.minZ + r - 1e-6);
    expect(state.position.z).toBeLessThanOrEqual(b.maxZ - r + 1e-6);
  });

  it("produces movement and velocity from forward input", () => {
    const world = buildWorldData();
    const state = { position: { x: 0, y: 0, z: 36.5 }, yaw: 0, velocity: { x: 0, z: 0 } };
    stepFoot(state, { forward: true }, 1, world);
    expect(Math.hypot(state.velocity.x, state.velocity.z)).toBeGreaterThan(0);
    expect(state.position.z).toBeGreaterThan(36.5);
  });

  it("uses collision radius against world boxes", () => {
    const world = buildWorldData();
    const townHall = world.buildings.find((b) => b.id === "town-hall");
    expect(townHall).toBeDefined();
    // Stand just north of the town hall, facing into it.
    const frontZ = townHall.z + townHall.d / 2;
    const state = { position: { x: townHall.x, y: 0, z: frontZ + 1.2 }, yaw: Math.PI, velocity: { x: 0, z: 0 } };
    // prime velocity by a small step, then a big step into the building
    stepFoot(state, { forward: true }, 10, world);
    // z must not enter the town-hall footprint plus the player radius
    expect(state.position.z).toBeGreaterThanOrEqual(frontZ + 0.4 - 1e-6);
  });
});