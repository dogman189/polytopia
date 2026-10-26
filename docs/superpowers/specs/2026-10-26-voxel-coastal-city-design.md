# Design: Voxel Coastal City — Browser Free-Roam Game

- Date: 2026-10-26
- Status: Draft (pending builder check + approval)
- Author (in conversation): human + OpenAgent

## Intent & Why

Build a small, playable 3D "toy" coastal city in the browser that feels
like the spirit of Grand Theft Auto without the scope: you can walk or
drive around a stylized tropical neighborhood and steal a car whenever you
want. Success is "I load the page, immediately recognize a cute blocky
tropical beach town, and find myself driving around smiling within 30
seconds." Visual vibe and explorable city layout are the dominant goal
right now, not mission depth.

## Goals

- Browser loads the game with no install; a single URL.
- Pascal/shootable? No — third-person over-the-shoulder camera; can
  rotate view, but default is the character's back.
- Walk on foot with collision against buildings/road boundary.
- Enter/exit (steal) nearby cars with a single key press.
- Arcade driving with steering/throttle/brake, speed-appropriate.
- Ambient traffic cars on roads (looping).
- Pedestrians strolling on sidewalks (decoration).
- Voxel-ish (chunky block) buildings, street signs, props.
- Tropical coastal flavor, ocean as visual backdrop.
- Target ~4 blocks deep × short coastal strip; cross on foot in ~60s.

## Non-goals (explicitly out of scope for v1)

- Missions, objectives, scoring, money, or progression.
- Wanted level / police / violence (no weapons, no running over physics
  effects for pedestrians).
- Vehicle deformation, damage model, helicopter/boat vehicles.
- Multiplayer, save state, persistence, mobile support.
- Physics engine beyond simple movement curves.
- AI navigation (pedestrians use waypoints, not navmesh pathfinding).

## Anti-goals (what would make this a failure even if it "works")

- City feels empty or same-y; no landmarks to orient toward.
- Driving feels like sliding on ice or jerky; bad turning at speed.
- Entering a car requires precision lining up; feels fiddly.
- Framerate below 30fps on a mid laptop; too much geometry.

## Constraints

- Tech default (my call): Vite + JavaScript (no TypeScript) + Three.js,
  ES modules. Static output. No backend.
- Web target: desktop Chrome/Firefox/Edge; modern GPUs.
- Performance: 60fps at 1920×1080 for ~4 blocks of voxel buildings.
- No external asset pipelines beyond plain .glb/.png in /assets if needed; prefer procedural geometry.
- Delivery: a repo folder with `npm run dev` and `npm run build`.

## Decisions made (by user unless marked as agent's call)

- 3D over-the-shoulder perspective (user).
- Voxel/chunky aesthetic (user).
- Tropical coastal city (user).
- People only stroll for now (user).
- Ocean is scenic boundary only — no swimming, no driving into water
  (user). Buildings/water boundary prevents crossing.
- Agent's call: arcade physics via simple movement curves instead of a
  physics engine; readability over fidelity.
- Agent's call: Three.js + Vite + plain JS (no TS) to cut friction.
- Agent's call: 4 × 4 block hand-authored layout with a few landmark
  shapes (lighthouse, pier, fuel station), procedural prop detail.
- Agent's call: cars limited to ambient "pedestrian cars" that cruise
  simple loops; no pathfinding.
- Agent's call: camera is a follow camera with mouse-drag yaw; no
  pointer lock in v1 (lower friction, less input jank). Agent can upgrade
  if user wants.

## Architecture overview

Modules (each a separate file in src/):

- `main.js` — renderer, scene, RAF loop, resize.
- `world/sceneBuilder.js` — builds voxel buildings, roads, ground,
  props, signs, ocean plane, sky. Returns a world data object with
  collision boxes and waypoints.
- `player/playerController.js` — foot movement input, collision vs world.
- `vehicles/vehicle.js` — Vehicle class (position, velocity,
  steering, accel, brake integration).
- `vehicles/carjacking.js` — proximity detection, E-key entry/exit logic,
  hand-off between player and vehicle control.
- `traffic/ambientCars.js` — loops a handful of cars over waypoints.
- `peds/pedestrians.js` — loops pedestrians along sidewalks.
- `camera/followCamera.js` — third-person follow + mouse yaw.
- `input/keyboard.js`, `input/mouse.js` — central input state.
- `ui/hud.js` — simple overlay (controls, "Press E", speed readout).

Data: world defined as JSON-like configuration (block size = 1m,
grid size 16×16 for 4 blocks). Roads are axis-aligned segments. Buildings
have (x, z, w, h, depth, palette). Props/signs are instances. Pedestrian
routes are arrays of waypoints on sidewalks.

## Voxel style

- Core unit voxel = 1m cube (BoxGeometry), grouped instanced by color/material.
- Buildings: stacked boxes or instanced cubic columns; facades have awning
  pieces; rooftops flat.
- Color palette: pastel/white walls, terracotta roofs for tropical vibe;
  bright signage.
- Materials: MeshStandardMaterial with flat-ish shading (roughness 0.9,
  no metallic). Simpler = fast.
- Optional: real voxel engine not required (voxel effect from cubes).

## Gameplay specifics

### Controls

- Foot: WASD move, Space (optional sprint), E interact, mouse drag to
  rotate camera.
- Vehicle: W accel, S brake/reverse, A/D steer, E exit.
- Global ESC to release cursor / open pause (pause shows controls).

### Car enter/exit

- When on foot and within 2.5m of a vehicle's seat point, show
  "Press E to enter" above the screen center.
- E mounts player: snap to seat position; hide pedestrian; take control.
- E exits: teleport player 0.7m beside the door; show pedestrian; if
  vehicle is moving, give a small throw velocity (small momentum drop).

### Driving feel

- Steering at low speed: responsive, max turn rate high; at high speed:
  reduced turn rate, so no insta-U-turns.
- Acceleration capped to ~60 km/h; brake is strong. Simple friction drag
  proportional to speed.
- Surface is flat ground only; suspension optional (Agent call: hard
  stick to ground; no bounce).

## City layout (agent's call, can be changed by builder)

- 4 city blocks in a row parallel to beach: street along ocean (east),
  two east-west streets, three north-south streets.
- One main intersection; a park corner; petrol station; pier; lighthouse
  at sea end.
- Buildings of 1–4 stories; alleys between; sidewalks 2m wide.
- Parked cars distributed on streets (some stealable empty, some with
  flavor label only).
- Roads: central lane, no lane splitting physics.

## Out-of-scope visual realism (optional future work)

- Shadows (optional directional sun with shadow atlas if perf ok).
- Sky gradient + Sun + ambient.
- Water plane with subtle scrolling normal (nice-to-have).

## Success criteria (checklist for done v1)

1. `npm run dev` boots a 3D third-person scene.
2. City clearly reads as a tropical coastal neighborhood; ocean visible.
3. Foot movement + collision feels okay, can walk the whole map.
4. Enter/exit a car with E and immediately drive; steering runs.
5. At least 3 ambient looping cars and 8 pedestrians visible.
6. No frame drops below 30fps in a typical 4-block view.
7. Controls overlay present.

## What's left to the builder (intentionally unspecified)

- Exact jittering/tuning of steering curves, acceleration constants.
- Procedural generation vs hand JSON authoring for buildings.
- Precise color palette hex values.
- Shadow/lighting polish and water material.
- Edge cases: collision depth of stacked buildings, etc.

## Open questions (resolved 2026-10-26)

1. **Scale:** city sized for ~1 minute on foot to cross. (user)
2. **Collision while driving:** yes — terrain (AABB) collision against
   buildings/props/boundary; simple, no bounce. (user)
3. **Stealability of moving traffic:** only parked/idling cars. Moving
   ambient traffic is not interactable. (user)

## builder-check notes

Resolved all three builder questions; updated above. No new "theirs"
questions added. Outstanding items in "What's left to the builder" remain by
design.
