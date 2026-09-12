# Calmer open water and the daylight cycle

Deep water now uses slow, warped swells with different directions and timing rather than fast repeating bands. Ripple contrast, fine surface normals, glitter density and sharp reflection strength diminish toward deep ocean. Beach breakers and rock impacts retain their existing stronger animation.

The existing 240-second simulation day now drives a continuous lighting cycle. Dawn, Morning, Afternoon, Dusk and Night appear beside the day counter. The directional light travels through a sky arc, while its colour/intensity, ambient sky/ground light and background blend between time-of-day colours. The cool night key light and ambient fill keep the island playable. Ocean and rock-foam colours follow the same cycle; sun reflection follows the light direction and fades out at night.

Time is derived entirely from the existing saved simulation time. Pause and sculpting pause the simulation's daylight clock; the game speed setting advances it at the same rate as settlement life. Loading resumes the correct phase and the end of a day joins smoothly to the beginning. No new save fields, migrations or economy changes are required.

Validation: 22 scenery/shoreline and settlement checks, including phase order, readable night light, disappearance of sun glitter at night, save restoration, pause, day rollover continuity and ocean lighting uniforms; TypeScript, focused game lint, successful local route and production build. Browser visual testing was not requested.
