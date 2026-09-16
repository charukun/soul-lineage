import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PACKET_PHASE,PACKET_TYPE,createCanonPacketProtocol,crashQuorumConfig,proveCanonPacketInterleavings,proveFiniteBurstAndDuplicateSafety,proveGeneralCrashQuorums,proveGeneralPacketCrashRecovery,proveSequentialEpochAndDedupe,proveTwoPeerNoWitnessBoundary,proveUnsafeEarlyVisibilityCounterexample,runCanonPacketProofSuite,
} from '../src/game/reality-lab/canon-packet-proof.js';
import {chooseAdaptivePresence,optimizeRelayPresence,proveDenseAdaptiveRelay,proveRelayConstructionOptimality,relayFailureCoverage,runAdaptiveRelayProofSuite} from '../src/game/reality-lab/adaptive-relay.js';
import {directMembershipSwitchCounterexample,proveMembershipRotationLimits,proveOneMemberBridgeReconfiguration,proveSuspendedMemberRotation,runAuthorityMembershipProofSuite} from '../src/game/reality-lab/authority-membership-proof.js';
import {proveCanonFailureDomainBoundary,proveRelayFailureDomainBoundary,runFailureDomainProofSuite} from '../src/game/reality-lab/failure-domain-proof.js';
import {proveSemanticProtocolComposition,runRrpTheoryVerificationSuite} from '../src/game/reality-lab/theory-verification.js';

const deliver=(protocol,type,matcher=()=>true)=>protocol.deliverWhere(row=>row.type===type&&matcher(row));

test('2f+1/f+1 crash quorum generalization preserves intersection, one surviving copy and post-failure quorum',()=>{
  const proof=proveGeneralCrashQuorums({maxFailures:4});assert.equal(proof.pass,true);assert.equal(proof.rows.length,4);for(const row of proof.rows){assert.equal(row.members,2*row.failures+1);assert.equal(row.quorum,row.failures+1);assert.ok(row.minIntersection>=1);assert.ok(row.minSurvivingCopies>=1);assert.ok(row.liveAfterFailures>=row.quorum);assert.equal(row.minimalMemberCounterexample.canReopenQuorum,false);}
});

test('actual packet state machine preserves visible Canon across every f<=3 majority/failure combination',()=>{
  const proof=proveGeneralPacketCrashRecovery({maxFailures:3});assert.equal(proof.pass,true);assert.equal(proof.cases,5218);assert.deepEqual(proof.rows.map(row=>row.cases),[18,300,4900]);assert.equal(proof.rows.every(row=>row.pass),true);
});

test('two peers cannot guarantee both one-peer post-failure availability and arbitrary-partition split-brain safety without extra fencing',()=>{
  const proof=proveTwoPeerNoWitnessBoundary();assert.equal(proof.pass,true);assert.equal(proof.requiresAdditionalFailureDiscriminator,true);assert.equal(proof.policies.length,4);assert.equal(proof.policies.some(row=>row.satisfiesAll),false);
});

test('explicit Canon packet timing survives every f=1 store/ack/visible/recovery crash stage',()=>{
  const proof=proveCanonPacketInterleavings();assert.equal(proof.pass,true);assert.equal(proof.cases.length,45);assert.equal(proof.publishBlockedWhenAckHolderDies,true);assert.equal(proof.repairedWithAlternateFollower,true);assert.equal(proof.cases.every(row=>row.visibleSafe&&row.sameRoot),true);
});

test('visible Canon requires a currently-live durable quorum, then repairs durability before OPEN resumes',()=>{
  const protocol=createCanonPacketProtocol(),started=protocol.begin({operationId:'life:visible',canon:{ended:true},recovery:{tick:50}});deliver(protocol,PACKET_TYPE.PREPARE,row=>row.to==='n1');deliver(protocol,PACKET_TYPE.ACK,row=>row.from==='n1');const receipt=protocol.publish();assert.equal(receipt.root,started.proposal.root);protocol.crash('n1');assert.equal(protocol.snapshot().phase,PACKET_PHASE.RECOVERING);assert.equal(protocol.snapshot().holders.length,1);assert.equal(protocol.recover({candidateId:'n0'}),true);const repaired=protocol.snapshot();assert.equal(repaired.phase,PACKET_PHASE.OPEN);assert.equal(repaired.holders.length,2);assert.equal(repaired.visible.at(-1).root,receipt.root);assert.equal(repaired.safety.pass,true);
});

test('f=2 packet protocol commits at three durable copies and recovers after any two holder crashes when one committed holder survives',()=>{
  const config=crashQuorumConfig(2),members=Array.from({length:config.members},(_,i)=>`n${i}`),protocol=createCanonPacketProtocol({failures:2,members,leaderId:'n0'}),started=protocol.begin({operationId:'f2:1',canon:{ended:true},recovery:{tick:75}});for(const id of['n1','n2']){deliver(protocol,PACKET_TYPE.PREPARE,row=>row.to===id);deliver(protocol,PACKET_TYPE.ACK,row=>row.from===id);}const receipt=protocol.publish();assert.equal(receipt.root,started.proposal.root);protocol.crash(['n0','n1']);assert.equal(protocol.snapshot().phase,PACKET_PHASE.RECOVERING);assert.equal(protocol.recover({candidateId:'n2'}),true);const snap=protocol.snapshot();assert.equal(snap.phase,PACKET_PHASE.OPEN);assert.equal(snap.holders.length,3);assert.equal(snap.visible.at(-1).root,receipt.root);assert.equal(snap.safety.pass,true);
});

test('uncertain completion preserves ancestry and recovery-carried operation dedupe across a new epoch',()=>{
  const proof=proveSequentialEpochAndDedupe();assert.equal(proof.pass,true);assert.equal(proof.recovered,true);assert.equal(proof.replayCurrentOperation,true);assert.equal(proof.replayOlderOperation,true);assert.equal(proof.conflictRejected,true);assert.equal(proof.staleAccepted,false);assert.equal(proof.visible.length,3);assert.equal(proof.safety.pass,true);
});

test('finite burst loss, duplicates and reordering preserve safety while permanent partition makes no liveness promise',()=>{
  const proof=proveFiniteBurstAndDuplicateSafety({maxBurst:16});assert.equal(proof.pass,true);assert.equal(proof.burstCases.length,17);assert.deepEqual(proof.burstCases.map(row=>row.burst),Array.from({length:17},(_,i)=>i));assert.equal(proof.duplicateReorderSafe,true);assert.equal(proof.staleEpochRejected,true);assert.equal(proof.permanentPartitionMakesNoLivenessClaim,true);
});

test('publishing before durable quorum remains an explicit one-crash counterexample',()=>{
  const counterexample=proveUnsafeEarlyVisibilityCounterexample();assert.equal(counterexample.pass,true);assert.ok(counterexample.durableAtVisibility<2);assert.equal(counterexample.recovered,false);assert.equal(counterexample.phase,PACKET_PHASE.CLOSED);
});

test('direct nucleus membership switch retains a disjoint-majority counterexample',()=>{
  const proof=directMembershipSwitchCounterexample({failures:1});assert.equal(proof.pass,true);assert.deepEqual(proof.oldMembers,['n0','n1','n2']);assert.deepEqual(proof.newMembers,['n0','n1','n3']);assert.equal(proof.oldQuorum.some(id=>proof.newQuorum.includes(id)),false);
});

test('one-member authority rotation has an old/new common-majority bridge for f=1..4',()=>{
  const proof=proveOneMemberBridgeReconfiguration({maxFailures:4});assert.equal(proof.pass,true);for(const row of proof.rows){assert.ok(row.minOldIntersection>=1);assert.ok(row.minNewIntersection>=1);assert.equal(row.directCounterexample,true);assert.ok(row.bridgeQuorums>0);}
});

test('one suspended nucleus member can rotate out through the surviving majority but two unavailable old members fail closed',()=>{
  const proof=proveSuspendedMemberRotation();assert.equal(proof.pass,true);assert.equal(proof.oldQuorumAvailable,true);assert.equal(proof.canOpenNew,true);assert.equal(proof.transition.newMemberRecoveryCopied,true);assert.equal(proof.blockedAfterTooManyUnavailable,true);assert.equal(proveMembershipRotationLimits().requiresJointConsensusOrSequentialReplacement,true);assert.equal(runAuthorityMembershipProofSuite().pass,true);
});

test('Canon crash-copy count is not promoted to failure-domain durability without independent placement',()=>{
  const proof=proveCanonFailureDomainBoundary({maxFailures:3});assert.equal(proof.pass,true);for(const row of proof.rows){assert.equal(row.diverse.pass,true);assert.equal(row.collapsed.pass,false);assert.ok(row.diverse.domains.length>=row.failures+1);}
});

test('redundant relay peers still fail one-domain tolerance when both paths share the same domain',()=>{
  const proof=proveRelayFailureDomainBoundary();assert.equal(proof.pass,true);assert.equal(proof.diverse.pass,true);assert.equal(proof.collapsed.pass,false);assert.ok(proof.collapsed.uncovered.length>0);assert.equal(runFailureDomainProofSuite().pass,true);
});

test('dense 30-peer relay has exact sender-fanout optima but retains latency and failure counterexamples',()=>{
  const proof=proveDenseAdaptiveRelay();assert.equal(proof.pass,true);assert.equal(proof.star.hostFanout,29);assert.equal(proof.r1.relays,5);assert.equal(proof.r1.maxSenderFanout,5);assert.equal(proof.r1.aggregateTransmissions,29);assert.equal(proof.r2.relays,7);assert.equal(proof.r2.maxSenderFanout,7);assert.ok(proof.r2.aggregateTransmissions>29);assert.equal(proof.r1Failure.pass,false);assert.equal(proof.r2Failure.pass,true);assert.equal(proof.zeroExtraHop.selected.kind,'direct-star');
});

test('balanced relay construction reaches the pigeonhole lower bound across 3-64 players',()=>{
  const proof=proveRelayConstructionOptimality({maxPlayers:64,maxRedundancy:2});assert.equal(proof.pass,true);assert.equal(proof.rows.every(row=>row.constructed===row.theoretical),true);
});

test('relay failure redundancy and semantic isolation are enforced instead of assumed',()=>{
  const r1=optimizeRelayPresence({players:30,redundancy:1}),r2=optimizeRelayPresence({players:30,redundancy:2});assert.equal(relayFailureCoverage(r1,{failures:1}).pass,false);assert.equal(relayFailureCoverage(r2,{failures:1}).pass,true);assert.throws(()=>chooseAdaptivePresence({players:30,operation:{replaceable:false,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true}}),/replaceable presence/);const bounded=chooseAdaptivePresence({players:30,maxSenderFanout:8,maxExtraHops:1,requiredRelayFailures:1});assert.equal(bounded.pass,true);assert.equal(bounded.selected.kind,'adaptive-relay');assert.ok(bounded.selected.relayFailureTolerance>=1);
});

test('Semantic Frontier keeps presence relay, crash Canon and Byzantine escalation in separate guarantee domains',()=>{
  const proof=proveSemanticProtocolComposition();assert.equal(proof.pass,true);assert.equal(proof.checks.relayOnlyRefinesPresence,true);assert.equal(proof.checks.packetShapeMatchesCanonPolicy,true);assert.equal(proof.checks.byzantineEscalatesOutOfNucleus,true);
});

test('new theory suites compose without weakening Semantic Frontier impossibility boundaries',()=>{
  const packet=runCanonPacketProofSuite(),relay=runAdaptiveRelayProofSuite(),membership=runAuthorityMembershipProofSuite(),domains=runFailureDomainProofSuite();assert.equal(packet.pass,true);assert.equal(packet.packetSweep.cases,5218);assert.equal(packet.sequential.pass,true);assert.equal(relay.pass,true);assert.equal(membership.pass,true);assert.equal(domains.pass,true);const combined=runRrpTheoryVerificationSuite();assert.equal(combined.pass,true);assert.equal(combined.boundaries.twoPeerNoWitnessBoundary,true);assert.equal(combined.boundaries.earlyVisibilityCounterexampleRetained,true);assert.equal(combined.boundaries.authorityRotationBridge,true);assert.equal(combined.boundaries.canonFailureDomainDiversity,true);assert.equal(combined.boundaries.relayFailureDomainDiversity,true);assert.equal(combined.boundaries.relayNotUniversal,true);assert.equal(combined.boundaries.semanticProtocolComposition,true);assert.equal(combined.boundaries.semanticUniversalStrictDominanceStillRejected,true);
});
