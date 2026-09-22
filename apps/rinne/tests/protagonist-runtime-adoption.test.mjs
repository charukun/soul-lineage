import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  RINNE_PROTAGONIST_BYTES,
  RINNE_PROTAGONIST_MODEL_ID,
  RINNE_PROTAGONIST_RUNTIME_ASSET,
  RINNE_PROTAGONIST_SHA256
} from '../src/rebuild/protagonist-runtime-asset.js';
import { verifyProtagonistRuntimeBytes } from '../src/rebuild/protagonist-character-pool.js';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..');
const modelPath = join(app, 'public/simulator/assets/PROTAGONIST_VILLAGER_V1.glb');
const integrityPath = join(app, 'public/simulator/assets/PROTAGONIST_VILLAGER_V1.asset.json');

function glbDocument(buffer) {
  assert.equal(buffer.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset), type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = buffer.subarray(offset, offset + length);
    offset += length;
    if (type === 0x4e4f534a) return JSON.parse(chunk.toString('utf8').replace(/[\0\s]+$/u, ''));
  }
  throw new Error('GLB JSON chunk missing');
}

test('adopted protagonist bytes exactly match the committed integrity receipt', async () => {
  const bytes = readFileSync(modelPath);
  const sidecar = JSON.parse(readFileSync(integrityPath, 'utf8'));
  assert.equal(bytes.length, RINNE_PROTAGONIST_BYTES);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), RINNE_PROTAGONIST_SHA256);
  assert.equal(sidecar.id, RINNE_PROTAGONIST_MODEL_ID);
  assert.equal(sidecar.sha256, RINNE_PROTAGONIST_SHA256);
  assert.equal(sidecar.bytes, RINNE_PROTAGONIST_BYTES);
  assert.equal(sidecar.humanoidRig, RINNE_PROTAGONIST_RUNTIME_ASSET.integrityRigId);
  assert.equal(sidecar.visualApproval, 'pending');
  assert.equal(sidecar.productionStage, 'PRIMARY');
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  assert.deepEqual(await verifyProtagonistRuntimeBytes(arrayBuffer), { sha256: RINNE_PROTAGONIST_SHA256, bytes: RINNE_PROTAGONIST_BYTES });
});

test('adopted protagonist GLB identifies the clean KayKit CC0 DCC lineage', () => {
  const document = glbDocument(readFileSync(modelPath));
  const metadata = document.asset?.extras?.rinneCharacter;
  assert.equal(metadata?.id, RINNE_PROTAGONIST_MODEL_ID);
  assert.equal(metadata?.modelingMode, 'dcc-blender');
  assert.equal(metadata?.sourceFamily, 'kaykit.adventurers.v1');
  assert.equal(metadata?.sourceModel, 'Knight.glb');
  assert.equal(metadata?.sourceGitBlobSha, '717b56ca2b5ff5392679774725201ba03a3eefab');
  assert.equal(metadata?.license, 'CC0-1.0');
  assert.equal(document.extensions?.VRMC_vrm?.specVersion, '1.0');
});

test('playable protagonist adoption is fail-closed and does not add a legacy fallback', () => {
  const pool = readFileSync(join(app, 'src/rebuild/protagonist-character-pool.js'), 'utf8');
  const stage = readFileSync(join(app, 'src/rebuild/runtime-character-stage-base.js'), 'utf8');
  assert.match(pool, /byte length mismatch/);
  assert.match(pool, /SHA-256 mismatch/);
  assert.match(pool, /metadata does not match the adopted CC0 model/);
  assert.doesNotMatch(pool, /SHINO_review|Sendagaya|fallbackModelId/);
  assert.match(stage, /createProtagonistCharacterPool/);
  assert.match(stage, /heroPool:protagonist\.pool/);
  assert.match(stage, /createCoopActors\(\{pool:runtime\.peerPool,/);
  assert.match(stage, /motherPool:runtime\.motherPool,/);
});
