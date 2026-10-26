import { describe, it, expect } from "vitest";
import { resolveMovement } from "../src/world/collision.js";

describe("resolveMovement", () => {
  it("clamps to bounds without crossing", () => {
    const bounds = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
    const res = resolveMovement({ x: 0, z: 0 }, { x: 10, z: 0 }, 0.25, [], bounds);
    expect(res.x).toBeCloseTo(0.75, 5);
    expect(res.z).toBeCloseTo(0, 5);
  });

  it("slides along an AABB instead of embedding", () => {
    const bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
    const box = { minX: 0, maxX: 2, minZ: 0, maxZ: 2 };
    const prev = { x: -0.9, z: 0.5 };
    const next = { x: 0.9, z: 1.5 };
    const res = resolveMovement(prev, next, 0.4, [box], bounds);
    // Horizontal motion is blocked, vertical motion still happens (slide).
    expect(res.x).toBeCloseTo(prev.x, 5);
    expect(res.z).toBeCloseTo(next.z, 5);

    // resulting circle must not overlap the box
    const closestX = Math.min(Math.max(res.x, box.minX), box.maxX);
    const closestZ = Math.min(Math.max(res.z, box.minZ), box.maxZ);
    const distSq = (res.x - closestX) ** 2 + (res.z - closestZ) ** 2;
    expect(distSq).toBeGreaterThanOrEqual(0.4 * 0.4 - 1e-9);
  });

  it("handles boundary on both axes", () => {
    const bounds = { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };
    const res = resolveMovement({ x: 1.9, z: 1.9 }, { x: 5, z: 5 }, 0.2, [], bounds);
    expect(res.x).toBeCloseTo(1.8, 5);
    expect(res.z).toBeCloseTo(1.8, 5);
  });
});