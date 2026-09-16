import test from 'node:test';
import assert from 'node:assert/strict';
import {proveFalseSuspicionSafety,proveMinorityCannotPromote,proveQuorumEpochFencing,proveUnsafeTimeoutSelfPromotionCounterexample,runEpochElectionProofSuite} from '../src/game/reality-lab/epoch-election-proof.js';

test('new majority epoch fencing intersects every old majority for f=1..4',()=>{
  const proof=proveQuorumEpochFencing({maxFailures:4});assert.equal(proof.pass,true);assert.equal(proof.rows.length,4);for(const row of proof.rows){assert.ok(row.minIntersection>=1);assert.equal(row.unsafeOldAfterElection,0);assert.ok(row.cases>0);}
});

test('false suspicion is safe when promotion requires a quorum fence',()=>{
  const proof=proveFalseSuspicionSafety();assert.equal(proof.pass,true);assert.equal(proof.newCommitAccepted,true);assert.equal(proof.oldAttempts.every(row=>row.accepted===false),true);
});

test('minority partition cannot promote Canon authority',()=>{const proof=proveMinorityCannotPromote();assert.equal(proof.pass,true);assert.equal(proof.rows[0].canElect,false);assert.equal(proof.rows[1].canElect,true);});

test('timeout-only self-promotion retains an explicit split-authority counterexample',()=>{const proof=proveUnsafeTimeoutSelfPromotionCounterexample();assert.equal(proof.pass,true);assert.deepEqual(proof.oldQuorum,['a','c']);assert.deepEqual(proof.newLocal,['b']);});

test('epoch election proof suite preserves safety/liveness boundary',()=>{assert.equal(runEpochElectionProofSuite().pass,true);});
