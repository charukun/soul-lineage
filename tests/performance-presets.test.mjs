import assert from 'node:assert/strict';
import test from 'node:test';
import { benchmarkVerdict, performancePreset, validateBenchmarkCompatibility } from '../scripts/performance-presets.mjs';

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

test('benchmark comparison rejects a different app, preset, viewport or scene signature', () => {
  const baseline={app:'village',preset:{id:'pixel-fold-class',deviceClass:'synthetic-pixel-fold-class'},viewport:{width:412,height:892},scene:{id:'village-runtime-v1',signature:'a20-o30-i4-r10-v200'}};
  assert.equal(validateBenchmarkCompatibility(baseline,structuredClone(baseline)).comparable,true);
  const changed=structuredClone(baseline);changed.scene.signature='a30-o30-i4-r10-v200';
  const result=validateBenchmarkCompatibility(baseline,changed);
  assert.equal(result.comparable,false);
  assert.ok(result.mismatches.some(row=>row.field==='scene.signature'));
  const legacy=validateBenchmarkCompatibility({performance:{}},{performance:{}});
  assert.equal(legacy.comparable,true);
});
