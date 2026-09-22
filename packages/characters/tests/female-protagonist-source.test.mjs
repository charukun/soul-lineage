import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PROTAGONIST_VILLAGER_FEMALE_MODEL as model, PROTAGONIST_VILLAGER_MODEL as male } from '../src/reference-model-catalog.js';
import { KAYKIT_MODEL_BY_KEY } from '../src/kaykit-foundation.js';
import { projectAssetUrl, PROJECT_ASSET_MAX_BYTES } from '../../assets/src/runtime-origin.js';

const root = new URL('../../../', import.meta.url);
const file = path => fileURLToPath(new URL(path, root));
const read = path => readFileSync(file(path));
const json = path => JSON.parse(read(path));
const source = json('apps/review/public/library/provenance/female-protagonist-rogue-v1.json');
const production = json('packages/characters/production/protagonist-villager-female-v1.production.json');
const bytes = read(source.path);
const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
const digest = (kind, value) => createHash(kind).update(value).digest('hex');

// These pins identify the author's real mesh. A regenerated lookalike cannot pass.
test('female selection retains its ID but resolves to the original self-hosted CC0 Rogue', () => {
  assert.equal(model.id, 'protagonist.villager.female.v1');
  assert.equal(model.sourceModelId, KAYKIT_MODEL_BY_KEY.rogue.id);
  assert.equal(model.modelingMode, 'imported-reviewed');
  assert.equal(model.procedural, false);
  assert.equal(model.assetPath, projectAssetUrl('model/c8827661105eef7b2bfbef3bc676d41a47625733/Rogue.glb'));
  assert.equal(model.dccSourcePath, source.path);
  assert.equal(production.source.meshPath, source.path);
  assert.equal(source.author, 'Kay Lousberg');
  assert.equal(source.license, 'CC0-1.0');
  assert.equal(source.revision, KAYKIT_MODEL_BY_KEY.rogue.source.revision);
  assert.match(read(source.licensePath).toString(), /Creative Commons Zero, CC0/);
  assert.equal(digest('sha256', read(source.licensePath)), source.licenseSha256);
});

test('materialized bytes are unmodified, bounded, self-contained and independently pinned', () => {
  assert.equal(bytes.length, 3616284);
  assert.equal(bytes.length, source.bytes);
  assert.ok(bytes.length < PROJECT_ASSET_MAX_BYTES);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  assert.equal(digest('sha256', bytes), 'e825437cd4d2ee9c1960b517a74a69101e33eb409ae7fa8cedc7134a998fbb7d');
  assert.equal(source.sha256, digest('sha256', bytes));
  const blob = digest('sha1', Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]));
  assert.equal(blob, 'c8827661105eef7b2bfbef3bc676d41a47625733');
  assert.equal(blob, KAYKIT_MODEL_BY_KEY.rogue.source.gitBlobSha);
  assert.equal(source.gitBlobSha, blob);
  assert.ok(doc.buffers.every(buffer => !buffer.uri));
  assert.ok(doc.images.every(image => !image.uri && Number.isInteger(image.bufferView)));
  assert.equal(doc.materials[0].name, 'rogue_texture');
  assert.equal(doc.images[0].name, 'rogue_texture');
});

test('the original face, hair-bearing head, clothing, skin and common-rig motion bindings survive', () => {
  const names = new Set(doc.nodes.map(node => node.name));
  for (const name of ['Rogue_Head', 'Rogue_Body', 'Rogue_Cape', 'Rogue_ArmLeft', 'Rogue_ArmRight', 'Rogue_LegLeft', 'Rogue_LegRight', 'root', 'hips', 'head', 'hand.l', 'hand.r', 'foot.l', 'foot.r', 'handslot.l', 'handslot.r']) assert.ok(names.has(name), name);
  assert.equal(doc.skins.length, 1);
  for (const index of doc.skins[0].joints) assert.ok(doc.nodes[index]);
  const animations = new Set(doc.animations.map(animation => animation.name));
  for (const name of ['Idle', 'Walking_A', '1H_Melee_Attack_Chop', 'Block', 'Hit_A', 'PickUp', 'Lie_Idle', 'Death_A']) assert.ok(animations.has(name), name);
  for (const animation of doc.animations) for (const channel of animation.channels) {
    assert.ok(doc.nodes[channel.target.node]);
    assert.ok(animation.samplers[channel.sampler]);
  }
  assert.deepEqual(doc.animations.map(animation => animation.name), source.animations);
  assert.equal(model.production.target.rigId, 'Rig_Medium');
});

test('both review consumers use matching integrity receipts and cannot silently revive old geometry', () => {
  for (const app of ['rinne', 'character-studio']) {
    const receipt = json(`apps/${app}/public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.asset.json`);
    assert.equal(receipt.id, model.id);
    assert.equal(receipt.assetId, model.assetId);
    assert.equal(receipt.sha256, source.sha256);
    assert.equal(receipt.gitBlobSha, source.gitBlobSha);
    assert.equal(receipt.bytes, bytes.length);
    assert.equal(receipt.path, model.assetPath);
    assert.equal(receipt.humanoidRig, 'kaykit.Rig_Medium.v1');
    assert.equal(receipt.license.spdx, 'CC0-1.0');
    assert.equal(existsSync(file(`apps/${app}/public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.glb`)), false);
  }
  for (const path of ['assets/characters/protagonist/villager-female-v1/source/ProtagonistVillagerFemaleV1.blend', 'scripts/blender/build-protagonist-villager-female-v1.py', 'scripts/blender/refine-protagonist-villager-female-v1.py', 'docs/characters/references/protagonist-villager-female-v1.svg']) assert.equal(existsSync(file(path)), false, path);
});

test('replacement does not inherit old visual approval, alter male protagonist or promote production', () => {
  assert.equal(model.productionStage, 'REFERENCE');
  assert.equal(model.productionReady, false);
  assert.equal(model.visualApproval, 'pending');
  assert.equal(production.stage, 'REFERENCE');
  assert.equal(production.status.productionReady, false);
  assert.equal(production.status.visualApproval, 'pending');
  assert.doesNotMatch(JSON.stringify(production), /female-authored-head|female-bob|ProtagonistVillagerFemaleV1\.blend|4196/);
  assert.equal(male.modelingMode, 'dcc-blender');
  assert.equal(male.assetPath, './simulator/assets/PROTAGONIST_VILLAGER_V1.glb');
});


test('bundled weapon sample meshes are excluded from display without altering the source or skeleton', () => {
  assert.deepEqual(model.sourceDisplay.excludeMeshNodes, ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable']);
  const joints = new Set(doc.skins.flatMap(skin => skin.joints));
  for (const name of model.sourceDisplay.excludeMeshNodes) {
    const index = doc.nodes.findIndex(node => node.name === name);
    assert.ok(index >= 0 && Number.isInteger(doc.nodes[index].mesh), name);
    assert.equal(joints.has(index), false, name);
  }
});
