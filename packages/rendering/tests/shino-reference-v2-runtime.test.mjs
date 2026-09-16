import test from 'node:test';
import assert from 'node:assert/strict';
import {SHINO_REFERENCE_V2_BYTES,SHINO_REFERENCE_V2_SHA256} from '@soul/characters';
import {createShinoReferenceV2Pool,loadShinoReferenceV2Runtime} from '../src/shino-reference-v2-runtime.js';

test('shared Shino v2 runtime loader exposes the pinned receipt contract',()=>{
  assert.equal(SHINO_REFERENCE_V2_SHA256,'5f730603f1cd32f743ecbcdd279cf1d3233839fcf36277876a185abbf8eb3e2e');
  assert.equal(SHINO_REFERENCE_V2_BYTES,1453736);
  assert.equal(typeof loadShinoReferenceV2Runtime,'function');
  assert.equal(typeof createShinoReferenceV2Pool,'function');
});

test('shared Shino v2 loader and pool fail closed before touching unknown runtime bytes',async()=>{
  await assert.rejects(loadShinoReferenceV2Runtime(),/URL is required/);
  assert.throws(()=>createShinoReferenceV2Pool(null),/Audited Shino Reference v2 runtime is required/);
  assert.throws(()=>createShinoReferenceV2Pool({gltf:{scene:{}},rig:{},audit:{approved:false}}),/Audited Shino Reference v2 runtime is required/);
});
