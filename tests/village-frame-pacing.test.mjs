import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { syncVillageRenderResolution } from '../apps/village/src/render-resolution.js';
import { updateVegetationDensity } from '../apps/village/src/vegetation-density.js';

const source = name => readFileSync(new URL(`../apps/village/src/${name}.js`, import.meta.url), 'utf8');
function installModule(name, dependencies) {
  // Execute the actual prototype patch; inject only browser/rendering boundaries.
  const code = source(name).replace(/^import .*;\s*$/gm, '');
  new Function(...Object.keys(dependencies), code)(...Object.values(dependencies));
}
function renderer(ratio = 1.5) {
  return { ratio, changes: [], getPixelRatio() { return this.ratio; }, setPixelRatio(value) { this.ratio = value; this.changes.push(value); } };
}
function matrix(x, z, size = 1) {
  const elements = new Float64Array(16); elements[0] = elements[5] = elements[10] = size; elements[15] = 1; elements[12] = x; elements[14] = z;
  return { elements };
}
function meshAt(points) {
  const base = points.map(([x, z]) => matrix(x, z));
  return { userData: { stylizedDensityBase: base }, current: [...base], writes: [], instanceMatrix: { needsUpdate: false }, setMatrixAt(index, value) { this.current[index] = value; this.writes.push(index); } };
}

test('adaptive resolution reaches the real drawing buffer without changing CSS coordinates', () => {
  const view = { renderer: renderer(), renderScale: .64, w: 393, h: 852 };
  assert.equal(syncVillageRenderResolution(view, 3), .96);
  assert.equal(view.renderer.ratio, .96);
  assert.deepEqual([view.w, view.h], [393, 852]);
  assert.ok(Math.abs((.96 / 1.5) ** 2 - .4096) < 1e-12);
  for (let i = 0; i < 100; i++) syncVillageRenderResolution(view, 3);
  assert.equal(view.renderer.changes.length, 1, 'unchanged quality must not reallocate');
  view.renderScale = 1;
  syncVillageRenderResolution(view, 3);
  assert.equal(view.renderer.ratio, 1.5, 'quality recovery restores the original cap');
});

test('resolution preserves software scale, low-DPR devices, and invalid-value fallback', () => {
  const view = { renderer: renderer(), renderScale: .75 };
  assert.equal(syncVillageRenderResolution(view, 1), .75);
  assert.equal(syncVillageRenderResolution(view, 2), 1.125);
  view.renderScale = NaN;
  assert.equal(syncVillageRenderResolution(view, undefined), 1);
  view.renderScale = 0;
  assert.equal(syncVillageRenderResolution(view, 0), 1);
});

test('actual resize wrapper updates pixel ratio before the canvas and MiniatureFocus', () => {
  const events = [];
  class View {
    resize(marker) { events.push(['canvas', this.renderer.ratio, marker]); return 'resized'; }
  }
  installModule('runtime-render-optimization', { View, syncVillageRenderResolution: view => syncVillageRenderResolution(view, 3), createMiniatureFocus() {}, createStaticBatchController() {}, defs: {} });
  const view = new View(); view.renderScale = .64; view.renderer = renderer();
  view.miniatureFocus = { resize() { events.push(['focus', view.renderer.ratio]); } };
  assert.equal(view.resize('keep-args'), 'resized');
  assert.deepEqual(events, [['canvas', .96, 'keep-args'], ['focus', .96]]);
});

test('density writes only changed visibility and never recomputes stable ranks', () => {
  const mesh = meshAt([[0, 0], [10, 0], [20, 0], [30, 0]]), hidden = matrix(0, 0, 0);
  let ranks = 0;
  const options = { densityAtDistance: distance => distance < 15 ? 1 : .25, rankAtIndex: () => { ranks++; return .5; }, hiddenMatrix: hidden };
  assert.equal(updateVegetationDensity(mesh, { x: 0, z: 0 }, 1, options), 2);
  assert.deepEqual(mesh.writes, [2, 3]);
  assert.equal(mesh.instanceMatrix.needsUpdate, true);
  mesh.instanceMatrix.needsUpdate = false; mesh.writes.length = 0;
  for (let i = 0; i < 100; i++) assert.equal(updateVegetationDensity(mesh, { x: 0, z: 0 }, 1, options), 0);
  assert.equal(ranks, 4);
  assert.equal(mesh.instanceMatrix.needsUpdate, false);
  assert.equal(updateVegetationDensity(mesh, { x: 30, z: 0 }, 1, options), 4);
  assert.deepEqual(mesh.writes, [0, 1, 2, 3]);
  assert.equal(mesh.current[2], mesh.userData.stylizedDensityBase[2]);
});

test('quality changes and same-count footprint replacement keep the correct matrices', () => {
  const mesh = meshAt([[0, 0], [1, 0]]), hidden = matrix(0, 0, 0);
  const options = { densityAtDistance: () => 1, rankAtIndex: i => [.2, .8][i], hiddenMatrix: hidden };
  assert.equal(updateVegetationDensity(mesh, { x: 0, z: 0 }, .5, options), 1);
  assert.equal(updateVegetationDensity(mesh, { x: 0, z: 0 }, 1, options), 1);
  const replacement = [matrix(8, 9, 0), matrix(10, 11)];
  mesh.userData.stylizedDensityBase = replacement; mesh.current = [...replacement];
  assert.equal(updateVegetationDensity(mesh, { x: 0, z: 0 }, .5, options), 1);
  assert.equal(mesh.current[0], replacement[0], 'construction-covered vegetation stays covered');
  assert.equal(mesh.current[1], hidden);
  assert.equal(replacement[0].elements[0], 0, 'authoritative base is never mutated');
});

test('empty vegetation is safe and large unchanged fields do not upload again', () => {
  assert.equal(updateVegetationDensity({ userData: {} }, {}, 1, {}), 0);
  const mesh = meshAt(Array.from({ length: 4096 }, (_, i) => [i, 0])), hidden = matrix(0, 0, 0);
  const options = { densityAtDistance: () => .5, rankAtIndex: i => (i % 10) / 10, hiddenMatrix: hidden };
  const first = updateVegetationDensity(mesh, { x: 0, z: 0 }, 1, options);
  assert.ok(first > 0 && first < 4096);
  mesh.instanceMatrix.needsUpdate = false;
  const writes = mesh.writes.length;
  assert.equal(updateVegetationDensity(mesh, { x: 5, z: 0 }, 1, options), 0);
  assert.equal(mesh.writes.length, writes);
  assert.equal(mesh.instanceMatrix.needsUpdate, false);
});

test('actual stylized render uses one canonical adaptive mask before rendering', () => {
  const events = [];
  class Matrix4 { makeScale() { return this; } }
  class View { rebuild() { return { changed: false, vegetationChanged: false }; } render() { events.push('render'); return 'frame'; } }
  installModule('stylized-visual-target', { View, T: { Matrix4 }, stylizedDensityForDistance: () => .5, applyStylizedArtProfile() {}, installStylizedGeometryLOD() {}, stylizedArtDiagnostics() {}, instanceDensityIndex: (_mesh, index, seed) => { assert.equal(seed, 31); return index; }, updateVegetationDensity: (_mesh, _target, scale, options) => { events.push(['density', scale, options.rankAtIndex(7)]); } });
  const view = new View(); Object.assign(view, { target: { x: 0, z: 0 }, span: 38, forestMeshes: [{}], __stylizedQuality: { profile: { vegetationScale: .6 } } });
  assert.equal(view.render(), 'frame');
  const x = Math.sin(8 * 73.173 + 11.7) * 43758.5453;
  assert.deepEqual(events, [['density', .6, x - Math.floor(x)], 'render']);
  events.length = 0; view.render(); assert.deepEqual(events, ['render']);
  view.__stylizedQuality.profile.vegetationScale = .4;
  events.length = 0; view.render(); assert.equal(events[0][1], .4);
  assert.doesNotMatch(source('adaptive-visual-performance'), /applyAdaptiveVegetation|setMatrixAt/);
});
