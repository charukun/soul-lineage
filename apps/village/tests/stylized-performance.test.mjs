import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const stack=fs.readFileSync(new URL('../src/runtime-scale-stack.js',import.meta.url),'utf8');
const adaptive=fs.readFileSync(new URL('../src/adaptive-visual-performance.js',import.meta.url),'utf8');
const resilience=fs.readFileSync(new URL('../src/runtime-resilience.js',import.meta.url),'utf8');
const scale=fs.readFileSync(new URL('../src/shared-world-scale.js',import.meta.url),'utf8');
const simulation=fs.readFileSync(new URL('../src/simulation-scale.js',import.meta.url),'utf8');
const saveStore=fs.readFileSync(new URL('../src/game/save-store.js',import.meta.url),'utf8');
const online=fs.readFileSync(new URL('../src/online.js',import.meta.url),'utf8');

test('village loads one ordered runtime module graph before game boot',()=>{
 assert.match(main,/runtime-scale-stack\.js/);assert.ok(main.indexOf("./runtime-scale-stack.js")<main.indexOf("./web/main.js"));
 assert.ok(stack.indexOf("./asset-visuals.js")<stack.indexOf("./authored-visual-lod.js"));assert.ok(stack.indexOf("./authored-visual-lod.js")<stack.indexOf("./stylized-visual-target.js"));assert.ok(stack.indexOf("./stylized-visual-target.js")<stack.indexOf("./adaptive-visual-performance.js"));assert.ok(stack.indexOf("./adaptive-visual-performance.js")<stack.indexOf("./runtime-resilience.js"));assert.ok(stack.indexOf("./runtime-resilience.js")<stack.indexOf("./shared-world-scale.js"));assert.ok(stack.indexOf("./shared-world-scale.js")<stack.indexOf("./simulation-scale.js"));
});

test('village adaptive and resilience bridges remain presentation-only',()=>{
 for(const token of ['deviceCapabilityProfile','createGpuAwareQualityGovernor','createGpuTimer','createThermalTrendGovernor','renderScale','shadowScale','vegetationScale'])assert.match(adaptive,new RegExp(token));for(const token of ['createShaderWarmupManager','installWebGLContextRecovery','installSilhouetteImpostorLOD'])assert.match(resilience,new RegExp(token));assert.doesNotMatch(resilience,/world\.(state|people|objects)\s*=/);
});

test('village world scale uses worker interpolation profiler crowd audio and residency cache',()=>{
 for(const token of ['createWorldScaleWorker','createSnapshotInterpolator','createRuntimeProfiler','createCrowdPresenceRenderer','createAudioVoiceBudget','createAssetResidencyCache','__VILLAGE_WORLD_SCALE__'])assert.match(scale,new RegExp(token));
});

test('village CPU scale wires fixed step spatial index flow field cadence and profiler without replacing save authority',()=>{
 for(const token of ['createFixedStepScheduler','createEntityCadenceScheduler','createSpatialIndex','createFlowFieldRouter','createRuntimeProfiler','Simulation.prototype.update','Navigation.prototype.route','__VILLAGE_SIMULATION_SCALE__'])assert.match(simulation,new RegExp(token.replace('.','\\.')));assert.match(simulation,/originalRoute/);assert.match(simulation,/Path following stays at the fixed 30 Hz/);assert.doesNotMatch(simulation,/platform\.storage/);
});

test('village save store uses snapshot plus append-only journal compaction and no-op revision safety',()=>{
 for(const token of ['JOURNAL_KEY','COMPACT_KEY','createIncrementalPatch','appendJournalEntry','replayJournal','shouldCompactJournal'])assert.match(saveStore,new RegExp(token));assert.match(saveStore,/if\(!ops\.length\)\{lastPayload=payload;return;\}/);assert.match(saveStore,/recovery/);
});

test('village host sends observer-specific presence on dual channel while authority ticks once',()=>{
 for(const token of ['dualChannel:true','createPresenceTransport','host.snapshotFor','sendObserverSnapshot','host.tick(dt)'])assert.match(online,new RegExp(token.replace('.','\\.')));assert.doesNotMatch(online,/host\.tick\(dt,\{observerId/);
});
