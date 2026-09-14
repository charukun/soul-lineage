import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldScaleWorker} from '../src/world-scale-worker.js';
import {createAssetResidencyCache} from '../src/asset-residency.js';
import {detectDeviceCapability} from '../src/device-capability.js';

test('world-scale worker fails open to deterministic synchronous planner',async()=>{
 const client=createWorldScaleWorker({WorkerCtor:null});const plan=await client.plan({focus:{x:0,z:0},entities:[{id:'x',x:10,z:0}]});assert.equal(plan[0].tier,'near');assert.equal(client.snapshot().worker,false);client.dispose();
});

test('asset residency reuses cached response before network',async()=>{
 const rows=new Map();const store={match:async k=>rows.get(String(k))?.clone()||null,put:async(k,v)=>rows.set(String(k),v.clone()),keys:async()=>[],delete:async()=>true};
 const cachesImpl={open:async()=>store,delete:async()=>true};let calls=0;const cache=createAssetResidencyCache({version:'abc',cachesImpl,fetchImpl:async()=>{calls++;return new Response('asset',{status:200});}});
 assert.equal(await (await cache.fetch('https://example.test/model.glb',{hash:'h1'})).text(),'asset');assert.equal(await (await cache.fetch('https://example.test/model.glb',{hash:'h1'})).text(),'asset');assert.equal(calls,1);assert.ok(cache.snapshot().hits>=1);
});

test('device capability derives an initial quality without pretending a physical temperature',()=>{
 const renderer={getContext:()=>({MAX_TEXTURE_SIZE:1,MAX_TEXTURE_IMAGE_UNITS:2,getParameter:key=>key===1?8192:16})};const profile=detectDeviceCapability({renderer,windowRef:{devicePixelRatio:2,innerWidth:390},navigatorRef:{hardwareConcurrency:8,deviceMemory:8,userAgent:'Android'}});assert.equal(profile.targetFps,30);assert.ok(['high','mid','mobile','low'].includes(profile.tier));assert.equal('temperature' in profile,false);
});
