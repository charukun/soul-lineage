import {
  YEAR_MS,
  appearanceForCharacter,
  characterData,
  deepFreeze,
  invariant,
  validateCharacter
} from './master-character.js';

export const AGE_IDENTITY_REVIEW_VERSION = 1;

export const AGE_IDENTITY_REVIEW_STAGES = deepFreeze([
  { id: 'childhood', label: '幼少', years: 4 },
  { id: 'boyhood', label: '少年', years: 12 },
  { id: 'young-adult', label: '青年', years: 22 },
  { id: 'mature-adult', label: '壮年', years: 50 },
  { id: 'elder', label: '老年', years: 75 }
]);

export const AGE_IDENTITY_REVIEW_DIMENSIONS = deepFreeze([
  'face-structure',
  'eyes',
  'nose-mouth',
  'hair-lineage',
  'body-lineage',
  'age-readability',
  'overall-same-person'
]);

export const AGE_IDENTITY_REVIEW_VIEWS = deepFreeze([
  'front',
  'three-quarter-front',
  'side',
  'back',
  'face-close-up'
]);

const REVIEW_STATUSES = new Set(['pending', 'pass', 'fail']);
const ARTIFACT_FORMATS = new Set(['vrm', 'glb', 'gltf']);
const SHA256 = /^[a-f0-9]{64}$/i;

const clone = value => JSON.parse(JSON.stringify(value));

function identityData(character) {
  validateCharacter(character);
  return {
    id: character.id,
    masterId: character.masterId,
    seed: character.seed,
    parents: [...character.parents],
    genome: Object.fromEntries(Object.entries(character.genome).map(([gene, alleles]) => [gene, [...alleles]]))
  };
}

export function ageIdentitySignature(character) {
  return JSON.stringify(identityData(character));
}

export function createAgeIdentitySnapshots(character) {
  validateCharacter(character);
  const signature = ageIdentitySignature(character);
  const snapshots = AGE_IDENTITY_REVIEW_STAGES.map(stage => {
    const snapshot = characterData(character);
    snapshot.ageMs = stage.years * YEAR_MS;
    snapshot.lifeState = 'alive';
    validateCharacter(snapshot);
    invariant(ageIdentitySignature(snapshot) === signature, `Identity drift at ${stage.id}`);
    return {
      stageId: stage.id,
      label: stage.label,
      years: stage.years,
      character: snapshot,
      appearance: appearanceForCharacter(snapshot)
    };
  });
  return deepFreeze(snapshots);
}

export function ageIdentityComparisonPairs() {
  const adjacent = AGE_IDENTITY_REVIEW_STAGES.slice(0, -1).map((stage, index) => ({
    id: `${stage.id}->${AGE_IDENTITY_REVIEW_STAGES[index + 1].id}`,
    from: stage.id,
    to: AGE_IDENTITY_REVIEW_STAGES[index + 1].id,
    span: 'adjacent'
  }));
  return deepFreeze([
    ...adjacent,
    { id: 'childhood->elder', from: 'childhood', to: 'elder', span: 'full-life' }
  ]);
}

export function createAgeIdentityReviewPlan(character) {
  validateCharacter(character);
  const snapshots = createAgeIdentitySnapshots(character);
  return deepFreeze({
    version: AGE_IDENTITY_REVIEW_VERSION,
    kind: 'age-identity-review-plan',
    id: `age-identity.${character.id}`,
    characterId: character.id,
    identity: identityData(character),
    identitySignature: ageIdentitySignature(character),
    reviewOnly: true,
    snapshots,
    views: [...AGE_IDENTITY_REVIEW_VIEWS],
    dimensions: [...AGE_IDENTITY_REVIEW_DIMENSIONS],
    comparisons: ageIdentityComparisonPairs(),
    constraints: {
      neutralPresentation: true,
      preserveCanonicalCharacterSchema: true,
      productionStageUnaffected: true,
      visualApprovalUnaffected: true
    }
  });
}

function validateArtifact(artifact, stageIds) {
  invariant(artifact && typeof artifact === 'object' && !Array.isArray(artifact), 'Invalid age identity artifact');
  invariant(stageIds.has(artifact.stageId), `Unknown age identity stage: ${artifact.stageId}`);
  invariant(typeof artifact.path === 'string' && artifact.path.length > 0 && artifact.path.length <= 1024, 'Invalid age identity artifact path');
  invariant(typeof artifact.format === 'string' && ARTIFACT_FORMATS.has(artifact.format.toLowerCase()), 'Invalid age identity artifact format');
  invariant(typeof artifact.sha256 === 'string' && SHA256.test(artifact.sha256), 'Invalid age identity artifact sha256');
  if (artifact.provider != null) invariant(typeof artifact.provider === 'string' && artifact.provider.trim().length > 0, 'Invalid age identity artifact provider');
  return {
    stageId: artifact.stageId,
    path: artifact.path,
    format: artifact.format.toLowerCase(),
    sha256: artifact.sha256.toLowerCase(),
    provider: artifact.provider?.trim() || 'unassigned'
  };
}

export function createAgeIdentityCandidateSet(plan, artifacts) {
  invariant(plan?.version === AGE_IDENTITY_REVIEW_VERSION && plan?.kind === 'age-identity-review-plan', 'Invalid age identity review plan');
  invariant(Array.isArray(artifacts), 'Age identity artifacts must be an array');
  const stageIds = new Set(AGE_IDENTITY_REVIEW_STAGES.map(stage => stage.id));
  const normalized = artifacts.map(artifact => validateArtifact(artifact, stageIds));
  invariant(normalized.length === AGE_IDENTITY_REVIEW_STAGES.length, 'Age identity candidate set requires exactly five artifacts');
  invariant(new Set(normalized.map(artifact => artifact.stageId)).size === AGE_IDENTITY_REVIEW_STAGES.length, 'Age identity candidate set requires one artifact per stage');
  const byStage = new Map(normalized.map(artifact => [artifact.stageId, artifact]));
  const ordered = AGE_IDENTITY_REVIEW_STAGES.map(stage => byStage.get(stage.id));
  invariant(ordered.every(Boolean), 'Age identity candidate set is incomplete');
  return deepFreeze({
    version: AGE_IDENTITY_REVIEW_VERSION,
    kind: 'age-identity-candidate-set',
    id: `age-identity-candidates.${plan.characterId}`,
    planId: plan.id,
    characterId: plan.characterId,
    identitySignature: plan.identitySignature,
    artifacts: ordered
  });
}

function normalizeComparisonResult(comparison, input = {}) {
  invariant(input && typeof input === 'object' && !Array.isArray(input), `Invalid result for ${comparison.id}`);
  const unknown = Object.keys(input).filter(key => !AGE_IDENTITY_REVIEW_DIMENSIONS.includes(key));
  invariant(unknown.length === 0, `Unknown age identity review dimension: ${unknown[0]}`);
  const dimensions = {};
  for (const dimension of AGE_IDENTITY_REVIEW_DIMENSIONS) {
    const status = input[dimension] ?? 'pending';
    invariant(REVIEW_STATUSES.has(status), `Invalid ${dimension} status for ${comparison.id}`);
    dimensions[dimension] = status;
  }
  const values = Object.values(dimensions);
  return {
    comparisonId: comparison.id,
    from: comparison.from,
    to: comparison.to,
    span: comparison.span,
    dimensions,
    status: values.includes('fail') ? 'fail' : values.every(value => value === 'pass') ? 'pass' : 'pending'
  };
}

export function evaluateAgeIdentityReview(plan, results = {}) {
  invariant(plan?.version === AGE_IDENTITY_REVIEW_VERSION && plan?.kind === 'age-identity-review-plan', 'Invalid age identity review plan');
  invariant(results && typeof results === 'object' && !Array.isArray(results), 'Invalid age identity review results');
  const ids = new Set(plan.comparisons.map(comparison => comparison.id));
  const unknown = Object.keys(results).filter(id => !ids.has(id));
  invariant(unknown.length === 0, `Unknown age identity comparison: ${unknown[0]}`);
  const comparisons = plan.comparisons.map(comparison => normalizeComparisonResult(comparison, results[comparison.id]));
  const failed = comparisons.find(comparison => comparison.status === 'fail');
  const status = failed ? 'fail' : comparisons.every(comparison => comparison.status === 'pass') ? 'pass' : 'pending';
  return deepFreeze({
    version: AGE_IDENTITY_REVIEW_VERSION,
    kind: 'age-identity-review-result',
    planId: plan.id,
    characterId: plan.characterId,
    identitySignature: plan.identitySignature,
    status,
    earliestFailedTransition: failed?.comparisonId ?? null,
    comparisons: clone(comparisons),
    productionStageChanged: false,
    visualApprovalGranted: false
  });
}
