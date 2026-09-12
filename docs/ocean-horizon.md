# Ocean horizon and depth bands

The fixed camera distance and near/far clipping could cut across the ocean in a tall viewport at low pitch. Camera distance and far range now account for the vertical orthographic extent and pitch without changing the visible scale. A 2,000-unit water plane fades to transparent beyond irregular mist, well before its physical boundary.

The water mesh has 16,641 vertices (previously 25,921). Two slow vertex-shader swells total at most 0.03 units and are damped near dry land. Fragment shading converts terrain scalar samples into the same submerged terrace elevations used by Terrain.height, then selects five discrete water colours from actual depth. Narrow transition thresholds preserve band readability; depth-derived breathing foam follows sculpting. The expensive caustic lattice and glitter were removed in favour of a broad, camera-responsive sun/moon highlight and saved day-cycle tints.

Water-contact footprints support foam around submerged structures; current plot footprints refresh once per second without mesh changes. There is no buildable pier in the current game. Existing rock foam remains in the landscape renderer.

Validation: TypeScript and 33 expansion/rendering regression checks pass, including camera clipping across portrait/wide aspects and low/top-down pitches, coarse mesh budget and contact clearing. Browser checks at 390×844 with maximum zoom-out and minimum pitch, including orbiting, show no straight ocean cutoff. A 1280×800 view also renders without shader errors. Temporary viewport overrides were reset.
