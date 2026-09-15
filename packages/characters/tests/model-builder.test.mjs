import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_REFERENCE_MODELS } from '../src/reference-models.js';
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
    const before = JSON.stringify(reference);
    const request = createCharacterModelBuildRequest(id);
    assert.equal(request.reference.id, id);
    assert.equal(request.reference.referencePath, reference.referencePath);
    assert.deepEqual(request.reference.profile, reference.profile);
    assert.equal(request.reference.fallbackAssetId, reference.masterId);
    assert.equal(JSON.stringify(reference), before);
    assert.equal(reference.productionStage, reference.kind === 'dcc-character-model' ? 'PRIMARY' : 'BLOCKOUT');
    assert.equal(reference.productionReady, false);
  }
});

test('character reference becomes a provider-neutral production request', () => {
  const request = createCharacterModelBuildRequest('shino.reference.v2');
  assert.equal(request.kind, 'character-model-build-request');
  assert.equal(request.reference.characterId, 'Sendagaya_Shino');
  assert.equal(request.reference.referencePath, 'docs/characters/references/shino/shino-character-reference-sheet-v2.png');
  assert.equal(request.target.primaryFormat, 'vrm');
  assert.ok(request.target.formats.includes('glb'));
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
  const request = createCharacterModelBuildRequest('shino.reference.v2', { provider: 'test-provider' });
  const provider = createCharacterModelProvider('test-provider', async received => {
    assert.equal(received.reference.id, 'shino.reference.v2');
    return { format: 'vrm', path: 'generated/shino.vrm', sha256: 'a'.repeat(64) };
  });
  const candidate = await buildCharacterModel(request, provider);
  assert.equal(candidate.kind, 'character-model-candidate');
  assert.equal(candidate.artifact.provider, 'test-provider');
  assert.equal(candidate.acceptance.status, 'pending');
});

test('candidate rejects an output format outside the reference contract', () => {
  const request = createCharacterModelBuildRequest('shino.reference.v2');
  assert.throws(() => createCharacterModelCandidate(request, {
    format: 'fbx', path: 'generated/shino.fbx', sha256: 'b'.repeat(64), provider: 'manual'
  }), /Unsupported candidate format/);
});

test('distribution remains blocked until all required gates pass', () => {
  const request = createCharacterModelBuildRequest('shino.reference.v2');
  const candidate = createCharacterModelCandidate(request, {
    format: 'vrm', path: 'generated/shino.vrm', sha256: 'c'.repeat(64), provider: 'manual'
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
  const request = createCharacterModelBuildRequest('shino.reference.v2');
  const candidate = createCharacterModelCandidate(request, {
    format: 'glb', path: 'generated/shino.glb', sha256: 'd'.repeat(64), provider: 'manual'
  });
  const results = Object.fromEntries(CHARACTER_MODEL_REQUIRED_GATES.map(gate => [gate, { status: 'pass', evidence: ['ok'] }]));
  results.clipping = { status: 'fail', evidence: ['qa/clipping.webp'], note: '髪が肩を貫通' };
  const rejected = reviewCharacterModelCandidate(candidate, results);
  assert.equal(rejected.acceptance.status, 'rejected');
  assert.throws(() => createCharacterDistributionManifest(rejected), /not accepted/);
});
