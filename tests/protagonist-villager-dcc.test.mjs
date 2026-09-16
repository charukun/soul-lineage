import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  CHARACTER_REFERENCE_MODELS,
  PROTAGONIST_VILLAGER_MODEL_ID,
  createCharacterModelBuildRequest,
  auditCharacterRuntimeDocument
} from '../packages/characters/src/index.js';

function glbDocument(buffer) {
  assert.equal(buffer.subarray(0, 4).toString('ascii'), 'glTF');
  const total = buffer.readUInt32LE(8);
  assert.equal(total, buffer.length);
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = buffer.subarray(offset, offset + length);
    offset += length;
    if (type === 0x4e4f534a) return JSON.parse(chunk.toString('utf8').replace(/[\0\s]+$/u, ''));
  }
  throw new Error('GLB JSON chunk missing');
}

test('protagonist village-start DCC is a dedicated humble hero candidate', () => {
  const model = CHARACTER_REFERENCE_MODELS[PROTAGONIST_VILLAGER_MODEL_ID];
  assert.ok(model);
  assert.equal(model.kind, 'dcc-character-model');
  assert.equal(model.role, 'resident');
  assert.equal(model.gear, 'belt');
  assert.equal(model.productionStage, 'PRIMARY');
  assert.equal(model.productionReady, false);
  assert.equal(model.assetPath, './simulator/assets/PROTAGONIST_VILLAGER_V1.glb');
  assert.equal(model.integrityPath, './simulator/assets/PROTAGONIST_VILLAGER_V1.asset.json');
  assert.equal(model.referenceStyle.design, 'protagonist-villager');
  assert.equal(model.referenceStyle.prop, 'none');
  assert.ok(model.proportions.head > 1.1);
  assert.ok(model.referenceStyle.palette.primary.every(Number.isFinite));

  const request = createCharacterModelBuildRequest(PROTAGONIST_VILLAGER_MODEL_ID, { requestedBy: 'character-workshop' });
  assert.equal(request.reference.id, PROTAGONIST_VILLAGER_MODEL_ID);
  assert.equal(request.target.primaryFormat, 'glb');
  assert.deepEqual(request.target.formats, ['glb']);
  assert.equal(request.handoff.fallbackPolicy, 'retain-current-master-until-candidate-accepted');
});

test('generated protagonist GLB carries the exact audited humanoid runtime contract', () => {
  const modelPath = 'apps/rinne/public/simulator/assets/PROTAGONIST_VILLAGER_V1.glb';
  const integrityPath = 'apps/rinne/public/simulator/assets/PROTAGONIST_VILLAGER_V1.asset.json';
  const bytes = readFileSync(modelPath);
  const integrity = JSON.parse(readFileSync(integrityPath, 'utf8'));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const document = glbDocument(bytes);
  const audit = auditCharacterRuntimeDocument(document, sha256, bytes.length, integrity);
  assert.equal(audit.approved, true, audit.errors.join(', '));
  assert.equal(document.asset.extras.rinneCharacter.id, 'protagonist.villager.v1');
  assert.equal(document.extensions.VRMC_vrm.specVersion, '1.0');
  assert.equal(integrity.visualApproval, 'pending');
});

test('motion review URL can preselect the protagonist without making it the released gameplay default', () => {
  const source = readFileSync('apps/rinne/src/motion-review-entrypoint.js', 'utf8');
  assert.match(source, /characterModel/);
  assert.match(source, /workspace\?\.selectModel\(requestedModel\)/);
  assert.match(source, /30秒演舞/);
});
