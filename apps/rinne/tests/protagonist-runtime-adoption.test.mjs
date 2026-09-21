import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { KAYKIT_MODELS, KAYKIT_MODEL_BY_KEY } from '@soul/characters';
import {
  RINNE_PROTAGONIST_BYTES,
  RINNE_PROTAGONIST_GIT_BLOB_SHA,
  RINNE_PROTAGONIST_MODEL_ID,
  RINNE_PROTAGONIST_RUNTIME_ASSET
} from '../src/rebuild/protagonist-runtime-asset.js';
import { verifyProtagonistRuntimeBytes } from '../src/rebuild/protagonist-character-pool.js';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..');

test('playable protagonist descriptor is the exact pinned Knight used by motion review', () => {
  const knight = KAYKIT_MODEL_BY_KEY.knight;
  assert.equal(KAYKIT_MODELS[0], knight);
  assert.equal(RINNE_PROTAGONIST_MODEL_ID, knight.id);
  assert.equal(RINNE_PROTAGONIST_RUNTIME_ASSET.url, knight.runtime.url);
  assert.equal(RINNE_PROTAGONIST_RUNTIME_ASSET.source, knight.source);
  assert.equal(RINNE_PROTAGONIST_RUNTIME_ASSET.license, 'CC0-1.0');
  assert.equal(RINNE_PROTAGONIST_RUNTIME_ASSET.rigId, 'Rig_Medium');
  assert.equal(RINNE_PROTAGONIST_RUNTIME_ASSET.productionStage, 'REFERENCE');
  assert.equal(RINNE_PROTAGONIST_RUNTIME_ASSET.modelingMode, 'imported-reviewed');
  assert.equal(RINNE_PROTAGONIST_RUNTIME_ASSET.productionReady, false);
  assert.equal(RINNE_PROTAGONIST_RUNTIME_ASSET.visualApproval, 'pending');
  assert.equal(RINNE_PROTAGONIST_BYTES, knight.source.byteLength);
  assert.equal(RINNE_PROTAGONIST_GIT_BLOB_SHA, knight.source.gitBlobSha);
  assert.equal(RINNE_PROTAGONIST_GIT_BLOB_SHA, '717b56ca2b5ff5392679774725201ba03a3eefab');
  assert.equal(knight.runtime.localPath, 'apps/rinne/public/simulator/assets/kaykit/Knight.glb');
});

test('Knight byte verifier fails closed before accepting unknown materialized bytes', async () => {
  await assert.rejects(
    () => verifyProtagonistRuntimeBytes(new ArrayBuffer(1)),
    /byte length mismatch/
  );
  await assert.rejects(
    () => verifyProtagonistRuntimeBytes(new ArrayBuffer(RINNE_PROTAGONIST_BYTES)),
    /Git blob SHA-1 mismatch/
  );
});

test('motion review and gameplay protagonist resolve the same first pinned Knight model', () => {
  const review = readFileSync(join(app, 'src/review-motion.js'), 'utf8');
  const packageJson = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'));
  assert.match(review, /const REVIEW_MODELS=KAYKIT_MODELS/);
  assert.match(review, /let selectedModel=REVIEW_MODELS\[0\]/);
  assert.equal(KAYKIT_MODELS[0].id, RINNE_PROTAGONIST_MODEL_ID);
  assert.equal(KAYKIT_MODELS[0].source.gitBlobSha, RINNE_PROTAGONIST_GIT_BLOB_SHA);
  assert.match(packageJson.scripts.prebuild, /prepare-kaykit-foundation\.mjs/);
});

test('playable Knight adoption is fail-closed and keeps gameplay-owned equipment', () => {
  const pool = readFileSync(join(app, 'src/rebuild/protagonist-character-pool.js'), 'utf8');
  const stage = readFileSync(join(app, 'src/rebuild/runtime-character-stage-base.js'), 'utf8');
  assert.match(pool, /byte length mismatch/);
  assert.match(pool, /Git blob SHA-1 mismatch/);
  assert.match(pool, /hideEmbeddedCombatProps/);
  assert.match(pool, /simulator\/assets\/kaykit\//);
  assert.doesNotMatch(pool, /PROTAGONIST_VILLAGER_V1|SHINO_review|Sendagaya|fallbackModelId/);
  assert.match(stage, /createProtagonistCharacterPool/);
  assert.match(stage, /heroPool:protagonist\.pool/);
  assert.match(stage, /createEquipmentController\(\{heroActor:roster\.heroActor/);
  assert.match(stage, /createCoopActors\(\{pool:runtime\.peerPool,/);
  assert.match(stage, /motherPool:runtime\.motherPool,/);
});
