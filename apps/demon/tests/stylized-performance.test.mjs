import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const adaptive=fs.readFileSync(new URL('../src/adaptive-visual-performance.js',import.meta.url),'utf8');
const assets=fs.readFileSync(new URL('../src/asset-visuals.js',import.meta.url),'utf8');

test('demon installs authored LOD before stylized and adaptive runtime bridges',()=>{
  assert.ok(main.indexOf("./authored-visual-lod.js")<main.indexOf("./stylized-visual-target.js"));
  assert.ok(main.indexOf("./stylized-visual-target.js")<main.indexOf("./adaptive-visual-performance.js"));
});

test('demon GPU-aware bridge controls render, VFX, streaming, occlusion and static batching',()=>{
  for(const token of ['createGpuAwareQualityGovernor','createGpuTimer','createPerformanceRecorder','createConservativeOcclusionCuller','batchStaticMeshes','shadowScale','applyTextureQuality','vfxScale','createVisualDistanceStreamer','presentationDistance'])assert.match(adaptive,new RegExp(token));
});

test('demon visual assets use Meshopt/KTX2-capable loading',()=>{
  assert.match(assets,/createCompressedGLTFLoader/);
  assert.match(assets,/basis\//);
  assert.match(assets,/compression/);
});
