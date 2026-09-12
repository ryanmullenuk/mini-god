# Forests, flocking birds and wooded highlands

More than doubles vegetation sampling, expands woodland beyond the original narrow groves and increases palms along sandy shores. Larger instance budgets support substantially denser cover without extra draw calls. The reference's round crowns, open acacia canopies, palms and decorative mango-coloured fruit remain, and pines now have four overlapping foliage tiers. Camp roots retain an 11.5-unit clearing to account for overhanging foliage, alongside existing building/resource buffers.

Four flocks of twelve seagulls follow shared coastal flight paths with V-shaped offsets, coordinated gliding and staggered wing beats. Two black-bird murmurations of eighty birds each stretch, fold and turn around shared moving centres. These are decorative group animations, not simulated food populations. Birds remain above the terrain.

Thirty drifting cloud banks replace the previous eight: twelve opaque, ten at 48% opacity and eight at 24% opacity. Translucent clouds do not write depth; thinner wisps have flatter shapes. All sky animation pauses with the game. Sky updates reuse instanced meshes and introduce no per-frame geometry creation.

Main-island mountain massifs cover the north-west and eastern interior, with broader uplands on the larger satellite islands. The twenty thin terrain layers, shoreline layout, sandy connections and one-layer climbing rule remain. Version-11 saves upgrade untouched format-10 terrain using its frozen natural-coast generator; version-9 and older baselines are retained. Occupied land, crops, work routes, wildlife and player sculpting keep their buffers. Startup keeps a before-wooded-highlands backup. Existing simulation data is not regenerated.

Validation includes forest density, growth of mountain area, migration, flock cohesion, cloud opacity, pause behaviour, settlement clearings, terrain and navigation regression checks. No browser visual or device-performance testing was requested.
