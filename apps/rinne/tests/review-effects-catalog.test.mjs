import test from 'node:test';
import assert from 'node:assert/strict';
import {EFFECT_ASSETS,REVIEW_AUTHORED_EFFECTS} from '../src/rebuild/authored-effect-manifest.js';
import {REVIEW_EFFECT_CATALOG,REVIEW_EFFECT_CATEGORIES,REVIEW_EFFECT_SCENARIOS,effectsForCategory,reviewEffectById,reviewScenarioById} from '../src/review-effects-catalog.js';

test('review catalog exposes a broad pinned authored selection',()=>{
  assert.equal(Object.keys(REVIEW_AUTHORED_EFFECTS).length,9);
  assert.equal(REVIEW_EFFECT_CATALOG.length,9);
  const pinned=new Set(EFFECT_ASSETS.map(row=>row.path));
  for(const row of REVIEW_EFFECT_CATALOG){
    assert.ok(REVIEW_AUTHORED_EFFECTS[row.effect],`missing definition for ${row.effect}`);
    assert.ok(pinned.has(row.source),`un-pinned review source ${row.source}`);
    assert.ok(row.label&&row.category&&row.use&&row.summary);
  }
  assert.ok(REVIEW_EFFECT_CATALOG.some(row=>row.id==='laser02'));
  assert.ok(REVIEW_EFFECT_CATALOG.some(row=>row.id==='fireworks'));
  assert.ok(REVIEW_EFFECT_CATALOG.some(row=>row.id==='toonWater'));
  assert.ok(REVIEW_EFFECT_CATALOG.some(row=>row.id==='hanmadoHit'));
});

test('review categories and combat-like preview scenarios remain navigable',()=>{
  assert.ok(REVIEW_EFFECT_CATEGORIES.length>=6);
  assert.deepEqual(REVIEW_EFFECT_SCENARIOS.map(row=>row.id),['forward','sweep','multi','incoming','kyu','finisher']);
  assert.equal(effectsForCategory('beam').length,3);
  assert.equal(effectsForCategory('all').length,REVIEW_EFFECT_CATALOG.length);
  assert.equal(reviewEffectById('missing').id,REVIEW_EFFECT_CATALOG[0].id);
  assert.equal(reviewScenarioById('missing').id,'forward');
});
