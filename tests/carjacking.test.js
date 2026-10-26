import { describe, it, expect } from "vitest";
import {
  nearestVehicle,
  canEnter,
  exitPosition,
  INTERACT_RADIUS,
  EXIT_OFFSET
} from "../src/vehicles/carjacking.js";

describe("nearestVehicle", () => {
  it("returns nearest index within maxDistance", () => {
    const vehicles = [{ x: 5, z: 0 }, { x: 1, z: 0 }];
    expect(nearestVehicle({ x: 0, z: 0 }, vehicles, 10)).toBe(1);
  });

  it("returns -1 when no vehicles are in range", () => {
    const vehicles = [{ x: 5, z: 0, traffic: false, parked: true }];
    expect(nearestVehicle({ x: 0, z: 0 }, vehicles, 1)).toBe(-1);
  });

  it("supports player objects with a position property", () => {
    const vehicles = [{ x: 1, z: 0, traffic: false, parked: true }];
    expect(nearestVehicle({ position: { x: 0, z: 0 } }, vehicles, 2.5)).toBe(0);
  });

  it("uses INTERACT_RADIUS by default", () => {
    const vehicles = [{ x: 10, z: 0, traffic: false, parked: true }];
    expect(nearestVehicle({ x: 0, z: 0 }, vehicles)).toBe(-1);
  });
});

describe("canEnter", () => {
  it("allows a parked non-traffic vehicle within radius", () => {
    const vehicle = { x: 1, z: 1, traffic: false, parked: true };
    expect(canEnter({ position: { x: 0, z: 0 } }, vehicle)).toBe(true);
  });

  it("rejects traffic vehicles", () => {
    const vehicle = { x: 1, z: 1, traffic: true, parked: true };
    expect(canEnter({ x: 0, z: 0 }, vehicle)).toBe(false);
  });

  it("rejects destroyed vehicles", () => {
    const vehicle = { x: 1, z: 1, traffic: false, parked: true, destroyed: true };
    expect(canEnter({ x: 0, z: 0 }, vehicle)).toBe(false);
  });

  it("rejects vehicles outside INTERACT_RADIUS", () => {
    const vehicle = { x: 3, z: 0, traffic: false, parked: true };
    expect(canEnter({ x: 0, z: 0 }, vehicle)).toBe(false);
  });

  it("rejects vehicles that are moving", () => {
    const vehicle = { x: 1, z: 0, traffic: false, moving: true };
    expect(canEnter({ x: 0, z: 0 }, vehicle)).toBe(false);
  });
});

describe("exitPosition", () => {
  it("offsets 0.8m to the right at yaw 0", () => {
    const position = exitPosition({ x: 2, z: 3, yaw: 0 });
    expect(position.x).toBeCloseTo(2.8, 6);
    expect(position.z).toBeCloseTo(3, 6);
  });

  it("uses right vector for yaw pi/2", () => {
    const position = exitPosition({ x: 2, z: 3, yaw: Math.PI / 2 });
    expect(position.x).toBeCloseTo(2, 6);
    expect(position.z).toBeCloseTo(2.2, 6);
  });
});

describe("constants", () => {
  it("exposes interaction constants", () => {
    expect(INTERACT_RADIUS).toBe(2.5);
    expect(EXIT_OFFSET).toBe(0.8);
  });
});