import test from 'node:test';
import assert from 'node:assert/strict';
import {
  catalog,
  evaluateCharacterLicensePolicy,
  KAYKIT_FAMILY_ID,
  MASTER_ID
} from '../packages/characters/src/index.js';

test('active character catalog contains only the unconditional KayKit foundation', () => {
  assert.deepEqual(Object.keys(catalog), [KAYKIT_FAMILY_ID]);
  assert.equal(catalog[KAYKIT_FAMILY_ID].license, 'CC0-1.0');
  assert.equal(Object.hasOwn(catalog, MASTER_ID), false);
});

test('CC0 and fully RINNE-owned character assets are allowed', () => {
  assert.equal(evaluateCharacterLicensePolicy({ license: 'CC0-1.0' }).allowed, true);
  assert.equal(evaluateCharacterLicensePolicy({ ownership: 'RINNE-owned' }).allowed, true);
});

test('conditional review models and Shino carrier rigs fail closed', () => {
  assert.equal(evaluateCharacterLicensePolicy({ id: MASTER_ID, license: { original: 'CC0-1.0', conversion: 'VRM-Public-License-1.0' } }).status, 'retired');
  assert.equal(evaluateCharacterLicensePolicy({ id: 'review.vroid-a', license: 'VRoid sample terms' }).allowed, false);
  assert.equal(evaluateCharacterLicensePolicy({ id: 'review.tsukuyomi-type-a', license: 'character license' }).allowed, false);
  assert.equal(evaluateCharacterLicensePolicy({ ownership: 'RINNE-owned', rigId: 'humanoid.shino-vrm1.v2' }).status, 'blocked-rerig');
  assert.equal(evaluateCharacterLicensePolicy({ ownership: 'RINNE-owned', rigProvenance: 'Sendagaya_Shino carrier rig' }).status, 'blocked-rerig');
  assert.equal(evaluateCharacterLicensePolicy({ license: 'commercial allowed with conditions' }).allowed, false);
});
