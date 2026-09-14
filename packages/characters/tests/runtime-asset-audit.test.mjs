import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { auditCharacterRuntimeDocument } from '../src/runtime-asset-audit.js';

function glbDocument(bytes){
  assert.equal(bytes.subarray(0,4).toString('ascii'),'glTF');
  assert.equal(bytes.readUInt32LE(4),2);
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  let offset=12;
  while(offset+8<=bytes.length){
    const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);offset+=8;
    const payload=bytes.subarray(offset,offset+length);offset+=length;
    if(type===0x4E4F534A)return JSON.parse(payload.toString('utf8').replace(/[\u0000\s]+$/,''));
  }
  throw new Error('GLB JSON chunk missing');
}

test('generated Shino Reference v2 DCC asset matches its exact-hash integrity record',()=>{
  const asset=new URL('../../../apps/rinne/public/simulator/assets/SHINO_REFERENCE_V2.vrm',import.meta.url);
  const integrityURL=new URL('../../../apps/rinne/public/simulator/assets/SHINO_REFERENCE_V2.asset.json',import.meta.url);
  const bytes=readFileSync(asset),integrity=JSON.parse(readFileSync(integrityURL,'utf8'));
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const result=auditCharacterRuntimeDocument(glbDocument(bytes),sha256,bytes.length,integrity);
  assert.equal(result.approved,true,result.errors.join(', '));
  assert.equal(result.id,'shino.reference.v2');
  assert.equal(result.productionStage,'PRIMARY');
  assert.equal(result.productionReady,false);
});
