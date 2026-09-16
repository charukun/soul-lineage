import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NUCLEUS_PHASE,
  architectureCost,
  combinations,
  compareRequirementEnvelope,
  createCanonNucleus,
  progressIsolation,
  proveCrashToleranceLowerBound,
  proveCostDominance,
  proveThreeNodeQuorumIntersection,
  runCanonNucleusProofSuite,
} from '../src/game/reality-lab/canon-nucleus.js';

test('every two-of-three canon quorum intersects',()=>{
  const proof=proveThreeNodeQuorumIntersection(['a','b','c']);
  assert.equal(proof.pass,true);
  assert.equal(proof.quorums.length,3);
});

test('all commit quorums survive every single nucleus failure without canon rollback',()=>{
  for(const committers of combinations(['a','b','c'],2))for(const failed of ['a','b','c']){
    const node=createCanonNucleus({members:['a','b','c'],leaderId:'a'});
    const receipt=node.commit({operationId:'life:end',canon:{life:'l1',ended:true},recovery:{tick:100},acknowledgers:committers});
    node.fail(failed);
    const live=node.snapshot().live;
    const ok=node.phase===NUCLEUS_PHASE.OPEN?node.repair():node.recover({candidateId:live[0]});
    assert.equal(ok,true,`${committers.join('+')} / ${failed}`);
    const snapshot=node.snapshot();
    assert.equal(snapshot.phase,NUCLEUS_PHASE.OPEN);
    assert.equal(snapshot.committed.root,receipt.root);
    assert.equal(snapshot.committed.revision,receipt.revision);
    assert.ok(snapshot.holders.length>=2);
  }
});

test('all two-member failure sets fail closed instead of fabricating a successor',()=>{
  for(const committers of combinations(['a','b','c'],2))for(const failed of combinations(['a','b','c'],2)){
    const node=createCanonNucleus({members:['a','b','c'],leaderId:'a'});
    node.commit({operationId:'life:end',canon:{life:'l1',ended:true},recovery:{tick:100},acknowledgers:committers});
    node.fail(failed);
    const live=node.snapshot().live;
    const recovered=live.length?node.recover({candidateId:live[0]}):false;
    assert.equal(recovered,false);
    assert.equal(node.phase,NUCLEUS_PHASE.CLOSED);
  }
});

test('canon is never marked committed before a follower acknowledgement exists',()=>{
  for(const acknowledgers of [[],['a'],['missing']]){
    const node=createCanonNucleus({members:['a','b','c'],leaderId:'a'});
    assert.throws(()=>node.commit({operationId:'pending',canon:{v:1},recovery:{tick:1},acknowledgers}),/quorum/);
    assert.equal(node.snapshot().committed,null);
  }
  for(const acknowledgers of [['b'],['c']]){
    const node=createCanonNucleus({members:['a','b','c'],leaderId:'a'});
    node.commit({operationId:'committed',canon:{v:1},recovery:{tick:1},acknowledgers});
    assert.equal(node.snapshot().committed.revision,1);
    assert.equal(node.snapshot().holders.length,2);
  }
});

test('recovery can ignore one corrupt replica when another committed holder survives',()=>{
  const node=createCanonNucleus({members:['a','b','c'],leaderId:'a'});
  node.commit({operationId:'life:end',canon:{life:'l1',ended:true},recovery:{tick:100},acknowledgers:['b','c']});
  node.fail('a');node.corrupt('b','recovery');
  assert.equal(node.recover({candidateId:'c'}),true);
  assert.equal(node.snapshot().holders.length,2);
});

test('recovery requires the complete committed canon plus recovery material',()=>{
  const node=createCanonNucleus({members:['a','b','c'],leaderId:'a'});
  node.commit({operationId:'life:end',canon:{life:'l1',ended:true},recovery:{tick:100},acknowledgers:['a','b']});
  node.fail('a');
  node.corrupt('b','recovery');
  assert.equal(node.recover({candidateId:'c'}),false);
  assert.equal(node.phase,NUCLEUS_PHASE.CLOSED);
});

test('a healthy leader cannot be replaced through the recovery path',()=>{
  const node=createCanonNucleus({members:['a','b','c'],leaderId:'a'});
  node.commit({operationId:'op',canon:{v:1},recovery:{tick:1},acknowledgers:['b']});
  assert.throws(()=>node.recover({candidateId:'b'}),/healthy canon leader/);
  assert.equal(node.leaderId,'a');
  assert.equal(node.epoch,1);
});

test('authority epoch fences stale writers and operation ids are idempotent',()=>{
  const node=createCanonNucleus({members:['a','b','c'],leaderId:'a'});
  const first=node.commit({operationId:'op',canon:{v:1},recovery:{tick:1},acknowledgers:['a','b']});
  const again=node.commit({operationId:'op',canon:{v:1},recovery:{tick:1},acknowledgers:['a','c']});
  assert.equal(again.root,first.root);
  assert.equal(again.revision,first.revision);
  assert.throws(()=>node.commit({operationId:'op',canon:{v:2},recovery:{tick:1},acknowledgers:['a','c']}),/conflict/);
  node.fail('a');const oldEpoch=node.epoch;assert.equal(node.recover({candidateId:'b'}),true);
  assert.throws(()=>node.commit({operationId:'new',canon:{v:2},recovery:{tick:2},expectedEpoch:oldEpoch}),/Stale/);
});

test('two committed copies are the crash-tolerance lower bound for one device failure',()=>{
  const proof=proveCrashToleranceLowerBound({failures:1,copies:2});
  assert.equal(proof.minimumCopies,2);
  assert.equal(proof.pass,true);
  assert.equal(proof.strictlyMinimal,true);
  assert.equal(proveCrashToleranceLowerBound({failures:1,copies:1}).pass,false);
});

test('semantic canon replication strictly removes realtime traffic from the strong-consistency path',()=>{
  const proof=proveCostDominance();
  assert.equal(proof.pass,true);
  assert.ok(proof.cases>=6000);
  const cost=architectureCost({players:30,ticks:1200,realtimeBytesPerTick:2048,canonEvents:4,canonBytesPerEvent:512,recoveryBytesPerCanon:16384});
  assert.equal(cost.nucleusConnections,30);
  assert.equal(cost.fullStateConnections,30);
  assert.equal(cost.fullMeshConnections,435);
  assert.equal(cost.commitPathSaved,2048*1200);
  assert.equal(cost.warmSaved,2*2048*1200);
  assert.ok(cost.nucleusCommitPath<cost.fullStateCommitPath);
  assert.ok(cost.nucleusWarmReplication<cost.fullStateWarmReplication);
  assert.ok(cost.nucleusTotal<cost.fullStateTotal);
});

test('canon stalls isolate only canon-affected actors instead of freezing the full simulation',()=>{
  const isolation=progressIsolation({actors:30,pendingCanonActors:1});
  assert.equal(isolation.allStateBlocked,30);
  assert.equal(isolation.nucleusBlocked,1);
  assert.equal(isolation.strictIsolation,true);
});

test('within the same failure requirements the nucleus dominates the feasible all-state baselines',()=>{
  const comparison=compareRequirementEnvelope({players:30,ticks:1200,realtimeBytesPerTick:2048,canonEvents:4,canonBytesPerEvent:512,recoveryBytesPerCanon:16384,pendingCanonActors:1});
  assert.equal(comparison.architectures.singleHostStar.feasible,false);
  assert.equal(comparison.pass,true);
  assert.equal(comparison.constrainedDominance.overAllState,true);
  assert.equal(comparison.constrainedDominance.overFullMesh,true);
});

test('proof suite is self-consistent',()=>{
  const proof=runCanonNucleusProofSuite();
  assert.equal(proof.pass,true);
  assert.deepEqual(proof.checks,{
    crashToleranceLowerBound:true,
    quorumIntersection:true,
    singleFailureRecovery:true,
    doubleFailureFailClosed:true,
    staleEpochRejected:true,
    corruptRecoveryRejected:true,
    idempotentOperation:true,
    costDominance:true,
    requirementDominance:true,
  });
});
