import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
const modelPath = join(app, 'public/simulator/assets/kaykit/Knight.glb');

function gitBlobSha(buffer) {
  return createHash('sha1').update(Buffer.from(`blob ${buffer.length}\0`)).update(buffer).digest('hex');
}

test('playable protagonist bytes are the exact repository-local Knight used by motion review', async () => {
  const bytes = readFileSync(modelPath);
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
  assert.equal(bytes.length, RINNE_PROTAGONIST_BYTES);
  assert.equal(gitBlobSha(bytes), RINNE_PROTAGONIST_GIT_BLOB_SHA);
  assert.equal(RINNE_PROTAGONIST_GIT_BLOB_SHA, '717b56ca2b5ff5392679774725201ba03a3eefab');
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  assert.deepEqual(await verifyProtagonistRuntimeBytes(arrayBuffer), { gitBlobSha: RINNE_PROTAGONIST_GIT_BLOB_SHA, bytes: RINNE_PROTAGONIST_BYTES });
});

test('motion review and gameplay protagonist resolve the same first pinned Knight model', () => {
  const review = readFileSync(join(app, 'src/review-motion.js'), 'utf8');
  assert.match(review, /const REVIEW_MODELS=KAYKIT_MODELS/);
  assert.match(review, /let selectedModel=REVIEW_MODELS\[0\]/);
  assert.equal(KAYKIT_MODELS[0].id, RINNE_PROTAGONIST_MODEL_ID);
  assert.equal(KAYKIT_MODELS[0].source.gitBlobSha, RINNE_PROTAGONIST_GIT_BLOB_SHA);
});

test('playable Knight adoption is fail-closed and keeps gameplay-owned equipment', () => {
  const pool = readFileSync(join(app, 'src/rebuild/protagonist-character-pool.js'), 'utf8');
  const stage = readFileSync(join(app, 'src/rebuild/runtime-character-stage-base.js'), 'utf8');
  assert.match(pool, /byte length mismatch/);
  assert.match(pool, /Git blob SHA-1 mismatch/);
  assert.match(pool, /hideEmbeddedCombatProps/);
  assert.match(pool, /kaykit\/\)/);
  assert.doesNotMatch(pool, /PROTAGONIST_VILLAGER_V1|SHINO_review|Sendagaya|fallbackModelId/);
  assert.match(stage, /createProtagonistCharacterPool/);
  assert.match(stage, /heroPool:protagonist\.pool/);
  assert.match(stage, /createEquipmentController\(\{heroActor:roster\.heroActor/);
  assert.match(stage, /createCoopActors\(\{pool:runtime\.peerPool,/);
  assert.match(stage, /motherPool:runtime\.motherPool,/);
});
