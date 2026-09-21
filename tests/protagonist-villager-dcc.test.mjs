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

test('motion review keeps explicit model selection rather than silently forcing the protagonist', () => {
  const source = readFileSync('apps/rinne/src/review-motion.js', 'utf8');
  assert.match(source, /const REVIEW_MODELS=KAYKIT_MODELS/);
  assert.match(source, /dataset\.motionModel=model\.id/);
  assert.match(source, /loadModel\(model\)/);
  assert.doesNotMatch(source, /PROTAGONIST_VILLAGER_MODEL_ID/);
});


test('female protagonist is a separate repository-local Rig_Medium DCC model', () => {
  const model = CHARACTER_REFERENCE_MODELS[PROTAGONIST_VILLAGER_FEMALE_MODEL_ID];
  assert.equal(model.id, 'protagonist.villager.female.v1');
  assert.equal(model.productionStage, 'PRIMARY');
  assert.equal(model.modelingMode, 'dcc-blender');
  assert.equal(model.productionReady, false);
  assert.equal(model.production.target.rigId, 'Rig_Medium');
  assert.equal(model.referenceStyle.design, 'protagonist-female-kaykit-derivative');
  assert.equal(model.assetPath, './simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.glb');

  const glbPath = 'apps/rinne/public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.glb';
  const receiptPath = 'apps/rinne/public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.asset.json';
  const blendPath = 'assets/characters/protagonist/villager-female-v1/source/ProtagonistVillagerFemaleV1.blend';
  const productionPath = 'packages/characters/production/protagonist-villager-female-v1.production.json';
  assert.equal(existsSync(glbPath), true);
  assert.equal(existsSync(blendPath), true);
  assert.equal(existsSync(receiptPath), true);
  assert.equal(existsSync(productionPath), true);
  for (const view of ['front', 'three-quarter', 'side', 'back']) {
    assert.equal(existsSync(`docs/characters/qa/protagonist-villager-female-v1/${view}.png`), true);
  }

  const bytes = readFileSync(glbPath);
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  const production = JSON.parse(readFileSync(productionPath, 'utf8'));
  assert.equal(bytes.length, receipt.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256);
  assert.equal(receipt.sha256, '06de3a20266316b5ce1f75b88ca7434916d13c2f161036c29649f06f6b44c78c');
  assert.equal(receipt.humanoidRig, 'kaykit.Rig_Medium.v1');
  assert.equal(production.stage, 'PRIMARY');
  assert.equal(production.status.visualApproval, 'pending');
  assert.equal(production.status.productionReady, false);
  assert.equal(production.evidence.primary.meshObjects, 25);
  assert.equal(production.evidence.primary.triangles, 4128);
});
