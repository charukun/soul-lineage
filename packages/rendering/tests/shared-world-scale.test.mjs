import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene} from 'three';
import {createCrowdPresenceRenderer} from '../src/crowd-presence.js';
import {createDeterministicScaleReplay,runScaleReplay} from '../src/replay-benchmark.js';
import {probeExperimentalWebGPU,selectRendererBackend} from '../src/webgpu-experimental.js';
import {planWorldScale} from '@soul/world/scale-policy';

test('crowd presence proxy keeps hundreds of far people at two draw-call meshes',()=>{
 const scene=new Scene(),crowd=createCrowdPresenceRenderer(scene,{capacity:300});const count=crowd.update(Array.from({length:200},(_,i)=>({id:String(i),x:i,z:0,crowdMode:'proxy'})));assert.equal(count,200);assert.equal(crowd.snapshot().drawCalls,2);crowd.dispose();assert.equal(scene.children.length,0);
});

test('deterministic replay is stable for the same seed and runs the shared planner',async()=>{
 const a=createDeterministicScaleReplay({seed:7}),b=createDeterministicScaleReplay({seed:7});assert.deepEqual(a,b);let t=0;const report=await runScaleReplay({replay:a,planner:payload=>planWorldScale(payload),now:()=>++t});assert.equal(report.frames.length,a.frames.length);assert.ok(report.frames.every(row=>row.entities>0));
});

test('WebGPU stays experimental and WebGL2 remains default',async()=>{
 const probe=await probeExperimentalWebGPU({navigatorRef:{}});assert.equal(probe.available,false);assert.equal(selectRendererBackend({webgpuAvailable:true,experimental:false}),'webgl2');assert.equal(selectRendererBackend({webgpuAvailable:true,experimental:true}),'webgpu-experimental');
});
