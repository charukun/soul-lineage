import test from 'node:test';
import assert from 'node:assert/strict';
import {REVIEW_EFFECT_CATALOG,REVIEW_EFFECT_COUNT} from '../src/review-effect-catalog.js';

test('visual review exposes at least 100 authored VFX motions',()=>{
  assert.equal(REVIEW_EFFECT_COUNT,REVIEW_EFFECT_CATALOG.length);
  assert.ok(REVIEW_EFFECT_COUNT>=100,`expected >=100 VFX presets, got ${REVIEW_EFFECT_COUNT}`);
  assert.equal(new Set(REVIEW_EFFECT_CATALOG.map(row=>row.id)).size,REVIEW_EFFECT_COUNT);
});

test('spectacle presets stay review-only compositions over pinned authored effects',()=>{
  const allowed=new Set(['slash','impact','finisher','arrow','blow','cure','water']);
  const spectacle=REVIEW_EFFECT_CATALOG.filter(row=>row.id.startsWith('spectacle-'));
  assert.ok(spectacle.length>=100);
  for(const row of spectacle){
    assert.equal(row.mode,'raw');
    assert.equal(row.kind,'composition');
    assert.ok(row.cues.length>=2);
    assert.ok(row.effects.every(effect=>allowed.has(effect)),row.id);
  }
});
