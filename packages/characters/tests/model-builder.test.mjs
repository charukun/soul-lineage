import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_REFERENCE_MODELS } from '../src/reference-models.js';
import { RETIRED_CONDITIONAL_CHARACTER_IDS, BLOCKED_RERIG_CHARACTER_IDS } from '../src/license-policy.js';
import {KAYKIT_DEFAULT_MODEL_ID} from '../src/kaykit-foundation.js';
import {
  CHARACTER_MODEL_DISTRIBUTION_TARGETS,
  CHARACTER_MODEL_REQUIRED_GATES,
  buildCharacterModel,
  createCharacterDistributionManifest,
  createCharacterModelBuildRequest,
  createCharacterModelCandidate,
  createCharacterModelProvider,
  reviewCharacterModelCandidate
} from '../src/model-builder.js';

test('all Workshop references export build requests without promoting their current production stage', () => {
  for (const [id, reference] of Object.entries(CHARACTER_REFERENCE_MODELS)) {
    if (RETIRED_CONDITIONAL_CHARACTER_IDS.includes(id) || BLOCKED_RERIG_CHARACTER_IDS.includes(id)) {
      assert.throws(() => createCharacterModelBuildRequest(id), /Retired conditional|unconditional re-rig/);
      continue;
    }
    const before = JSON.stringify(reference);
    const request = createCharacterModelBuildRequest(id);
    assert.equal(request.reference.id, id);
    assert.equal(request.reference.referencePath, reference.referencePath);
    assert.deepEqual(request.reference.profile, reference.profile);
    assert.equal(request.reference.fallbackAssetId, KAYKIT_DEFAULT_MODEL_ID);
    assert.equal(JSON.stringify(reference), before);
    assert.equal(reference.productionStage, reference.kind === 'dcc-character-model' ? 'PRIMARY' : 'BLOCKOUT');
    assert.equal(reference.productionReady, false);
  }
});

test('character reference becomes a provider-neutral production request', () => {
  const request = createCharacterModelBuildRequest('knight.reference.v1');
  assert.equal(request.kind, 'character-model-build-request');
  assert.equal(request.reference.characterId, 'Reference_Knight');
  assert.equal(request.reference.referencePath, 'docs/characters/references/npc-role-set/knight.avif');
  assert.equal(request.target.primaryFormat, 'glb');
  assert.deepEqual(request.target.formats, ['glb']);
  assert.deepEqual(request.authority.proposedParts, []);
  assert.deepEqual(request.authority.gameEquipment, []);
  assert.deepEqual(request.acceptance.requiredGates, CHARACTER_MODEL_REQUIRED_GATES);
  assert.equal(request.handoff.fallbackPolicy, 'retain-current-master-until-candidate-accepted');
});

test('runtime blockout references keep the audited MasterCharacter as fallback', () => {
  const request = createCharacterModelBuildRequest('guard.reference.v1');
  assert.equal(request.reference.id, 'guard.reference.v1');
  assert.equal(request.reference.fallbackAssetId, request.reference.masterId);
  assert.notEqual(request.reference.fallbackAssetId, 'runtime.guard.reference.v1');
  assert.deepEqual(request.authority.proposedParts, []);
  assert.equal(request.requirements.fallbackPolicy, 'retain-current-master-until-candidate-accepted');
});

test('provider adapter can generate a concrete candidate without entering runtime code', async () => {
  const request = createCharacterModelBuildRequest('knight.reference.v1', { provider: 'test-provider' });
  const provider = createCharacterModelProvider('test-provider', async received => {
    assert.equal(received.reference.id, 'knight.reference.v1');
    return { format: 'glb', path: 'generated/knight.glb', sha256: 'a'.repeat(64), license: 'CC0-1.0', rigId: 'Rig_Medium' };
  });
  const candidate = await buildCharacterModel(request, provider);
  assert.equal(candidate.kind, 'character-model-candidate');
  assert.equal(candidate.artifact.provider, 'test-provider');
  assert.equal(candidate.acceptance.status, 'pending');
});

test('candidate rejects an output format outside the reference contract', () => {
  const request = createCharacterModelBuildRequest('knight.reference.v1');
  assert.throws(() => createCharacterModelCandidate(request, {
    format: 'fbx', path: 'generated/shino.fbx', sha256: 'b'.repeat(64), provider: 'manual'
  }), /Unsupported candidate format/);
});

test('distribution remains blocked until all required gates pass', () => {
  const request = createCharacterModelBuildRequest('knight.reference.v1');
  const candidate = createCharacterModelCandidate(request, {
    format: 'glb', path: 'generated/knight.glb', sha256: 'c'.repeat(64), provider: 'manual', license: 'CC0-1.0', rigId: 'Rig_Medium'
  });
  const partial = reviewCharacterModelCandidate(candidate, {
    identity: { status: 'pass', evidence: ['workshop/front.webp'] }
  });
  assert.equal(partial.acceptance.status, 'needs-review');
  assert.throws(() => createCharacterDistributionManifest(partial), /not accepted/);

  const passed = Object.fromEntries(CHARACTER_MODEL_REQUIRED_GATES.map(gate => [gate, {
    status: 'pass', evidence: [`qa/${gate}.json`]
  }]));
  const accepted = reviewCharacterModelCandidate(candidate, passed);
  assert.equal(accepted.acceptance.status, 'accepted');
  const manifest = createCharacterDistributionManifest(accepted);
  assert.deepEqual(manifest.targets.map(target => target.appId), CHARACTER_MODEL_DISTRIBUTION_TARGETS);
  assert.equal(manifest.masterId, request.reference.masterId);
  assert.equal(manifest.adoptionPolicy, 'integration-exact-head-after-acceptance');
});

test('one failed gate rejects the candidate even if every other gate passes', () => {
  const request = createCharacterModelBuildRequest('knight.reference.v1');
  const candidate = createCharacterModelCandidate(request, {
    format: 'glb', path: 'generated/knight.glb', sha256: 'd'.repeat(64), provider: 'manual', license: 'CC0-1.0', rigId: 'Rig_Medium'
  });
  const results = Object.fromEntries(CHARACTER_MODEL_REQUIRED_GATES.map(gate => [gate, { status: 'pass', evidence: ['ok'] }]));
  results.clipping = { status: 'fail', evidence: ['qa/clipping.webp'], note: '髪が肩を貫通' };
  const rejected = reviewCharacterModelCandidate(candidate, results);
  assert.equal(rejected.acceptance.status, 'rejected');
  assert.throws(() => createCharacterDistributionManifest(rejected), /not accepted/);
});
