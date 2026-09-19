import test from 'node:test';
import assert from 'node:assert/strict';
import {REVIEW_EFFECT_CATALOG,REVIEW_REAL_EFFECT_COUNT} from '../src/review-effect-catalog.js';
import {REVIEW_VFX_LIBRARY_ASSETS,REVIEW_VFX_LIBRARY_EFFECTS,REVIEW_VFX_LIBRARY_COUNT} from '../src/rebuild/review-vfx-library-manifest.js';

test('review catalog counts only distinct upstream VFX files as the real library',()=>{
  assert.equal(REVIEW_REAL_EFFECT_COUNT,REVIEW_VFX_LIBRARY_COUNT);
  assert.equal(REVIEW_VFX_LIBRARY_EFFECTS.length,REVIEW_VFX_LIBRARY_COUNT);
  assert.ok(REVIEW_REAL_EFFECT_COUNT>=100);
  const effectAssets=REVIEW_VFX_LIBRARY_ASSETS.filter(row=>row.reviewLibrary);
  assert.equal(effectAssets.length,REVIEW_REAL_EFFECT_COUNT);
  assert.equal(new Set(effectAssets.map(row=>row.sourcePath)).size,REVIEW_REAL_EFFECT_COUNT);
  assert.equal(new Set(effectAssets.map(row=>row.gitBlobSha)).size,REVIEW_REAL_EFFECT_COUNT);
});

test('each real library card maps one-to-one to one source effect, never a generated size variant',()=>{
  const real=REVIEW_EFFECT_CATALOG.filter(row=>row.realSource);
  assert.equal(real.length,REVIEW_REAL_EFFECT_COUNT);
  assert.equal(new Set(real.map(row=>row.sourcePath)).size,REVIEW_REAL_EFFECT_COUNT);
  assert.ok(real.every(row=>row.kind==='original'&&row.mode==='raw'&&row.effects.length===1&&row.cues.length===1));
  assert.equal(REVIEW_EFFECT_CATALOG.some(row=>row.id.startsWith('spectacle-')),false);
  assert.equal(new Set(REVIEW_EFFECT_CATALOG.map(row=>row.id)).size,REVIEW_EFFECT_CATALOG.length);
});
