import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const adaptive=fs.readFileSync(new URL('../src/adaptive-visual-performance.js',import.meta.url),'utf8');
const resilience=fs.readFileSync(new URL('../src/runtime-resilience.js',import.meta.url),'utf8');

test('demon installs authored LOD, stylized, adaptive and resilience bridges in order',()=>{
  assert.ok(main.indexOf("./authored-visual-lod.js")<main.indexOf("./stylized-visual-target.js"));
  assert.ok(main.indexOf("./stylized-visual-target.js")<main.indexOf("./adaptive-visual-performance.js"));
  assert.ok(main.indexOf("./adaptive-visual-performance.js")<main.indexOf("./runtime-resilience.js"));
});

test('demon adaptive bridge controls GPU/CPU/thermal costs while preserving enemy quality floor',()=>{
  for(const token of ['createGpuAwareQualityGovernor','createGpuTimer','createThermalTrendGovernor','applyVisualQualityFloor','shadowScale','applyTextureQuality','vfxScale','createVisualDistanceStreamer','presentationDistance'])assert.match(adaptive,new RegExp(token));
});

test('demon resilience prewarms combat shaders and protects context loss recovery',()=>{
  for(const token of ['createShaderWarmupManager','createResourceLeakSentinel','installWebGLContextRecovery','installStylizedBakedLighting','installSilhouetteImpostorLOD','view.spark','view.slash'])assert.match(resilience,new RegExp(token.replace('.','\\.')));
  assert.match(resilience,/context-restored/);assert.match(resilience,/character-ready/);
  assert.match(resilience,/beforeChildren/);assert.match(resilience,/disposeWarmupMesh/);
  assert.doesNotMatch(resilience,/game\.(player|village|time)\s*=/);
});
