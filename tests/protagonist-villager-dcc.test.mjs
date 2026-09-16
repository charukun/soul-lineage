import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  CHARACTER_REFERENCE_MODELS,
  PROTAGONIST_VILLAGER_MODEL_ID,
  evaluateCharacterLicensePolicy
} from '../packages/characters/src/index.js';

test('protagonist village DCC runtime output is retired until it is re-rigged', () => {
  assert.equal(CHARACTER_REFERENCE_MODELS[PROTAGONIST_VILLAGER_MODEL_ID], undefined);
  const license = evaluateCharacterLicensePolicy({ id: PROTAGONIST_VILLAGER_MODEL_ID });
  assert.equal(license.status, 'blocked-rerig');
  assert.equal(license.allowed, false);

  const production = JSON.parse(readFileSync('packages/characters/production/protagonist-villager-v1.production.json', 'utf8'));
  assert.equal(production.stage, 'PRIMARY');
  assert.equal(production.status.productionReady, false);
  assert.equal(production.status.licensePolicy, 'blocked-rerig');
  assert.equal(production.status.distributionEligible, false);
});

test('RINNE-authored Blender surface source remains available for CC0/RINNE-owned re-rig migration', () => {
  assert.equal(existsSync('assets/characters/protagonist/villager-v1/source/ProtagonistVillagerV1.blend'), true);
  assert.equal(existsSync('apps/rinne/public/simulator/assets/PROTAGONIST_VILLAGER_V1.glb'), false);
  assert.equal(existsSync('apps/rinne/public/simulator/assets/PROTAGONIST_VILLAGER_V1.asset.json'), false);
  assert.equal(existsSync('.dcc/character-dcc-request.json'), false);
});

test('motion review no longer defaults to the retired protagonist runtime model', () => {
  const source = readFileSync('apps/rinne/src/motion-review-entrypoint.js', 'utf8');
  assert.match(source, /characterModel/);
  assert.match(source, /workspace\?\.selectModel\(requestedModel\)/);
  assert.doesNotMatch(source, /PROTAGONIST_VILLAGER_MODEL_ID/);
  assert.match(source, /30秒演舞/);
});
