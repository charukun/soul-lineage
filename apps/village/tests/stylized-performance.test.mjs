import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const adaptive=fs.readFileSync(new URL('../src/adaptive-visual-performance.js',import.meta.url),'utf8');
const resilience=fs.readFileSync(new URL('../src/runtime-resilience.js',import.meta.url),'utf8');

test('village installs authored LOD, stylized, adaptive and resilience bridges in order',()=>{
  assert.ok(main.indexOf("./authored-visual-lod.js")<main.indexOf("./stylized-visual-target.js"));
  assert.ok(main.indexOf("./stylized-visual-target.js")<main.indexOf("./adaptive-visual-performance.js"));
  assert.ok(main.indexOf("./adaptive-visual-performance.js")<main.indexOf("./runtime-resilience.js"));
});

test('village adaptive bridge controls actual mobile render costs without hiding gameplay objects',()=>{
  for(const token of ['createGpuAwareQualityGovernor','createGpuTimer','createThermalTrendGovernor','renderScale','shadowScale','applyTextureQuality','vegetationScale','presentationDistance','createWorldCellStreamingPlan'])assert.match(adaptive,new RegExp(token));
  assert.doesNotMatch(adaptive,/objectNodes.*visible\s*=\s*false/);
});

test('village resilience keeps renderer recovery and quality-floor systems presentation-only',()=>{
  for(const token of ['createShaderWarmupManager','createResourceLeakSentinel','installWebGLContextRecovery','installStylizedBakedLighting','installSilhouetteImpostorLOD'])assert.match(resilience,new RegExp(token));
  assert.match(resilience,/context-restored/);assert.match(resilience,/rendererRecovery/);
  assert.doesNotMatch(resilience,/world\.(state|people|objects)\s*=/);
});
