# Living island and coastline

Adds layered leafy groves, tall upland pines, six-frond beach palms, clustered bushes and meadow flowers in Tide's existing low-poly palette. Seven instanced batches keep draw calls bounded; wind moves foliage in the vertex shader without rebuilding trees each frame. Settlement clearings, building orders, resource nodes and terrace edges remain clear. Decorative planting does not add harvestable stock or alter navigation.

Ocean breakers follow a terrain-derived distance field. Rolling crests approach land, become white foam and leave a broken receding wash. Only water connected to the edge of the world receives surf; inland pools stay calm. Opening a channel introduces surf, and sculpting, undo and loading update the coast automatically. Existing seabed colours, caustics and offshore reflections remain. Wave and foliage animation freezes with Pause.

No save format or gameplay balance changes. Existing islands receive the scenery immediately.

Validation: TypeScript, focused lint, expansion checks including ocean/pool connectivity, sculpted shoreline refresh, vegetation batches and unchanged game state, plus production build. Browser visual and device-performance testing was not performed.
