import { Box3, Ray, Vector3 } from 'three';
import { EXTENT, STEP, LAYER_HEIGHTS, LAYER_COUNT, type Terrain } from './terrain';

const bounds = new Box3(
  new Vector3(-EXTENT / 2, -2, -EXTENT / 2),
  new Vector3(EXTENT / 2, LAYER_HEIGHTS[LAYER_COUNT - 1] + .5, EXTENT / 2),
);
/** March the live terraced height field, not stale worker meshes. Orthographic
 * rays retain their individual camera-plane origins. Clip away empty sky first. */
export function pickTerrain(ray: Ray, terrain: Pick<Terrain, 'height'>, far: number): Vector3 | null {
  const entry = ray.intersectBox(bounds, new Vector3());
  if (!entry) return null;
  const start = bounds.containsPoint(ray.origin) ? 0 : entry.distanceTo(ray.origin) + 1e-7;
  const step = STEP * .5;
  let previous = start;
  const point = new Vector3();
  for (let t = start; t <= far; t += step) {
    ray.at(t, point);
    if (!bounds.containsPoint(point)) return null;
    if (point.y <= terrain.height(point.x, point.z)) {
      let lo = previous, hi = t;
      for (let k = 0; k < 12; k++) {
        const m = (lo + hi) * .5;
        ray.at(m, point);
        if (point.y > terrain.height(point.x, point.z)) lo = m; else hi = m;
      }
      return ray.at((lo + hi) * .5, point);
    }
    previous = t;
  }
  return null;
}
