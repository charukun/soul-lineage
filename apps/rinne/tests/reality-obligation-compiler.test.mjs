import test from 'node:test';
import assert from 'node:assert/strict';
import {
  minimumEvidenceFields, setCoverAsEvidence, oneWayEqualityLowerBound,
  negativeFactFromSilence, createRegistryAuthority, verifyAbsenceProof, staleAbsenceFreshnessCounterexample,
  createCapabilityIssuer, createCapabilitySink, leaseDecision,
  createDomain, joinCommitCertificate, createRuleAuthority, verifyObligation,
  signedIncompleteManifestCounterexample, completeManifestRepair, staleRuleReplay,
  sagaIrreversibilityWitness,
} from '../scripts/reality-obligation-compiler-model.mjs';

const mutation = process.env.RRP_MUTATION ?? 'none';
const invariant = (condition, message) => assert.equal(condition, true, `INVARIANT: ${message}`);

test('minimum decision evidence is a set-cover instance, not a free optimization', () => {
  const result = setCoverAsEvidence(['u0','u1','u2'], [
    ['u0','u1'], ['u1','u2'], ['u0'], ['u2'],
  ]);
  assert.equal(result.width, 2);
  invariant(result.selectedSets.length === 2, 'minimum evidence cover changed');
  const worlds = [
    { stock: 1, generation: 1, weather: 0, safe: true },
    { stock: 0, generation: 1, weather: 0, safe: false },
    { stock: 1, generation: 2, weather: 0, safe: false },
  ];
  const evidence = minimumEvidenceFields(worlds, ['stock','generation','weather'], w => w.safe);
  assert.deepEqual(evidence.fields, ['stock','generation']);
});

test('exact deterministic one-way equality can require the entire n-bit remote value', () => {
  for (let n = 1; n <= 8; n++) {
    for (let k = 0; k < n; k++) invariant(!oneWayEqualityLowerBound({ inputBits: n, summaryBits: k }).exactPossible, 'compressed exact equality falsely possible');
    assert.equal(oneWayEqualityLowerBound({ inputBits: n, summaryBits: n }).exactPossible, true);
  }
});

test('silence cannot prove a global negative fact in an asynchronous network', () => {
  const result = negativeFactFromSilence({ mutation });
  invariant(result.safe, 'silence was treated as proof of global absence');
});

test('an authenticated complete registry snapshot can turn absence into local evidence', () => {
  const authority = createRegistryAuthority();
  const snap = authority.snapshot();
  assert.equal(verifyAbsenceProof(snap, 'unique:sword', authority, snap.body.epoch), true);
  const claimed = authority.claim('unique:sword');
  assert.equal(verifyAbsenceProof(snap, 'unique:sword', authority, claimed.body.epoch), false);
  assert.equal(verifyAbsenceProof(claimed, 'unique:sword', authority, claimed.body.epoch), false);
});

test('authentic absence proof can become stale without freshness evidence', () => {
  const witness = staleAbsenceFreshnessCounterexample();
  assert.equal(witness.pass, true);
  assert.ok(witness.newEpoch > witness.oldEpoch);
});

test('attenuated bearer capability still needs durable replay protection at the effect sink', () => {
  const issuer = createCapabilityIssuer();
  const root = issuer.issue({ id: 'cap:1', resource: 'unique:sword', holder: 'alice', nonce: 'nonce:1' });
  const token = issuer.attenuate(issuer.attenuate(root, { kind: 'holder', value: 'alice' }), { kind: 'maxAmount', value: 1 });
  const sink = createCapabilitySink({ issuer, mutation });
  const first = sink.consume(token, { holder: 'alice', amount: 1 });
  const second = sink.consume(token, { holder: 'alice', amount: 1 });
  invariant(first.ok && !second.ok, 'copyable bearer token was mistaken for a linear consumable right');
});

test('capability revocation is enforced by learned issuer generation, not by token authenticity alone', () => {
  const issuer = createCapabilityIssuer();
  const token = issuer.issue({ id: 'cap:rev', resource: 'gate', holder: 'alice', nonce: 'nonce:rev' });
  const sink = createCapabilitySink({ issuer, mutation });
  const newEpoch = issuer.revokeAll();
  sink.learnEpoch(newEpoch);
  const result = sink.consume(token, { holder: 'alice', amount: 1 });
  invariant(!result.ok, 'revoked but authentic credential remained usable');
});

test('time bounded authority without a clock relation remains unknown; bounded skew creates a fail-closed window', () => {
  assert.equal(leaseDecision({ localClock: 100, expiry: 90 }).decision, 'unknown');
  assert.equal(leaseDecision({ localClock: 80, expiry: 100, maxClockError: 5 }).decision, 'definitely-valid');
  assert.equal(leaseDecision({ localClock: 98, expiry: 100, maxClockError: 5 }).decision, 'uncertain');
  assert.equal(leaseDecision({ localClock: 106, expiry: 100, maxClockError: 5 }).decision, 'definitely-expired');
});

test('independent domain prepares are not an atomic irreversible commit', () => {
  const a = createDomain('inventory'), b = createDomain('lineage');
  const ra = a.prepare('tx:1', -1), rb = b.prepare('tx:1', +1);
  const cert = joinCommitCertificate('tx:1', [ra, rb], [a, b]);
  assert.ok(cert);
  const left = a.apply(cert, mutation);
  const right = b.apply(cert, mutation);
  invariant(left.ok && right.ok && a.snapshot().value === -1 && b.snapshot().value === 1, 'joint certificate did not atomically authorize both local effects');
});

test('one-domain partial certificate cannot authorize a cross-domain irreversible action', () => {
  const a = createDomain('inventory'), b = createDomain('lineage');
  const ra = a.prepare('tx:partial', -1);
  const fake = { txid: 'tx:partial', atomic: false, receipts: [ra] };
  const result = a.apply(fake, mutation);
  invariant(!result.ok && a.snapshot().value === 0 && b.snapshot().value === 0, 'local prepare was promoted to global commit');
});

test('prepared-version validation prevents stale independently valid capsules from composing', () => {
  const a = createDomain('inventory'), b = createDomain('lineage');
  const ra = a.prepare('tx:stale', -1), rb = b.prepare('tx:stale', +1);
  a.mutate(+5);
  const cert = joinCommitCertificate('tx:stale', [ra, rb], [a, b]);
  assert.ok(cert);
  invariant(!a.apply(cert, mutation).ok, 'stale read/preparation version composed after intervening write');
});

test('signed proof object does not prove that the policy/effect manifest is complete', () => {
  const counterexample = signedIncompleteManifestCounterexample();
  assert.equal(counterexample.pass, true);
  assert.equal(completeManifestRepair().pass, true);
});

test('rule-version root fences stale proof capsules after semantics evolve', () => {
  const replay = staleRuleReplay(mutation);
  invariant(!replay.ok, 'old proof capsule survived a rule-root change');
});

test('signature checking alone cannot replace predicate/dependency checking', () => {
  const authority = createRuleAuthority();
  const signed = authority.signManifest({ action: 'claim', requires: [
    { field: 'stock', op: 'gt', value: 0 }, { field: 'curse', op: 'eq', value: false },
  ] });
  const result = verifyObligation({ signedManifest: signed, evidence: { stock: 1 }, authority, mutation });
  invariant(!result.ok, 'authentic partial evidence was treated as a complete proof');
});

test('saga compensation is not equivalent to erasing an already observed irreversible effect', () => {
  const witness = sagaIrreversibilityWitness();
  assert.equal(witness.compensatedBusinessState, true);
  invariant(!witness.atomicHistoryRestored, 'compensation was misclassified as historical atomicity');
});

test('issuer-side revocation is not instantaneous at an offline or lagging effect sink', () => {
  const issuer = createCapabilityIssuer();
  const token = issuer.issue({ id: 'cap:lag', resource: 'gate', holder: 'alice', nonce: 'nonce:lag' });
  const sink = createCapabilitySink({ issuer });
  issuer.revokeAll();
  const staleLocalDecision = sink.consume(token, { holder: 'alice', amount: 1 });
  assert.equal(staleLocalDecision.ok, true);
  assert.equal(sink.snapshot().knownEpoch, 1);
});

test('a joint commit certificate is a decision, not instantaneous multi-domain visibility', () => {
  const a = createDomain('inventory'), b = createDomain('lineage');
  const ra = a.prepare('tx:visible-gap', -1), rb = b.prepare('tx:visible-gap', +1);
  const cert = joinCommitCertificate('tx:visible-gap', [ra, rb], [a, b]);
  assert.ok(cert);
  assert.equal(a.apply(cert).ok, true);
  // B has the same globally valid decision but has not applied it yet.
  assert.equal(a.snapshot().value, -1);
  assert.equal(b.snapshot().value, 0);
  assert.notEqual(a.snapshot().value + b.snapshot().value, 0);
});
