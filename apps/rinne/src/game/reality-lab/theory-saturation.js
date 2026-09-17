export const THEORY_SATURATION_REQUIREMENTS=Object.freeze([
  'generalizedCrashQuorum','generalizedPacketRecovery','boundedScheduleStateSpace','sequentialEpochDedupe','twoPeerNoWitnessBoundary','packetInterleavings','finiteBurstEventuallyProgresses','earlyVisibilityCounterexampleRetained','quorumFencedEpochPromotion','minorityCannotPromoteCanon','timeoutSelfPromotionCounterexampleRetained','authorityRotationBridge','unsafeDirectMembershipSwitchRetained','multiMemberRotationNeedsJointOrSequential','canonFailureDomainDiversity','relayFailureDomainDiversity','denseRelayFanoutFrontier','relayNotUniversal','sfuParetoPointRetained','noInfraConstraintRetained','invariantCompiledCoordination','invariantCertificateTamperRejected','compiledFrontierRejectsUnderCoordination','proofCarryingPlanVerified','fencedPolicyHandoff','unsafePolicySwitchRetained','canonNeverUsesPresenceRelay','semanticProtocolComposition','externalEffectsEscalated','semanticUniversalStrictDominanceStillRejected',
]);

export const THEORY_DEFERRED_BOUNDARIES=Object.freeze([
  {id:'byzantine-canon',class:'different-failure-model',resolution:'Semantic Frontier escalates to a Byzantine policy; crash-only Canon Nucleus makes no BFT claim'},
  {id:'arbitrary-program-semantics',class:'undeclared-application-semantics',resolution:'declare a richer invariant/effect model or coordinate conservatively'},
  {id:'bulk-membership-jump',class:'known-protocol-boundary',resolution:'sequential one-member rotation or joint consensus'},
  {id:'permanent-partition-strong-progress',class:'impossibility-boundary',resolution:'strong Canon remains unavailable without quorum'},
  {id:'physical-webrtc-transport',class:'physical-evidence',resolution:'measure browser/SCTP/ICE/TURN behavior'},
  {id:'device-scheduling-radio-battery',class:'physical-evidence',resolution:'measure target devices and networks'},
  {id:'adaptive-switch-thresholds',class:'physical-calibration',resolution:'calibrate from accepted performance baselines rather than inventing model thresholds'},
]);

export function classifyRrpTheorySaturation(boundaries={}){
  const modelAddressableOpen=THEORY_SATURATION_REQUIREMENTS.filter(key=>boundaries[key]!==true),addressed=THEORY_SATURATION_REQUIREMENTS.filter(key=>boundaries[key]===true);
  return Object.freeze({pass:modelAddressableOpen.length===0,scope:'declared crash-fault, bounded-invariant and topology model',addressed,modelAddressableOpen,deferred:THEORY_DEFERRED_BOUNDARIES});
}
