export const RRP_PERFORMANCE_EVIDENCE_VERSION=1;
export const EVIDENCE_CLASS=Object.freeze({MODEL:'model',BROWSER_SYNTHETIC:'browser-synthetic',PHYSICAL_DEVICE:'physical-device',PHYSICAL_MULTIPEER:'physical-multipeer'});
export const PERFORMANCE_STATUS=Object.freeze({PASS:'pass',FAIL:'fail',CALIBRATION_REQUIRED:'calibration-required'});

export const RRP_SAFETY_KEYS=Object.freeze([
  'committedCanonRollbackEvents',
  'duplicateIrreversibleCommits',
  'staleAuthorityAccepts',
  'splitBrainOpenMs',
  'uncommittedCanonVisibleEvents',
  'recoveryOpenWithoutMaterialEvents',
]);

export const RRP_PERFORMANCE_METRICS=Object.freeze([
  'inputToDisplayP50Ms','inputToDisplayP95Ms','inputToDisplayP99Ms',
  'canonCommitP50Ms','canonCommitP95Ms','canonCommitP99Ms',
  'hostLossDetectionP95Ms','hostReopenP95Ms',
  'peerUplinkAverageKbps','peerUplinkP95Kbps','peerUplinkPeakKbps',
  'hostUplinkAverageKbps','hostUplinkP95Kbps','hostUplinkPeakKbps',
  'reliableBufferedAmountMaxBytes','presenceBufferedAmountMaxBytes',
  'stateFreshnessP95Ms','stateFreshnessP99Ms',
  'positionErrorP95M','positionErrorMaxM','missingSampleRate',
  'rollbackPerMinute','rollbackP95Ms','rollbackMaxMs',
  'connectionSuccessRate','turnRelayRate',
  'frameP95Ms','gpuP95Ms','memoryPeakMb','batteryPctPerHour',
  'modelDeliveryP95Ms','modelMaxQueue','modelDarkMs','modelRollbackMs',
]);

// Only thresholds that already have a repository contract are absolute gates here.
// Other metrics remain calibration-required until compatible physical evidence exists.
export const RRP_ABSOLUTE_SLOS=Object.freeze({
  frameP95Ms:Object.freeze({max:33.34,minEvidenceClass:EVIDENCE_CLASS.PHYSICAL_DEVICE,source:'pixel-fold-class 30fps target'}),
  hostLossDetectionP95Ms:Object.freeze({max:4500,minEvidenceClass:EVIDENCE_CLASS.PHYSICAL_MULTIPEER,source:'peer-host migration SLO'}),
  hostReopenP95Ms:Object.freeze({max:6000,minEvidenceClass:EVIDENCE_CLASS.PHYSICAL_MULTIPEER,source:'peer-host migration SLO'}),
});

export const PHYSICAL_MULTIPEER_CALIBRATION_METRICS=Object.freeze([
  'inputToDisplayP95Ms','canonCommitP95Ms','peerUplinkP95Kbps','hostUplinkP95Kbps',
  'reliableBufferedAmountMaxBytes','presenceBufferedAmountMaxBytes','stateFreshnessP95Ms',
  'positionErrorP95M','rollbackP95Ms','connectionSuccessRate',
]);

const CLASS_RANK=Object.freeze({[EVIDENCE_CLASS.MODEL]:0,[EVIDENCE_CLASS.BROWSER_SYNTHETIC]:1,[EVIDENCE_CLASS.PHYSICAL_DEVICE]:2,[EVIDENCE_CLASS.PHYSICAL_MULTIPEER]:3});
const plain=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const clone=value=>structuredClone(value);
const numberOrNull=value=>value==null?null:Number(value);
const finiteNonNegative=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const finiteRate=value=>finiteNonNegative(value)&&value<=1;

function normalizeMetric(key,value){
  if(value==null)return null;
  const number=Number(value);
  const isRate=key.endsWith('Rate');
  if(!(isRate?finiteRate(number):finiteNonNegative(number)))throw Error(`Invalid RRP performance metric ${key}`);
  return number;
}
function normalizeSafety(key,value){
  if(value==null)return null;
  const number=Number(value);
  if(!finiteNonNegative(number)||!Number.isInteger(number)&&key!=='splitBrainOpenMs')throw Error(`Invalid RRP safety metric ${key}`);
  return number;
}
function requiredText(value,label){if(typeof value!=='string'||!value.trim())throw Error(`RRP performance evidence requires ${label}`);return value.trim();}

export function percentile(values,p){
  if(!Array.isArray(values)||!values.length||!Number.isFinite(p)||p<0||p>1)throw Error('Invalid percentile input');
  const sorted=values.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!sorted.length)throw Error('Percentile requires finite samples');
  return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*p)-1))];
}

export function normalizeRrpPerformanceEvidence(input={}){
  if(!plain(input))throw Error('Invalid RRP performance evidence');
  const evidenceClass=input.evidenceClass;
  if(!Object.values(EVIDENCE_CLASS).includes(evidenceClass))throw Error('Unknown RRP performance evidence class');
  const metrics=Object.fromEntries(RRP_PERFORMANCE_METRICS.map(key=>[key,normalizeMetric(key,input.metrics?.[key])]));
  const safety=Object.fromEntries(RRP_SAFETY_KEYS.map(key=>[key,normalizeSafety(key,input.safety?.[key])]));
  const samples=Number(input.samples??0);
  if(!Number.isInteger(samples)||samples<0)throw Error('Invalid RRP performance sample count');
  const provenance=plain(input.provenance)?clone(input.provenance):{};
  if(evidenceClass!==EVIDENCE_CLASS.MODEL){
    provenance.buildRevision=requiredText(provenance.buildRevision,'provenance.buildRevision');
    provenance.runtime=requiredText(provenance.runtime,'provenance.runtime');
  }
  if(evidenceClass===EVIDENCE_CLASS.PHYSICAL_DEVICE||evidenceClass===EVIDENCE_CLASS.PHYSICAL_MULTIPEER){
    provenance.deviceClass=requiredText(provenance.deviceClass,'provenance.deviceClass');
    provenance.deviceModel=requiredText(provenance.deviceModel,'provenance.deviceModel');
    if(String(provenance.deviceClass).toLowerCase().includes('synthetic'))throw Error('Physical RRP evidence cannot use a synthetic device class');
  }
  if(evidenceClass===EVIDENCE_CLASS.PHYSICAL_MULTIPEER){
    const peers=Number(provenance.peers);
    if(!Number.isInteger(peers)||peers<2)throw Error('Physical multipeer evidence requires at least two peers');
    provenance.peers=peers;
    provenance.networkProfile=requiredText(provenance.networkProfile,'provenance.networkProfile');
  }
  return Object.freeze({schema:'rrp-performance-evidence',version:RRP_PERFORMANCE_EVIDENCE_VERSION,evidenceClass,samples,metrics:Object.freeze(metrics),safety:Object.freeze(safety),provenance:Object.freeze(provenance)});
}

function eligibleFor(evidenceClass,minEvidenceClass){return CLASS_RANK[evidenceClass]>=CLASS_RANK[minEvidenceClass];}

export function evaluateRrpPerformanceContract(input,{requirePhysicalCertification=false}={}){
  const evidence=normalizeRrpPerformanceEvidence(input);
  const safetyMissing=RRP_SAFETY_KEYS.filter(key=>evidence.safety[key]==null);
  const safetyFailures=RRP_SAFETY_KEYS.filter(key=>(evidence.safety[key]??0)>0).map(key=>({metric:key,value:evidence.safety[key],required:0}));
  const sloChecks=[],sloFailures=[];
  for(const[key,target]of Object.entries(RRP_ABSOLUTE_SLOS)){
    const value=evidence.metrics[key];
    if(value==null||!eligibleFor(evidence.evidenceClass,target.minEvidenceClass))continue;
    const row={metric:key,value,max:target.max,pass:value<=target.max,source:target.source};sloChecks.push(row);if(!row.pass)sloFailures.push(row);
  }
  const calibrationRequired=evidence.evidenceClass===EVIDENCE_CLASS.PHYSICAL_MULTIPEER?PHYSICAL_MULTIPEER_CALIBRATION_METRICS.filter(key=>evidence.metrics[key]==null):[];
  const physicalCertificationEligible=evidence.evidenceClass===EVIDENCE_CLASS.PHYSICAL_MULTIPEER&&safetyMissing.length===0&&calibrationRequired.length===0;
  const failures=[...safetyFailures,...sloFailures];
  let status=failures.length?PERFORMANCE_STATUS.FAIL:PERFORMANCE_STATUS.PASS;
  if(!failures.length&&(safetyMissing.length||calibrationRequired.length||requirePhysicalCertification&&!physicalCertificationEligible))status=PERFORMANCE_STATUS.CALIBRATION_REQUIRED;
  return Object.freeze({status,pass:status===PERFORMANCE_STATUS.PASS,evidenceClass:evidence.evidenceClass,safety:{complete:safetyMissing.length===0,missing:safetyMissing,failures:safetyFailures},slos:{checks:sloChecks,failures:sloFailures},calibrationRequired,physicalCertificationEligible,evidence});
}

export function realityResultToPerformanceEvidence(result,{scenario='steady',canonSafety=null}={}){
  if(!plain(result))throw Error('Reality result is required');
  const elapsedSeconds=Math.max(.001,Number(result.elapsedMs||0)/1000);
  const messages=Math.max(0,Number(result.messages||0));
  const missing=Math.max(0,Number(result.missingSamples||0));
  const measured=Math.max(0,Number(result.errorSamples||0));
  const safety=Object.fromEntries(RRP_SAFETY_KEYS.map(key=>[key,canonSafety?.[key]??null]));
  return normalizeRrpPerformanceEvidence({
    evidenceClass:EVIDENCE_CLASS.MODEL,
    samples:messages,
    metrics:{
      hostUplinkAverageKbps:numberOrNull(result.primaryKbps),
      peerUplinkAverageKbps:numberOrNull(result.maxPeerKbps),
      modelDeliveryP95Ms:numberOrNull(result.modelDeliveryP95Ms),
      modelMaxQueue:numberOrNull(result.maxQueue),
      modelDarkMs:numberOrNull(result.darkMs),
      modelRollbackMs:numberOrNull(result.rollbackMs),
      positionErrorMaxM:numberOrNull(result.maxPositionError),
      missingSampleRate:missing+measured>0?missing/(missing+measured):null,
    },
    safety,
    provenance:{scenario,mode:result.mode??null,elapsedSeconds},
  });
}

export const RRP_RATCHET=Object.freeze({
  inputToDisplayP95Ms:1.12,canonCommitP95Ms:1.12,peerUplinkP95Kbps:1.15,hostUplinkP95Kbps:1.15,
  reliableBufferedAmountMaxBytes:1.20,presenceBufferedAmountMaxBytes:1.20,stateFreshnessP95Ms:1.12,
  positionErrorP95M:1.15,rollbackP95Ms:1.15,frameP95Ms:1.12,gpuP95Ms:1.15,memoryPeakMb:1.15,batteryPctPerHour:1.15,
});

function compatibleBaseline(baseline,current){
  const mismatches=[];
  const same=(key,a,b)=>{if(a!=null&&b!=null&&a!==b)mismatches.push({field:key,baseline:a,current:b});};
  same('evidenceClass',baseline.evidenceClass,current.evidenceClass);
  if(baseline.evidenceClass===EVIDENCE_CLASS.PHYSICAL_MULTIPEER){same('provenance.peers',baseline.provenance.peers,current.provenance.peers);same('provenance.networkProfile',baseline.provenance.networkProfile,current.provenance.networkProfile);}
  if(baseline.evidenceClass===EVIDENCE_CLASS.PHYSICAL_DEVICE||baseline.evidenceClass===EVIDENCE_CLASS.PHYSICAL_MULTIPEER){same('provenance.deviceClass',baseline.provenance.deviceClass,current.provenance.deviceClass);same('provenance.deviceModel',baseline.provenance.deviceModel,current.provenance.deviceModel);}
  return{comparable:mismatches.length===0,mismatches};
}

export function compareRrpPerformanceEvidence(baselineInput,currentInput,{ratios=RRP_RATCHET}={}){
  const baseline=normalizeRrpPerformanceEvidence(baselineInput),current=normalizeRrpPerformanceEvidence(currentInput),compatibility=compatibleBaseline(baseline,current);
  if(!compatibility.comparable)throw Error(`RRP performance evidence is not comparable: ${compatibility.mismatches.map(row=>row.field).join(', ')}`);
  const regressions=[],improvements=[],checks=[];
  for(const[key,ratio]of Object.entries(ratios)){
    const before=baseline.metrics[key],after=current.metrics[key];
    if(before==null)continue;
    if(after==null){regressions.push({metric:key,baseline:before,current:null,reason:'measurement-missing'});continue;}
    const limit=before*Number(ratio),pass=after<=limit+1e-9,row={metric:key,baseline:before,current:after,limit,ratio:Number(ratio),pass};checks.push(row);if(!pass)regressions.push(row);else if(after<before)improvements.push(row);
  }
  const contract=evaluateRrpPerformanceContract(current);
  return Object.freeze({pass:contract.status!==PERFORMANCE_STATUS.FAIL&&regressions.length===0,compatibility,contract,checks,regressions,improvements});
}
