# Tropical island visual refresh

Reference-inspired art direction: cobalt ocean, turquoise shallows, pale sand, green tropical canopy and faceted rocky highlands. The game remains a live, sculptable 3D world, not a background image.

Water uses continuous colour-depth interpolation and procedural reef patches from the existing height and shoreline maps. The gentle surf and half-speed motion remain. Ground colours have subtle deterministic world-space variation; no per-frame textures are generated. Foliage and rocky outcrops reuse the existing nine instanced landscape batches. Underwater and high-rock terraces omit bevel geometry, while walkable lowland terraces retain their bevels and all navigation thresholds.

New worlds use `tropicalArchipelagoHeight`: three compact mainland peaks, offshore summits and openings from coastal basins to the sea. Historical terrain generators are unchanged so save migrations remain stable. Loading an existing save applies the new rendering and foliage without regenerating its terrain, moving its village or discarding sculpting. A new world is required for the new topography.

Validation includes the existing gameplay, save migration, worker meshing, navigation and resource reuse checks, plus a new generation check for peaks, clearings, pools and open bays. The terrain remains within the existing one-million-vertex test budget; rock and plant submissions remain instanced. Local browser checks cover desktop and portrait rendering and shader errors. This is an approximation of the supplied art direction within the existing terraced game, not a pixel-identical recreation; it does not add the reference image's waterfall system.
