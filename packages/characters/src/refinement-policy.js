export const CHARACTER_REFINEMENT_POLICY_VERSION = 1;
export const CHARACTER_REFINEMENT_MAX_ROUNDS = 3;

export const CHARACTER_REFINEMENT_VIEWS = Object.freeze([
  'front',
  'three-quarter',
  'side',
  'back'
]);

export const CHARACTER_REFINEMENT_CHECKS = Object.freeze([
  Object.freeze({ id: 'silhouette-proportion', label: 'シルエット・体格', target: 'whole-character' }),
  Object.freeze({ id: 'side-profile', label: '横姿・前後厚み', target: 'head-torso-pelvis' }),
  Object.freeze({ id: 'joint-readability', label: '肩・肘・手首', target: 'arms-joints' }),
  Object.freeze({ id: 'hands', label: '手・指の読みやすさ', target: 'hands' }),
  Object.freeze({ id: 'hair-consistency', label: '髪の前後整合', target: 'hair' }),
  Object.freeze({ id: 'back-view-identity', label: '背面の固有性', target: 'back-silhouette' })
]);

const CHECK_IDS = Object.freeze(CHARACTER_REFINEMENT_CHECKS.map(check => check.id));
const CHECK_STATUSES = new Set(['pending', 'pass', 'fail']);

export const CHARACTER_REFINEMENT_POLICY = Object.freeze({
  version: CHARACTER_REFINEMENT_POLICY_VERSION,
  basePolicy: 'reuse-compatible-reviewed-source',
  reviewViews: CHARACTER_REFINEMENT_VIEWS,
  checks: CHECK_IDS,
  maxRounds: CHARACTER_REFINEMENT_MAX_ROUNDS,
  repairMode: 'failed-regions-only',
  preservePassedRegions: true,
  externalReferencePolicy: 'unresolved-part-only-with-provenance-license',
  wholeModelReplacement: 'fallback-only',
  visualApproval: 'human-required'
});

function assert(condition, message) {
  if (!condition) throw new Error(`Character refinement policy: ${message}`);
}

function sameList(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && expected.every((value, index) => actual[index] === value);
}

export function validateCharacterRefinementPolicy(policy) {
  assert(policy && typeof policy === 'object' && !Array.isArray(policy), 'policy must be an object');
  assert(policy.version === CHARACTER_REFINEMENT_POLICY_VERSION, 'unsupported version');
  assert(policy.basePolicy === 'reuse-compatible-reviewed-source', 'base source must be reused when compatible');
  assert(sameList(policy.reviewViews, CHARACTER_REFINEMENT_VIEWS), 'fixed review views changed');
  assert(sameList(policy.checks, CHECK_IDS), 'structural checklist changed');
  assert(policy.maxRounds === CHARACTER_REFINEMENT_MAX_ROUNDS, 'maxRounds must remain 3');
  assert(policy.repairMode === 'failed-regions-only', 'repairs must stay local to failed regions');
  assert(policy.preservePassedRegions === true, 'passed regions must be preserved');
  assert(policy.externalReferencePolicy === 'unresolved-part-only-with-provenance-license', 'external references must be scoped and licensed');
  assert(policy.wholeModelReplacement === 'fallback-only', 'whole-model replacement must stay a fallback');
  assert(policy.visualApproval === 'human-required', 'automation cannot grant visual approval');
  return policy;
}

export function createCharacterRefinementPolicy() {
  return JSON.parse(JSON.stringify(CHARACTER_REFINEMENT_POLICY));
}

export function createCharacterRefinementRound(round = 1, results = {}) {
  assert(Number.isInteger(round) && round >= 1 && round <= CHARACTER_REFINEMENT_MAX_ROUNDS, 'round must be between 1 and 3');
  assert(results && typeof results === 'object' && !Array.isArray(results), 'results must be an object');
  const unknown = Object.keys(results).filter(id => !CHECK_IDS.includes(id));
  assert(unknown.length === 0, `unknown checks: ${unknown.join(', ')}`);

  const checks = CHARACTER_REFINEMENT_CHECKS.map(check => {
    const status = results[check.id] ?? 'pending';
    assert(CHECK_STATUSES.has(status), `${check.id} has invalid status ${status}`);
    return Object.freeze({ ...check, status });
  });
  const failed = checks.filter(check => check.status === 'fail').map(check => check.id);
  const passed = checks.filter(check => check.status === 'pass').map(check => check.id);
  const pending = checks.filter(check => check.status === 'pending').map(check => check.id);
  const state = failed.length
    ? (round === CHARACTER_REFINEMENT_MAX_ROUNDS ? 'escalate' : 'repair')
    : pending.length ? 'review' : 'pass';

  return Object.freeze({
    round,
    maxRounds: CHARACTER_REFINEMENT_MAX_ROUNDS,
    state,
    checks: Object.freeze(checks),
    failedChecks: Object.freeze(failed),
    preserveChecks: Object.freeze(passed),
    pendingChecks: Object.freeze(pending),
    repairMode: 'failed-regions-only',
    externalReference: state === 'escalate' ? 'unresolved-failed-parts-only' : 'not-needed',
    visualApproval: 'unchanged'
  });
}
