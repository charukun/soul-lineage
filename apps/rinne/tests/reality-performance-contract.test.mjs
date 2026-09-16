import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVIDENCE_CLASS,
  PERFORMANCE_STATUS,
  PHYSICAL_MULTIPEER_CALIBRATION_METRICS,
  PHYSICAL_MULTIPEER_REQUIRED_METRICS,
  RRP_ABSOLUTE_SLOS,
  RRP_MIN_SAMPLE_COUNTS,
  RRP_SAFETY_KEYS,
  aggregateRrpPerformanceSamples,
  compareRrpPerformanceEvidence,
  evaluateRrpPerformanceContract,
  normalizeRrpPerformanceEvidence,
  percentile,
  realityResultToPerformanceEvidence,
  runRrpPerformanceContractProofSuite,
} from '../src/game/reality-lab/performance-contract.js';

const zeroSafety=()=>Object.fromEntries(RRP_SAFETY_KEYS.map(key=>[key,0]));
const sampleCounts=()=>Object.fromEntries(PHYSICAL_MULTIPEER_REQUIRED_METRICS.map(key=>[key,RRP_MIN_SAMPLE_COUNTS[key]??1]));
const physicalBase=(metrics={})=>({
  evidenceClass:EVIDENCE_CLASS.PHYSICAL_MULTIPEER,
  samples:300,
  safety:zeroSafety(),
  metrics:{
    inputToAuthoritativeAckP95Ms:140,inputToDisplayP95Ms:180,canonCommitP95Ms:220,hostLossDetectionP95Ms:4000,hostReopenP95Ms:5000,
    peerUplinkP95Kbps:320,hostUplinkP95Kbps:900,reliableBufferedAmountMaxBytes:32768,presenceBufferedAmountMaxBytes:8192,
    stateFreshnessP95Ms:180,positionErrorP95M:.35,rollbackP95Ms:0,connectionSuccessRate:.99,frameP95Ms:30,...metrics,
  },
  sampleCounts:sampleCounts(),
  provenance:{buildRevision:'abc',runtime:'Chrome',deviceClass:'pixel-fold-class',deviceModel:'Pixel Fold',peers:3,networkProfile:'wifi-lan'},
});

const calibratedOptions={calibratedMetrics:PHYSICAL_MULTIPEER_CALIBRATION_METRICS};

test('percentile uses a deterministic nearest-rank definition',()=>{
  assert.equal(percentile([5,1,4,2,3],.5),3);
  assert.equal(percentile([5,1,4,2,3],.95),5);
});

test('raw performance samples keep authoritative acknowledgement and rendered display as separate metrics',()=>{
  const metrics=aggregateRrpPerformanceSamples({
    inputToAuthoritativeAckMs:[70,80,90,100],inputToDisplayMs:[100,120,140,200],canonCommitMs:[180,200,240],hostLossDetectionMs:[4000,4200],hostReopenMs:[5000,5200],
    peerUplinkKbps:[100,200,300],hostUplinkKbps:[600,800,1000],reliableBufferedAmountBytes:[0,1000,4000],presenceBufferedAmountBytes:[0,500],
    stateFreshnessMs:[100,130,170],positionErrorM:[.1,.2,.4],rollbackMs:[50,80],durationMinutes:2,
    connectionAttempts:100,connectionSuccesses:99,turnCandidateClassifiedConnections:80,turnRelayConnections:8,frameMs:[20,25,30],gpuMs:[10,12],memoryMb:[400,450],
  });
  assert.equal(metrics.inputToAuthoritativeAckP95Ms,100);
  assert.equal(metrics.inputToDisplayP95Ms,200);
  assert.equal(metrics.peerUplinkAverageKbps,200);
  assert.equal(metrics.hostUplinkPeakKbps,1000);
  assert.equal(metrics.reliableBufferedAmountMaxBytes,4000);
  assert.equal(metrics.connectionSuccessRate,.99);
  assert.equal(metrics.turnRelayRate,.1);
  assert.equal(metrics.batteryPctPerHour,null);
});

test('TURN rate stays unknown when candidate classification is unavailable',()=>{
  const metrics=aggregateRrpPerformanceSamples({connectionAttempts:1,connectionSuccesses:1,turnCandidateClassifiedConnections:0,turnRelayConnections:0});
  assert.equal(metrics.connectionSuccessRate,1);
  assert.equal(metrics.turnRelayRate,null);
});

test('measured zero rollback is preserved as zero instead of treated as missing',()=>{
  const metrics=aggregateRrpPerformanceSamples({rollbackMs:[],durationMinutes:5});
  assert.equal(metrics.rollbackPerMinute,0);
  assert.equal(metrics.rollbackP95Ms,0);
  assert.equal(metrics.rollbackMaxMs,0);
});

test('faster evidence cannot pass when a safety invariant is violated',()=>{
  const input=physicalBase({inputToDisplayP95Ms:1,hostUplinkP95Kbps:1});
  input.safety={...input.safety,committedCanonRollbackEvents:1};
  const result=evaluateRrpPerformanceContract(input,calibratedOptions);
  assert.equal(result.status,PERFORMANCE_STATUS.FAIL);
  assert.equal(result.safety.failures[0].metric,'committedCanonRollbackEvents');
});

test('complete first physical capture still requires explicit calibration acceptance',()=>{
  const result=evaluateRrpPerformanceContract(physicalBase(),{requirePhysicalCertification:true});
  assert.equal(result.status,PERFORMANCE_STATUS.CALIBRATION_REQUIRED);
  assert.equal(result.physicalCertificationEligible,false);
  assert.ok(result.uncalibratedMetrics.includes('inputToAuthoritativeAckP95Ms'));
  assert.ok(result.uncalibratedMetrics.includes('connectionSuccessRate'));
});

test('accepted calibrated physical evidence can pass anchored SLOs',()=>{
  const result=evaluateRrpPerformanceContract(physicalBase(),{...calibratedOptions,requirePhysicalCertification:true});
  assert.equal(result.status,PERFORMANCE_STATUS.PASS);
  assert.equal(result.physicalCertificationEligible,true);
  assert.equal(result.slos.failures.length,0);
  assert.equal(result.insufficientSamples.length,0);
  assert.equal(result.uncalibratedMetrics.length,0);
});

test('existing migration SLO regressions fail the contract',()=>{
  const result=evaluateRrpPerformanceContract(physicalBase({hostLossDetectionP95Ms:RRP_ABSOLUTE_SLOS.hostLossDetectionP95Ms.max+1}),calibratedOptions);
  assert.equal(result.status,PERFORMANCE_STATUS.FAIL);
  assert.equal(result.slos.failures[0].metric,'hostLossDetectionP95Ms');
});

test('physical frame p95 retains the 30fps-class absolute target',()=>{
  const result=evaluateRrpPerformanceContract(physicalBase({frameP95Ms:33.35}),calibratedOptions);
  assert.equal(result.status,PERFORMANCE_STATUS.FAIL);
  assert.ok(result.slos.failures.some(row=>row.metric==='frameP95Ms'));
});

test('missing physical network or anchored measurements remain calibration gaps instead of passes',()=>{
  const input=physicalBase();delete input.metrics.inputToDisplayP95Ms;delete input.metrics.hostUplinkP95Kbps;delete input.metrics.hostReopenP95Ms;
  const result=evaluateRrpPerformanceContract(input,calibratedOptions);
  assert.equal(result.status,PERFORMANCE_STATUS.CALIBRATION_REQUIRED);
  assert.equal(result.physicalCertificationEligible,false);
  assert.ok(result.calibrationRequired.includes('inputToDisplayP95Ms'));
  assert.ok(result.calibrationRequired.includes('hostUplinkP95Kbps'));
  assert.ok(result.calibrationRequired.includes('hostReopenP95Ms'));
});

test('insufficient physical samples remain calibration gaps instead of passes',()=>{
  const input=physicalBase();input.sampleCounts={...input.sampleCounts,inputToAuthoritativeAckP95Ms:10};
  const result=evaluateRrpPerformanceContract(input,calibratedOptions);
  assert.equal(result.status,PERFORMANCE_STATUS.CALIBRATION_REQUIRED);
  assert.equal(result.physicalCertificationEligible,false);
  assert.ok(result.insufficientSamples.some(row=>row.metric==='inputToAuthoritativeAckP95Ms'));
});

test('model evidence cannot masquerade as physical certification',()=>{
  const evidence=realityResultToPerformanceEvidence({mode:'cells',elapsedMs:16000,messages:100,primaryKbps:90,maxPeerKbps:30,modelDeliveryP95Ms:100,maxQueue:4,darkMs:0,rollbackMs:0,maxPositionError:.2,missingSamples:0},{scenario:'steady',canonSafety:zeroSafety()});
  const result=evaluateRrpPerformanceContract(evidence,{requirePhysicalCertification:true});
  assert.equal(result.evidenceClass,EVIDENCE_CLASS.MODEL);
  assert.equal(result.status,PERFORMANCE_STATUS.CALIBRATION_REQUIRED);
  assert.equal(result.physicalCertificationEligible,false);
});

test('physical evidence rejects synthetic device provenance',()=>{
  assert.throws(()=>normalizeRrpPerformanceEvidence({...physicalBase(),provenance:{...physicalBase().provenance,deviceClass:'synthetic-pixel-fold-class'}}),/synthetic/);
});

test('ratchet comparison catches lower-is-better and missing repeated measurements',()=>{
  const baseline=physicalBase(),current=physicalBase({inputToDisplayP95Ms:220});
  const compared=compareRrpPerformanceEvidence(baseline,current);
  assert.equal(compared.pass,false);
  assert.ok(compared.regressions.some(row=>row.metric==='inputToDisplayP95Ms'&&row.direction==='max'));
  const missing=physicalBase();delete missing.metrics.frameP95Ms;
  const missingCompared=compareRrpPerformanceEvidence(baseline,missing);
  assert.equal(missingCompared.pass,false);
  assert.ok(missingCompared.regressions.some(row=>row.metric==='frameP95Ms'&&row.reason==='measurement-missing'));
});

test('connection success uses a higher-is-better regression ratchet',()=>{
  const result=compareRrpPerformanceEvidence(physicalBase(),physicalBase({connectionSuccessRate:.90}));
  assert.equal(result.pass,false);
  assert.ok(result.regressions.some(row=>row.metric==='connectionSuccessRate'&&row.direction==='min'));
});

test('incompatible physical baselines are rejected instead of compared',()=>{
  const baseline=physicalBase(),current=physicalBase();current.provenance={...current.provenance,peers:4};
  assert.throws(()=>compareRrpPerformanceEvidence(baseline,current),/not comparable/);
});

test('performance contract proof suite keeps safety, calibration, sample and anchored SLO boundaries intact',()=>{
  const proof=runRrpPerformanceContractProofSuite();
  assert.equal(proof.pass,true);
  assert.deepEqual(proof.checks,{
    completePhysicalNeedsCalibration:true,
    calibratedPhysicalPasses:true,
    unsafeFastFails:true,
    anchoredSloFails:true,
    missingMetricCalibrates:true,
    insufficientSamplesCalibrate:true,
    modelCannotCertify:true,
    ratchetRejectsRegression:true,
    higherIsBetterRatchet:true,
    anchoredTargetsPreserved:true,
  });
});
