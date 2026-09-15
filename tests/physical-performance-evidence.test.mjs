import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPhysicalPerformanceEvidence,
  classifyCaptureSource,
  comparePhysicalPerformanceEvidence,
  validatePhysicalEvidenceCompatibility,
  validatePhysicalEvidenceRecord,
} from '../scripts/lib/physical-performance-evidence.mjs';

const capture = ({ samples = 300, frameP95Ms = 30, gpuP95Ms = 18, sceneId = 'village-runtime-v1', signature = 'a20-o30-i4-r12-v800' } = {}) => ({
  performance: {
    samples,
    frame: { averageMs: 24, p50Ms: 23, p95Ms: frameP95Ms, p99Ms: frameP95Ms + 3, longFrames: 0 },
    gpu: { averageMs: 15, p95Ms: gpuP95Ms, samples },
    drawCalls: { average: 90, p95: 100 },
    triangles: { average: 60000, p95: 65000 },
    textureBytes: { average: 20_000_000, p95: 20_000_000 },
    transparency: { drawCalls: { average: 12, p95: 15 }, triangles: { average: 4000, p95: 5000 } },
  },
  scene: { id: sceneId, signature },
});

const metadata = overrides => ({
  evidenceKind: 'physical-device',
  captureOrigin: 'physical-device',
  app: 'village',
  buildRevision: '75f5e1dfc00a1970b5163465331b03426b22d232',
  deviceModel: 'Pixel Fold',
  deviceClass: 'pixel-fold',
  os: 'Android 17',
  runtime: 'Chrome 140',
  capturedAt: '2026-09-15T18:00:00+09:00',
  viewportWidth: 412,
  viewportHeight: 892,
  ...overrides,
});

test('physical evidence requires explicit provenance and preserves a passing mobile target',()=>{
  const evidence=buildPhysicalPerformanceEvidence(capture(),metadata());
  assert.equal(evidence.schema,'soul-physical-performance-evidence');
  assert.equal(evidence.evidenceKind,'physical-device');
  assert.equal(evidence.captureOrigin,'physical-device');
  assert.equal(evidence.sourceClassification,'unclassified-runtime-capture');
  assert.equal(evidence.target.minimumSamples,300);
  assert.equal(evidence.target.sampleTargetMet,true);
  assert.equal(evidence.target.meetsFrameTarget,true);
  assert.equal(evidence.target.gate,'pass');
  assert.equal(evidence.provenance.validatorDoesNotProveDevicePossession,true);
  assert.equal(validatePhysicalEvidenceRecord(evidence),evidence);
});

test('insufficient samples stay review and slow physical measurements are retained as fail',()=>{
  const short=buildPhysicalPerformanceEvidence(capture({samples:120,frameP95Ms:28}),metadata());
  assert.equal(short.target.sampleTargetMet,false);
  assert.equal(short.target.gate,'review');
  const slow=buildPhysicalPerformanceEvidence(capture({samples:300,frameP95Ms:42}),metadata());
  assert.equal(slow.target.sampleTargetMet,true);
  assert.equal(slow.target.meetsFrameTarget,false);
  assert.equal(slow.target.gate,'fail');
});

test('missing physical attestation and synthetic relabeling fail closed',()=>{
  assert.throws(()=>buildPhysicalPerformanceEvidence(capture(),metadata({evidenceKind:null})),/evidenceKind=physical-device/);
  assert.throws(()=>buildPhysicalPerformanceEvidence(capture(),metadata({captureOrigin:'browser'})),/explicit physical-device kind and origin/);
  assert.throws(()=>buildPhysicalPerformanceEvidence(capture(),metadata({deviceClass:'synthetic-pixel-fold-class'})),/device class cannot be synthetic/);
  const synthetic={...capture(),preset:{id:'pixel-fold-class',deviceClass:'synthetic-pixel-fold-class'}};
  assert.equal(classifyCaptureSource(synthetic),'synthetic-browser');
  assert.throws(()=>buildPhysicalPerformanceEvidence(synthetic,metadata()),/cannot be promoted/);
  const persistedSynthetic={...capture(),sourceClassification:'synthetic-browser'};
  assert.throws(()=>buildPhysicalPerformanceEvidence(persistedSynthetic,metadata()),/cannot be promoted/);
});

test('stored target verdict is recomputed and tampering is rejected',()=>{
  const evidence=buildPhysicalPerformanceEvidence(capture({frameP95Ms:42}),metadata());
  const tampered={...evidence,target:{...evidence.target,gate:'pass',meetsFrameTarget:true}};
  assert.throws(()=>validatePhysicalEvidenceRecord(tampered),/target verdict was modified/);
});

test('physical comparisons allow build changes but guard hardware viewport and scene identity',()=>{
  const baseline=buildPhysicalPerformanceEvidence(capture(),metadata());
  const current=buildPhysicalPerformanceEvidence(capture({frameP95Ms:31}),metadata({buildRevision:'new-build',capturedAt:'2026-09-15T18:10:00+09:00'}));
  const compatible=validatePhysicalEvidenceCompatibility(baseline,current);
  assert.equal(compatible.comparable,true);
  assert.equal(compatible.mismatches.length,0);
  const otherDevice=buildPhysicalPerformanceEvidence(capture(),metadata({deviceModel:'Pixel 10 Pro Fold'}));
  assert.equal(validatePhysicalEvidenceCompatibility(baseline,otherDevice).comparable,false);
  const otherScene=buildPhysicalPerformanceEvidence(capture({signature:'different-scene'}),metadata());
  assert.equal(validatePhysicalEvidenceCompatibility(baseline,otherScene).comparable,false);
  assert.throws(()=>comparePhysicalPerformanceEvidence(baseline,otherScene),/not comparable/);
});

test('OS/runtime drift is surfaced as warning and actual physical regression is detected',()=>{
  const baseline=buildPhysicalPerformanceEvidence(capture({frameP95Ms:30}),metadata());
  const current=buildPhysicalPerformanceEvidence(capture({frameP95Ms:40}),metadata({buildRevision:'new-build',os:'Android 18',runtime:'Chrome 141',capturedAt:'2026-09-16T18:00:00+09:00'}));
  const compatibility=validatePhysicalEvidenceCompatibility(baseline,current);
  assert.equal(compatibility.comparable,true);
  assert.deepEqual(compatibility.warnings.map(row=>row.field),['device.os','device.runtime']);
  const comparison=comparePhysicalPerformanceEvidence(baseline,current);
  assert.equal(comparison.pass,false);
  assert.ok(comparison.regressions.some(row=>row.metric==='frame.p95Ms'));
});
