import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),adaptive=fs.readFileSync(new URL('../src/adaptive-visual-performance.js',import.meta.url),'utf8'),resilience=fs.readFileSync(new URL('../src/runtime-resilience.js',import.meta.url),'utf8'),scale=fs.readFileSync(new URL('../src/shared-world-scale.js',import.meta.url),'utf8'),cpu=fs.readFileSync(new URL('../src/cpu-runtime-scale.js',import.meta.url),'utf8'),audio=fs.readFileSync(new URL('../src/web/audio.js',import.meta.url),'utf8'),online=fs.readFileSync(new URL('../src/web/online.js',import.meta.url),'utf8');

test('demon installs visual scale before CPU profiling bridge and game boot',()=>{assert.ok(main.indexOf("./authored-visual-lod.js")<main.indexOf("./stylized-visual-target.js"));assert.ok(main.indexOf("./stylized-visual-target.js")<main.indexOf("./adaptive-visual-performance.js"));assert.ok(main.indexOf("./adaptive-visual-performance.js")<main.indexOf("./runtime-resilience.js"));assert.ok(main.indexOf("./runtime-resilience.js")<main.indexOf("./shared-world-scale.js"));assert.ok(main.indexOf("./shared-world-scale.js")<main.indexOf("./cpu-runtime-scale.js"));assert.ok(main.indexOf("./cpu-runtime-scale.js")<main.indexOf("./web/main.js"));});

test('demon visual bridges keep combat authority outside presentation quality systems',()=>{for(const token of ['createGpuAwareQualityGovernor','createGpuTimer','createThermalTrendGovernor','applyVisualQualityFloor'])assert.match(adaptive,new RegExp(token));for(const token of ['installWebGLContextRecovery','createResourceLeakSentinel','view.spark','view.slash'])assert.match(resilience,new RegExp(token.replace('.','\\.')));assert.doesNotMatch(resilience,/game\.(player|village|time)\s*=/);});

test('demon shared-world scale smooths remote presence and profiles worker planning',()=>{for(const token of ['createWorldScaleWorker','createSnapshotInterpolator','createRuntimeProfiler','createCrowdPresenceRenderer','createAssetResidencyCache','__DEMON_WORLD_SCALE__'])assert.match(scale,new RegExp(token));assert.match(scale,/interpolationMode/);});

test('demon CPU bridge measures authoritative RaidSession tick without replacing it',()=>{assert.match(cpu,/RaidSession\.prototype\.tick/);assert.match(cpu,/tick\.apply\(this,args\)/);assert.match(cpu,/createRuntimeProfiler/);assert.doesNotMatch(cpu,/player\.(x|z)\s*=/);});

test('demon audio uses AudioWorklet category mixer with transparent fallback buses',()=>{for(const token of ['createAudioWorkletCategoryMixer','ambientBus','fxBus','__DEMON_AUDIO_WORKLET__'])assert.match(audio,new RegExp(token));assert.match(audio,/if\(mixer\.supported\)/);});

test('demon online path uses lossy presence channel and bounded reconciliation diagnostics',()=>{for(const token of ['dualChannel:true','createPresenceTransport','createPredictionReconciler','sendLocalState','snapshot-delta','__DEMON_NETWORK_SCALE__'])assert.match(online,new RegExp(token.replace('.','\\.')));assert.doesNotMatch(online,/game\.(player|village|time)\s*=/);});
