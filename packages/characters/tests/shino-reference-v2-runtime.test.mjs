import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  MASTER_ID,
  SHINO_REFERENCE_V2_ASSET_ID,
  SHINO_REFERENCE_V2_BYTES,
  SHINO_REFERENCE_V2_ID,
  SHINO_REFERENCE_V2_INTEGRITY,
  SHINO_REFERENCE_V2_RUNTIME,
  SHINO_REFERENCE_V2_SHA256
} from '../src/index.js';

const sidecar=JSON.parse(readFileSync(new URL('../../../apps/rinne/public/simulator/assets/SHINO_REFERENCE_V2.asset.json',import.meta.url),'utf8'));

test('shared Shino v2 descriptor exactly matches the committed asset integrity receipt',()=>{
  assert.equal(SHINO_REFERENCE_V2_ID,sidecar.id);
  assert.equal(SHINO_REFERENCE_V2_ASSET_ID,sidecar.assetId);
  assert.equal(SHINO_REFERENCE_V2_SHA256,sidecar.sha256);
  assert.equal(SHINO_REFERENCE_V2_BYTES,sidecar.bytes);
  for(const key of ['schema','version','id','assetId','format','path','sha256','bytes','productionStage','modelingMode','sourceBlendSha256','humanoidRig','referencePath','visualApproval']){
    assert.deepEqual(SHINO_REFERENCE_V2_INTEGRITY[key],sidecar[key],`integrity mismatch: ${key}`);
  }
});

test('shared Shino v2 remains a non-procedural PRIMARY candidate until later gates approve it',()=>{
  assert.equal(SHINO_REFERENCE_V2_RUNTIME.familyId,MASTER_ID);
  assert.equal(SHINO_REFERENCE_V2_RUNTIME.modelId,SHINO_REFERENCE_V2_ID);
  assert.equal(SHINO_REFERENCE_V2_RUNTIME.productionStage,'PRIMARY');
  assert.equal(SHINO_REFERENCE_V2_RUNTIME.modelingMode,'dcc-blender');
  assert.equal(SHINO_REFERENCE_V2_RUNTIME.productionReady,false);
  assert.equal(SHINO_REFERENCE_V2_RUNTIME.visualApproval,'pending');
  assert.equal(SHINO_REFERENCE_V2_RUNTIME.procedural,false);
  assert.ok(Object.isFrozen(SHINO_REFERENCE_V2_RUNTIME));
  assert.ok(Object.isFrozen(SHINO_REFERENCE_V2_RUNTIME.integrity));
});
