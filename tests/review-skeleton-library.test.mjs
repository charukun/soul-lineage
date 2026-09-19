import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  REVIEW_SKELETON_SOURCE,
  REVIEW_SKELETON_MODELS,
  REVIEW_SKELETON_EQUIPMENT,
  REVIEW_SKELETON_DOWNLOADS,
  reviewSkeletonEquipmentForSlot,
} from '../packages/assets/src/review-skeleton-library.js';

test('review skeleton library stays review-only and pinned', () => {
  assert.equal(REVIEW_SKELETON_SOURCE.commit, '15b62b9bad122f72926c10fb14d622c73819fa54');
  assert.equal(REVIEW_SKELETON_SOURCE.license, 'CC0-1.0');
  assert.equal(REVIEW_SKELETON_MODELS.length, 4);
  assert.equal(REVIEW_SKELETON_EQUIPMENT.length, 9);
  assert.equal(new Set(REVIEW_SKELETON_MODELS.map(row => row.id)).size, 4);
  assert.equal(new Set(REVIEW_SKELETON_EQUIPMENT.map(row => row.id)).size, 9);
  for (const model of REVIEW_SKELETON_MODELS) {
    assert.equal(model.kind, 'review-asset-model');
    assert.match(model.runtime.url, /^\.\/asset-review\/models\/kaykit-skeletons\/.+\.glb$/);
    assert.equal(model.source.commit, REVIEW_SKELETON_SOURCE.commit);
    assert.ok(model.source.byteLength > 0);
    assert.match(model.source.gitBlobSha, /^[0-9a-f]{40}$/);
    assert.equal('productionStage' in model, false);
    assert.equal('visualApproval' in model, false);
  }
  for (const item of REVIEW_SKELETON_EQUIPMENT) {
    assert.match(item.runtime.url, /^\.\/asset-review\/equipment\/.+\.gltf$/);
    assert.ok(item.slots.length > 0);
    assert.ok(item.slots.every(slot => ['main','off','back'].includes(slot)));
    assert.equal('inventory' in item, false);
    assert.equal('save' in item, false);
  }
});

test('review skeleton assets are complete and output paths are unique', () => {
  assert.equal(reviewSkeletonEquipmentForSlot('main').length, 4);
  assert.equal(reviewSkeletonEquipmentForSlot('off').length, 6);
  assert.equal(reviewSkeletonEquipmentForSlot('back').length, 9);
  assert.equal(new Set(REVIEW_SKELETON_DOWNLOADS.map(row => row.output)).size, REVIEW_SKELETON_DOWNLOADS.length);
  assert.equal(REVIEW_SKELETON_DOWNLOADS.filter(row => row.output.endsWith('.glb')).length, 4);
  assert.equal(REVIEW_SKELETON_DOWNLOADS.filter(row => row.output.endsWith('.gltf')).length, 9);
  assert.equal(REVIEW_SKELETON_DOWNLOADS.filter(row => row.output.endsWith('.bin')).length, 9);
  assert.ok(REVIEW_SKELETON_DOWNLOADS.some(row => row.output === 'equipment/skeleton_texture.png'));
  assert.ok(REVIEW_SKELETON_DOWNLOADS.some(row => row.output === 'licenses/KayKit-Skeletons-CC0.txt'));
  for (const row of REVIEW_SKELETON_DOWNLOADS) {
    assert.equal(row.commit, REVIEW_SKELETON_SOURCE.commit);
    assert.ok(row.size > 0);
    assert.match(row.gitBlob, /^[0-9a-f]{40}$/);
    assert.equal(row.output.startsWith('/'), false);
    assert.equal(row.output.includes('..'), false);
  }
});


test('RINNE Fast DEV does not materialize review assets during dev or build', async () => {
  const pkg = JSON.parse(await readFile(new URL('../apps/rinne/package.json', import.meta.url), 'utf8'));
  assert.doesNotMatch(pkg.scripts.predev, /prepare-review-assets\.mjs/);
  assert.doesNotMatch(pkg.scripts.prebuild, /prepare-review-assets\.mjs/);
  const prepare = await readFile(new URL('../scripts/prepare-review-assets.mjs', import.meta.url), 'utf8');
  const verify = await readFile(new URL('../scripts/verify-build.mjs', import.meta.url), 'utf8');
  assert.match(prepare, /prepareReviewAssets/);
  assert.doesNotMatch(verify, /RINNE review models are missing|asset-review\/manifest\.json/);
});
