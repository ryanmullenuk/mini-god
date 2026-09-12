# Tide: twenty-layer sculpting

The existing island, ocean, pools, wildlife, village simulation and articulated people remain. Godus reference images supplied by the user guide the thinner contour treatment and the depth-to-altitude colours.

## Player controls

- Raise or lower one terrace per drag. Holding or crossing the stroke cannot sculpt a second layer. Release before working the next layer.
- Each stroke locks to the terrace where it starts. Dragging over another terrace does not switch the selected layer.
- Path starts on a low terrace and trims the layer immediately above it. A taller cliff needs successive strokes to form a staircase.
- Islanders climb or descend one layer at a time. Each intermediate tread needs room for their feet; cramped, tightly stacked ledges remain blocked. Homes and farms still require flat ground.

## Implementation

Twenty contours share the original 200 × 200 scalar terrain field. Thresholds are 0.5 units apart, keeping the existing shoreline at scalar 3.5. Six bands are submerged; fourteen are dry land. Land risers are 0.28 world units high instead of the previous increasingly tall cliffs. Underwater colours progress from dark blue through turquoise, followed by sand, grass and upland earth, with the existing regional desert blend.

Sculpting uses the original pointer lifecycle and undo stack. A stroke captures an immutable baseline, selected layer and direction. Both destination layer and maximum 0.5 scalar displacement are capped against that baseline, including between interpolated samples. Overlapping round brush stamps use a smooth falloff, with closer spacing along drags. The ocean shader follows the same contour interval.

Navigation permits at most two adjacent dry levels within a body's clearance radius. It checks complete segments, route shortcuts and actual movement steps. This rejects narrow interpolated strips in a tall cliff. The same rules drive legacy roaming and autonomous settlers; visible step height blends smoothly. Plot footprints retain strict flatness. Fertility bands retain their previous meaning at doubled layer indices.

## Existing islands

Save format 2 retains the current storage key and accepts format 1. Terrain scalar values and village supplies, crops, progress and cargo survive. Existing valid plot foundations are levelled to the lower of the two new terraces in their old layer. Movement jobs replan against the upgraded terrain.

Before automatic migration is saved, the original save is backed up under the storage key's `.before-20-layers` suffix. If that extra backup cannot be written, the island still restores in memory; autosaving stops so the original stored island remains safe, and the player is told to export new progress. Format 2 exports reload without another migration.

## Verification

24 automated tests pass: 8 terrain metadata, 8 settlement and 8 terrace tests. These include real sculpted stairs, bidirectional one-step movement, rejected two-step cliffs and narrow treads, long/crossed brush strokes, dense inter-sample limits, old save foundations and farm fertility. TypeScript, source lint and production build pass.

Native browser verification was attempted but no browser window was accessible through Computer Use (`cgWindowNotFound`). Visual feel, performance on the user's device and touch interaction remain unverified for this update.
