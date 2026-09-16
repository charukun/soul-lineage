import {runCanonPacketProofSuite,crashQuorumConfig} from './canon-packet-proof.js';
import {runAdaptiveRelayProofSuite,chooseAdaptivePresence} from './adaptive-relay.js';
import {runAuthorityMembershipProofSuite} from './authority-membership-proof.js';
import {runFailureDomainProofSuite} from './failure-domain-proof.js';
import {OP_KIND,POLICY,evaluatePolicy,runSemanticFrontierProofSuite} from './semantic-frontier.js';

export function proveSemanticProtocolComposition(){
  const environment={players:30,crashReplicas:3,byzantineReplicas:4,trustedAuthority:true,rttMs:80,jitterMs:20};
  const presence={id:'presence',kind:OP_KIND.PRESENCE,bytes:96,rate:20,recipients:29,rollbackAllowed:true};
  const canon={id:'rebirth',kind:OP_KIND.CANON,bytes:512,recoveryBytes:16384,rate:.02,recipients:2,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true,rollbackAllowed:false};
  const adversarial={...canon,id:'ranked-canon',kind:OP_KIND.ADVERSARIAL_CANON,requiresByzantine:true};
  const presencePolicy=evaluatePolicy(POLICY.PRESENCE_DATAGRAM,presence,environment),canonPolicy=evaluatePolicy(POLICY.CANON_NUCLEUS,canon,environment),adversarialNucleus=evaluatePolicy(POLICY.CANON_NUCLEUS,adversarial,environment),adversarialPbft=evaluatePolicy(POLICY.PBFT,adversarial,environment);
  const relay=chooseAdaptivePresence({players:30,maxSenderFanout:8,maxExtraHops:1,operation:{replaceable:true}});let canonRelayRejected=false;try{chooseAdaptivePresence({players:30,operation:{replaceable:false,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true}});}catch{canonRelayRejected=true;}
  const quorum=crashQuorumConfig(1),checks={presencePolicyFeasible:presencePolicy.feasible===true,canonPolicyFeasible:canonPolicy.feasible===true&&canonPolicy.guarantees?.recoveryComplete===true,packetShapeMatchesCanonPolicy:quorum.members===3&&quorum.quorum===2,relayOnlyRefinesPresence:relay.pass&&relay.selected?.kind==='adaptive-relay'&&canonRelayRejected,byzantineEscalatesOutOfNucleus:adversarialNucleus.feasible===false&&adversarialPbft.feasible===true};
  return{pass:Object.values(checks).every(Boolean),checks,presencePolicy,canonPolicy,adversarialNucleus,adversarialPbft,relay:relay.selected};
}

export function runRrpTheoryVerificationSuite({semantic=null}={}){
  const packets=runCanonPacketProofSuite(),relay=runAdaptiveRelayProofSuite(),membership=runAuthorityMembershipProofSuite(),failureDomains=runFailureDomainProofSuite(),semanticProof=semantic??runSemanticFrontierProofSuite(),composition=proveSemanticProtocolComposition();
  const boundaries={
    generalizedCrashQuorum:packets.generalized.pass,
    generalizedPacketRecovery:packets.packetSweep.pass&&packets.packetSweep.cases===5218,
    sequentialEpochDedupe:packets.sequential.pass,
    twoPeerNoWitnessBoundary:packets.twoPeer.pass&&packets.twoPeer.requiresAdditionalFailureDiscriminator,
    packetInterleavings:packets.interleavings.pass,
    finiteBurstEventuallyProgresses:packets.faults.pass&&packets.faults.permanentPartitionMakesNoLivenessClaim,
    earlyVisibilityCounterexampleRetained:packets.unsafe.pass,
    authorityRotationBridge:membership.bridges.pass&&membership.suspension.pass,
    unsafeDirectMembershipSwitchRetained:membership.direct.pass,
    multiMemberRotationNeedsJointOrSequential:membership.limits.pass,
    canonFailureDomainDiversity:failureDomains.canon.pass,
    relayFailureDomainDiversity:failureDomains.relay.pass,
    denseRelayFanoutFrontier:relay.dense.pass,
    relayNotUniversal:relay.dense.checks.r1AddsHop&&relay.dense.checks.r1NotOneRelayFaultSafe&&relay.dense.checks.r2CostsExtraTraffic&&relay.dense.checks.zeroExtraHopSelectsStar,
    canonNeverUsesPresenceRelay:relay.dense.checks.canonIsolation,
    semanticProtocolComposition:composition.pass,
    semanticUniversalStrictDominanceStillRejected:semanticProof.maximal.strictUniversalDominancePossible===false,
  };
  return{format:'rrp-theory-verification/5',pass:packets.pass&&relay.pass&&membership.pass&&failureDomains.pass&&semanticProof.pass&&composition.pass&&Object.values(boundaries).every(Boolean),packets,relay,membership,failureDomains,composition,semantic:{pass:semanticProof.pass,maximal:semanticProof.maximal},boundaries,limits:[...packets.limits,...relay.dense.limits,...failureDomains.limits,'authority rotation proof covers one-member replacement through an old/new common majority; larger membership changes require sequential replacement or a joint-consensus protocol','background/suspended nucleus members are treated as unavailable for new Canon and cannot be rotated out after old quorum is already lost','this suite proves a deterministic crash-fault model, not physical WebRTC/NAT/TURN/device behavior','adaptive relay changes the presence fan-out frontier only; it does not weaken Canon consistency requirements']};
}
