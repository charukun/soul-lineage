export const RRP_PERFORMANCE_EVIDENCE_VERSION=1;
export const EVIDENCE_CLASS=Object.freeze({MODEL:'model',BROWSER_SYNTHETIC:'browser-synthetic',PHYSICAL_DEVICE:'physical-device',PHYSICAL_MULTIPEER:'physical-multipeer'});
export const PERFORMANCE_STATUS=Object.freeze({PASS:'pass',FAIL:'fail',CALIBRATION_REQUIRED:'calibration-required'});

export const RRP_SAFETY_KEYS=Object.freeze([
  'committedCanonRollbackEvents','duplicateIrreversibleCommits','staleAuthorityAccepts','splitBrainOpenMs','uncommittedCanonVisibleEvents','recoveryOpenWithoutMaterialEvents',
]);
export const RRP_PERFORMANCE_METRICS=Object.freeze([
  'inputToAuthoritativeAckP50Ms','inputToAuthoritativeAckP95Ms','inputToAuthoritativeAckP99Ms',
  'inputToDisplayP50Ms','inputToDisplayP95Ms','inputToDisplayP99Ms','canonCommitP50Ms','canonCommitP95Ms','canonCommitP99Ms',
  'hostLossDetectionP95Ms','hostReopenP95Ms','peerUplinkAverageKbps','peerUplinkP95Kbps','peerUplinkPeakKbps','hostUplinkAverageKbps','hostUplinkP95Kbps','hostUplinkPeakKbps',
  'reliableBufferedAmountMaxBytes','presenceBufferedAmountMaxBytes','stateFreshnessP95Ms','stateFreshnessP99Ms','positionErrorP95M','positionErrorMaxM','missingSampleRate',
  'rollbackPerMinute','rollbackP95Ms','rollbackMaxMs','connectionSuccessRate','turnRelayRate','frameP95Ms','gpuP95Ms','memoryPeakMb','batteryPctPerHour',
  'modelDeliveryP95Ms','modelMaxQueue','modelDarkMs','modelRollbackMs',
]);

export const RRP_ABSOLUTE_SLOS=Object.freeze({
  frameP95Ms:Object.freeze({max:33.34,minEvidenceClass:EVIDENCE_CLASS.PHYSICAL_DEVICE,source:'pixel-fold-class 30fps target'}),
  hostLossDetectionP95Ms:Object.freeze({max:4500,minEvidenceClass:EVIDENCE_CLASS.PHYSICAL_MULTIPEER,source:'peer-host migration SLO'}),
  hostReopenP95Ms:Object.freeze({max:6000,minEvidenceClass:EVIDENCE_CLASS.PHYSICAL_MULTIPEER,source:'peer-host migration SLO'}),
});

export const PHYSICAL_MULTIPEER_CALIBRATION_METRICS=Object.freeze([
  'inputToAuthoritativeAckP95Ms','inputToDisplayP95Ms','canonCommitP95Ms','peerUplinkP95Kbps','hostUplinkP95Kbps','reliableBufferedAmountMaxBytes','presenceBufferedAmountMaxBytes',
  'stateFreshnessP95Ms','positionErrorP95M','rollbackP95Ms','connectionSuccessRate',
]);
export const PHYSICAL_MULTIPEER_REQUIRED_METRICS=Object.freeze([...new Set([...PHYSICAL_MULTIPEER_CALIBRATION_METRICS,'hostLossDetectionP95Ms','hostReopenP95Ms','frameP95Ms'])]);

// Calibration floors only. A measured interval with zero rollback events is still valid rollback evidence.
export const RRP_MIN_SAMPLE_COUNTS=Object.freeze({
  inputToAuthoritativeAckP95Ms:300,inputToDisplayP95Ms:300,canonCommitP95Ms:20,hostLossDetectionP95Ms:20,hostReopenP95Ms:20,
  peerUplinkP95Kbps:120,hostUplinkP95Kbps:120,reliableBufferedAmountMaxBytes:120,presenceBufferedAmountMaxBytes:120,
  stateFreshnessP95Ms:300,positionErrorP95M:300,rollbackP95Ms:1,connectionSuccessRate:20,frameP95Ms:300,
});

const CLASS_RANK=Object.freeze({[EVIDENCE_CLASS.MODEL]:0,[EVIDENCE_CLASS.BROWSER_SYNTHETIC]:1,[EVIDENCE_CLASS.PHYSICAL_DEVICE]:2,[EVIDENCE_CLASS.PHYSICAL_MULTIPEER]:3});
const plain=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const clone=value=>structuredClone(value);
const numberOrNull=value=>value==null?null:Number(value);
const finiteNonNegative=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const finiteRate=value=>finiteNonNegative(value)&&value<=1;
const finiteSamples=values=>Array.isArray(values)?values.map(Number).filter(Number.isFinite):[];
const count=values=>finiteSamples(values).length;
const average=values=>{const rows=finiteSamples(values);return rows.length?rows.reduce((sum,value)=>sum+value,0)/rows.length:null;};
const peak=values=>{const rows=finiteSamples(values);return rows.length?Math.max(...rows):null;};

function normalizeMetric(key,value){if(value==null)return null;const number=Number(value),isRate=key.endsWith('Rate');if(!(isRate?finiteRate(number):finiteNonNegative(number)))throw Error(`Invalid RRP performance metric ${key}`);return number;}
function normalizeSafety(key,value){if(value==null)return null;const number=Number(value);if(!finiteNonNegative(number)||(!Number.isInteger(number)&&key!=='splitBrainOpenMs'))throw Error(`Invalid RRP safety metric ${key}`);return number;}
function normalizeSampleCount(value,key){if(value==null)return null;const number=Number(value);if(!Number.isInteger(number)||number<0)throw Error(`Invalid RRP sample count ${key}`);return number;}
function requiredText(value,label){if(typeof value!=='string'||!value.trim())throw Error(`RRP performance evidence requires ${label}`);return value.trim();}

export function percentile(values,p){if(!Array.isArray(values)||!values.length||!Number.isFinite(p)||p<0||p>1)throw Error('Invalid percentile input');const sorted=finiteSamples(values).sort((a,b)=>a-b);if(!sorted.length)throw Error('Percentile requires finite samples');return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*p)-1))];}
const pct=(values,p)=>{const rows=finiteSamples(values);return rows.length?percentile(rows,p):null;};

export function aggregateRrpPerformanceSamples(samples={}){
  if(!plain(samples))throw Error('RRP performance samples must be an object');
  const success=Number(samples.connectionSuccesses??0),attempts=Number(samples.connectionAttempts??0),relayed=Number(samples.turnRelayConnections??0),classified=Number(samples.turnCandidateClassifiedConnections??0);
  if(!Number.isInteger(success)||success<0||!Number.isInteger(attempts)||attempts<0||success>attempts)throw Error('Invalid connection sample counts');
  if(!Number.isInteger(relayed)||relayed<0||!Number.isInteger(classified)||classified<0||classified>success||relayed>classified)throw Error('Invalid TURN sample counts');
  const rollback=finiteSamples(samples.rollbackMs),durationMinutes=Number(samples.durationMinutes??0);if(!Number.isFinite(durationMinutes)||durationMinutes<0)throw Error('Invalid sample duration');
  return Object.freeze({
    inputToAuthoritativeAckP50Ms:pct(samples.inputToAuthoritativeAckMs,.50),inputToAuthoritativeAckP95Ms:pct(samples.inputToAuthoritativeAckMs,.95),inputToAuthoritativeAckP99Ms:pct(samples.inputToAuthoritativeAckMs,.99),
    inputToDisplayP50Ms:pct(samples.inputToDisplayMs,.50),inputToDisplayP95Ms:pct(samples.inputToDisplayMs,.95),inputToDisplayP99Ms:pct(samples.inputToDisplayMs,.99),
    canonCommitP50Ms:pct(samples.canonCommitMs,.50),canonCommitP95Ms:pct(samples.canonCommitMs,.95),canonCommitP99Ms:pct(samples.canonCommitMs,.99),
    hostLossDetectionP95Ms:pct(samples.hostLossDetectionMs,.95),hostReopenP95Ms:pct(samples.hostReopenMs,.95),
    peerUplinkAverageKbps:average(samples.peerUplinkKbps),peerUplinkP95Kbps:pct(samples.peerUplinkKbps,.95),peerUplinkPeakKbps:peak(samples.peerUplinkKbps),
    hostUplinkAverageKbps:average(samples.hostUplinkKbps),hostUplinkP95Kbps:pct(samples.hostUplinkKbps,.95),hostUplinkPeakKbps:peak(samples.hostUplinkKbps),
    reliableBufferedAmountMaxBytes:peak(samples.reliableBufferedAmountBytes),presenceBufferedAmountMaxBytes:peak(samples.presenceBufferedAmountBytes),
    stateFreshnessP95Ms:pct(samples.stateFreshnessMs,.95),stateFreshnessP99Ms:pct(samples.stateFreshnessMs,.99),positionErrorP95M:pct(samples.positionErrorM,.95),positionErrorMaxM:peak(samples.positionErrorM),
    missingSampleRate:Number.isFinite(Number(samples.missingSamples))&&Number.isFinite(Number(samples.expectedSamples))&&Number(samples.expectedSamples)>0?Number(samples.missingSamples)/Number(samples.expectedSamples):null,
    rollbackPerMinute:durationMinutes>0?rollback.length/durationMinutes:null,rollbackP95Ms:durationMinutes>0?(rollback.length?percentile(rollback,.95):0):null,rollbackMaxMs:durationMinutes>0?(rollback.length?Math.max(...rollback):0):null,
    connectionSuccessRate:attempts>0?success/attempts:null,turnRelayRate:classified>0?relayed/classified:null,
    frameP95Ms:pct(samples.frameMs,.95),gpuP95Ms:pct(samples.gpuMs,.95),memoryPeakMb:peak(samples.memoryMb),batteryPctPerHour:average(samples.batteryPctPerHour),
    modelDeliveryP95Ms:pct(samples.modelDeliveryMs,.95),modelMaxQueue:peak(samples.modelQueue),modelDarkMs:peak(samples.modelDarkMs),modelRollbackMs:peak(samples.modelRollbackMs),
  });
}

export function rrpPerformanceSampleCounts(samples={}){
  if(!plain(samples))throw Error('RRP performance samples must be an object');
  return Object.freeze({
    inputToAuthoritativeAckP95Ms:count(samples.inputToAuthoritativeAckMs),inputToDisplayP95Ms:count(samples.inputToDisplayMs),canonCommitP95Ms:count(samples.canonCommitMs),hostLossDetectionP95Ms:count(samples.hostLossDetectionMs),hostReopenP95Ms:count(samples.hostReopenMs),
    peerUplinkP95Kbps:count(samples.peerUplinkKbps),hostUplinkP95Kbps:count(samples.hostUplinkKbps),reliableBufferedAmountMaxBytes:count(samples.reliableBufferedAmountBytes),presenceBufferedAmountMaxBytes:count(samples.presenceBufferedAmountBytes),
    stateFreshnessP95Ms:count(samples.stateFreshnessMs),positionErrorP95M:count(samples.positionErrorM),rollbackP95Ms:count(samples.rollbackMs)||Number(Number(samples.durationMinutes)>0),connectionSuccessRate:Number(samples.connectionAttempts??0),frameP95Ms:count(samples.frameMs),
  });
}

export function buildRrpPerformanceEvidenceFromSamples({evidenceClass,rawSamples,safety,provenance}={}){
  const metrics=aggregateRrpPerformanceSamples(rawSamples||{}),sampleCounts=rrpPerformanceSampleCounts(rawSamples||{});
  return normalizeRrpPerformanceEvidence({evidenceClass,samples:Math.max(0,...Object.values(sampleCounts).filter(Number.isFinite)),metrics,sampleCounts,safety,provenance});
}

export function normalizeRrpPerformanceEvidence(input={}){
  if(!plain(input))throw Error('Invalid RRP performance evidence');
  const evidenceClass=input.evidenceClass;if(!Object.values(EVIDENCE_CLASS).includes(evidenceClass))throw Error('Unknown RRP performance evidence class');
  const metrics=Object.fromEntries(RRP_PERFORMANCE_METRICS.map(key=>[key,normalizeMetric(key,input.metrics?.[key])]));
  const safety=Object.fromEntries(RRP_SAFETY_KEYS.map(key=>[key,normalizeSafety(key,input.safety?.[key])]));
  const sampleCounts=Object.fromEntries(RRP_PERFORMANCE_METRICS.map(key=>[key,normalizeSampleCount(input.sampleCounts?.[key],key)]));
  const samples=Number(input.samples??0);if(!Number.isInteger(samples)||samples<0)throw Error('Invalid RRP performance sample count');
  const provenance=plain(input.provenance)?clone(input.provenance):{};
  if(evidenceClass!==EVIDENCE_CLASS.MODEL){provenance.buildRevision=requiredText(provenance.buildRevision,'provenance.buildRevision');provenance.runtime=requiredText(provenance.runtime,'provenance.runtime');}
  if(evidenceClass===EVIDENCE_CLASS.PHYSICAL_DEVICE||evidenceClass===EVIDENCE_CLASS.PHYSICAL_MULTIPEER){provenance.deviceClass=requiredText(provenance.deviceClass,'provenance.deviceClass');provenance.deviceModel=requiredText(provenance.deviceModel,'provenance.deviceModel');if(String(provenance.deviceClass).toLowerCase().includes('synthetic'))throw Error('Physical RRP evidence cannot use a synthetic device class');}
  if(evidenceClass===EVIDENCE_CLASS.PHYSICAL_MULTIPEER){const peers=Number(provenance.peers);if(!Number.isInteger(peers)||peers<2)throw Error('Physical multipeer evidence requires at least two peers');provenance.peers=peers;provenance.networkProfile=requiredText(provenance.networkProfile,'provenance.networkProfile');}
  return Object.freeze({schema:'rrp-performance-evidence',version:RRP_PERFORMANCE_EVIDENCE_VERSION,evidenceClass,samples,metrics:Object.freeze(metrics),sampleCounts:Object.freeze(sampleCounts),safety:Object.freeze(safety),provenance:Object.freeze(provenance)});
}

function eligibleFor(evidenceClass,minEvidenceClass){return CLASS_RANK[evidenceClass]>=CLASS_RANK[minEvidenceClass];}
export function evaluateRrpPerformanceContract(input,{requirePhysicalCertification=false}={}){
  const evidence=normalizeRrpPerformanceEvidence(input),safetyMissing=RRP_SAFETY_KEYS.filter(key=>evidence.safety[key]==null);
  const safetyFailures=RRP_SAFETY_KEYS.filter(key=>(evidence.safety[key]??0)>0).map(key=>({metric:key,value:evidence.safety[key],required:0})),sloChecks=[],sloFailures=[];
  for(const[key,target]of Object.entries(RRP_ABSOLUTE_SLOS)){const value=evidence.metrics[key];if(value==null||!eligibleFor(evidence.evidenceClass,target.minEvidenceClass))continue;const row={metric:key,value,max:target.max,pass:value<=target.max,source:target.source};sloChecks.push(row);if(!row.pass)sloFailures.push(row);}
  const calibrationRequired=evidence.evidenceClass===EVIDENCE_CLASS.PHYSICAL_MULTIPEER?PHYSICAL_MULTIPEER_REQUIRED_METRICS.filter(key=>evidence.metrics[key]==null):[];
  const insufficientSamples=evidence.evidenceClass===EVIDENCE_CLASS.PHYSICAL_MULTIPEER?PHYSICAL_MULTIPEER_REQUIRED_METRICS.filter(key=>evidence.metrics[key]!=null&&((evidence.sampleCounts[key]??0)<(RRP_MIN_SAMPLE_COUNTS[key]??1))).map(key=>({metric:key,count:evidence.sampleCounts[key]??0,minimum:RRP_MIN_SAMPLE_COUNTS[key]??1})):[];
  const physicalCertificationEligible=evidence.evidenceClass===EVIDENCE_CLASS.PHYSICAL_MULTIPEER&&safetyMissing.length===0&&calibrationRequired.length===0&&insufficientSamples.length===0;
  const failures=[...safetyFailures,...sloFailures];let status=failures.length?PERFORMANCE_STATUS.FAIL:PERFORMANCE_STATUS.PASS;
  if(!failures.length&&(safetyMissing.length||calibrationRequired.length||insufficientSamples.length||requirePhysicalCertification&&!physicalCertificationEligible))status=PERFORMANCE_STATUS.CALIBRATION_REQUIRED;
  return Object.freeze({status,pass:status===PERFORMANCE_STATUS.PASS,evidenceClass:evidence.evidenceClass,safety:{complete:safetyMissing.length===0,missing:safetyMissing,failures:safetyFailures},slos:{checks:sloChecks,failures:sloFailures},calibrationRequired,insufficientSamples,physicalCertificationEligible,evidence});
}

export function realityResultToPerformanceEvidence(result,{scenario='steady',canonSafety=null}={}){
  if(!plain(result))throw Error('Reality result is required');
  const elapsedSeconds=Math.max(.001,Number(result.elapsedMs||0)/1000),messages=Math.max(0,Number(result.messages||0)),missing=Math.max(0,Number(result.missingSamples||0)),measured=Math.max(0,Number(result.errorSamples||0));
  const safety=Object.fromEntries(RRP_SAFETY_KEYS.map(key=>[key,canonSafety?.[key]??null]));
  return normalizeRrpPerformanceEvidence({evidenceClass:EVIDENCE_CLASS.MODEL,samples:messages,metrics:{hostUplinkAverageKbps:numberOrNull(result.primaryKbps),peerUplinkAverageKbps:numberOrNull(result.maxPeerKbps),modelDeliveryP95Ms:numberOrNull(result.modelDeliveryP95Ms),modelMaxQueue:numberOrNull(result.maxQueue),modelDarkMs:numberOrNull(result.darkMs),modelRollbackMs:numberOrNull(result.rollbackMs),positionErrorMaxM:numberOrNull(result.maxPositionError),missingSampleRate:missing+measured>0?missing/(missing+measured):null},sampleCounts:{modelDeliveryP95Ms:messages,modelMaxQueue:messages},safety,provenance:{scenario,mode:result.mode??null,elapsedSeconds}});
}

export const RRP_RATCHET=Object.freeze({inputToAuthoritativeAckP95Ms:1.12,inputToDisplayP95Ms:1.12,canonCommitP95Ms:1.12,peerUplinkP95Kbps:1.15,hostUplinkP95Kbps:1.15,reliableBufferedAmountMaxBytes:1.20,presenceBufferedAmountMaxBytes:1.20,stateFreshnessP95Ms:1.12,positionErrorP95M:1.15,rollbackP95Ms:1.15,frameP95Ms:1.12,gpuP95Ms:1.15,memoryPeakMb:1.15,batteryPctPerHour:1.15});
function compatibleBaseline(baseline,current){const mismatches=[];const same=(key,a,b)=>{if(a!=null&&b!=null&&a!==b)mismatches.push({field:key,baseline:a,current:b});};same('evidenceClass',baseline.evidenceClass,current.evidenceClass);if(baseline.evidenceClass===EVIDENCE_CLASS.PHYSICAL_MULTIPEER){same('provenance.peers',baseline.provenance.peers,current.provenance.peers);same('provenance.networkProfile',baseline.provenance.networkProfile,current.provenance.networkProfile);}if(baseline.evidenceClass===EVIDENCE_CLASS.PHYSICAL_DEVICE||baseline.evidenceClass===EVIDENCE_CLASS.PHYSICAL_MULTIPEER){same('provenance.deviceClass',baseline.provenance.deviceClass,current.provenance.deviceClass);same('provenance.deviceModel',baseline.provenance.deviceModel,current.provenance.deviceModel);}return{comparable:mismatches.length===0,mismatches};}
export function compareRrpPerformanceEvidence(baselineInput,currentInput,{ratios=RRP_RATCHET}={}){const baseline=normalizeRrpPerformanceEvidence(baselineInput),current=normalizeRrpPerformanceEvidence(currentInput),compatibility=compatibleBaseline(baseline,current);if(!compatibility.comparable)throw Error(`RRP performance evidence is not comparable: ${compatibility.mismatches.map(row=>row.field).join(', ')}`);const regressions=[],improvements=[],checks=[];for(const[key,ratio]of Object.entries(ratios)){const before=baseline.metrics[key],after=current.metrics[key];if(before==null)continue;if(after==null){regressions.push({metric:key,baseline:before,current:null,reason:'measurement-missing'});continue;}const limit=before*Number(ratio),pass=after<=limit+1e-9,row={metric:key,baseline:before,current:after,limit,ratio:Number(ratio),pass};checks.push(row);if(!pass)regressions.push(row);else if(after<before)improvements.push(row);}const contract=evaluateRrpPerformanceContract(current);return Object.freeze({pass:contract.status===PERFORMANCE_STATUS.PASS&&regressions.length===0,compatibility,contract,checks,regressions,improvements});}

function completePhysicalFixture(overrides={}){
  const safety=Object.fromEntries(RRP_SAFETY_KEYS.map(key=>[key,0])),metrics={inputToAuthoritativeAckP95Ms:140,inputToDisplayP95Ms:180,canonCommitP95Ms:220,hostLossDetectionP95Ms:4000,hostReopenP95Ms:5000,peerUplinkP95Kbps:320,hostUplinkP95Kbps:900,reliableBufferedAmountMaxBytes:32768,presenceBufferedAmountMaxBytes:8192,stateFreshnessP95Ms:180,positionErrorP95M:.35,rollbackP95Ms:0,connectionSuccessRate:.99,frameP95Ms:30,...(overrides.metrics||{})};
  const sampleCounts=Object.fromEntries(PHYSICAL_MULTIPEER_REQUIRED_METRICS.map(key=>[key,RRP_MIN_SAMPLE_COUNTS[key]??1]));
  return {evidenceClass:EVIDENCE_CLASS.PHYSICAL_MULTIPEER,samples:300,safety:{...safety,...(overrides.safety||{})},metrics,sampleCounts:{...sampleCounts,...(overrides.sampleCounts||{})},provenance:{buildRevision:'proof',runtime:'browser',deviceClass:'physical-mobile',deviceModel:'fixture',peers:3,networkProfile:'fixture',...(overrides.provenance||{})}};
}
export function runRrpPerformanceContractProofSuite(){
  const safe=evaluateRrpPerformanceContract(completePhysicalFixture()),unsafe=evaluateRrpPerformanceContract(completePhysicalFixture({metrics:{inputToDisplayP95Ms:1,hostUplinkP95Kbps:1},safety:{committedCanonRollbackEvents:1}})),slow=evaluateRrpPerformanceContract(completePhysicalFixture({metrics:{hostLossDetectionP95Ms:4501}}));
  const missing=completePhysicalFixture();delete missing.metrics.inputToDisplayP95Ms;const calibration=evaluateRrpPerformanceContract(missing);
  const thin=completePhysicalFixture({sampleCounts:{inputToDisplayP95Ms:10}}),insufficient=evaluateRrpPerformanceContract(thin);
  const model=evaluateRrpPerformanceContract(realityResultToPerformanceEvidence({mode:'cells',elapsedMs:16000,messages:10,primaryKbps:1,maxPeerKbps:1,modelDeliveryP95Ms:1,maxQueue:1,darkMs:0,rollbackMs:0,maxPositionError:0,missingSamples:0}),{requirePhysicalCertification:true});
  const ratchet=compareRrpPerformanceEvidence(completePhysicalFixture(),completePhysicalFixture({metrics:{inputToDisplayP95Ms:220}}));
  const checks={completePhysicalPasses:safe.status===PERFORMANCE_STATUS.PASS&&safe.physicalCertificationEligible,unsafeFastFails:unsafe.status===PERFORMANCE_STATUS.FAIL,anchoredSloFails:slow.status===PERFORMANCE_STATUS.FAIL,missingMetricCalibrates:calibration.status===PERFORMANCE_STATUS.CALIBRATION_REQUIRED&&!calibration.physicalCertificationEligible,insufficientSamplesCalibrate:insufficient.status===PERFORMANCE_STATUS.CALIBRATION_REQUIRED&&!insufficient.physicalCertificationEligible,modelCannotCertify:model.status===PERFORMANCE_STATUS.CALIBRATION_REQUIRED&&!model.physicalCertificationEligible,ratchetRejectsRegression:ratchet.pass===false&&ratchet.regressions.some(row=>row.metric==='inputToDisplayP95Ms'),anchoredTargetsPreserved:RRP_ABSOLUTE_SLOS.frameP95Ms.max===33.34&&RRP_ABSOLUTE_SLOS.hostLossDetectionP95Ms.max===4500&&RRP_ABSOLUTE_SLOS.hostReopenP95Ms.max===6000};
  return Object.freeze({pass:Object.values(checks).every(Boolean),checks});
}
