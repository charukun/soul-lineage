import assert from 'node:assert/strict';
import test from 'node:test';
import { benchmarkVerdict, performancePreset } from '../scripts/performance-presets.mjs';

test('Pixel Fold-class preset is deterministic and explicit about synthetic evidence', () => {
  const preset=performancePreset('pixel-fold-class');
  assert.equal(preset.targetFps,30);
  assert.equal(preset.targetFrameMs,33.34);
  assert.equal(preset.minSamples,300);
  assert.equal(preset.deviceClass,'synthetic-pixel-fold-class');
  assert.ok(preset.notes.includes('Real Pixel Fold evidence'));
  assert.throws(()=>performancePreset('unknown'),/Unknown performance preset/);
});

test('benchmark verdict reports target without pretending missing GPU data exists', () => {
  const preset=performancePreset('pixel-fold-class');
  const pass=benchmarkVerdict({performance:{frame:{p95Ms:30},gpu:{p95Ms:null}}},preset);
  assert.equal(pass.meetsFrameTarget,true);
  assert.equal(pass.gpuP95Ms,null);
  const fail=benchmarkVerdict({performance:{frame:{p95Ms:40},gpu:{p95Ms:20}}},preset);
  assert.equal(fail.meetsFrameTarget,false);
  assert.equal(fail.gpuP95Ms,20);
});
