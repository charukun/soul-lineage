import test from 'node:test';
import assert from 'node:assert/strict';
import {HANDOFF_PHASE,createPolicyHandoff,proveFencedPolicyHandoff,proveSequentialPolicyEpochs,proveUnsafeDirectPolicySwitchCounterexample,runPolicyHandoffProofSuite} from '../src/game/reality-lab/policy-handoff-proof.js';

test('policy handoff fences the old generation before the new policy opens',()=>{
  const proof=proveFencedPolicyHandoff();assert.equal(proof.pass,true);assert.equal(proof.staleFenceBlocked,true);assert.equal(proof.canActivateAfterSourceCrash,true);assert.equal(proof.recovered.phase,HANDOFF_PHASE.TARGET_OPEN);assert.equal(proof.cases.every(row=>row.safety.pass),true);
});

test('source writes after PREPARE invalidate the stale snapshot and force a fresh handoff',()=>{
  const handoff=createPolicyHandoff({initialState:{value:1}});handoff.prepare();assert.equal(handoff.writeSource(state=>({...state,value:2})),true);assert.equal(handoff.snapshot().phase,HANDOFF_PHASE.SOURCE_OPEN);assert.equal(handoff.snapshot().prepared,null);assert.throws(()=>handoff.persistFence(),/stale or unavailable/);handoff.prepare();handoff.persistFence();handoff.activate();assert.equal(handoff.snapshot().targetState.value,2);assert.equal(handoff.snapshot().safety.pass,true);
});

test('successive policy generations reject late writes from older generations',()=>{
  const proof=proveSequentialPolicyEpochs();assert.equal(proof.pass,true);assert.equal(proof.staleGen1,false);assert.equal(proof.staleGen2Source,false);assert.equal(proof.final.targetGeneration,3);assert.equal(proof.final.targetState.value,3);
});

test('opening the target before fencing retains an explicit split-brain counterexample',()=>{
  const proof=proveUnsafeDirectPolicySwitchCounterexample();assert.equal(proof.pass,true);assert.equal(proof.snapshot.sourceOpen,true);assert.equal(proof.snapshot.targetOpen,true);assert.equal(proof.snapshot.safety.pass,false);assert.notEqual(proof.snapshot.sourceState.value,proof.snapshot.targetState.value);
});

test('policy handoff suite preserves both safe path and unsafe counterexample',()=>{assert.equal(runPolicyHandoffProofSuite().pass,true);});
