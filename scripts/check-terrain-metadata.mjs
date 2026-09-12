import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const project = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(resolve(project, 'work'), { recursive: true });
const temp = mkdtempSync(resolve(project, 'work/metadata-tests-'));
after(() => rmSync(temp, { recursive: true, force: true }));
for (const name of ['food-balance','food-system','food-save','terrain', 'navigation', 'terrain-metadata']) {
  const source = readFileSync(resolve(project, `lib/game/${name}.ts`), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText.replace(/from ['"]\.\/([a-z-]+)['"]/g, "from './$1.mjs'");
  writeFileSync(resolve(temp, `${name}.mjs`), compiled);
}
const { Terrain, SEA, STEP, EXTENT, layerY } = await import(pathToFileURL(resolve(temp, 'terrain.mjs')));
const { TerrainMetadata } = await import(pathToFileURL(resolve(temp, 'terrain-metadata.mjs')));
const bounds = { minX: -12, maxX: -10, minZ: -2, maxZ: 0 };
const known = { reachable: true, unoccupied: true, freshWaterSupplied: true };

test('physical terrace height and clearance remain compatible with the prototype', () => {
  const terrain = new Terrain();
  try {
    const metadata = new TerrainMetadata(terrain);
    const fact = metadata.inspect(-11, -1);
    assert.equal(fact.elevation, layerY(terrain.level(-11, -1)));
    assert.ok(Math.abs(terrain.height(-11, -1) - fact.elevation - .065) < 1e-9);
    assert.equal(fact.submerged, fact.elevation <= SEA);
    assert.ok(Number.isFinite(fact.slope));
    assert.ok(fact.fertilityEstimate >= 0 && fact.fertilityEstimate <= 1);
  } finally { terrain.dispose(); }
});

test('queries are lazy, read-only, and reject invalid/outside sample coordinates', () => {
  let reads = 0;
  const metadata = new TerrainMetadata({ level() { reads++; return 12; } });
  assert.equal(reads, 0);
  metadata.invalidate();
  assert.equal(reads, 0);
  for (const [x, z] of [[NaN, 0], [0, Infinity], [-EXTENT / 2, 0], [EXTENT / 2 - STEP / 2, 0]]) {
    assert.equal(metadata.inspect(x, z), null);
  }
  assert.equal(reads, 0);
  assert.ok(metadata.inspect(-EXTENT / 2 + STEP / 2 + 1e-9, 0));
  assert.ok(reads > 0);
  assert.equal(metadata.inspect(0, 0).waterDistance, Infinity);
});

test('terrain candidates need explicit occupancy and reachability before reservation', () => {
  const metadata = new TerrainMetadata({ level: () => 12 });
  const unknown = metadata.assessPlot('home', bounds);
  assert.equal(unknown.terrainSuitable, true);
  assert.equal(unknown.readyToReserve, false);
  assert.deepEqual(unknown.blockers, ['reachability-unknown', 'occupancy-unknown']);
  assert.equal(metadata.assessPlot('home', bounds, known).readyToReserve, true);
  assert.ok(metadata.assessPlot('home', bounds, { ...known, reachable: false }).blockers.includes('unreachable'));
  assert.ok(metadata.assessPlot('home', bounds, { ...known, unoccupied: false }).blockers.includes('occupied'));
});

test('water proximity never substitutes for freshwater supply', () => {
  const metadata = new TerrainMetadata({ level: (_x, z) => z > 1 ? 2 : 12 });
  assert.ok(Number.isFinite(metadata.inspect(-11, -1).waterDistance));
  const unknown = metadata.assessPlot('farm', bounds, { reachable: true, unoccupied: true });
  assert.equal(unknown.terrainSuitable, true);
  assert.equal(unknown.readyToReserve, false);
  assert.ok(unknown.blockers.includes('freshwater-unknown'));
  assert.equal(metadata.assessPlot('farm', bounds, known).readyToReserve, true);
  assert.ok(metadata.assessPlot('farm', bounds, { ...known, freshWaterSupplied: false }).blockers.includes('no-freshwater'));
});

test('footprint interiors reject a pool despite dry level corners', () => {
  const metadata = new TerrainMetadata({ level: (x, z) => Math.hypot(x + 11, z + 1) < .45 ? 2 : 12 });
  for (const x of [-12, -10]) for (const z of [-2, 0]) assert.equal(metadata.inspect(x, z).submerged, false);
  const result = metadata.assessPlot('home', bounds, known);
  assert.equal(result.terrainSuitable, false);
  assert.equal(result.readyToReserve, false);
  assert.ok(result.blockers.includes('submerged'));
  assert.ok(result.blockers.includes('uneven-terrain'));
});

test('symmetric cliffs produce nonzero slope and an uneven plot', () => {
  const metadata = new TerrainMetadata({ level: (x) => Math.abs(x + 11) < .4 ? 12 : 15 });
  assert.ok(metadata.inspect(-11, -1).slope > 0);
  const result = metadata.assessPlot('home', bounds, known);
  assert.equal(result.readyToReserve, false);
  assert.ok(result.blockers.includes('uneven-terrain'));
});

test('wet, sandy, reversed and outside footprints fail with useful reasons', () => {
  const water = new TerrainMetadata({ level: () => 2 });
  assert.ok(water.assessPlot('home', bounds, known).blockers.includes('submerged'));
  const sand = new TerrainMetadata({ level: () => 6 });
  assert.ok(sand.assessPlot('farm', bounds, known).blockers.includes('low-fertility'));
  const land = new TerrainMetadata({ level: () => 12 });
  assert.deepEqual(land.assessPlot('home', { ...bounds, maxX: -13 }).blockers, ['invalid-bounds']);
  assert.deepEqual(land.assessPlot('home', { ...bounds, minX: NaN }).blockers, ['invalid-bounds']);
  assert.deepEqual(land.assessPlot('home', { ...bounds, minX: -116 }).blockers, ['out-of-bounds']);
});

test('sculpt and restoration refresh water, elevation and suitability without changing the snapshot', () => {
  const terrain = new Terrain();
  try {
    terrain.values.fill(6.8);
    const metadata = new TerrainMetadata(terrain);
    const saved = terrain.values.slice();
    const original = metadata.inspect(-11, -1);
    assert.equal(original.waterDistance, Infinity);
    assert.equal(metadata.assessPlot('home', bounds, known).readyToReserve, true);
    for (let i = 0; i < 20; i++) terrain.sculpt(-11, -1, 4, 'lower', 1);
    metadata.invalidate();
    assert.equal(metadata.inspect(-11, -1).submerged, true);
    assert.ok(metadata.inspect(-17, -1).waterDistance < Infinity);
    assert.equal(metadata.assessPlot('home', bounds, known).readyToReserve, false);
    assert.equal(original.submerged, false);
    assert.equal(original.waterDistance, Infinity);
    terrain.values.set(saved);
    metadata.invalidate();
    assert.deepEqual(metadata.inspect(-11, -1), original);
    assert.equal(metadata.assessPlot('home', bounds, known).readyToReserve, true);
    assert.deepEqual(terrain.values, saved);
  } finally { terrain.dispose(); }
});
