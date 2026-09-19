import test from 'node:test';
import assert from 'node:assert/strict';
import {REVIEW_EFFECT_CATALOG,REVIEW_REAL_EFFECT_COUNT} from '../src/review-effect-catalog.js';
import {REVIEW_REFERENCE_MODEL_HEIGHT,reviewModelScale} from '../src/review-vfx-model-scale.js';

test('real VFX use one model-relative review scale without changing source count',()=>{
  const real=REVIEW_EFFECT_CATALOG.filter(row=>row.realSource);
  assert.equal(real.length,REVIEW_REAL_EFFECT_COUNT);
  assert.equal(new Set(real.map(row=>row.sourcePath)).size,REVIEW_REAL_EFFECT_COUNT);
  for(const row of real){
    const scale=reviewModelScale(row,REVIEW_REFERENCE_MODEL_HEIGHT);
    assert.ok(Number.isFinite(scale)&&scale>=.28&&scale<=1.45,`${row.id}: ${scale}`);
  }
});

test('review scale follows measured model height and never creates another effect identity',()=>{
  const attack=REVIEW_EFFECT_CATALOG.find(row=>row.realSource&&row.category==='attack');
  assert.ok(attack);
  const small=reviewModelScale(attack,REVIEW_REFERENCE_MODEL_HEIGHT*.75);
  const normal=reviewModelScale(attack,REVIEW_REFERENCE_MODEL_HEIGHT);
  assert.ok(small<normal);
  assert.equal(reviewModelScale({...attack,realSource:false},REVIEW_REFERENCE_MODEL_HEIGHT),1);
  assert.equal(attack.effects.length,1);
});
