import {runCanonPacketProofSuite} from './canon-packet-proof.js';
import {runAdaptiveRelayProofSuite} from './adaptive-relay.js';
import {runSemanticFrontierProofSuite} from './semantic-frontier.js';

export function runRrpTheoryVerificationSuite(){
  const packets=runCanonPacketProofSuite(),relay=runAdaptiveRelayProofSuite(),semantic=runSemanticFrontierProofSuite();
  const boundaries={
    generalizedCrashQuorum:packets.generalized.pass,
    twoPeerNoWitnessBoundary:packets.twoPeer.pass&&packets.twoPeer.requiresAdditionalFailureDiscriminator,
    packetInterleavings:packets.interleavings.pass,
    finiteBurstEventuallyProgresses:packets.faults.pass&&packets.faults.permanentPartitionMakesNoLivenessClaim,
    earlyVisibilityCounterexampleRetained:packets.unsafe.pass,
    denseRelayFanoutFrontier:relay.dense.pass,
    relayNotUniversal:relay.dense.checks.r1AddsHop&&relay.dense.checks.r1NotOneRelayFaultSafe&&relay.dense.checks.r2CostsExtraTraffic&&relay.dense.checks.zeroExtraHopSelectsStar,
    canonNeverUsesPresenceRelay:relay.dense.checks.canonIsolation,
    semanticUniversalStrictDominanceStillRejected:semantic.maximal.strictUniversalDominancePossible===false,
  };
  return{format:'rrp-theory-verification/1',pass:packets.pass&&relay.pass&&semantic.pass&&Object.values(boundaries).every(Boolean),packets,relay,semantic:{pass:semantic.pass,maximal:semantic.maximal},boundaries,limits:[...packets.limits,...relay.dense.limits,'this suite proves a deterministic crash-fault model, not physical WebRTC/NAT/TURN/device behavior','adaptive relay changes the presence fan-out frontier only; it does not weaken Canon consistency requirements']};
}
