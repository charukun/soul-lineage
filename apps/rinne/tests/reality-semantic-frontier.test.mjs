import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OP_KIND,POLICY,FAMILY,
  adversarialWorkload,evaluatePolicy,semanticFrontier,
  proveImpossibilityBoundaries,proveKnownFamilyClosure,proveFamilyReachability,proveFamilyStrictExtension,proveSafetyClassification,
  proveMixedWorkloadStrictGain,proveHomogeneousNoFalseStrictClaim,proveInvariantClosure,
  proveByzantineReplicaLowerBound,proveMaximalFrontierTheorem,runSemanticFrontierProofSuite
} from '../src/game/reality-lab/semantic-frontier.js';

test('CAP/FLP and crash-copy lower bounds remain explicit',()=>{const p=proveImpossibilityBoundaries();assert.equal(p.pass,true);});
test('semantic safety classes cannot silently downgrade',()=>{const p=proveSafetyClassification();assert.equal(p.pass,true);});
test('included known-family plans remain in the frontier policy closure',()=>{const p=proveKnownFamilyClosure();assert.equal(p.pass,true);assert.equal(p.covered,p.cases);});
test('every modeled baseline family is non-vacuously reachable',()=>{const p=proveFamilyReachability();assert.equal(p.pass,true);assert.ok(p.families>=14);for(const row of Object.values(p.rows))assert.equal(row.pass,true);});
test('semantic frontier strictly extends every modeled baseline family on at least one valid workload',()=>{const p=proveFamilyStrictExtension();assert.equal(p.pass,true);assert.ok(p.families>=14);for(const row of Object.values(p.rows))assert.equal(row.pass,true);});
test('mixed Rinne workload gains over strong all-state baselines after switching overhead',()=>{const p=proveMixedWorkloadStrictGain();assert.equal(p.pass,true);assert.ok(p.result.dominated.includes(FAMILY.RAFT));assert.ok(p.result.dominated.includes(FAMILY.MESH));});
test('single-class optimum is matched rather than falsely claimed as strictly beaten',()=>{assert.equal(proveHomogeneousNoFalseStrictClaim().pass,true);});
test('cross-plane invariant conflicts escalate while proven commutativity remains weak',()=>{assert.equal(proveInvariantClosure().pass,true);});
test('partition-available mergeable work admits CRDT while strong canon fails the CAP requirement',()=>{const env={players:30,partitioned:true,crashReplicas:3};assert.equal(evaluatePolicy(POLICY.CRDT,{id:'m',kind:OP_KIND.MERGEABLE,bytes:32,mergeable:true,requiresPartitionAvailability:true},env).feasible,true);assert.equal(evaluatePolicy(POLICY.CANON_NUCLEUS,{id:'c',kind:OP_KIND.CANON,bytes:32,recoveryBytes:100,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true,requiresPartitionAvailability:true,rollbackAllowed:false},env).feasible,false);});
test('Byzantine workload needs BFT resources',()=>{const ops=adversarialWorkload();assert.equal(semanticFrontier(ops,{players:12,crashReplicas:3,byzantineReplicas:0,trustedAuthority:false}).frontier.length,0);assert.ok(semanticFrontier(ops,{players:12,crashReplicas:3,byzantineReplicas:4,trustedAuthority:false}).frontier.length>0);});
test('PBFT-style f=1 replica condition is retained',()=>{const p=proveByzantineReplicaLowerBound({faults:1,replicas:4});assert.equal(p.pass,true);assert.equal(p.strictlyMinimal,true);assert.equal(p.minimumReplicas,4);});
test('maximal-frontier theorem claims closure and strict expansion, not impossible universal strict dominance',()=>{const p=proveMaximalFrontierTheorem();assert.equal(p.pass,true);assert.equal(p.weakPolicyClosure,true);assert.equal(p.strictExpansion,true);assert.equal(p.strictUniversalDominancePossible,false);assert.equal(p.reachability.pass,true);assert.equal(p.familyExtension.pass,true);});
test('full semantic frontier proof suite passes the broad matrix',()=>{const p=runSemanticFrontierProofSuite();assert.equal(p.pass,true);assert.equal(p.sweep.covered,p.sweep.cases);assert.ok(p.sweep.cases>=2500);assert.ok(p.sweep.strict>0);assert.ok(p.sweep.infeasible>0);});
