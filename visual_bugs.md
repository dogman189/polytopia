# Visual Bugs — Voxel Coastal City (Polytopia)

This document catalogs the visual glitches found during the visual-fix pass and their status (fixed / remaining / intentional).

## Fixed in this pass

### Layout / world composition

**1. Roads did not span the full map**
- *Bug:* Horizontal roads were only 120 units wide and stopped at `x=±60` on a 200-wide map. Vertical roads stopped at `z=84`, leaving half the city disconnected.
- *Fix:* Horizontal roads now run full width (`x=-100..100`) at `z=8, 44, 80, 116`. Vertical roads at `x=±75.2` span `z≈4.5..119.5` and join all horizontal roads. Intersections have asphalt patches covering crossing lane markings.

**2. Buildings overlapped roads and each other**
- *Bug:* `mall-1` (40×20) sat directly on the main road. Apartments, hotel, towers, library, warehouses, mall, pavilion and coast houses overlapped storefront rows and each other.
- *Fix:* All 71 buildings were repositioned into clean walkable blocks (A `z=13.9..38.1`, B `z=49.9..74.1`, C `z=85.9..110.1`). Storefront rows face their nearest road. Building-vs-building overlap tested at <0.05 units. Locked by `tests/worldLayout.test.js`.

**3. Ocean wall split the city in half**
- *Bug:* Invisible ocean collision wall at `z=60..62` cut through the middle of the map; `world.ocean.minZ` was stale at 60. Ground plane ran to `z=157.5`, covering the ocean plane and leaving a grass strip between sand and water.
- *Fix:* Ground stops at `z=121.7`. Beach `z=121.7..133.2`. Ocean begins at `z=133.2`. Ocean wall sits at the coast (`z=133.2..133.8`), not in the city. Ocean is visible beyond the beach.

**4. Beach and coastal road overlapped**
- *Bug:* Beach at `z=117..135` was cut by a coastal road at `z=124`; sea wall at `z=126` sat on the road.
- *Fix:* Beach moved to `z=121.7..133.2`. Coastal road at `z=116` stays on land. Sea wall at `z≈133.5` beyond beach. Foam line marks the shoreline.

**5. Lighthouse and pier were inland**
- *Bug:* Lighthouse at `(48, 56)` and pier at `(12, 59)` sat in the middle of the city.
- *Fix:* Lighthouse at `(92, 126)` on the west coast. Pier at `(12, 137)` extending into the ocean.

**6. Spawn stared into a wall**
- *Bug:* Spawn at `(0, 36)` faced a storefront wall 4 units away.
- *Fix:* Spawn moved to `(0, 36.5)` in the open town-hall plaza, facing `+Z` toward open space.

### Traffic / pedestrians / parked cars

**7. Traffic routes drove on grass**
- *Bug:* Route B drove on grass at `z=16`; Route A reached `z=100` off-road.
- *Fix:* All traffic route segments constrained to road bands. Verified every segment lands inside a road rect (locked by test).

**8. Pedestrians walked on roads/grass**
- *Bug:* Peds at `z=30, 86, 100` walked off sidewalks.
- *Fix:* Pedestrian loops follow sidewalks around each block. Verified segment-by-segment against sidewalks/plazas.

**9. Parked cars sat on grass**
- *Bug:* Cars `1/4` at `x=±90` and `5/7` at `x=-70/50` were on grass.
- *Fix:* All 8 parked cars now sit in the curb lane of roads. Traffic cars spawn at route start points inside roads.

### Props

**10. Palms grew in the road**
- *Bug:* Palms at `z=5` and `z=30` grew in traffic lanes.
- *Fix:* Palms relocated to the beach line (`z=124.5`) and the town-hall plaza (`z=31.5, 37`). All props verified clear of roads and buildings.

**11. Palm model was a flat green pinwheel**
- *Bug:* Palm rendered as a flat cross-shaped billboard with no trunk thickness or frond volume.
- *Fix:* New procedural palm with curved segmented trunk (bends slightly), crown, 9 drooping fronds, and coconuts. Cached geometry per frond size.

**12. Lamps stood in roads**
- *Bug:* Lamps at `z=27.8` stood in traffic lanes; spacing didn't follow the expanded grid.
- *Fix:* Lamps placed on sidewalks at `z=13.1, 26, 48.0, 62, 74.7, 98, 120.6`. Horizontal sidewalks split at vertical-road intersections so pavement never paints across asphalt.

### Building rendering

**13. Every building was the same brick box with a red roof**
- *Bug:* Type was ignored; storefronts, towers, warehouses and houses all used the identical geometry/material.
- *Fix:* Type-specific facades:
  - Tower: curtain-wall grid with lit/dark window randomization, corner bands, clock beacon, antenna.
  - Hotel: balconies, canopy, sign band, large entrance doors.
  - Warehouse: metal cladding, loading dock, roof vents, gable roof.
  - House: pitched roof with chimney, shutters, porch columns.
  - Retail mall: glass entrance, columns, skylights, sign band.
  - Pavilion: columned canopy roof, benches.
  - Utility: tank, pipe, corrugated metal cladding.
  - Landmarks: town hall clock tower + columns, library portico, market awning + crates.
- Framed windows and doors added to all non-storefront buildings.

**14. Windows were unframed black slots**
- *Bug:* Window textures were pitch-black voids with no mullions, sills, or glass reflection.
- *Fix:* New `makeWindowTexture()` with pale cross mullions, diagonal reflection streaks, and a sill. `makeDoorTexture()` with paneled door and brass handle. `makeCurtainWallTexture()` for office towers with a 4×4 lit/unlit grid.

**15. Every cube allocated a new BoxGeometry**
- *Bug:* Each building mesh created its own `BoxGeometry`, wasting memory and GPU uploads.
- *Fix:* Geometry cache (`boxGeo`, `cylGeo`, `gableGeo`) keyed by dimensions; material cache keyed by kind/tint/repeat.

### Camera

**16. Follow camera clipped through buildings**
- *Bug:* Camera entered building interiors when backing into walls, producing black walls and floating windows.
- *Fix:* 3D AABB segment-AABB ray test (`rayBoxEntry`) pulls the camera in against static building boxes. Applied both to the ideal target and the smoothed frame position. Never lets smoothing carry the camera through a wall.

### Cars

**17. Variant cars had `wheels: []` — no wheels spun**
- *Bug:* SUV/compact/pickup variants captured empty wheel arrays; only the sport variant had wheels, and none spun with speed.
- *Fix:* All four variants now capture their 4-wheel arrays. New `spinCarWheels(carOrMesh, speed, dt)` rotates wheels by `speed / radius * dt`. Called in `updateTraffic` for traffic cars and in `main.js` for the player-driven vehicle.

### HUD

**18. No reverse hint**
- *Bug:* Control guide listed "S brake" but not reverse behavior.
- *Fix:* Changed to "S brake/reverse".

---

## Remaining minor visual notes

These are cosmetic, not blocking:

- **Texture seams at intersections**: Where horizontal and vertical road meshes meet, the asphalt striping can shift phase slightly across the intersection patch. Acceptable at voxel scale.
- **Palm shadow softness**: Palm fronds cast shadows but the trunk/crown overlap can produce slight self-shadow artifacts at low sun angles.
- **Fog fade at map edge**: Beyond `z=230` the ocean fades into fog before the map edge; no hard ocean boundary line. Intentional for scenic boundary.
- **Car wheel spin visible only in motion**: Wheels are static when parked; spin only while moving. Correct behavior.

---

## Intentional (not bugs)

- Inverted A/D steering and inverted horizontal mouse-look are per design and working.
- Traffic cars are not stealable (`stealable: false`, `enterable: false`).
- No swimming/driving into water — ocean wall blocks entry; ocean is scenic only.
- No missions, money, police, weapons, or progression.

---

## Files changed

| File | Change |
|------|--------|
| `src/world/worldConfig.js` | Rewritten as single source of truth for roads/sidewalks/plazas/beach/ocean/buildings/routes/props/spawn/collision |
| `src/world/sceneBuilder.js` | Layout-driven renderer; type-specific facades; cached geometry; fixed ground/beach/ocean extents |
| `src/world/textures.js` | Added `makeWindowTexture`, `makeDoorTexture`, `makeCurtainWallTexture`, `metal` palette |
| `src/camera/followCamera.js` | Added `rayBoxEntry` and `pullCameraIn` collision; wired static building obstacles |
| `src/main.js` | Camera obstacle wiring; wheel spin for player vehicle |
| `src/traffic/ambientCars.js` | Wheel spin call in `updateTraffic` |
| `src/vehicles/carModel.js` | Capture wheels for all variants; `spinCarWheels` export; `baseMaterials` helper |
| `src/ui/hud.js` | Reverse hint in control guide |
| `tests/worldLayout.test.js` | 12 layout invariants (no overlaps, cars on roads, peds on sidewalks, ocean order, etc.) |
| `tests/player.test.js` | Spawn-relative town-hall collision test |
