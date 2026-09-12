import { EXTENT, GRID, STEP, SEA, desertWeight, layerY, type Terrain } from './terrain';
import { walkingClearance } from './navigation';

export type PlotKind = 'home' | 'farm';
export type PlotBounds = { minX: number; minZ: number; maxX: number; maxZ: number };
export type PlotContext = {
  reachable?: boolean;
  unoccupied?: boolean;
  freshWaterSupplied?: boolean;
};
export type TerrainFacts = {
  x: number;
  z: number;
  level: number;
  elevation: number;
  /** Maximum absolute neighbour rise/run, in world units; not a central derivative. */
  slope: number;
  submerged: boolean;
  /** Local clearance only. This does not prove a route exists. */
  walkable: boolean;
  /** Approximate four-neighbour grid distance to water of any kind. */
  waterDistance: number;
  moistureEstimate: number;
  fertilityEstimate: number;
};
export type PlotBlocker =
  | 'invalid-bounds' | 'out-of-bounds' | 'submerged' | 'insufficient-clearance'
  | 'uneven-terrain' | 'low-fertility' | 'reachability-unknown' | 'unreachable'
  | 'occupancy-unknown' | 'occupied' | 'freshwater-unknown' | 'no-freshwater';
export type PlotAssessment = {
  terrainSuitable: boolean;
  /** Conservative eligibility, not a reservation or a navigation calculation. */
  readyToReserve: boolean;
  score: number;
  blockers: PlotBlocker[];
};

const MIN = -EXTENT / 2 + STEP / 2;
const MAX = EXTENT / 2 - STEP / 2;
const CLEARANCE_OFFSETS = [
  [.33, 0], [-.33, 0], [0, .33], [0, -.33],
  [.23, .23], [.23, -.23], [-.23, .23], [-.23, -.23],
] as const;

function inBounds(x: number, z: number) {
  // Match Terrain.sample's actual arithmetic, including rounding at the edge.
  const gx = (x + EXTENT / 2) / STEP - .5, gz = (z + EXTENT / 2) / STEP - .5;
  return Number.isFinite(x) && Number.isFinite(z) &&
    x >= MIN && z >= MIN && x < MAX && z < MAX &&
    gx >= 0 && gz >= 0 && gx < GRID - 1 && gz < GRID - 1;
}

/**
 * Derived, disposable gameplay facts. Never modifies heights, meshes or agents.
 * Call invalidate after sculpting or replacing heights, including undo/rollback.
 * Water distances are computed lazily; unused metadata costs no per-frame scan.
 */
export class TerrainMetadata {
  private waterDistances: Float32Array | undefined;

  constructor(private readonly terrain: Pick<Terrain, 'level'>) {}

  invalidate() {
    this.waterDistances = undefined;
  }

  private distances() {
    if (this.waterDistances) return this.waterDistances;
    const distances = new Float32Array(GRID * GRID).fill(Infinity);
    const queue = new Int32Array(GRID * GRID);
    let head = 0, tail = 0;
    for (let j = 0; j < GRID - 1; j++) {
      for (let i = 0; i < GRID - 1; i++) {
        // An infinitesimal inward offset prevents rounding the first centre
        // outside Terrain.sample and mistaking its -2 sentinel for seawater.
        const x = Math.max(MIN + 1e-9, (i + .5) * STEP - EXTENT / 2);
        const z = Math.max(MIN + 1e-9, (j + .5) * STEP - EXTENT / 2);
        if (layerY(this.terrain.level(x, z)) <= SEA) {
          const k = j * GRID + i;
          distances[k] = 0;
          queue[tail++] = k;
        }
      }
    }
    // Multi-source breadth-first distance. Invalid border samples are not water.
    while (head < tail) {
      const k = queue[head++], i = k % GRID, j = Math.floor(k / GRID);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= GRID - 1 || nj >= GRID - 1) continue;
        const n = nj * GRID + ni;
        if (distances[n] !== Infinity) continue;
        distances[n] = distances[k] + STEP;
        queue[tail++] = n;
      }
    }
    this.waterDistances = distances;
    return distances;
  }

  inspect(x: number, z: number): TerrainFacts | null {
    if (!inBounds(x, z)) return null;
    const level = this.terrain.level(x, z), elevation = layerY(level);
    const submerged = elevation <= SEA;
    let slope = 0;
    for (const [dx, dz] of CLEARANCE_OFFSETS) {
      const nx = x + dx / .33 * STEP, nz = z + dz / .33 * STEP;
      if (!inBounds(nx, nz)) { slope = Infinity; break; }
      const rise = Math.abs(layerY(this.terrain.level(nx, nz)) - elevation);
      slope = Math.max(slope, rise / Math.hypot(nx - x, nz - z));
    }
    const walkable = walkingClearance(this.terrain,x,z);
    const i = Math.min(GRID - 2, Math.floor((x + EXTENT / 2) / STEP));
    const j = Math.min(GRID - 2, Math.floor((z + EXTENT / 2) / STEP));
    const waterDistance = submerged ? 0 : this.distances()[j * GRID + i];
    const desert = desertWeight(x, z);
    // Design estimates only. Coastal proximity does not imply drinkable water.
    const moistureEstimate = submerged ? 1 : Math.exp(-waterDistance / 8) * (1 - desert * .55);
    const soil = level < 8 ? .15 : level < 12 ? .45 : .85;
    const fertilityEstimate = submerged ? 0 : soil * (1 - desert * .65);
    return { x, z, level, elevation, slope, submerged, walkable,
      waterDistance, moistureEstimate, fertilityEstimate };
  }

  assessPlot(kind: PlotKind, bounds: PlotBounds, context: PlotContext = {}): PlotAssessment {
    const blockers = new Set<PlotBlocker>();
    const { minX, minZ, maxX, maxZ } = bounds;
    if (![minX, minZ, maxX, maxZ].every(Number.isFinite) || maxX <= minX || maxZ <= minZ) {
      return { terrainSuitable: false, readyToReserve: false, score: 0, blockers: ['invalid-bounds'] };
    }
    if (!inBounds(minX, minZ) || !inBounds(maxX, maxZ)) {
      return { terrainSuitable: false, readyToReserve: false, score: 0, blockers: ['out-of-bounds'] };
    }
    // Include all terrain interpolation knots as well as a half-cell grid and
    // the perimeter. This catches interior pools/ridges missed by corner tests.
    const axis = (min: number, max: number) => {
      const values = new Set([min, max]);
      const count = Math.ceil((max - min) / (STEP / 2));
      for (let k = 1; k < count; k++) values.add(min + (max - min) * k / count);
      const first = Math.ceil((min + EXTENT / 2) / STEP - .5);
      const last = Math.floor((max + EXTENT / 2) / STEP - .5);
      for (let k = first; k <= last; k++) values.add((k + .5) * STEP - EXTENT / 2);
      return values;
    };
    const xs = axis(minX, maxX), zs = axis(minZ, maxZ);
    let firstLevel: number | undefined, scoreTotal = 0, count = 0;
    for (const x of xs) for (const z of zs) {
      const fact = this.inspect(x, z);
      if (!fact) { blockers.add('out-of-bounds'); continue; }
      if (fact.submerged) blockers.add('submerged');
      if (!fact.walkable) blockers.add('insufficient-clearance');
      if (!CLEARANCE_OFFSETS.every(([dx,dz])=>this.terrain.level(x+dx,z+dz)===fact.level)) blockers.add('insufficient-clearance');
      if (firstLevel === undefined) firstLevel = fact.level;
      if (fact.level !== firstLevel) blockers.add('uneven-terrain');
      if (kind === 'farm' && fact.fertilityEstimate < .3) blockers.add('low-fertility');
      scoreTotal += kind === 'home' ? 1 : fact.fertilityEstimate * (.4 + .6 * fact.moistureEstimate);
      count++;
    }
    const terrainSuitable = blockers.size === 0 && count > 0;
    if (context.reachable === undefined) blockers.add('reachability-unknown');
    else if (!context.reachable) blockers.add('unreachable');
    if (context.unoccupied === undefined) blockers.add('occupancy-unknown');
    else if (!context.unoccupied) blockers.add('occupied');
    if (kind === 'farm') {
      if (context.freshWaterSupplied === undefined) blockers.add('freshwater-unknown');
      else if (!context.freshWaterSupplied) blockers.add('no-freshwater');
    }
    return { terrainSuitable, readyToReserve: blockers.size === 0,
      score: terrainSuitable ? scoreTotal / count : 0, blockers: [...blockers] };
  }
}
