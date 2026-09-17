import { createHash } from 'node:crypto';

export const Verdict=Object.freeze({ALLOW:'ALLOW',DENY:'DENY',UNEVALUATED:'UNEVALUATED',ESCALATE:'ESCALATE'});
export const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');

const setOf=value=>new Set(Array.isArray(value)?value:[]);
export function normalizeEvidence(e={}) {
  return {
    provider:String(e.provider||'unknown'),
    evidenceClass:String(e.evidenceClass||'unknown'),
    claims:[...setOf(e.claims)].sort(),
    challenge:e.challenge??null,
    actionDigest:e.actionDigest??null,
    measurementRoot:e.measurementRoot??null,
    measurementSet:[...setOf(e.measurementSet)].sort(),
    appraisalPolicyRoot:e.appraisalPolicyRoot??null,
    appraisalGeneration:Number.isInteger(e.appraisalGeneration)?e.appraisalGeneration:null,
    principalBinding:e.principalBinding??null,
    evaluated:e.evaluated!==false,
  };
}

export function appraiseEvidence(evidence,policy) {
  const e=normalizeEvidence(evidence), required=setOf(policy.requiredClaims);
  if(!e.evaluated) return {verdict:Verdict.UNEVALUATED,missing:[...required],reason:'provider-did-not-evaluate'};
  if(policy.allowedProviders?.length&&!policy.allowedProviders.includes(e.provider))return{verdict:Verdict.DENY,missing:[],reason:'provider-not-allowed'};
  const claims=setOf(e.claims),missing=[...required].filter(x=>!claims.has(x)).sort();
  if(missing.length)return{verdict:Verdict.DENY,missing,reason:'missing-claims'};
  if(policy.challenge!==undefined&&e.challenge!==policy.challenge)return{verdict:Verdict.DENY,missing:[],reason:'challenge-mismatch'};
  if(policy.requireActionBinding===true&&e.actionDigest!==policy.actionDigest)return{verdict:Verdict.DENY,missing:[],reason:'action-not-bound'};
  if(policy.measurementRoot&&e.measurementRoot!==policy.measurementRoot)return{verdict:Verdict.DENY,missing:[],reason:'measurement-mismatch'};
  if(policy.appraisalPolicyRoot&&e.appraisalPolicyRoot!==policy.appraisalPolicyRoot)return{verdict:Verdict.DENY,missing:[],reason:'appraisal-policy-mismatch'};
  if(Number.isInteger(policy.appraisalGeneration)&&e.appraisalGeneration!==policy.appraisalGeneration)return{verdict:Verdict.DENY,missing:[],reason:'appraisal-generation-mismatch'};
  return{verdict:Verdict.ALLOW,missing:[],reason:'requirements-satisfied'};
}

export function booleanTrustCollapseWitness() {
  const webauthn={provider:'webauthn',claims:['credential-origin','user-verification','authenticator-properties']};
  const play={provider:'play-integrity',claims:['recognized-app','device-integrity']};
  return{webauthn,play,collapsed:{webauthn:true,play:true},sameMeaning:false};
}

export function freshNonceWithoutActionBindingWitness() {
  const challenge='nonce-77';
  const evidence={provider:'toy',claims:['device-integrity'],challenge};
  const actionA={type:'rebirth',lifeId:'a'};
  const actionB={type:'claim-unique',item:'sword'};
  const policyBase={requiredClaims:['device-integrity'],challenge};
  return{
    actionA,actionB,evidence,
    baseA:appraiseEvidence(evidence,policyBase).verdict,
    baseB:appraiseEvidence(evidence,policyBase).verdict,
    digestA:sha(actionA),digestB:sha(actionB),
    boundB:appraiseEvidence({...evidence,actionDigest:sha(actionA)},{...policyBase,requireActionBinding:true,actionDigest:sha(actionB)}).verdict,
  };
}

export function measurementCoverageWitness() {
  const appBinary='rinne-app-v7',configA={fatalThreshold:.78},configB={fatalThreshold:.20};
  const measurementRoot=sha(appBinary);
  return{measurementRoot,configA,configB,sameAppMeasurement:measurementRoot===sha(appBinary),semanticOutputsDiffer:configA.fatalThreshold!==configB.fatalThreshold};
}

export function measurementSetCovers({required,evidence}) {
  const have=setOf(evidence);
  return required.every(x=>have.has(x));
}

export function webAuthnScopeWitness() {
  const claims=['credential-origin','rp-binding','user-verification','authenticator-properties'];
  return{claims,provesAppRuntimeIntegrity:claims.includes('app-runtime-integrity'),provesGameState:claims.includes('game-state-integrity')};
}

export function playIntegrityScopeWitness() {
  const claims=['recognized-app','device-integrity'];
  return{claims,provesUniqueHuman:false,provesGameplayState:false};
}

export function principalMultiplicityWitness() {
  const device={id:'device-1',integrity:true};
  const accounts=['player-a','player-b'];
  return{device,accounts,sameDevice:true,uniqueHumanDerived:false};
}

export function unevaluatedIsNotFalseWitness() {
  return{
    evaluatedBad:{evaluated:true,claims:[]},
    unavailable:{evaluated:false,claims:[]},
    badVerdict:appraiseEvidence({evaluated:true,claims:[]},{requiredClaims:['device-integrity']}).verdict,
    unavailableVerdict:appraiseEvidence({evaluated:false,claims:[]},{requiredClaims:['device-integrity']}).verdict,
  };
}

export function fallbackTrustWitness() {
  const strong={requiredClaims:['recognized-app','device-integrity'],allowedProviders:['play-integrity']};
  const weakEvidence={provider:'webauthn',claims:['credential-origin','user-verification']};
  return{strongVerdict:appraiseEvidence(weakEvidence,strong).verdict,explicitWeakerModeNeeded:true};
}

export function globalProfileTradeoffWitness() {
  const effects={
    localChat:{requiredClaims:[]},
    rankedUniqueClaim:{requiredClaims:['recognized-app','device-integrity']},
  };
  const web={provider:'web',claims:[]};
  const android={provider:'play-integrity',claims:['recognized-app','device-integrity']};
  return{
    localChat:{web:appraiseEvidence(web,effects.localChat).verdict,android:appraiseEvidence(android,effects.localChat).verdict},
    rankedUniqueClaim:{web:appraiseEvidence(web,effects.rankedUniqueClaim).verdict,android:appraiseEvidence(android,effects.rankedUniqueClaim).verdict},
  };
}

export function appraisalGenerationWitness() {
  const e={provider:'toy',claims:['device-integrity'],appraisalPolicyRoot:'policy-v1',appraisalGeneration:1};
  return{
    old:appraiseEvidence(e,{requiredClaims:['device-integrity'],appraisalPolicyRoot:'policy-v1',appraisalGeneration:1}).verdict,
    new:appraiseEvidence(e,{requiredClaims:['device-integrity'],appraisalPolicyRoot:'policy-v2',appraisalGeneration:2}).verdict,
  };
}

export function actionMeasurementWitness() {
  const effect={type:'life-end',lifeId:'p:1'};
  const binary='app-v3',config='policy-v9';
  const full=sha({binary,config,effect});
  return{
    effect,
    binaryOnly:sha(binary),
    full,
    binaryOnlyBindsEffect:false,
    fullBindsEffect:true,
  };
}

export function privacyClaimCost(profile) {
  const weights={'stable-device-id':5,'device-model':2,'authenticator-model':2,'recognized-app':1,'device-integrity':1,'user-verification':1};
  return (profile.claims||[]).reduce((sum,c)=>sum+(weights[c]||0),0);
}

export function minimalDisclosureWitness() {
  const low={claims:['user-verification']};
  const high={claims:['user-verification','authenticator-model','stable-device-id']};
  return{low:privacyClaimCost(low),high:privacyClaimCost(high),higherDisclosure:privacyClaimCost(high)>privacyClaimCost(low)};
}

export function trustEvidenceContractIssues(c) {
  const issues=[];if(!c||typeof c!=='object')return['missing-contract'];const need=(x,n)=>{if(!x)issues.push(n)};
  need(c.effectId,'effect-id');need(c.profile,'profile');need(Array.isArray(c.requiredClaims),'required-claims');need(c.appraisalPolicyRoot,'appraisal-policy-root');need(Number.isInteger(c.appraisalGeneration),'appraisal-generation');need(c.freshnessMode,'freshness-mode');
  if(c.requireActionBinding)need(c.actionDigest,'action-digest');
  if(c.requiredMeasurements?.length){need(c.measurementRoot,'measurement-root');need(c.measurementSchema,'measurement-schema')}
  need(['deny','unevaluated','explicit-weaker-mode','escalate'].includes(c.unsupportedPolicy),'unsupported-policy');
  need(c.privacyDisclosureClass,'privacy-disclosure-class');
  return issues;
}

export const witnessNames=Object.freeze([
  'boolean-trust-semantic-collapse',
  'fresh-nonce-without-action-binding',
  'binary-measurement-with-unmeasured-config',
  'webauthn-not-app-runtime-attestation',
  'device-integrity-not-unique-human',
  'unevaluated-not-negative-proof',
  'silent-fallback-downgrade',
  'global-profile-cross-platform-tradeoff',
  'appraisal-generation-binding',
  'privacy-overcollection',
]);
