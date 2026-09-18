import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntimeProfiler} from '../src/runtime-profiler.js';
import {createAudioWorkletCategoryMixer} from '../src/audio-worklet-mixer.js';

test('runtime profiler records named CPU sections with bounded summaries',async()=>{
 let now=0;const profiler=createRuntimeProfiler({PerformanceObserverCtor:null,performanceRef:{now:()=>now},capacity:4});profiler.measure('simulation',()=>{now+=12;});await profiler.measure('worker',async()=>{now+=7;});const snap=profiler.snapshot();assert.equal(snap.metrics.simulation.samples,1);assert.equal(snap.metrics.simulation.max,12);assert.equal(snap.metrics.worker.max,7);assert.equal(snap.errors,0);profiler.dispose();
});

test('runtime profiler records worker latency without allocating unbounded history',()=>{
 const profiler=createRuntimeProfiler({PerformanceObserverCtor:null,capacity:3});for(let i=0;i<10;i++)profiler.recordWorkerLatency(i);const snap=profiler.snapshot();assert.equal(snap.workerLatency.samples,3);assert.equal(snap.workerLatency.max,9);
});

test('audio worklet mixer fails open when AudioWorklet is unavailable',async()=>{
 const destination={},source={connected:null,connect(target){this.connected=target;}};const mixer=await createAudioWorkletCategoryMixer({destination},{destination});assert.equal(mixer.supported,false);mixer.connect(source,{category:'ambient'});assert.equal(source.connected,destination);
});
