# Voxel Coastal City

A browser-based voxel 3D demo about walking, driving, and exploring a chunky
tropical coastal city. Built with **Vite** + **Three.js**.

> Characters and cars first, city atmosphere to follow.

## Features

- **Third-person over-the-shoulder camera** that stays behind your target at
  **yaw 0 = +Z forward**, mouse-controlled with pointer lock (no click-and-drag),
  look with the mouse, ESC to release.
- **Detailed voxel humans** (player + pedestrians): pixel face textures, caps,
  tank tops, shorts, sneakers, limbs, walk cycle synced to speed, idle sway.
- **Detailed voxel sports cars** (parked and ambient traffic): body, cabin, glass,
  pillars, bumpers, headlights/tail lights, spoilers, exhausts, wheels with rims.
- **Walk / sprint / drive**:
  - Walk on foot, sprint with `Shift`.
  - Approach a parked car and press `E` to hijack; press `E` again to exit.
  - Ambient traffic cars are not stealable.
- **Driving physics** with speed-scaled steering, drag, and **AABB/circle
  collision against buildings** (car radius tuned so it stops near building edges).
- **Chunky, voxel coastal city**: beaches, promenade, sidewalks, crosswalks,
  roads, storefronts with windows/awnings/signs, rooftops, utility boxes, palms,
  street lamps, a darker night lighting, a bright turquoise ocean, and a lighthouse.
- **Procedural pixel textures** (nearest-filtered) for asphalt, pavement, brick,
  stone, sand, grass, roof tiles, and glass, with seasonal shading.
- **SSAO, ACES filmic tone mapping, soft shadows**, and a tropical day-lighting
  rig; fog toward the ocean.
- HUD with the current mode, prompt, and live speed.

## Getting started

```bash
npm install
npm run dev            # starts Vite dev server (usually http://localhost:5173)
npm run build          # production build into dist/
npm run preview        # preview the production build
npm test               # vitest unit tests
```

Node **18+** recommended (the project uses Vite 5 and Three.js 0.164).

## Controls

- `WASD` — walk / steer (driving)
- `Shift` — sprint (on foot)
- `E` — enter / exit vehicle
- Mouse — look (click canvas to lock pointer; `ESC` to release)
- When driving: `W` throttle, `S` brake, `A`/`D` steer
- `Shift+R` reset? No; just reload the page to restart

## World layout

- Top-down coordinates in world units (`1 unit = 1 meter`).
- Spawn near the mid city grid, roads at `z ~= 8 / 30 / 44 / 124`,
  buildings laid out in rows from north to south, ocean as the southern
  boundary.
- Playable bounds and layout knobs live in `src/config/constants.js`
  (`WORLD.MIN_X..MAX_Z`) and `src/world/worldConfig.js`.

## Scene modules

- `src/main.js` — entry, loop, HUD, camera, input glue, dev-only
  `window.__voxelCity` QA handle.
- `src/world/` — `sceneBuilder.js` (materials, road, beach, ocean, buildings,
  palms, lamps), `worldConfig.js` (buildings/props/routes), `textures.js`,
  `characterModel.js`, `collision.js`.
- `src/peds/` — pedestrian entities and walking loops.
- `src/traffic/ambientCars.js`, `src/vehicles/` — car entities + vehicle physics
  (`Vehicle.js`) and car models (`carModel.js`).
- `src/camera/`, `src/input/`, `src/ui/`.
- `tests/` — unit tests for collision, player, vehicle, and carjacking.

## Tests / QA

- `npm test` runs Vitest over pure movement/physics helpers (23 tests).
- `import.meta.env.DEV` only: `window.__voxelCity` exposes `scene`,
  `camera`, `renderer`, `world`, `player`, `playerAvatar`, `cars`, `peds`, and
  `mouse` for browser-based screenshot QA.
- Use a headless browser with Swiftshader to capture screenshots and confirm
  there are no console errors.

## Known limitations

- No missions, money, police, weapons, or progression.
- Tropical coastal city focus; the ocean is a scene boundary only
  (no swimming/driving into water).
- Visual QA still depends on a real GPU screenshot review.

## Status

Active prototype. Characters and cars pass complete; expanded city, roads, ocean
and collision shipped in the most recent batch. Next pass targets further
art-deco facade detail and deeper coastal scenery.