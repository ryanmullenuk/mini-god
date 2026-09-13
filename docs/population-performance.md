# Population and pointer performance

The code had several costs that scale with population or input frequency:

- Ten idle islanders submitted 420 visible meshes; thirty submitted 1,260. Each person owned duplicate primitive geometries and materials. Shadow passes also drew those body parts.
- Every nontrivial route allocated two 160,000-element buffers and repeated segment-clearance checks during breadth-first search. Only node clearance was cached. Settlement decisions, deliveries, food jobs and status queries repeatedly ask related route questions.
- Pointer hover raycast every input event, including Explore mode. Terrain geometry had bounding spheres but no bounding boxes, so rays could scan triangles in chunks they missed.

## Changes

Rigid body parts sharing an animated parent are merged using vertex colours and one shared Lambert material. Joint transforms, skin colours, skirt motion, tool visibility and recolourable carried animals remain independent. Matching rigs share retained geometries and materials; the owning view releases these once on reset or disposal. This reduces mesh submissions without changing model detail. The terrain height texture and ocean's reference to it were already reused; adding texture copies or an atlas would not address these hotspots.

Navigation lazily allocates and reuses search buffers, uses visit generations instead of clearing the parent array per search, and caches directed edge-clearance results. A bounded 256-entry cache stores exact endpoint routes, including unreachable results. Callers receive independent waypoint copies because jobs consume and modify routes. Terrain changes and building placement invalidate all derived navigation caches using the existing invalidation points. Temporary placement navigators that only check straight segments allocate no grid buffers.

Terrain geometry now computes tight bounding boxes alongside its spheres, retaining Three.js's exact triangle picking. Hover work is coalesced to one request per animation frame and skipped in Explore mode. Active sculpt strokes still use the existing flat-plane picker and background worker mesher; one-layer stroke rules are unchanged.

## Reproduce measurements

Run `node scripts/benchmark-performance.mjs [git-revision]`. An optional revision loads that version of the game code into an isolated temporary directory and applies the same workloads. Compare against the parent commit of this change. Timings vary by machine and JIT state; do not treat these as browser frame rates.

Initial local before/after results:

| Workload | Before | After |
| --- | ---: | ---: |
| 30 detours, first pass | 30.22 ms | 10.89 ms |
| Same 30 detours, repeat | 21.51 ms | 0.04 ms |
| First-pass terrain samples | 5,457,358 | 1,014,838 |
| Repeat terrain samples | 5,433,420 | 0 |
| 10 islanders, visible meshes | 420 | 150 |
| 20 islanders, visible meshes | 840 | 300 |
| 30 islanders, visible meshes | 1,260 | 450 |
| 30 islanders, unique visible geometries | 1,260 | 40 |
| 30 islanders, unique visible materials | 225 | 8 |
| 200 terrain raycasts | 33.92 ms | 26.89 ms |

Both raycast runs returned the same 2,400 intersections. Mesh counts exclude hidden tools/cargo and other scenery, and are not whole-scene GPU draw-call measurements. The navigation fixture uses a bounded land patch and a wall requiring a detour; real saves vary in route complexity and cache hit rate.

## Verification and remaining limits

`node --test --test-concurrency=2 scripts/check-*.mjs` includes cache invalidation after terrain/building changes, exact endpoint handling, independent waypoint ownership, edge reuse, bounded route storage, bounded graphics resource growth through 30 islanders, single disposal and exact raycast equivalence after sculpting. Existing movement, building, food, wildlife and worker/sculpting checks remain in place.

Cold searches across unreachable terrain can still be expensive. Sculpt completion still validates settlements and refreshes scenery, and undo/import still perform synchronous terrain rebuilds. Worker meshing does not eliminate GPU uploads or main-thread mesh installation. These changes reduce demonstrated costs but cannot guarantee a particular FPS on every device.

The local browser check created a settlement, added followers to the 30-person cap, let the village build and animate, performed a raise drag, and undid that stroke. The undo control became enabled after sculpting; the village continued running afterward. Screenshots were inspected and the browser reported no JavaScript errors. This is a local functional check, not a cross-device performance guarantee. All 120 automated checks, TypeScript, lint on the changed code, and the production build passed.
