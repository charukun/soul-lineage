import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVIDENCE_CLASS,PERFORMANCE_STATUS,RRP_ABSOLUTE_SLOS,RRP_SAFETY_KEYS,
  compareRrpPerformanceEvidence,evaluateRrpPerformanceContract,normalizeRrpPerformanceEvidence,
  percentile,realityResultToPerformanceEvidence,
} from '../src/game/reality-lab/performance-contract.js';

const zeroSafety=()=>Object.fromEntries(RRP_SAFETY_KEYS.map(key=>[key,0]));
const physicalBase=(metrics={})=>({
  evidenceClass:EVIDENCE_CLASS.PHYSICAL_MULTIPEER,
  samples:300,
  safety:zeroSafety(),
  metrics:{
    inputToDisplayP95Ms:180,canonCommitP95Ms:220,hostLossDetectionP95Ms:4000,hostReopenP95Ms:5000,
    peerUplinkP95Kbps:320,hostUplinkP95Kbps:900,reliableBufferedAmountMaxBytes:32768,presenceBufferedAmountMaxBytes:8192,
    stateFreshnessP95Ms:180,positionErrorP95M:.35,rollbackP95Ms:80,connectionSuccessRate:.99,frameP95Ms:30,...metrics,
  },
  provenance:{buildRevision:'abc',runtime:'Chrome 140',deviceClass:'pixel-fold-class',deviceModel:'Pixel Fold',peers:3,networkProfile:'wifi-lan'},
});

test('percentile uses a deterministic nearest-rank definition',()=>{
  assert.equal(percentile([5,1,4,2,3],.5),3);
  assert.equal(percentile([5,1,4,2,3],.95),5);
});

test('faster evidence cannot pass when a safety invariant is violated',()=>{
  const input=physicalBase({inputToDisplayP95Ms:1,hostUplinkP95Kbps:1});
  input.safety={...input.safety,committedCanonRollbackEvents:1};
  const result=evaluateRrpPerformanceContract(input);
  assert.equal(result.status,PERFORMANCE_STATUS.FAIL);
  assert.equal(result.safety.failures[0].metric,'committedCanonRollbackEvents');
});

test('physical multipeer evidence passes anchored SLOs only when safety and calibration metrics are complete',()=>{
  const result=evaluateRrpPerformanceContract(physicalBase());
  assert.equal(result.status,PERFORMANCE_STATUS.PASS);
  assert.equal(result.physicalCertificationEligible,true);
  assert.equal(result.slows,undefined);
  assert.equal(result.slos.failures.length,0);
});

test('existing migration SLO regressions fail the contract',()=>{
  const result=evaluateRrpPerformanceContract(physicalBase({hostLossDetectionP95Ms:RRP_ABSOLUTE_SLOS.hostLossDetectionP95Ms.max+1}));
  assert.equal(result.status,PERFORMANCE_STATUS.FAIL);
  assert.equal(result.slos.failures[0].metric,'hostLossDetectionP95Ms');
});

test('physical frame p95 retains the 30fps-class absolute target',()=>{
  const result=evaluateRrpPerformanceContract(physicalBase({frameP95Ms:33.35}));
  assert.equal(result.status,PERFORMANCE_STATUS.FAIL);
  assert.ok(result.slos.failures.some(row=>row.metric==='frameP95Ms'));
});

test('missing physical network measurements remain calibration gaps instead of passes',()=>{
  const input=physicalBase();delete input.metrics.inputToDisplayP95Ms;delete input.metrics.hostUplinkP95Kbps;
  const result=evaluateRrpPerformanceContract(input);
  assert.equal(result.status,PERFORMANCE_STATUS.CALIBRATION_REQUIRED);
  assert.equal(result.physicalCertificationEligible,false);
  assert.ok(result.calibrationRequired.includes('inputToDisplayP95Ms'));
  assert.ok(result.calibrationRequired.includes('hostUplinkP95Kbps'));
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

test('ratchet comparison catches regressions and missing repeated measurements',()=>{
  const baseline=physicalBase(),current=physicalBase({inputToDisplayP95Ms:220});
  const compared=compareRrpPerformanceEvidence(baseline,current);
  assert.equal(compared.pass,false);
  assert.ok(compared.regressions.some(row=>row.metric==='inputToDisplayP95Ms'));
  const missing=physicalBase();delete missing.metrics.frameP95Ms;
  const missingCompared=compareRrpPerformanceEvidence(baseline,missing);
  assert.equal(missingCompared.pass,false);
  assert.ok(missingCompared.regressions.some(row=>row.metric==='frameP95Ms'&&row.reason==='measurement-missing'));
});

test('incompatible physical baselines are rejected instead of compared',()=>{
  const baseline=physicalBase(),current=physicalBase();current.provenance={...current.provenance,peers:4};
  assert.throws(()=>compareRrpPerformanceEvidence(baseline,current),/not comparable/);
});
