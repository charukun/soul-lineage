import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const stack=fs.readFileSync(new URL('../src/runtime-scale-stack.js',import.meta.url),'utf8');
const adaptive=fs.readFileSync(new URL('../src/adaptive-visual-performance.js',import.meta.url),'utf8');
const assets=fs.readFileSync(new URL('../src/asset-visuals.js',import.meta.url),'utf8');
const resilience=fs.readFileSync(new URL('../src/runtime-resilience.js',import.meta.url),'utf8');
const scale=fs.readFileSync(new URL('../src/shared-world-scale.js',import.meta.url),'utf8');
const simulation=fs.readFileSync(new URL('../src/simulation-scale.js',import.meta.url),'utf8');
const saveStore=fs.readFileSync(new URL('../src/game/save-store.js',import.meta.url),'utf8');
const online=fs.readFileSync(new URL('../src/online.js',import.meta.url),'utf8');

test('village loads one ordered runtime module graph before game boot',()=>{
 assert.match(main,/runtime-scale-stack\.js/);assert.ok(main.indexOf("./runtime-scale-stack.js")<main.indexOf("./web/main.js"));
 assert.ok(stack.indexOf("./asset-visuals.js")<stack.indexOf("./authored-visual-lod.js"));assert.ok(stack.indexOf("./authored-visual-lod.js")<stack.indexOf("./stylized-visual-target.js"));assert.ok(stack.indexOf("./stylized-visual-target.js")<stack.indexOf("./adaptive-visual-performance.js"));assert.ok(stack.indexOf("./adaptive-visual-performance.js")<stack.indexOf("./runtime-resilience.js"));assert.ok(stack.indexOf("./runtime-resilience.js")<stack.indexOf("./shared-world-scale.js"));assert.ok(stack.indexOf("./shared-world-scale.js")<stack.indexOf("./simulation-scale.js"));
});

test('village GPU-aware bridge controls learned device, mobile render costs, transparency and thermal pressure without hiding gameplay objects',()=>{
  for(const token of ['deviceCapabilityProfile','createGpuAwareQualityGovernor','createGpuTimer','createPerformanceRecorder','createConservativeOcclusionCuller','createThermalTrendGovernor','applyVisualQualityFloor','auditTransparency','combineTransparencyAudits','transparentDrawCalls','transparentTriangleUpperBound','village-runtime-v1','signature','renderScale','shadowScale','applyTextureQuality','vegetationScale','presentationDistance','createWorldCellStreamingPlan'])assert.match(adaptive,new RegExp(token));
  assert.doesNotMatch(adaptive,/objectNodes.*visible\s*=\s*false/);
  assert.match(adaptive,/transparencyFrame\+\+%120/);
  assert.doesNotMatch(resilience,/world\.(state|people|objects)\s*=/);
});

test('village resilience keeps renderer recovery and quality-floor systems presentation-only',()=>{
  for(const token of ['createShaderWarmupManager','createResourceLeakSentinel','installWebGLContextRecovery','installStylizedBakedLighting','installSilhouetteImpostorLOD'])assert.match(resilience,new RegExp(token));
  assert.match(resilience,/context-restored/);assert.match(resilience,/rendererRecovery/);
  assert.doesNotMatch(resilience,/world\.(state|people|objects)\s*=/);
});

test('village repository assets use Meshopt/KTX2-capable loader with local Basis transcoder',()=>{
  assert.match(assets,/createCompressedGLTFLoader/);
  assert.match(assets,/basis\//);
  assert.match(assets,/meshopt:\s*true,\s*ktx2:\s*true/);
});
test('village world scale uses worker interpolation profiler crowd audio and residency cache',()=>{
 for(const token of ['createWorldScaleWorker','createSnapshotInterpolator','createRuntimeProfiler','createCrowdPresenceRenderer','createAudioVoiceBudget','createAssetResidencyCache','__VILLAGE_WORLD_SCALE__'])assert.match(scale,new RegExp(token));
});

test('village CPU scale wires fixed step spatial index flow field cadence and profiler without replacing save authority',()=>{
 for(const token of ['createFixedStepScheduler','createEntityCadenceScheduler','createSpatialIndex','createFlowFieldRouter','createRuntimeProfiler','Simulation.prototype.update','Navigation.prototype.route','__VILLAGE_SIMULATION_SCALE__'])assert.match(simulation,new RegExp(token.replace('.','\\.')));assert.match(simulation,/originalRoute/);assert.match(simulation,/Path following stays at the fixed 30 Hz/);assert.doesNotMatch(simulation,/platform\.storage/);
});

test('village shared-world scale offloads planning and exposes crowd audio cache and replay diagnostics',()=>{
  for(const token of ['createWorldScaleWorker','createCrowdPresenceRenderer','createAudioVoiceBudget','createAssetResidencyCache','runScaleReplay','probeExperimentalWebGPU','__VILLAGE_WORLD_SCALE__'])assert.match(scale,new RegExp(token));
  assert.doesNotMatch(scale,/world\.(state|people|objects)\s*=/);
});
test('village save store uses snapshot plus append-only journal compaction and no-op revision safety',()=>{
 for(const token of ['JOURNAL_KEY','COMPACT_KEY','createIncrementalPatch','appendJournalEntry','replayJournal','shouldCompactJournal'])assert.match(saveStore,new RegExp(token));assert.match(saveStore,/if\s*\(!ops\.length\)\s*\{\s*lastPayload\s*=\s*payload;\s*return;\s*\}/);assert.match(saveStore,/recovery/);
});
