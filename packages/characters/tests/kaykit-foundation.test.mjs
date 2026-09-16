import test from 'node:test';
import assert from 'node:assert/strict';
import { MASTER_ID } from '../src/master-character.js';
import {
  DEFAULT_CHARACTER_FAMILY_ID,
  KAYKIT_DEFAULT_MODEL_ID,
  KAYKIT_FAMILY_ID,
  KAYKIT_FOUNDATION,
  KAYKIT_LICENSE,
  KAYKIT_MODELS,
  KAYKIT_RIG_ID,
  KAYKIT_SOURCE_REVISION,
  kaykitRuntimeAsset,
  selectKaykitModel
} from '../src/kaykit-foundation.js';

test('KayKit Adventurers is the default game character foundation without rewriting legacy identity', () => {
  assert.equal(DEFAULT_CHARACTER_FAMILY_ID, KAYKIT_FAMILY_ID);
  assert.equal(KAYKIT_FOUNDATION.id, 'kaykit.adventurers.v1');
  assert.equal(KAYKIT_SOURCE_REVISION, '672074b73ba276876a19e8816ecdc5241817ab47');
  assert.equal(KAYKIT_LICENSE, 'CC0-1.0');
  assert.equal(KAYKIT_RIG_ID, 'Rig_Medium');
  assert.equal(MASTER_ID, 'character.sendagaya-shino.v1', 'legacy save identity must remain compatible');
});

test('the five pinned KayKit models have immutable provenance and local runtime targets', () => {
  assert.deepEqual(KAYKIT_MODELS.map(row => row.label), ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue Hooded']);
  assert.equal(new Set(KAYKIT_MODELS.map(row => row.source.gitBlobSha)).size, 5);
  for (const row of KAYKIT_MODELS) {
    assert.equal(row.familyId, KAYKIT_FAMILY_ID);
    assert.equal(row.license, 'CC0-1.0');
    assert.equal(row.rigId, 'Rig_Medium');
    assert.equal(row.source.revision, KAYKIT_SOURCE_REVISION);
    assert.match(row.source.gitBlobSha, /^[0-9a-f]{40}$/);
    assert.ok(row.source.byteLength > 3_000_000);
    assert.match(row.runtime.url, /^\.\/simulator\/assets\/kaykit\/.+\.glb$/);
    assert.equal(row.productionReady, false);
    assert.equal(row.visualApproval, 'pending');
  }
});

test('runtime selection is deterministic and preserves an explicit Knight default', () => {
  assert.equal(KAYKIT_DEFAULT_MODEL_ID, 'kaykit.knight.v1');
  assert.equal(selectKaykitModel({ kind: 'hero', key: 'player' }).id, KAYKIT_DEFAULT_MODEL_ID);
  assert.equal(selectKaykitModel({ kind: 'mother', key: 'village' }).id, 'kaykit.rogue-hooded.v1');
  const a = selectKaykitModel({ kind: 'enemy', key: 'enemy-7', index: 2 });
  const b = selectKaykitModel({ kind: 'enemy', key: 'enemy-7', index: 2 });
  assert.equal(a.id, b.id);
  assert.notEqual(a.id, KAYKIT_DEFAULT_MODEL_ID, 'enemy pool intentionally excludes the hero default');
  const asset = kaykitRuntimeAsset();
  assert.equal(asset.familyId, KAYKIT_FAMILY_ID);
  assert.equal(asset.modelId, KAYKIT_DEFAULT_MODEL_ID);
  assert.equal(asset.productionReady, false);
  assert.equal(asset.usage, 'dev-runtime-foundation');
});
