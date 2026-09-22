import test from 'node:test';
import assert from 'node:assert/strict';
import {Hi3DGenJob,Hi3DGenRateLimit} from '../worker.mjs';

class MemoryStorage{
  constructor(){this.map=new Map();this.alarm=null}
  async get(key){return this.map.get(key)}
  async put(key,value){this.map.set(key,value)}
  async delete(key){this.map.delete(key)}
  async deleteAll(){this.map.clear()}
  async setAlarm(value){this.alarm=value}
}
const state=()=>({storage:new MemoryStorage()});
function glb(){
  const bytes=new ArrayBuffer(24),view=new DataView(bytes);
  view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,24,true);
  return bytes;
}
const request={schema:1,id:'hi3dgen-test-v1',label:'test',usage:'experimental-review',productionEligible:false,consentToPublicInference:true,images:[{path:'assets/generated/hi3dgen/inputs/test.png',view:'front',author:'test',license:'CC0-1.0',source:'test'}],provider:{id:'hi3dgen-hf',endpoint:'https://stable-x-hi3dgen.hf.space'},parameters:{seed:1,ssGuidanceStrength:3,ssSamplingSteps:10,slatGuidanceStrength:3,slatSamplingSteps:6},postprocess:{heightMeters:.45,yawDegrees:0,maxTriangles:12000}};

test('async Hi3DGen job survives request boundary and stores result',async()=>{
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async(url)=>{
    calls.push(String(url));
    if(String(url).endsWith('/gradio_api/upload'))return Response.json(['/tmp/input.png']);
    if(String(url).endsWith('/gradio_api/call/generate_3d'))return Response.json({event_id:'evt_test'});
    if(String(url).endsWith('/gradio_api/call/generate_3d/evt_test'))return new Response('event: complete\ndata: '+JSON.stringify([null,null,{path:'/tmp/output.glb'}])+'\n\n');
    if(String(url).includes('/gradio_api/file='))return new Response(glb(),{headers:{'content-type':'model/gltf-binary'}});
    throw new Error('unexpected fetch '+url);
  };
  try{
    const s=state(),job=new Hi3DGenJob(s),form=new FormData();form.append('image',new File([new Uint8Array([1,2,3])],'test.png',{type:'image/png'}));form.append('request',JSON.stringify(request));
    const init=await job.fetch(new Request('https://internal/internal/init',{method:'POST',body:form,headers:{'x-hi3dgen-job-id':'11111111-1111-4111-8111-111111111111'}}));
    assert.equal(init.status,202);assert.ok(s.storage.alarm);
    await job.alarm();
    const status=await (await job.fetch(new Request('https://internal/internal/status'))).json();
    assert.equal(status.status,'completed');assert.equal(status.progress,100);assert.equal(status.result.byteLength,24);assert.match(status.result.sha256,/^[a-f0-9]{64}$/);
    const result=await job.fetch(new Request('https://internal/internal/result'));assert.equal(result.status,200);assert.equal((await result.arrayBuffer()).byteLength,24);
    assert.equal(calls.length,4);
  }finally{globalThis.fetch=original}
});

test('rate limiter caps public generation jobs per window',async()=>{
  const limiter=new Hi3DGenRateLimit(state());
  for(let i=0;i<6;i++)assert.equal((await limiter.fetch(new Request('https://internal/take',{method:'POST'}))).status,200);
  assert.equal((await limiter.fetch(new Request('https://internal/take',{method:'POST'}))).status,429);
});
