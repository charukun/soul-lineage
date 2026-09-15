import assert from 'node:assert/strict';
import test from 'node:test';
import { createPerformanceRecorder, comparePerformanceSnapshots } from '../packages/rendering/src/performance-lab.js';

test('performance recorder retains transparency pressure telemetry', () => {
  const recorder = createPerformanceRecorder({ label: 'test', maxSamples: 8 });
  recorder.sample({ frameMs: 16, drawCalls: 12, triangles: 1000, transparentDrawCalls: 3, transparentTriangleUpperBound: 220 });
  recorder.sample({ frameMs: 20, drawCalls: 13, triangles: 1100, transparentDrawCalls: 5, transparentTriangleUpperBound: 330 });
  const snapshot = recorder.snapshot();
  assert.equal(snapshot.transparency.drawCalls.average, 4);
  assert.equal(snapshot.transparency.drawCalls.p95, 5);
  assert.equal(snapshot.transparency.triangleUpperBound.average, 275);
  assert.equal(snapshot.transparency.triangleUpperBound.p95, 330);
});

test('transparency regressions are review warnings rather than false hard GPU failures', () => {
  const baseline = {
    frame: { p95Ms: 16, longFrames: 0 }, gpu: { p95Ms: 10 }, drawCalls: { p95: 20 }, triangles: { p95: 1000 }, textureBytes: { p95: 1000 },
    transparency: { drawCalls: { p95: 4 }, triangleUpperBound: { p95: 200 } },
  };
  const current = {
    frame: { p95Ms: 16, longFrames: 0 }, gpu: { p95Ms: 10 }, drawCalls: { p95: 20 }, triangles: { p95: 1000 }, textureBytes: { p95: 1000 },
    transparency: { drawCalls: { p95: 8 }, triangleUpperBound: { p95: 500 } },
  };
  const comparison = comparePerformanceSnapshots(baseline, current);
  assert.equal(comparison.pass, true);
  assert.equal(comparison.regressions.length, 0);
  assert.ok(comparison.warnings.some(row => row.metric === 'transparency.drawCalls.p95'));
  assert.ok(comparison.warnings.some(row => row.metric === 'transparency.triangleUpperBound.p95'));
});
