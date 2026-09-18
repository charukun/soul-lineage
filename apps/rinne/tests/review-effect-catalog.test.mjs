import test from 'node:test';
import assert from 'node:assert/strict';
import {REVIEW_EFFECT_CATALOG} from '../src/review-effect-catalog.js';

test('review catalog never counts generated scale or placement variants as distinct VFX',()=>{
  assert.equal(new Set(REVIEW_EFFECT_CATALOG.map(row=>row.id)).size,REVIEW_EFFECT_CATALOG.length);
  assert.equal(REVIEW_EFFECT_CATALOG.some(row=>row.id.startsWith('spectacle-')),false);
});
