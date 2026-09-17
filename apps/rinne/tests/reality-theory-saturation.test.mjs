import test from 'node:test';
import assert from 'node:assert/strict';
import {THEORY_SATURATION_REQUIREMENTS,classifyRrpTheorySaturation} from '../src/game/reality-lab/theory-saturation.js';
import {runRrpTheoryVerificationSuite} from '../src/game/reality-lab/theory-verification.js';

test('combined theory suite leaves no unclassified model-addressable item in declared scope',()=>{
  const suite=runRrpTheoryVerificationSuite();assert.equal(suite.pass,true);assert.equal(suite.saturation.pass,true);assert.deepEqual(suite.saturation.modelAddressableOpen,[]);assert.equal(suite.saturation.addressed.length,THEORY_SATURATION_REQUIREMENTS.length);assert.ok(suite.saturation.deferred.some(row=>row.class==='physical-evidence'));assert.ok(suite.saturation.deferred.some(row=>row.class==='impossibility-boundary'));
});

test('saturation gate reopens when a required proof boundary is missing',()=>{
  const boundaries=Object.fromEntries(THEORY_SATURATION_REQUIREMENTS.map(key=>[key,true]));boundaries.packetInterleavings=false;const result=classifyRrpTheorySaturation(boundaries);assert.equal(result.pass,false);assert.deepEqual(result.modelAddressableOpen,['packetInterleavings']);
});
