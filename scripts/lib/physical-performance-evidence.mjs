import { comparePerformanceSnapshots } from '@soul/rendering/performance-lab';
import { benchmarkVerdict, performancePreset } from '../performance-presets.mjs';

export const PHYSICAL_PERFORMANCE_EVIDENCE_VERSION = 1;
export const PHYSICAL_EVIDENCE_KIND = 'physical-device';
export const PHYSICAL_CAPTURE_ORIGIN = 'physical-device';
const SUPPORTED_APPS = new Set(['rinne', 'village', 'demon']);
const targetPreset = performancePreset('pixel-fold-class');

const finitePositive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const copy = value => JSON.parse(JSON.stringify(value));

function requiredString(value, label) {
  if (!nonEmpty(value)) throw new Error(`Physical performance evidence requires ${label}`);
  return value.trim();
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`Physical performance evidence requires positive integer ${label}`);
  return number;
}

function isoTimestamp(value) {
  const text = requiredString(value, 'capturedAt');
  const time = Date.parse(text);
  if (!Number.isFinite(time)) throw new Error('Physical performance evidence capturedAt must be an ISO-compatible timestamp');
  return new Date(time).toISOString();
}

export function classifyCaptureSource(capture) {
  if (!plain(capture)) return 'unknown';
  const syntheticSignals = [
    capture.evidenceKind,
    capture.captureOrigin,
    capture.preset?.deviceClass,
    capture.preset?.id,
    capture.device?.deviceClass,
  ].filter(nonEmpty).map(value => value.toLowerCase());
  if (syntheticSignals.some(value => value.startsWith('synthetic-') || value.includes('synthetic') || value === 'pixel-fold-class')) return 'synthetic-browser';
  if (capture.evidenceKind === PHYSICAL_EVIDENCE_KIND || capture.captureOrigin === PHYSICAL_CAPTURE_ORIGIN) return 'physical-device';
  return 'unclassified-runtime-capture';
}

function ensureCaptureNotSynthetic(capture) {
  const classification = classifyCaptureSource(capture);
  if (classification === 'synthetic-browser') throw new Error('Synthetic/browser capture cannot be promoted to physical-device evidence');
  return classification;
}

function requirePhysicalAttestation(capture, metadata) {
  const evidenceKind = requiredString(metadata.evidenceKind ?? capture?.evidenceKind, 'evidenceKind=physical-device');
  const captureOrigin = requiredString(metadata.captureOrigin ?? capture?.captureOrigin, 'captureOrigin=physical-device');
  if (evidenceKind !== PHYSICAL_EVIDENCE_KIND || captureOrigin !== PHYSICAL_CAPTURE_ORIGIN) throw new Error('Physical performance evidence requires explicit physical-device kind and origin');
  return { evidenceKind, captureOrigin };
}

function snapshotFromCapture(capture) {
  const performance = capture?.performance;
  const scene = capture?.scene;
  if (!plain(performance)) throw new Error('Physical performance evidence requires a Performance Lab snapshot');
  if (!plain(scene)) throw new Error('Physical performance evidence requires benchmark scene id/signature');
  const samples = positiveInteger(performance.samples, 'performance.samples');
  if (!finitePositive(performance?.frame?.p95Ms)) throw new Error('Physical performance evidence requires performance.frame.p95Ms');
  return { performance, scene, samples };
}

export function buildPhysicalPerformanceEvidence(capture, metadata = {}) {
  const sourceClassification = ensureCaptureNotSynthetic(capture);
  const attestation = requirePhysicalAttestation(capture, metadata);
  const snapshot = snapshotFromCapture(capture);
  const app = requiredString(metadata.app ?? capture.app, 'app');
  if (!SUPPORTED_APPS.has(app)) throw new Error(`Unsupported app for physical performance evidence: ${app}`);
  const buildRevision = requiredString(metadata.buildRevision ?? capture.build?.revision ?? capture.buildRevision, 'build revision');
  const deviceModel = requiredString(metadata.deviceModel ?? capture.device?.model, 'device model');
  const deviceClass = requiredString(metadata.deviceClass ?? capture.device?.deviceClass, 'device class');
  const os = requiredString(metadata.os ?? capture.device?.os, 'device OS');
  const runtime = requiredString(metadata.runtime ?? capture.device?.runtime, 'browser/runtime');
  const capturedAt = isoTimestamp(metadata.capturedAt ?? capture.capturedAt);
  const viewport = {
    width: positiveInteger(metadata.viewportWidth ?? capture.viewport?.width, 'viewport width'),
    height: positiveInteger(metadata.viewportHeight ?? capture.viewport?.height, 'viewport height'),
  };
  const scene = {
    id: requiredString(snapshot.scene.id, 'scene.id'),
    signature: requiredString(snapshot.scene.signature, 'scene.signature'),
  };
  const target = benchmarkVerdict({ performance: snapshot.performance }, targetPreset);
  const sampleTargetMet = snapshot.samples >= targetPreset.minSamples;
  const performanceGate = !sampleTargetMet ? 'review' : target.meetsFrameTarget === true ? 'pass' : 'fail';
  return Object.freeze({
    schema: 'soul-physical-performance-evidence',
    version: PHYSICAL_PERFORMANCE_EVIDENCE_VERSION,
    evidenceKind: attestation.evidenceKind,
    captureOrigin: attestation.captureOrigin,
    sourceClassification,
    app,
    build: { revision: buildRevision },
    device: { model: deviceModel, deviceClass, os, runtime },
    viewport,
    capturedAt,
    scene,
    performance: copy(snapshot.performance),
    target: {
      class: 'mobile-30fps',
      fps: targetPreset.targetFps,
      frameMs: targetPreset.targetFrameMs,
      minimumSamples: targetPreset.minSamples,
      sampleTargetMet,
      frameP95Ms: target.frameP95Ms,
      gpuP95Ms: target.gpuP95Ms,
      meetsFrameTarget: target.meetsFrameTarget,
      gate: performanceGate,
    },
    provenance: {
      explicitPhysicalOrigin: true,
      captureAttestation: 'caller-supplied',
      validatorDoesNotProveDevicePossession: true,
      syntheticPromotionRejected: true,
    },
  });
}

export function validatePhysicalEvidenceRecord(record) {
  if (!plain(record) || record.schema !== 'soul-physical-performance-evidence' || record.version !== PHYSICAL_PERFORMANCE_EVIDENCE_VERSION) throw new Error('Unsupported physical performance evidence record');
  if (record.evidenceKind !== PHYSICAL_EVIDENCE_KIND || record.captureOrigin !== PHYSICAL_CAPTURE_ORIGIN) throw new Error('Physical performance evidence kind/origin is invalid');
  if (record.sourceClassification === 'synthetic-browser') throw new Error('Synthetic/browser capture cannot be physical evidence');
  snapshotFromCapture(record);
  const app = requiredString(record.app, 'app');
  if (!SUPPORTED_APPS.has(app)) throw new Error(`Unsupported app for physical performance evidence: ${app}`);
  requiredString(record.build?.revision, 'build revision');
  requiredString(record.device?.model, 'device model');
  requiredString(record.device?.deviceClass, 'device class');
  requiredString(record.device?.os, 'device OS');
  requiredString(record.device?.runtime, 'browser/runtime');
  positiveInteger(record.viewport?.width, 'viewport width');
  positiveInteger(record.viewport?.height, 'viewport height');
  isoTimestamp(record.capturedAt);
  return record;
}

export function validatePhysicalEvidenceCompatibility(baseline, current) {
  validatePhysicalEvidenceRecord(baseline);
  validatePhysicalEvidenceRecord(current);
  const mismatches = [], warnings = [];
  const compare = (field, before, after, target = mismatches) => { if (before !== after) target.push({ field, baseline: before ?? null, current: after ?? null }); };
  compare('app', baseline.app, current.app);
  compare('device.deviceClass', baseline.device.deviceClass, current.device.deviceClass);
  compare('device.model', baseline.device.model, current.device.model);
  compare('viewport.width', baseline.viewport.width, current.viewport.width);
  compare('viewport.height', baseline.viewport.height, current.viewport.height);
  compare('scene.id', baseline.scene.id, current.scene.id);
  compare('scene.signature', baseline.scene.signature, current.scene.signature);
  compare('device.os', baseline.device.os, current.device.os, warnings);
  compare('device.runtime', baseline.device.runtime, current.device.runtime, warnings);
  return Object.freeze({ comparable: mismatches.length === 0, mismatches, warnings });
}

export function comparePhysicalPerformanceEvidence(baseline, current, thresholds = {}) {
  const compatibility = validatePhysicalEvidenceCompatibility(baseline, current);
  if (!compatibility.comparable) throw new Error(`Physical performance evidence is not comparable: ${compatibility.mismatches.map(row => `${row.field} ${JSON.stringify(row.baseline)} != ${JSON.stringify(row.current)}`).join('; ')}`);
  const regression = comparePerformanceSnapshots(baseline.performance, current.performance, thresholds);
  return Object.freeze({ compatibility, ...regression });
}
