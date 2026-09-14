import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const adaptive=fs.readFileSync(new URL('../src/adaptive-visual-performance.js',import.meta.url),'utf8');
const resilience=fs.readFileSync(new URL('../src/runtime-resilience.js',import.meta.url),'utf8');
const scale=fs.readFileSync(new URL('../src/shared-world-scale.js',import.meta.url),'utf8');

test('village installs authored LOD, adaptive, resilience and shared-world scale bridges in order',()=>{
 assert.ok(main.indexOf("./authored-visual-lod.js")<main.indexOf("./stylized-visual-target.js"));assert.ok(main.indexOf("./stylized-visual-target.js")<main.indexOf("./adaptive-visual-performance.js"));assert.ok(main.indexOf("./adaptive-visual-performance.js")<main.indexOf("./runtime-resilience.js"));assert.ok(main.indexOf("./runtime-resilience.js")<main.indexOf("./shared-world-scale.js"));
});

test('village adaptive bridge consumes learned device capability and runtime costs',()=>{
 for(const token of ['deviceCapabilityProfile','createGpuAwareQualityGovernor','createGpuTimer','createThermalTrendGovernor','renderScale','shadowScale','applyTextureQuality','vegetationScale','presentationDistance','createWorldCellStreamingPlan'])assert.match(adaptive,new RegExp(token));assert.doesNotMatch(adaptive,/objectNodes.*visible\s*=\s*false/);
});

test('village resilience keeps renderer recovery presentation-only',()=>{for(const token of ['createShaderWarmupManager','createResourceLeakSentinel','installWebGLContextRecovery','installStylizedBakedLighting','installSilhouetteImpostorLOD'])assert.match(resilience,new RegExp(token));assert.match(resilience,/context-restored/);assert.doesNotMatch(resilience,/world\.(state|people|objects)\s*=/);});

test('village shared-world scale offloads planning and exposes crowd audio cache and replay diagnostics',()=>{for(const token of ['createWorldScaleWorker','createCrowdPresenceRenderer','createAudioVoiceBudget','createAssetResidencyCache','runScaleReplay','probeExperimentalWebGPU','__VILLAGE_WORLD_SCALE__'])assert.match(scale,new RegExp(token));assert.doesNotMatch(scale,/world\.(state|people|objects)\s*=/);});
