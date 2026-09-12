# Visible ocean movement, sunlight and breaking surf

The preceding depth-colour pass attenuated the still-running animation too strongly. This update retains the depth palette, reefs and visual shelf field while restoring visible movement.

Larger swells and stronger directional ripples animate the surface. Analytical wave normals produce a warm sun glow and sharper moving highlights from the scene's sun direction. The renderer supplies the actual orthographic view direction every frame, so reflection responds to camera orbiting. Low-density glints supplement the reflection.

Wave crests travel toward the geography-derived shoreline across a wider surf zone, break into brighter foam and leave an advancing/receding wash. A nonzero exposure floor ensures beaches are not accidentally masked out. Enclosed pools remain excluded from ocean breakers.

Rock foam meshes now have radial segments and animate in height: the inner, windward side rises during impact, with a white collar and an expanding foam front that fades outward. The existing shared clock freezes surface and rock animation on Pause. No terrain, save format, navigation or economy changes.

Validation uses the scenery/shoreline tests, including reflection direction changing with camera orbit, shared time updates, pool isolation, shelf stability, rock placement and unchanged game state. TypeScript, focused lint, local response and production build are checked. Browser visual testing was not requested.
