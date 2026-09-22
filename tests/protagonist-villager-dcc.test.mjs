import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import {
  CHARACTER_REFERENCE_MODELS,
  PROTAGONIST_VILLAGER_MODEL_ID,
  PROTAGONIST_VILLAGER_FEMALE_MODEL_ID,
  evaluateCharacterLicensePolicy
} from '../packages/characters/src/index.js';

test('protagonist village DCC runtime output is the clean CC0 KayKit derivative', () => {
  const model = CHARACTER_REFERENCE_MODELS[PROTAGONIST_VILLAGER_MODEL_ID];
  assert.equal(model.id, PROTAGONIST_VILLAGER_MODEL_ID);
  assert.equal(model.productionStage, 'PRIMARY');
  assert.equal(model.modelingMode, 'dcc-blender');
  assert.equal(model.productionReady, false);
  assert.equal(model.production.target.rigId, 'Rig_Medium');
  assert.equal(model.referenceStyle.design, 'protagonist-kaykit-knight-derivative');

  const integrity = JSON.parse(readFileSync('apps/rinne/public/simulator/assets/PROTAGONIST_VILLAGER_V1.asset.json', 'utf8'));
  const license = evaluateCharacterLicensePolicy({
    id: PROTAGONIST_VILLAGER_MODEL_ID,
    license: 'CC0-1.0',
    rigId: integrity.humanoidRig,
    rigProvenance: integrity.license.rigProvenance
  });
  assert.equal(license.status, 'allowed');
  assert.equal(license.allowed, true);

  const production = JSON.parse(readFileSync('packages/characters/production/protagonist-villager-v1.production.json', 'utf8'));
  assert.equal(production.stage, 'PRIMARY');
  assert.equal(production.status.productionReady, false);
  assert.equal(production.status.visualApproval, 'pending');
  assert.doesNotMatch(JSON.stringify(production), /blocked-rerig|humanoid\.shino-vrm1\.v2|Sendagaya_Shino/);
});

test('adopted protagonist runtime bytes and DCC evidence are repository-local', () => {
  const glbPath = 'apps/rinne/public/simulator/assets/PROTAGONIST_VILLAGER_V1.glb';
  const receiptPath = 'apps/rinne/public/simulator/assets/PROTAGONIST_VILLAGER_V1.asset.json';
  assert.equal(existsSync('assets/characters/protagonist/villager-v1/source/ProtagonistVillagerV1.blend'), true);
  assert.equal(existsSync(glbPath), true);
  assert.equal(existsSync(receiptPath), true);
  for (const view of ['front', 'three-quarter', 'side', 'back']) {
    assert.equal(existsSync(`docs/characters/qa/protagonist-villager-v1/${view}.png`), true);
  }
  const bytes = readFileSync(glbPath);
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  assert.equal(bytes.length, receipt.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256);
  assert.equal(receipt.sha256, 'ab3e2e71b768843a756abaa79f47859d1cd3c77a45b0c8b7a582f8d0b158fab6');
  assert.equal(receipt.humanoidRig, 'kaykit.Rig_Medium.v1');
});

test('motion review defaults to the current game protagonist while retaining explicit model selection', () => {
  const source = readFileSync('apps/rinne/src/review-motion.js', 'utf8');
  const models = readFileSync('apps/rinne/src/review-motion-models.js', 'utf8');
  assert.match(source, /RINNE_MOTION_REVIEW_MODELS/);
  assert.match(source, /selectedModel=RINNE_MOTION_REVIEW_DEFAULT_MODEL/);
  assert.match(source, /dataset\.motionModel=model\.id/);
  assert.match(source, /loadModel\(model\)/);
  assert.match(models, /PROTAGONIST_VILLAGER_MODEL/);
  assert.match(models, /PROTAGONIST_VILLAGER_V1\.glb/);
  assert.match(models, /28fae04c0d0276af60e854756e8e7d10a5b965d3/);
});

test('female protagonist uses the independently authored CC0-derived heroine without restoring the retired head', () => {
  const model = CHARACTER_REFERENCE_MODELS[PROTAGONIST_VILLAGER_FEMALE_MODEL_ID];
  const receipt = JSON.parse(readFileSync('apps/rinne/public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.asset.json', 'utf8'));
  const production = JSON.parse(readFileSync('packages/characters/production/protagonist-villager-female-v1.production.json', 'utf8'));
  const bytes = readFileSync(production.source.meshPath);
  assert.equal(model.id, 'protagonist.villager.female.v1');
  assert.equal(model.modelingMode, 'dcc-blender');
  assert.equal(model.production.target.rigId, 'Rig_Medium');
  assert.equal(model.sourceModelId, 'kaykit.rogue.v1');
  assert.equal(model.assetPath, receipt.path);
  assert.equal(model.productionStage, 'PRIMARY');
  assert.equal(production.stage, 'PRIMARY');
  assert.equal(production.status.visualApproval, 'pending');
  assert.equal(production.status.productionReady, false);
  assert.equal(model.productionReady, false);
  assert.equal(bytes.length, receipt.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256);
  assert.notEqual(receipt.sha256, 'e825437cd4d2ee9c1960b517a74a69101e33eb409ae7fa8cedc7134a998fbb7d');
  assert.equal(model.referenceStyle.design, 'protagonist-female-heroine-dawn');
  assert.equal(existsSync(model.dccSourcePath), true);
  assert.equal(receipt.humanoidRig, 'kaykit.Rig_Medium.v1');
  assert.equal(receipt.license.spdx, 'CC0-1.0');
  for (const app of ['rinne', 'character-studio']) {
    assert.equal(existsSync(`apps/${app}/public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.glb`), false);
    assert.deepEqual(JSON.parse(readFileSync(`apps/${app}/public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.asset.json`, 'utf8')), receipt);
  }
  assert.equal(existsSync('assets/characters/protagonist/villager-female-v1/source/ProtagonistVillagerFemaleV1.blend'), false);
});
