# Mini God refresh

The game, page title, splash and save-download names now use Mini God. The splash is an overhead low-poly beach and ocean, drawn as a lightweight vector scene with MINI GOD and an Enter your world button. The simulation waits while the splash is open. Existing local saves retain their original storage key and format identifier.

## Quieter world

The faceted mountain meshes, elevated spring and waterfall renderer are removed. Version 15 replaces untouched mountain/tableland ground with the lower, broader island generation while preserving occupied areas, routes, fishing, resources and player edits. Small original hills and pools remain. No replacement population, inventory or buildings are created.

Tracks are no longer created, updated or drawn. Old track data remains readable for save compatibility.

The ocean animation clock runs at half speed; intermittent spatially varied wave sets suppress roughly half the continuous surf cycles. Rock surf uses the same half-speed treatment. There are two gull flocks (10 and 12 birds), ten solo gulls and one 80-bird blackbird murmuration. Cursor avoidance and rejoining remain enabled.

## Local sculpting and stable rocks

Terrain is split into 8 × 8 spatial sections, rendered with one mesh per nonempty section. A stroke rebuilds only the changed elevation bands in touched sections and a one-sample interpolation halo. Unchanged section buffers and unchanged bands are retained. Padded contours are clipped to exact section ownership boundaries, avoiding seams and artificial internal walls. All 32 editable elevations and the one-layer rule remain available.

Background workers still coalesce strokes and discard stale responses. The worker fallback uses the same local builder. Undo/import re-establish their rendered baseline so subsequent strokes stay local.

Scenery candidates and individual rocks now use independent deterministic seeds. A rejected or newly exposed candidate cannot shift the random stream for distant objects. Rock capacity no longer causes a local edit to displace distant upland rocks.

Local geometry benchmark: sample edit rebuilt two elevation bands in three sections in about 11 ms. A full rebuild was about 613 ms. Initial geometry is cached for resets. These are CPU geometry timings, not browser FPS measurements; browser visual QA was not performed.

## Verification

All 110 automated checks passed. Coverage includes section boundary edits, exact clipped ownership, complete flat top coverage without artificial walls, partial/full geometry agreement, retained distant mesh identity, stale worker results, distant rock matrix stability, bird counts, half-speed ocean time, no new tracks, save migration, food conservation, construction and safe navigation. Type checking, the production build and the emitted worker protocol passed before publication.
