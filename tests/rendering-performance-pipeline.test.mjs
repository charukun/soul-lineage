import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('compressed asset path prepares local Basis transcoders for all apps', () => {
  const prep=read('scripts/prepare-basis-assets.mjs');
  assert.match(prep,/three\/examples\/jsm\/libs\/basis/);
  assert.match(prep,/basis_transcoder/);
  for(const app of ['rinne','village','demon']){
    const pkg=JSON.parse(read(`apps/${app}/package.json`));
    assert.match(pkg.scripts.prebuild,/prepare-basis-assets/);
    assert.match(pkg.scripts.predev,/prepare-basis-assets/);
  }
});

test('DCC LOD generator is silhouette guarded and refuses morph destruction', () => {
  const blender=read('scripts/blender/generate-lods.py');
  const wrapper=read('scripts/generate-lods.mjs');
  assert.match(blender,/shape keys require authored LOD/);
  assert.match(blender,/front','side','diag/);
  assert.match(blender,/material slot count changed/);
  assert.match(blender,/UV layer count changed/);
  assert.match(wrapper,/BLENDER_BIN/);
  assert.match(wrapper,/generate-lods\.py/);
});

test('apps consume GPU timing, compression, occlusion and performance capture', () => {
  const village=read('apps/village/src/adaptive-visual-performance.js');
  const demon=read('apps/demon/src/adaptive-visual-performance.js');
  const villageAssets=read('apps/village/src/asset-visuals.js');
  const demonAssets=read('apps/demon/src/asset-visuals.js');
  for(const source of [village,demon]){
    assert.match(source,/createGpuTimer/);
    assert.match(source,/createGpuAwareQualityGovernor/);
    assert.match(source,/createPerformanceRecorder/);
    assert.match(source,/createConservativeOcclusionCuller/);
  }
  assert.match(demon,/batchStaticMeshes/);
  assert.match(villageAssets,/createCompressedGLTFLoader/);
  assert.match(demonAssets,/createCompressedGLTFLoader/);
  assert.match(villageAssets,/basis\//);
  assert.match(demonAssets,/basis\//);
});

test('performance and compression tools are wired at repository root', () => {
  const pkg=JSON.parse(read('package.json'));
  assert.match(pkg.scripts['performance:compare'],/performance-regression/);
  assert.match(pkg.scripts['performance:browser'],/performance-smoke/);
  assert.match(pkg.scripts['lod:generate'],/generate-lods/);
  assert.match(pkg.scripts['gltf:compress'],/compress-gltf/);
  assert.match(pkg.scripts['rendering:transcoders'],/prepare-basis-assets/);
  assert.match(read('scripts/performance-regression.mjs'),/comparePerformanceSnapshots/);
  assert.match(read('scripts/browser/performance-smoke.mjs'),/__VILLAGE_ADAPTIVE_QUALITY__/);
  assert.match(read('scripts/browser/performance-smoke.mjs'),/__DEMON_ADAPTIVE_QUALITY__/);
  const compress=read('scripts/compress-gltf.mjs');
  assert.match(compress,/GLTFPACK_BIN/);
  assert.match(compress,/'-cc'/);
  assert.match(compress,/'-tc'/);
});

test('existing browser evidence path automatically stores performance snapshots',()=>{
  const media=read('scripts/browser/media-diagnostics.mjs');
  assert.match(media,/performance\.json/);
  assert.match(media,/__VILLAGE_ADAPTIVE_QUALITY__/);
  assert.match(media,/__DEMON_ADAPTIVE_QUALITY__/);
});
