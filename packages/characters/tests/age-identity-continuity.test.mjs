import test from 'node:test';
import assert from 'node:assert/strict';
import { YEAR_MS, createCharacter } from '../src/master-character.js';
import {
  AGE_IDENTITY_REVIEW_DIMENSIONS,
  AGE_IDENTITY_REVIEW_STAGES,
  ageIdentitySignature,
  createAgeIdentityCandidateSet,
  createAgeIdentityReviewPlan,
  createAgeIdentitySnapshots,
  evaluateAgeIdentityReview
} from '../src/age-identity-continuity.js';

const makeCharacter = () => createCharacter({ id: 'age-probe', seed: 0x12345678 });
const passDimensions = () => Object.fromEntries(AGE_IDENTITY_REVIEW_DIMENSIONS.map(dimension => [dimension, 'pass']));

test('five review snapshots age one canonical character without changing its identity or source record', () => {
  const character = makeCharacter();
  const before = structuredClone(character);
  const snapshots = createAgeIdentitySnapshots(character);

  assert.deepEqual(snapshots.map(snapshot => snapshot.stageId), AGE_IDENTITY_REVIEW_STAGES.map(stage => stage.id));
  assert.deepEqual(snapshots.map(snapshot => snapshot.years), [4, 12, 22, 50, 75]);
  assert.deepEqual(snapshots.map(snapshot => snapshot.character.ageMs), [4, 12, 22, 50, 75].map(years => years * YEAR_MS));
  assert.ok(snapshots.every(snapshot => ageIdentitySignature(snapshot.character) === ageIdentitySignature(character)));
  assert.deepEqual(character, before);

  assert.ok(snapshots[0].appearance.headScale > snapshots[2].appearance.headScale);
  assert.ok(snapshots[2].appearance.scale > snapshots[0].appearance.scale);
  assert.ok(snapshots[4].appearance.gray > snapshots[3].appearance.gray);
  assert.ok(snapshots[4].appearance.stoop > snapshots[3].appearance.stoop);
  assert.equal(snapshots[0].appearance.canEquipWeapon, false);
  assert.equal(snapshots[1].appearance.canEquipWeapon, true);
});

test('review plan requires adjacent life-stage comparisons plus childhood to elder', () => {
  const plan = createAgeIdentityReviewPlan(makeCharacter());
  assert.equal(plan.reviewOnly, true);
  assert.equal(plan.constraints.productionStageUnaffected, true);
  assert.equal(plan.constraints.visualApprovalUnaffected, true);
  assert.deepEqual(plan.comparisons.map(comparison => comparison.id), [
    'childhood->boyhood',
    'boyhood->young-adult',
    'young-adult->mature-adult',
    'mature-adult->elder',
    'childhood->elder'
  ]);
  assert.deepEqual(plan.views, ['front', 'three-quarter-front', 'side', 'back', 'face-close-up']);
});

test('candidate set accepts exactly one real artifact slot per age stage and orders it deterministically', () => {
  const plan = createAgeIdentityReviewPlan(makeCharacter());
  const sha = index => index.toString(16).padStart(64, '0');
  const artifacts = [...AGE_IDENTITY_REVIEW_STAGES].reverse().map((stage, index) => ({
    stageId: stage.id,
    path: `generated/${stage.id}.vrm`,
    format: 'VRM',
    sha256: sha(index + 1),
    provider: 'generation-probe'
  }));
  const set = createAgeIdentityCandidateSet(plan, artifacts);
  assert.deepEqual(set.artifacts.map(artifact => artifact.stageId), AGE_IDENTITY_REVIEW_STAGES.map(stage => stage.id));
  assert.ok(set.artifacts.every(artifact => artifact.format === 'vrm' && artifact.provider === 'generation-probe'));
  assert.throws(() => createAgeIdentityCandidateSet(plan, artifacts.slice(1)), /exactly five artifacts/);
  assert.throws(() => createAgeIdentityCandidateSet(plan, artifacts.map((artifact, index) => index === 0 ? { ...artifact, sha256: 'bad' } : artifact)), /sha256/);
});

test('review remains pending until every dimension is explicit and reports the earliest failed transition', () => {
  const plan = createAgeIdentityReviewPlan(makeCharacter());
  const pending = evaluateAgeIdentityReview(plan, {
    'childhood->boyhood': { 'face-structure': 'pass' }
  });
  assert.equal(pending.status, 'pending');
  assert.equal(pending.visualApprovalGranted, false);
  assert.equal(pending.productionStageChanged, false);

  const failed = evaluateAgeIdentityReview(plan, {
    'childhood->boyhood': passDimensions(),
    'boyhood->young-adult': { ...passDimensions(), eyes: 'fail' },
    'young-adult->mature-adult': passDimensions(),
    'mature-adult->elder': passDimensions(),
    'childhood->elder': passDimensions()
  });
  assert.equal(failed.status, 'fail');
  assert.equal(failed.earliestFailedTransition, 'boyhood->young-adult');
});

test('all five comparisons must pass before the same-person probe passes', () => {
  const plan = createAgeIdentityReviewPlan(makeCharacter());
  const results = Object.fromEntries(plan.comparisons.map(comparison => [comparison.id, passDimensions()]));
  const reviewed = evaluateAgeIdentityReview(plan, results);
  assert.equal(reviewed.status, 'pass');
  assert.equal(reviewed.earliestFailedTransition, null);
  assert.ok(reviewed.comparisons.every(comparison => comparison.status === 'pass'));
  assert.equal(reviewed.visualApprovalGranted, false);
  assert.equal(reviewed.productionStageChanged, false);
});
