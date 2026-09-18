import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTHORED_EFFECTS,
  EFFECT_ASSETS,
  REVIEW_AUTHORED_EFFECTS,
  REVIEW_EFFECT_SOURCE,
} from '../src/rebuild/authored-effect-manifest.js';
import {REVIEW_EFFECT_CATALOG} from '../src/review-effect-catalog.js';
import {REVIEW_PRELOAD_GROUPS} from '../src/review-preloader.js';
import {EFFECT_DOWNLOADS} from '../scripts/prepare-effects.mjs';

test('production VFX stays bounded while review gets a larger authored library', () => {
  assert.deepEqual(Object.keys(AUTHORED_EFFECTS), ['slash', 'impact', 'finisher']);
  assert.deepEqual(Object.keys(REVIEW_AUTHORED_EFFECTS), ['slash', 'impact', 'finisher', 'arrow', 'blow', 'cure', 'water']);
  assert.ok(REVIEW_EFFECT_CATALOG.length >= 16);
  assert.equal(new Set(REVIEW_EFFECT_CATALOG.map(row => row.id)).size, REVIEW_EFFECT_CATALOG.length);
  for (const row of REVIEW_EFFECT_CATALOG) {
    for (const effect of row.effects) assert.ok(REVIEW_AUTHORED_EFFECTS[effect], `unknown review effect: ${effect}`);
  }
});

test('review originals are pinned to the compatible Effekseer WebGL source', () => {
  const reviewAssets = EFFECT_ASSETS.filter(row => row.reviewOnly);
  assert.ok(reviewAssets.length >= 31);
  assert.equal(REVIEW_EFFECT_SOURCE.repository, 'effekseer/EffekseerForWebGL');
  assert.match(REVIEW_EFFECT_SOURCE.revision, /^[a-f\d]{40}$/);
  for (const row of reviewAssets) {
    assert.equal(row.repository, REVIEW_EFFECT_SOURCE.repository);
    assert.equal(row.revision, REVIEW_EFFECT_SOURCE.revision);
    assert.equal(row.license, 'MIT');
    assert.match(row.gitBlobSha, /^[a-f\d]{40}$/);
    assert.ok(Number.isInteger(row.byteLength) && row.byteLength > 0);
  }
  for (const name of ['Arrow1.efkefc', 'Blow1.efkefc', 'Cure1.efkefc', 'ToonWater.efkefc']) {
    const row = reviewAssets.find(item => item.path.endsWith(`/${name}`));
    assert.equal(row?.infoVersion, 1500);
  }
});

test('download plan preserves per-source provenance and does not warm the full review library at launcher', () => {
  const arrow = EFFECT_DOWNLOADS.find(row => row.target.endsWith('/Arrow1.efkefc'));
  assert.equal(arrow?.repository, REVIEW_EFFECT_SOURCE.repository);
  assert.equal(arrow?.revision, REVIEW_EFFECT_SOURCE.revision);
  const warm = REVIEW_PRELOAD_GROUPS.effects.assets;
  assert.ok(warm.some(path => path.endsWith('/effekseer.wasm')));
  assert.ok(warm.length <= 4);
  assert.ok(!warm.some(path => /Arrow1|Blow1|Cure1|ToonWater/.test(path)));
});

test('catalog distinguishes upstream originals from review compositions', () => {
  const originals = REVIEW_EFFECT_CATALOG.filter(row => row.kind === 'original');
  const compositions = REVIEW_EFFECT_CATALOG.filter(row => row.kind === 'composition');
  assert.equal(originals.length, 7);
  assert.ok(compositions.length >= 5);
  assert.ok(originals.every(row => row.cues.length === 1));
});
