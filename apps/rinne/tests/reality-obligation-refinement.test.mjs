import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Verdict,
  ambientAuthorityCounterexample,
  annotationMismatchCounterexample,
  attenuateEffects,
  branchSensitiveRule,
  completeMediationCounterexample,
  compilePolicyDsl,
  incompleteManifestCounterexample,
  effectNameScopeCounterexample,
  ioPrimitiveSemanticGapCounterexample,
  interpretPolicyDsl,
  mutationNames,
  nestedHookCounterexample,
  oracleFreshnessCounterexample,
  policyRollbackCounterexample,
  policyArtifactRoot,
  policyRegistryV2,
  runMutation,
  semanticRootCoverageCounterexample,
  stalePermitCounterexample,
  traceCompletenessCounterexample,
  traceDependencies,
  scopedRightAllows,
  translationValidationCounterexample,
  validateTranslation,
  verifySinkOwnedPolicy,
} from '../scripts/reality-obligation-refinement-model.mjs';

test('runtime tracing observes only executed dependencies', () => {
  const observed = traceDependencies(branchSensitiveRule, [{ level: 1, stock: 1, curse: true }]);
  assert.deepEqual(observed, ['level', 'stock']);
});

test('an untraced branch can contain a safety dependency', () => {
  const witness = traceCompletenessCounterexample();
  assert.equal(witness.missing, true);
  assert.equal(witness.trueDecision, false);
});

test('manual effect annotation can underdeclare actual effects', () => {
  const witness = annotationMismatchCounterexample();
  assert.deepEqual(witness.undeclared, ['lineage.append']);
});

test('caller-defined manifest can authorize while sink-owned policy denies', () => {
  const witness = incompleteManifestCounterexample();
  assert.equal(witness.unsafeCallerVerdict.verdict, Verdict.ALLOW);
  assert.equal(witness.safeSinkVerdict.verdict, Verdict.DENY);
});

test('missing sink evidence escalates rather than silently authorizing', () => {
  const result = verifySinkOwnedPolicy({
    effect: 'inventory.claim',
    evidence: { stock: 1 },
    oracleProofs: { ownership: { epoch: 7, fresh: true } },
    policyRoot: policyArtifactRoot(policyRegistryV2),
  });
  assert.equal(result.verdict, Verdict.ESCALATE);
  assert.match(result.reason, /^missing-evidence:/);
});

test('explicitly false sink predicate denies', () => {
  const result = verifySinkOwnedPolicy({
    effect: 'inventory.claim',
    evidence: { stock: 1, curse: true },
    oracleProofs: { ownership: { epoch: 7, fresh: true } },
    policyRoot: policyArtifactRoot(policyRegistryV2),
  });
  assert.equal(result.verdict, Verdict.DENY);
});

test('fresh authoritative oracle can discharge an external fact', () => {
  const witness = oracleFreshnessCounterexample();
  assert.equal(witness.missing.verdict, Verdict.ESCALATE);
  assert.equal(witness.stale.verdict, Verdict.ESCALATE);
  assert.equal(witness.fresh.verdict, Verdict.ALLOW);
});

test('child effect capabilities can only attenuate', () => {
  assert.deepEqual(attenuateEffects(['inventory.claim'], ['inventory.claim', 'lineage.append']), ['inventory.claim']);
});

test('nested hook cannot amplify authority through a safe gateway', () => {
  const witness = nestedHookCounterexample();
  assert.equal(witness.claim.verdict, Verdict.ALLOW);
  assert.equal(witness.hook.verdict, Verdict.DENY);
  assert.deepEqual(witness.events, ['inventory.claim']);
});

test('caller source root does not track sink policy evolution', () => {
  const witness = semanticRootCoverageCounterexample();
  assert.equal(witness.callerRootBefore, witness.callerRootAfter);
  assert.notEqual(witness.policyRootBefore, witness.policyRootAfter);
});

test('safe protected sink does not expose a raw bypass', () => {
  const witness = completeMediationCounterexample();
  assert.equal(witness.safeRawExposed, false);
  assert.equal(witness.unsafeRawExposed, true);
});

test('restricted policy DSL compiler preserves a correct translation on bounded worlds', () => {
  const source = { all: [{ gt: { field: 'stock', value: 0 } }, { eq: { field: 'curse', value: false } }] };
  const target = compilePolicyDsl(source);
  const worlds = [{ stock: 0, curse: false }, { stock: 1, curse: false }, { stock: 1, curse: true }];
  assert.equal(validateTranslation(source, target, worlds).valid, true);
});

test('translation validation catches a dropped policy conjunct', () => {
  const witness = translationValidationCounterexample();
  assert.equal(witness.validation.valid, false);
  assert.equal(witness.validation.mismatches.length, 1);
  assert.deepEqual(witness.validation.mismatches[0].world, { stock: 1, curse: true });
});

test('policy DSL interpreter distinguishes safe and unsafe worlds', () => {
  const policy = { all: [{ gt: { field: 'stock', value: 0 } }, { eq: { field: 'curse', value: false } }] };
  assert.equal(interpretPolicyDsl(policy, { stock: 1, curse: false }), true);
  assert.equal(interpretPolicyDsl(policy, { stock: 1, curse: true }), false);
});

test('effect-name equality is too coarse for parameter-bound authority', () => {
  const witness = effectNameScopeCounterexample();
  assert.equal(witness.nameOnlyAllows, true);
  assert.equal(witness.scopedAllows, false);
  assert.equal(scopedRightAllows(witness.parent, 'life.rebirth', { playerId: 'p1', lifeId: 'p1:2' }), true);
});

test('a valid old policy root is not evidence that the policy is current', () => {
  const witness = policyRollbackCounterexample();
  assert.equal(witness.oldPolicyVerdict.verdict, Verdict.ALLOW);
  assert.equal(witness.newPolicyVerdict.verdict, Verdict.DENY);
  assert.equal(witness.generationFence.verdict, Verdict.DENY);
});

test('prepared authorization must be fenced against state changes before commit', () => {
  const witness = stalePermitCounterexample();
  assert.equal(witness.naiveCommitted, true);
  assert.equal(witness.safeCommitted, false);
  assert.equal(witness.naiveState.stock, 0);
});

test('low-level IO primitive cannot by itself classify semantic irreversibility', () => {
  const witness = ioPrimitiveSemanticGapCounterexample();
  assert.equal(witness.samePrimitive, true);
  assert.equal(witness.differentProtection, true);
});

test('a hidden wrapper is not a security boundary while ambient raw authority still exists', () => {
  const witness = ambientAuthorityCounterexample();
  assert.equal(witness.wrapperExposesAmbientWrite, false);
  assert.equal(witness.ambientBypassSucceeded, true);
});

test('all invariant-sensitive mutations retain a concrete failure witness', () => {
  for (const name of mutationNames) {
    assert.equal(runMutation(name), true, `${name} should produce a counterexample`);
  }
});
