# Tide: preserve the prototype, add a living settlement

Update: the MVP settlement loop is implemented, and the supplied visual references now guide twenty thin contour layers, single-layer sculpting, stair traversal and divine hut/farm guidance. See `living-island-mvp.md` and `terrace-sculpting.md` for the current implementation. The audit below records the original ten-layer prototype.

7 September 2026. Target confirmed by the user: the recent **Tide** sandbox, not the separate TIDELANDS project.

## Decision

Continue the existing React / Three.js project. No engine migration, terrain replacement, UI redesign, or import of TIDELANDS is needed. Preserve Tide's contour terraces, desert/meadow palette, slate ocean and jade shallows, pools, animated islanders, wildlife, camera controls, brush tools, and undo.

The first release should make terrain changes matter to a small autonomous settlement. It should not attempt all the researched systems at once.

## Inspection and evidence

Project: `[local project path]

Baseline: clean `main` at `94febfa` before this task's changes. This task uses `codex/terrain-metadata-foundation` for the first increment.

The referenced conversation was supplied as a partial preview. Its linked shared page did not expose readable content; a `read_thread` tool was not available in this session. The original uploaded screenshot is absent. Visual descriptions below are grounded in existing source, not a claim to have inspected that image. Preserving the existing rendering and styling is the visual baseline until the screenshot is available.

| Area | What exists | Implication |
| --- | --- | --- |
| Engine/framework | React 19.2.6, TypeScript 5.9.3, Three.js 0.180.0; Vinext/Vite with Next-style routes; Sites/Cloudflare packaging; pnpm lockfile. | Retain these dependencies and architecture. No Unity/Godot rewrite. |
| Terrain | `lib/game/terrain.ts`: a 200 × 200 Float32Array, 116-unit extent, 0.58-unit sample spacing. d3-contour extracts ten contours; extruded and bevelled meshes produce visible terraces. | Keep this authoritative terrain representation and its renderer. Add derived gameplay queries alongside it. |
| Height semantics | `sample()` returns a contour scalar; `level()` quantizes it; `layerY()` maps it to physical terrace height. `height()` adds 0.065 for actor clearance. | Use physical terrace height for slope and flooding. Do not use contour values as metres or fertility. |
| Sculpting | Raise/lower radial brushes and a path brush that cuts higher terrain to the selected terrace. Drag/hold input, touch gesture handling, throttled full mesh rebuilds, and up to 35 pre-stroke snapshots. | Extend the existing terrain-change and undo paths; do not add a second brush controller. |
| Camera/input | `lib/game/engine.ts`: orthographic camera, orbit/pan/zoom, desktop and touch input, raycast picking, pause and cleanup. | Preserve controls. Keep simulation work outside pointer handlers and avoid a full world scan for every paint stamp. |
| UI | `app/page.tsx` mounts the game and uses a small `GameAPI`. It provides brand/header, add-islanders, help/pause, layer legend, camera controls, bottom tools, brush slider and undo. `app/globals.css` defines responsive styling. | Add compact status and contextual feedback only when systems produce real data. Keep the island dominant. |
| Islanders | `lib/game/islanders.ts`: empty start; add pairs up to 30; low-poly articulated models; idle/roam animation; local collision probes; straight-segment checks on the same terrace; relocation after invalid terrain. | Reuse models and animation. They are not yet settlers: no needs, homes, inventories, jobs, pathfinding or settlement decisions. |
| Ocean/pools | `lib/game/ocean.ts`: shader animation, height-map masking, caustics, depth/shore effects, and three pool uniforms. Pools are cut into the same terrain and water is rendered at the common sea plane. | Keep water rendering. This is not flow, stored water volume, salinity, or a freshwater supply model. |
| Wildlife | `lib/game/wildlife.ts`: 154 fish, schools with water-safe movement, pool confinement, birds/clouds, instanced rendering, and recovery after sculpting. | Preserve this visual life. Later ecology must explicitly connect resource stocks to simulation. |
| World data | Terrain owns heights; islanders own mutable agent/model objects; wildlife owns its populations; the engine owns input/history. No durable world save, settlement inventory, plot registry, economy, faith, prayers or rivals. | Add small typed simulation modules. Avoid replacing all game state with a new framework. |

### Code quality

The module boundaries, disposal paths, input handling and existing geometry/simulation checks provide a useful foundation. TypeScript strict mode passes, but `any` in terrain contour handling and islanders weakens that protection. Much code is compressed into long lines, which raises review risk; expand only touched logic when useful.

The current expansion check passes: ten terrain layers; approximately fourfold island footprint; separate desert/meadow/highland areas; three enclosed pools; optional islanders with a 30-person cap; all 154 fish remain in safe water during a simulated minute; pause, sculpt recovery, restoration and ocean uniforms work. Baseline timing on this machine was about 54 ms for initial terrain generation and 18 ms per mesh rebuild; these are CPU checks, not browser frame-rate measurements.

The source lint baseline has six findings: explicit `any` uses, a reassignable local, and a spread flagged while traversing children that are removed during iteration. Do not blindly remove that defensive copy. `work/check.mjs` is stale: it expects 12 initial islanders, while the current design intentionally starts empty. Keep the current expansion check as the relevant regression baseline and replace obsolete checks deliberately.

## MVP vertical slice

Design target: one island, one settlement, two initial settlers using the existing Add islanders action, one shelter type, one crop, one food store, one need-based prayer and one blessing. Existing free sculpting remains available. A small starting food reserve prevents failure before the first harvest.

The player flattens a useful terrace. The game identifies space suitable for a home and a field. Settlers reserve reachable opportunities, gather and deliver a simple building material, build their home, prepare a field, grow and harvest food, and deliver it to storage. Food is consumed over time. When a shortage is foreseeable, settlers pray for fertile, watered ground. The player improves the environment; the game recognizes that the underlying need was met, awards faith once, and makes a small rain/fertility blessing available. No direct worker micromanagement is required.

An initial full loop should be tunable toward roughly 10–15 minutes of play; this is a proposed pacing target, not measured gameplay.

### Completion criteria

- On the same starting seed and with no manually assigned jobs, two settlers can reserve different work, build a usable home and deliver a harvest.
- Wet, steep, overlapping and unreachable footprints are rejected with distinct reasons. Close-to-water is never treated as proof of fresh water.
- Removing a route or changing a reserved plot cancels/replans work safely; it cannot duplicate resources, leave permanent claims, or teleport cargo into storage.
- At most one active task belongs to each settler; each plot has one reservation; resources are transferred exactly once.
- Food stock and consumption remain consistent. Hunger prompts a recoverable need before any severe consequence.
- A prayer represents an actual unmet need, resolves only when that need improves, and pays its reward once. Spending faith deducts the cost once and refuses insufficient funds.
- Pause freezes settlement decisions, work and needs. Frame rate does not change simulation outcomes materially.
- Save/reload preserves terrain, agents, work, claims, inventory and prayer state mid-build and mid-delivery. Old saves load or fail with a clear explanation.
- Existing sculpting, undo, ocean, wildlife and touch/desktop controls continue to work. Compare the same camera/viewport/terrain against the captured visual baseline before shipping UI or render changes.

## Migration order

Each increment should remain playable, have a narrow diff and pass the relevant existing checks. The first foundation can be delivered without a visible interface change.

| Step | Scope and reuse | Acceptance gate |
| --- | --- | --- |
| 0. Baseline | Record current source, existing checks, controls and visual reference. Preserve source on a focused branch. | Current expansion and type checks pass; limitations are recorded. |
| 1. Terrain facts | Add a read-only, lazily refreshed metadata adapter. Expose physical elevation, local slope, local walking clearance, water proximity, and explicitly estimated moisture/fertility. Add conservative footprint assessment. | No renderer/UI change. Sculpt and undo invalidate derived facts. Invalid coordinates, submerged ground and cliff footprints fail safely; navigation/occupancy/freshwater remain explicit unknowns. |
| 2. Simulation and navigation | Add a fixed-step clock, stable settler IDs and plain-data state beside existing model rigs. Build a small grid route service that initially obeys current same-terrace limits and agent clearance. | Existing rigs follow routes; destinations and all path segments are validated. No cross-cliff shortcuts. Pause and reproducible seeds work. |
| 3. Opportunities | Detect a bounded set of home/field candidates near settlers; reuse footprint assessment. Add stable IDs and a free → reserved → building → occupied lifecycle, with cancellation. | One reservation per footprint. Demand and reachable access choose among terrain-suitable candidates. Explain unsuitable sites without drawing a permanent grid over the island. |
| 4. Autonomous settlement | Add priorities above agent execution: urgent food, shelter, material supply, then surplus. States include idle, seek, travel, gather, deliver, build, farm and recover. Reuse current walking animation and scene objects. | Two settlers choose and execute useful tasks without player job assignment. Reservation and cargo invariants pass under interruptions. |
| 5. Farming/food | One seed/crop; explicit fresh-water supply; prepare → plant → grow → harvest → deliver. Track stored food, consumption and a small reserve. | Only delivered food enters storage. Dry/infertile land affects growth. Agents reserve labour and avoid duplicate harvests. |
| 6. Prayers/faith/power | One contextual food/soil prayer, deduplication and cooldown. Track faith; implement one bounded blessing through world events. | Genuine need resolution gives one reward. Powers spend faith once, affect simulation, and cannot create a free reward loop. |
| 7. Persistence and MVP hardening | Versioned save snapshot, seeded randomness, fixed-step rules and migration tests. Add only the minimal settlement status/prayer UI. | Complete the loop and recover from sculpting, interruption, pause and reload. Browser visual/input checks are required before shipping player-facing changes. |
| 8. Ecology and water | Persist soil moisture/fertility, vegetation and extraction/regrowth. Identify connected water bodies and salinity/freshwater explicitly. Add simplified rainfall/runoff before full fluid simulation. | One terrain/ecology decision has a legible downstream effect; existing ocean shader still renders the result. Filling/opening pools updates supply and habitat correctly. |
| 9. Emergent roads | Record actual completed foot travel in a decaying traffic field. Render narrow worn routes in Tide's palette. Add capped movement benefit only after topology is reliable. | Paths emerge from real use, decay when abandoned, and cannot bypass water/cliffs. Trail state persists if it affects travel. |
| 10. Richer civilization | Additional needs, specialist settlements, capacity and progression; more prayers and powers. | Each extension uses existing task, opportunity, resource and event rules. No collection of unrelated meters. |
| 11. Rival civilizations | Add faction IDs and shared rules for needs, claims, faith and territory, then expansion/trade/conflict. Diplomacy and combat are later decisions. | Rivals obey the same terrain, supply and navigation constraints; isolated simulations work before shared-world contention. |

Steps 1–7 constitute the first full MVP. Ecology depth, roads and rivals are later releases, not prerequisites for the first playable loop.

## Proposed architecture

Keep `terrain.ts`, `ocean.ts`, `wildlife.ts` and existing presentation. Add responsibilities beside them:

- `terrain-metadata.ts`: derived terrain queries and physical footprint checks; estimates are labelled and cannot imply route connectivity or fresh water.
- `navigation.ts`: walkability/connectivity/path queries. Terrain changes invalidate affected routes; the first implementation may rebuild a modest grid after a completed stroke.
- `simulation.ts` and `world-state.ts`: fixed time step, seeded random source, stable IDs, serializable records and one authoritative state.
- `opportunities.ts`: site discovery, claims, validity and cancellation. Jobs must reserve through this registry.
- `settlement.ts`: bounded need-driven priorities; directs task execution rather than modifying the render scene.
- `farming.ts`, `faith.ts`, `prayers.ts`: narrow rules over shared resources and events.
- `save.ts`: schema version, validation, migration, autosave and explicit recovery.

These are responsibility boundaries, not a requirement to create every file immediately. `GameAPI` remains the bridge to React. Render rigs consume simulation positions and animation states; durable records never contain Three.js objects.

### Data and invalidation rules

Keep the existing height array as the only terrain source of truth. Derived metadata is disposable and rebuilt after loading. Soil state, actual water supply, crops, inventories, needs and claims become authoritative only when their systems are implemented.

Terrain edits must invalidate metadata, candidate validity and routes. Undo currently restores only heights; define its settlement semantics before buildings exist. Recommended MVP rule: undo reverses the terrain stroke and triggers replanning; it does not rewind time, food, construction progress or prayer rewards. Never implement implicit economic rewind through terrain snapshots.

The first route service must respect the existing same-terrace restriction. Ramps/steps require an explicit geometry and traversal rule later. A flat cell or nearby resource alone does not establish reachability.

Use bounded decision intervals and caches keyed by terrain/state revision. Do not add full-map plot detection, route planning and ecology updates to every render frame. Measure browser performance before selecting budgets for larger populations; the present 30-person cap is a prototype bound, not evidence of scalability.

## First implementation boundary

This task's first increment is the metadata and suitability foundation only. It does not claim to implement settlers, building, farming, faith or the complete MVP. It should expose queries through the existing game bridge, refresh safely after edits/undo, and leave visuals untouched. The next visible increment is an optional suitability preview and reachable plot detection, followed by autonomous work.

Validation for the first patch: eight focused metadata tests, the existing expanded-island simulation check, strict TypeScript, changed-code lint and production build all pass. Six pre-existing overall source lint findings remain. Browser interaction/visual comparison was unavailable; rendering, model, UI and stylesheet files have no diff.


## Implementation update

The living-island MVP is now implemented on top of the terrain foundation. See `living-island-mvp.md` for gameplay, validation and the remaining later stages. Steps 2–7 now have working implementations; initial moisture/vegetation and cosmetic traffic wear also cover part of steps 8–9. Full hydrology, rival civilizations and advanced progression remain later work.
