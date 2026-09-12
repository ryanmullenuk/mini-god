# Tide: living-island MVP

The existing Tide sandbox includes the settlement loop and divine building guidance. See `divine-guidance.md` for the latest controls and construction rules. The contour terrain, ocean, wildlife, islander models and sculpting controls remain the visual foundation.

## Play

1. Select **Add islanders**. Two settlers arrive at a safe camp and choose work automatically.
2. Choose **Guide hut** or **Guide farm**, then click or tap a green site preview. Followers gather and deliver wood, build at your chosen site, plant and harvest. Guidance is free; huts need 6 wood and farms need 3. Only deliveries add goods to camp storage.
3. Use **Show plots** to see terrain candidates. Shape broad terraces and single-layer steps. Islanders can climb one layer at a time; taller cliffs need a staircase with room to stand between risers. **Find my village** returns the camera to camp.
4. Listen to prayers. Meeting a real need awards faith once; sheltered, fed settlers also generate a small amount over time. **Rain** costs 8 faith and waters fields. **New growth** costs 12 and improves soil, crops and vegetation.
5. Fields retain rainwater, dry between showers and lose a little fertility after harvest. Vegetation regrows. Actual foot travel creates fading worn paths.
6. Pause the world or switch settlement speed between 1× and 3×. Undo reverses terrain while preserving current settlement time and supplies.
7. The island saves on this device every 15 seconds and when leaving. The help menu includes export/import, a new-island action and previous-island recovery. Export a file to move between devices or browsers. Device storage failure is reported; replacement is refused if a backup cannot be kept.

The original untouched-island start and optional population remain. Adding settlers brings modest supplies, with the existing 30-person limit. Expansion is limited by actual terrain and resources.

## Implemented

- Single-layer step navigation with body clearance, sampled edge checks and home obstacles.
- Twenty thin terrain bands and a brush locked to one layer per drag; release to sculpt the next layer.
- Terrain-aware plot detection and exclusive work claims.
- Free hut/farm guidance with site previews, queued requests, priority construction, waiting reasons, cancellation before funding and saved progress.
- Fixed-step, seeded autonomous gathering, delivery, construction, planting and harvesting.
- Stored food consumption, shelter capacity and nonlethal shortage recovery.
- Rain-fed moisture, soil fertility and resource regrowth.
- Need-based prayers, cooldowns, single rewards and two paid god powers.
- Procedural homes, farm/crop stages, resources, camp, prayer marker, rain and traffic wear in the existing visual style.
- Existing articulated islanders driven by simulation state, including cargo and work animation.
- Versioned local saves, validation, import/export and previous-island recovery.
- Compact village UI with real resource counts, worker activity, prayer feedback, plot overlay and village camera focus.

## Validation

Eight settlement tests pass, covering autonomous progress, fixed-step equivalence, pause, save continuation at an arbitrary tick, terrain damage/restoration, faith spending, obstacle/navigation rules, invalid imports and scene/model integration. Eight metadata tests, eight terrace tests and ten guidance tests pass (34 total). The terrace checks cover step traversal, tall cliffs, narrow ledges, smooth single-layer strokes at interpolation boundaries, legacy saves, fertility, geometry and wildlife.

The 800-second deterministic two-settler scenario produced one usable home, one field, 76 units of delivered harvest food, three answered prayers and visible traffic wear. Inventory/claim invariants were checked during the run. This is simulation evidence, not a claim about measured browser frame rate.

Strict TypeScript, lint across game code, UI and test scripts, and production build pass. The build retains its existing large-chunk warning and Vinext route-classification notice. The older terrain/islander lint findings are resolved; no dependency versions changed.

The earlier MVP rendered successfully in Safari. The twenty-layer update passes scene geometry and simulation checks. A current visual/input check could not run because Computer Use could not access a browser window (`cgWindowNotFound`). Browser appearance, full manual playthrough and touch layout still need verification.

## Later stages

This release is the core MVP, with initial ecology and cosmetic roads. It does not yet include rival civilizations, diplomacy/combat, physically simulated water flow or salinity, freshwater hauling, road travel bonuses, autonomous population growth, a tech tree, or cloud/multiplayer saves. These should build on the shared world state and navigation rather than replacing the existing game.
