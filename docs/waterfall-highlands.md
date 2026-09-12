# Waterfall highlands

The reference image is implemented as a larger central mainland, a green northern tableland with exposed cliff faces, eight faceted rock formations, a highland spring and animated waterfall, and a plunge pool with a winding outlet to the sea. Outer islands retain their beaches, forests and distinct channels. Existing sandy connections remain walkable.

## Space and rendering

- Dry terrain: 44,719 → 56,300 grid samples (26% more across the archipelago).
- Low grassland (scalar elevations 5–8): 20,133 → 29,485 samples (46% more).
- The 400 × 400 world grid and 32 thin terrain layers remain unchanged.
- Eight static mountain meshes use 3,240 vertices in total; pale summit faces distinguish the highest peaks.
- The waterfall uses an animated shader, four ripple rings and 18 instanced mist particles. Pause and daylight affect the water animation.
- Existing background terrain meshing remains in place. A local sample edit rebuilt two layers in 23 ms; full terrain reconstruction was 265 ms / 1,362,708 vertices. These are geometry timings, not measured browser frame rates.

## Gameplay and saves

Mountains and the elevated spring block follower and animal navigation and construction suitability. Editable ground heights remain authoritative. Rock formations and the spring are withdrawn if their supporting terrain is reshaped; undo restores them when the original support returns. This stage uses a fixed scenic spring, not simulated rainfall or water volume.

Version 14 upgrades untouched ground from previous generations, preserving settlement buffers, resources, animals, fishing areas, paths, worker routes, and sculpted samples. The original source save is backed up on-device before migration. Occupied rock footprints are excluded, including resumed worker routes, so old villages may show fewer formations. No food, followers, buildings or inventories are regenerated. New saves do not repeat terrain migration.

## Validation

107 automated checks passed, including new coverage for expanded flat ground, mountain/spring collision, inter-island routes, finite geometry and its vertex budget, pause, sculpt/undo visibility, and version 13 save restoration. Type checking and the production build passed. Browser visual testing was not performed.
