import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARACTER_MODEL_REQUIRED_GATES,
  createCharacterDistributionManifest,
  createCharacterModelBuildRequest,
  createCharacterModelCandidate,
  reviewCharacterModelCandidate
} from '../packages/characters/src/model-builder.js';

test('reference-to-model handoff keeps current MasterCharacter until every gate passes', () => {
  const request = createCharacterModelBuildRequest('shino.reference.v2');
  assert.equal(request.reference.fallbackAssetId, request.reference.masterId);
  assert.equal(request.handoff.fallbackPolicy, 'retain-current-master-until-candidate-accepted');

  const candidate = createCharacterModelCandidate(request, {
    format: 'vrm',
    path: 'generated/shino.vrm',
    sha256: 'e'.repeat(64),
    provider: 'test'
  });
  assert.throws(() => createCharacterDistributionManifest(candidate), /not accepted/);

  const results = Object.fromEntries(CHARACTER_MODEL_REQUIRED_GATES.map(gate => [gate, {
    status: 'pass', evidence: [`evidence/${gate}.json`]
  }]));
  const accepted = reviewCharacterModelCandidate(candidate, results);
  const manifest = createCharacterDistributionManifest(accepted);
  assert.equal(manifest.candidateId, accepted.id);
  assert.equal(manifest.artifact.sha256, candidate.artifact.sha256);
});
