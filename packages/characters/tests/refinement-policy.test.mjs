import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterModelBuildRequest } from '../src/model-builder.js';
import {
  CHARACTER_REFINEMENT_CHECKS,
  CHARACTER_REFINEMENT_MAX_ROUNDS,
  CHARACTER_REFINEMENT_VIEWS,
  createCharacterRefinementPolicy,
  createCharacterRefinementRound,
  validateCharacterRefinementPolicy
} from '../src/refinement-policy.js';

test('refinement policy stays small, local and bounded', () => {
  const policy = createCharacterRefinementPolicy();
  assert.equal(validateCharacterRefinementPolicy(policy), policy);
  assert.equal(CHARACTER_REFINEMENT_MAX_ROUNDS, 3);
  assert.deepEqual(CHARACTER_REFINEMENT_VIEWS, ['front', 'three-quarter', 'side', 'back']);
  assert.equal(CHARACTER_REFINEMENT_CHECKS.length, 6);
  assert.equal(policy.basePolicy, 'reuse-compatible-reviewed-source');
  assert.equal(policy.repairMode, 'failed-regions-only');
  assert.equal(policy.preservePassedRegions, true);
  assert.equal(policy.externalReferencePolicy, 'unresolved-part-only-with-provenance-license');
  assert.equal(policy.wholeModelReplacement, 'fallback-only');
  assert.equal(policy.visualApproval, 'human-required');
});

test('build requests carry the same refinement contract used by review', () => {
  const request = createCharacterModelBuildRequest('elderly-man.reference.v1');
  assert.deepEqual(request.requirements.refinement, createCharacterRefinementPolicy());
  assert.equal(request.requirements.refinement.maxRounds, 3);
  assert.deepEqual(request.requirements.refinement.checks, CHARACTER_REFINEMENT_CHECKS.map(check => check.id));
});

test('a refinement round preserves passes and repairs only failed checks', () => {
  const first = createCharacterRefinementRound(1, {
    'silhouette-proportion': 'pass',
    'side-profile': 'fail',
    'joint-readability': 'fail',
    hands: 'pass',
    'hair-consistency': 'pass',
    'back-view-identity': 'pass'
  });
  assert.equal(first.state, 'repair');
  assert.deepEqual(first.failedChecks, ['side-profile', 'joint-readability']);
  assert.deepEqual(first.preserveChecks, ['silhouette-proportion', 'hands', 'hair-consistency', 'back-view-identity']);
  assert.equal(first.repairMode, 'failed-regions-only');
  assert.equal(first.visualApproval, 'unchanged');
});

test('third unresolved round escalates only failed parts to external-reference fallback', () => {
  const third = createCharacterRefinementRound(3, {
    'silhouette-proportion': 'pass',
    'side-profile': 'pass',
    'joint-readability': 'pass',
    hands: 'fail',
    'hair-consistency': 'pass',
    'back-view-identity': 'pass'
  });
  assert.equal(third.state, 'escalate');
  assert.deepEqual(third.failedChecks, ['hands']);
  assert.equal(third.externalReference, 'unresolved-failed-parts-only');
  assert.throws(() => createCharacterRefinementRound(4, {}), /round must be between 1 and 3/);
});
