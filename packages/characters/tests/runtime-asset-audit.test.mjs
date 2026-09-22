import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateCharacterLicensePolicy } from '../src/license-policy.js';

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

test('generated Shino Reference v2 DCC asset remains historical evidence and is not distributed',()=>{
  const asset=resolve('apps/rinne/public/simulator/assets/SHINO_REFERENCE_V2.vrm');
  const integrityURL=resolve('apps/rinne/public/simulator/assets/SHINO_REFERENCE_V2.asset.json');
  assert.equal(existsSync(asset),false);
  assert.equal(existsSync(integrityURL),false);
  const manifest=JSON.parse(readFileSync(resolve('packages/characters/production/shino-reference.production.json'),'utf8'));
  assert.equal(manifest.status.licensePolicy,'retired');
  assert.equal(manifest.status.distributionEligible,false);
  assert.deepEqual(evaluateCharacterLicensePolicy({id:'shino.reference.v2'}),{status:'retired',allowed:false,reason:'retired-conditional-character'});
});
