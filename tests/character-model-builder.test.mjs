import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARACTER_MODEL_REQUIRED_GATES,
  createCharacterDistributionManifest,
  createCharacterModelBuildRequest,
  createCharacterModelCandidate,
  reviewCharacterModelCandidate
} from '../packages/characters/src/model-builder.js';
import {KAYKIT_DEFAULT_MODEL_ID} from '../packages/characters/src/kaykit-foundation.js';

test('reference-to-model handoff uses the unconditional KayKit fallback until every gate passes', () => {
  const request = createCharacterModelBuildRequest('knight.reference.v1');
  assert.equal(request.reference.masterId, KAYKIT_DEFAULT_MODEL_ID);
  assert.equal(request.reference.fallbackAssetId, KAYKIT_DEFAULT_MODEL_ID);
  assert.equal(request.target.rigId, 'Rig_Medium');
  assert.deepEqual(request.target.formats, ['glb']);
  assert.ok(CHARACTER_MODEL_REQUIRED_GATES.includes('license'));
  assert.equal(request.handoff.fallbackPolicy, 'retain-current-master-until-candidate-accepted');

  const candidate = createCharacterModelCandidate(request, {
    format: 'glb',
    path: 'generated/knight.glb',
    sha256: 'e'.repeat(64),
    provider: 'test',
    license: 'CC0-1.0',
    rigId: 'Rig_Medium'
  });
  assert.throws(() => createCharacterDistributionManifest(candidate), /not accepted/);

  const results = Object.fromEntries(CHARACTER_MODEL_REQUIRED_GATES.map(gate => [gate, {
    status: 'pass', evidence: [`evidence/${gate}.json`]
  }]));
  const accepted = reviewCharacterModelCandidate(candidate, results);
  const manifest = createCharacterDistributionManifest(accepted);
  assert.equal(manifest.candidateId, accepted.id);
  assert.equal(manifest.artifact.sha256, candidate.artifact.sha256);
  assert.equal(manifest.licensePolicy.reason, 'cc0');
});

test('retired conditional references and conditional carrier rigs cannot enter distribution', () => {
  assert.throws(() => createCharacterModelBuildRequest('shino.reference.v2'), /Retired conditional character reference/);

  const request = createCharacterModelBuildRequest('knight.reference.v1');
  const candidate = createCharacterModelCandidate(request, {
    format: 'glb', path: 'generated/owned.glb', sha256: 'a'.repeat(64), provider: 'test', ownership: 'RINNE-owned', rigId: 'humanoid.shino-vrm1.v2'
  });
  const results = Object.fromEntries(CHARACTER_MODEL_REQUIRED_GATES.map(gate => [gate, {status:'pass', evidence:[`evidence/${gate}.json`]}]));
  const accepted = reviewCharacterModelCandidate(candidate, results);
  assert.throws(() => createCharacterDistributionManifest(accepted), /conditional-carrier-rig/);
});
