# Voxel Coastal City Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser 3D voxel-ish tropical coastal city where the player can walk, steal an idling car with E, drive it, and explore.

**Architecture:** Vite + Three.js ES-module web app split into focused modules: config/input/state, pure collision and vehicle math with Vitest targets, world data + procedural scene builder, player/vehicle/camera controllers, ambient traffic/pedestrians, and a thin orchestrator in `main.js`. No backend or physics engine.

**Tech Stack:** Node 18+, Vite 5, Three.js 0.164, Vitest 1.6, plain JavaScript.

**Spec:** `docs/superpowers/specs/2026-10-26-voxel-coastal-city-design.md`

## Global Constraints

- 1 world unit = 1 meter; voxel block size ~2 units.
- Playable map ~120 x 60; aim for ~60 seconds on foot.
- Target 60 FPS, simple loop entities (no navmesh).
- Desktop Chrome/Firefox/Edge, keyboard + mouse.
- Scripts: `npm run dev`, `npm run build`, `npm run preview`, `npm run test`.
- One production dependency (`three`).

## Review Focus

- Pressing E must select the nearest parked or idling car.
- Entering/exiting should not drop the player in a wall.
- Driving near zero velocity should not spin the car.
- Boundary driving should stop at ocean/city edges.
- Mode transitions should clear stale movement/input state.
- Browser blur should not leave movement or dragged camera stuck.
- These are pinned by tests/input handlers in Tasks 2, 5, 6, 7, 9.

---

### Task 1: Project scaffold

**Files:** `package.json`, `index.html`, `vite.config.js`, `src/style.css`, `src/main.js`, `.gitignore`

- [ ] **Step 1:** Create `package.json` with scripts dev/build/preview/test and dependencies Vite, Vitest, jsdom, Three.js.
- [ ] **Step 2:** Create `index.html` with root `#app`, module script to `/src/main.js`.
- [ ] **Step 3:** Create `vite.config.js` with jsdom test environment.
- [ ] **Step 4:** Create `src/style.css` full-screen canvas and HUD styling.
- [ ] **Step 5:** Create placeholder `src/main.js` Three.js scene with one rotating box and controls overlay root.
- [ ] **Step 6:** Create `.gitignore`.
- [ ] **Step 7:** Run `npm install`, `npm run test`, `npm run build`; expected pass.
- [ ] **Step 8:** Commit `chore: scaffold vite three game`.

### Task 2: Constants, collision, input, blur handling

**Files:** `src/config/constants.js`, `src/world/collision.js`, `tests/collision.test.js`, `src/input/keyboard.js`, `src/input/mouse.js`

**Interfaces:** `CONSTANTS`; `resolveMovement(prev,next,radius,boxes,bounds)`; `createKeyboardState`; `createMouseState(canvas)`.

- [ ] **Step 1:** Write `tests/collision.test.js` for boundary and slide test.
- [ ] **Step 2:** Run test; expected fail.
- [ ] **Step 3:** Implement `resolveMovement` responding radius vs boxes and bounds.
- [ ] **Step 4:** Implement `CONSTANTS` with world, player, vehicle, interaction, counts.
- [ ] **Step 5:** Implement keyboard state set with blur clear.
- [ ] **Step 6:** Implement mouse state with drag yaw and blur reset.
- [ ] **Step 7:** Run collision test; pass.
- [ ] **Step 8:** Commit `feat: constants collision input`.

### Task 3: World data and 1-minute map

**Files:** `src/world/worldConfig.js`

**Interfaces:** `buildWorldData()` returns `{ bounds, collisionBoxes, buildings, props, ocean, spawns, trafficRoutes, pedRoutes, parkedCars }`.

- [ ] **Step 1:** Create world data mapping. Use four anchors (town hall, market, lighthouse, pier), 11 storefronts each on two street rows, 10 palms, 8 parked cars, 3 traffic routes, 2 pedestrian loops, wall ocean boundary.
- [ ] **Step 2:** Ensure traffic cars are appended separately as `traffic: true`.
- [ ] **Step 3:** Run `npm run test`; pass.
- [ ] **Step 4:** Commit `feat: world data model`.

### Task 4: Scene builder rendering world

**Files:** `src/world/sceneBuilder.js`, `src/main.js`

**Interfaces:** `buildScene(scene, world, { renderer })` returns `{ group, buildingsGroup, ocean }`.

- [ ] **Step 1:** Implement scene: plane ground, blue ocean, retaining wall, buildings and rooftops, palms, hemi + directional light, standard materials.
- [ ] **Step 2:** Update `src/main.js` to build world and scene (remove dummy box).
- [ ] **Step 3:** Run `npm run build`; pass.
- [ ] **Step 4:** Manual smoke `npm run dev`; verify town visible.
- [ ] **Step 5:** Commit `feat: scene builder`.

### Task 5: Player movement

**Files:** `src/player/playerController.js`, `tests/player.test.js`

**Interfaces:** `stepFoot(state, input, dt, world)` mutates and returns state.

- [ ] **Step 1:** Write tests for bounds and direct yaw.
- [ ] **Step 2:** Run test; fail.
- [ ] **Step 3:** Implement WASD movement in yaw space, velocity easing, and collision resolution.
- [ ] **Step 4:** Run tests; pass.
- [ ] **Step 5:** Commit `feat: player controller`.

### Task 6: Vehicle physics

**Files:** `src/vehicles/Vehicle.js`, `tests/vehicle.test.js`

**Interfaces:** `createVehicle({x,z,yaw})`, `stepVehicle(vehicle, input, dt, world)`.

- [ ] **Step 1:** Write tests for speed cap, zero-speed no spin, bounds.
- [ ] **Step 2:** Run test; fail.
- [ ] **Step 3:** Implement throttle/brake, drag, speed-scaled steering, bounds/collision.
- [ ] **Step 4:** Run tests; pass.
- [ ] **Step 5:** Commit `feat: vehicle physics`.

### Task 7: Carjacking logic

**Files:** `src/vehicles/carjacking.js`, `tests/carjacking.test.js`

**Interfaces:** `nearestVehicle(playerPos, vehicles, maxDistance)`, `canEnter(player, vehicle)`, `exitPosition(vehicle)`.

- [ ] **Step 1:** Write tests for nearest selection and exit side.
- [ ] **Step 2:** Run test; fail.
- [ ] **Step 3:** Implement carjacking helper functions (2.5 m max, right-side exit offset 0.8 m).
- [ ] **Step 4:** Run tests; pass.
- [ ] **Step 5:** Commit `feat: carjacking helpers`.

### Task 8: Camera, traffic, pedestrians

**Files:** `src/camera/followCamera.js`, `src/traffic/ambientCars.js`, `src/peds/pedestrians.js`

**Interfaces:** `createCarEntities(world, scene)`, `updateTraffic(cars, dt)`, `createPedestrianEntities(world, scene)`, `updatePedestrians(Peds, dt)`.

- [ ] **Step 1:** Implement third-person draggable follow camera.
- [ ] **Step 2:** Implement traffic car entity loops using routes and simple mesh updates.
- [ ] **Step 3:** Implement pedestrian route loops with bobbing.
- [ ] **Step 4:** Build verification (no tests besides build).
- [ ] **Step 5:** Commit `feat: camera traffic pedestrians`.

### Task 9: HUD and game orchestrator

**Files:** `src/ui/hud.js`, `src/main.js`

- [ ] **Step 1:** Add HUD overlay controls/speed prompt.
- [ ] **Step 2:** Rewrite `main.js` to combine modules: keyboard/mouse, world, scene, player, car entities, peds, camera, mode state (on foot/driving), rising-edge E carjacking, camera target, HUD update. Clamp dt at 0.05.
- [ ] **Step 3:** Implement debounced transitions and exit teleport via `exitPosition` + collision.
- [ ] **Step 4:** Manual smoke test enter/exit/render; console no errors.
- [ ] **Step 5:** Commit `feat: game integration`.

### Task 10: Performance polish and verification

**Files:** modify tuning files constants/scene/worldConfig as needed.

- [ ] **Step 1:** Manual testing tuning steering feel, walking speed, geometry visibility.
- [ ] **Step 2:** Ensure no shadows heavy, optionally low shadow only low-pressure.
- [ ] **Step 3:** Run `npm run test`, `npm run build`, `npm run preview` and record results.
- [ ] **Step 4:** Commit `feat: verification polish`.

## Notes

- Store owner-only cars `(traffic: false)` are enterable.
- Ocean wall boundary handled in collision boxes.
- Manual verification accounts for no E2E suite.