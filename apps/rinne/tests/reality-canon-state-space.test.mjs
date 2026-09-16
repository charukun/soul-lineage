import test from 'node:test';
import assert from 'node:assert/strict';
import {proveBoundedF1ScheduleStateSpace} from '../src/game/reality-lab/canon-state-space-proof.js';

test('bounded f=1 schedule exploration keeps Canon safety under arbitrary delivery/drop/crash ordering',()=>{
  const proof=proveBoundedF1ScheduleStateSpace({maxDepth:16,maxStates:100000});
  assert.equal(proof.pass,true);
  assert.ok(proof.explored>100,'proof should explore a non-trivial state space');
  assert.ok(proof.transitions>proof.explored);
  assert.ok(proof.visibleStates>0);
  assert.ok(proof.recoveredStates>0);
  assert.deepEqual(proof.violations,[]);
  assert.ok(proof.maxObservedDepth<=16);
});
