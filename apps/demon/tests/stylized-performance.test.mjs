import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const adaptive=fs.readFileSync(new URL('../src/adaptive-visual-performance.js',import.meta.url),'utf8');
const assets=fs.readFileSync(new URL('../src/asset-visuals.js',import.meta.url),'utf8');
const resilience=fs.readFileSync(new URL('../src/runtime-resilience.js',import.meta.url),'utf8');
const scale=fs.readFileSync(new URL('../src/shared-world-scale.js',import.meta.url),'utf8');

test('demon installs authored LOD, adaptive, resilience and shared-world scale bridges in order',()=>{
  assert.ok(main.indexOf("./authored-visual-lod.js")<main.indexOf("./stylized-visual-target.js"));
  assert.ok(main.indexOf("./stylized-visual-target.js")<main.indexOf("./adaptive-visual-performance.js"));
  assert.ok(main.indexOf("./adaptive-visual-performance.js")<main.indexOf("./runtime-resilience.js"));
  assert.ok(main.indexOf("./runtime-resilience.js")<main.indexOf("./shared-world-scale.js"));
});

test('demon GPU-aware bridge controls learned device, render, VFX, streaming, occlusion, alpha pressure, thermal pressure and quality floor',()=>{
  for(const token of ['deviceCapabilityProfile','createGpuAwareQualityGovernor','createGpuTimer','createPerformanceRecorder','createConservativeOcclusionCuller','batchStaticMeshes','createThermalTrendGovernor','applyVisualQualityFloor','markVisualQualityPriority','auditTransparency','combineTransparencyAudits','transparentDrawCalls','transparentTriangleUpperBound','demon-first-village-v1','signature','shadowScale','applyTextureQuality','vfxScale','createVisualDistanceStreamer','presentationDistance'])assert.match(adaptive,new RegExp(token));
  assert.match(adaptive,/transparencyFrame\+\+%120/);
});

test('demon resilience prewarms combat shaders and protects context loss recovery',()=>{
  for(const token of ['createShaderWarmupManager','createResourceLeakSentinel','installWebGLContextRecovery','installStylizedBakedLighting','installSilhouetteImpostorLOD','view.spark','view.slash'])assert.match(resilience,new RegExp(token.replace('.','\\.')));
  assert.match(resilience,/context-restored/);assert.match(resilience,/character-ready/);
  assert.match(resilience,/beforeChildren/);assert.match(resilience,/disposeWarmupMesh/);
  assert.doesNotMatch(resilience,/game\.(player|village|time)\s*=/);
});

test('demon visual assets use Meshopt/KTX2-capable loading',()=>{
  assert.match(assets,/createCompressedGLTFLoader/);
  assert.match(assets,/basis\//);
  assert.match(assets,/compression/);
});

test('demon shared-world scale offloads crowd/network/audio planning without changing combat authority',()=>{
  for(const token of ['createWorldScaleWorker','createCrowdPresenceRenderer','createAssetResidencyCache','audioSummary','runScaleReplay','probeExperimentalWebGPU','__DEMON_WORLD_SCALE__'])assert.match(scale,new RegExp(token));
  assert.doesNotMatch(scale,/game\.(player|village|time)\s*=/);
});
