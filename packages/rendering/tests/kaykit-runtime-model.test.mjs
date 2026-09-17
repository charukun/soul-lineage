import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gitBlobSha,verifyKaykitRuntimeBytes} from '../src/kaykit-runtime-model.js';

const bytes=new Uint8Array([1,2,3,4,5]);
const expected=createHash('sha1').update(Buffer.from(`blob ${bytes.byteLength}\0`)).update(bytes).digest('hex');
const model={label:'Fixture',runtime:{url:'./Fixture.glb'},source:{byteLength:bytes.byteLength,gitBlobSha:expected}};

test('shared KayKit loader verifies Git blob identity, not only byte count',async()=>{
  assert.equal(await gitBlobSha(bytes),expected);
  assert.equal((await verifyKaykitRuntimeBytes(model,bytes)).byteLength,bytes.byteLength);
  await assert.rejects(()=>verifyKaykitRuntimeBytes({...model,source:{...model.source,gitBlobSha:'0'.repeat(40)}},bytes),/Git blob mismatch/);
});

test('shared KayKit loader rejects oversized or truncated bytes',async()=>{
  await assert.rejects(()=>verifyKaykitRuntimeBytes(model,new Uint8Array([1,2,3])),/size mismatch/);
  await assert.rejects(()=>verifyKaykitRuntimeBytes(model,bytes,{maxBytes:4}),/size mismatch/);
});
