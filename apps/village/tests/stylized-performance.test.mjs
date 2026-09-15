import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const adaptive=fs.readFileSync(new URL('../src/adaptive-visual-performance.js',import.meta.url),'utf8');
const assets=fs.readFileSync(new URL('../src/asset-visuals.js',import.meta.url),'utf8');

test('village installs authored LOD before stylized and adaptive runtime bridges',()=>{
  assert.ok(main.indexOf("./authored-visual-lod.js")<main.indexOf("./stylized-visual-target.js"));
  assert.ok(main.indexOf("./stylized-visual-target.js")<main.indexOf("./adaptive-visual-performance.js"));
});

test('village GPU-aware bridge controls mobile render costs without hiding gameplay objects',()=>{
  for(const token of ['createGpuAwareQualityGovernor','createGpuTimer','createPerformanceRecorder','createConservativeOcclusionCuller','auditTransparency','combineTransparencyAudits','transparentDrawCalls','transparentTriangleUpperBound','renderScale','shadowScale','applyTextureQuality','vegetationScale','presentationDistance','createWorldCellStreamingPlan'])assert.match(adaptive,new RegExp(token));
  assert.doesNotMatch(adaptive,/objectNodes.*visible\s*=\s*false/);
  assert.match(adaptive,/transparencyFrame\+\+%120/);
});

test('village repository assets use Meshopt/KTX2-capable loader with local Basis transcoder',()=>{
  assert.match(assets,/createCompressedGLTFLoader/);
  assert.match(assets,/basis\//);
  assert.match(assets,/meshopt:\s*true,\s*ktx2:\s*true/);
});
