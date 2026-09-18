import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkpoint, chooseAuthoritativeFork, classifyGuarantees, compatibleFinalizedHistories, CosigningNotary,
  finitePrefixEventualDetection, firstForkEvidence, fixtureIdentity, forkHistories, GossipWitness, gossipRound,
  hostKeySplitCounterexample, irreversibleObservationCounterexample, localRollbackIndistinguishability,
  repairDerivedProjection, verifyHistory, witnessRejectsRollback,
} from '../scripts/reality-accountability-model.mjs';

test('two locally valid signed histories can violate cross-client non-equivocation', () => {
  const { signer, left, right } = forkHistories();
  assert.equal(verifyHistory(left, signer), true);
  assert.equal(verifyHistory(right, signer), true);
  assert.equal(compatibleFinalizedHistories([left, right]), false);
  assert.equal(firstForkEvidence(left, right).type, 'equivocation');
});

test('a single client cannot detect a fork branch it never receives', () => {
  const { signer, left } = forkHistories();
  assert.equal(verifyHistory(left, signer), true);
  assert.equal(compatibleFinalizedHistories([left]), true);
});

test('gossip detects a split only when an edge crosses forked observer groups', () => {
  const { left, right } = forkHistories();
  const histories = { a: left, b: left, c: right, d: right };
  assert.equal(gossipRound(histories, [['a','b'], ['c','d']]).length, 0);
  assert.equal(gossipRound(histories, [['a','b'], ['c','d'], ['b','c']]).length, 1);
});

test('asynchronous witness turns equivocation into signed evidence after observation, not before', () => {
  const { left, right } = forkHistories();
  const witness = new GossipWitness();
  assert.deepEqual(witness.observe(left), { ok: true });
  const result = witness.observe(right);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'equivocation');
  assert.equal(witness.evidence.length, 1);
});

test('an online stateful notary prevents finalizing the second fork but creates an online dependency', () => {
  const { signer, left, right } = forkHistories();
  const notary = new CosigningNotary();
  assert.equal(notary.observeHistory(left, signer).ok, true);
  const rejected = notary.observeHistory(right, signer);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'equivocation');
});

test('full local rollback is locally indistinguishable when history and verifier state roll back together', () => {
  const signer = fixtureIdentity('rollback-host');
  const one = checkpoint({ signer, event: { step: 1 } });
  const two = checkpoint({ signer, previous: one, event: { step: 2 } });
  const three = checkpoint({ signer, previous: two, event: { step: 3 } });
  const history = [one, two, three];
  const witness = new GossipWitness();
  assert.equal(witness.observe(history).ok, true);
  const rolled = localRollbackIndistinguishability({ history, restoredLength: 1 });
  assert.equal(verifyHistory(rolled.restored, signer), true);
  assert.equal(witnessRejectsRollback(witness, rolled.restored), true);
});

test('rolling back the only witness erases rollback evidence as well', () => {
  const signer = fixtureIdentity('all-rollback-host');
  const one = checkpoint({ signer, event: { step: 1 } });
  const two = checkpoint({ signer, previous: one, event: { step: 2 } });
  const full = [one, two], rolled = [one];
  const witness = new GossipWitness();
  witness.observe(full);
  const rolledWitness = new GossipWitness();
  rolledWitness.observe(rolled);
  assert.equal(witnessRejectsRollback(rolledWitness, rolled), false);
});

test('stable host identity binding is necessary for cross-session equivocation attribution', () => {
  const row = hostKeySplitCounterexample();
  assert.equal(row.locallyValid, true);
  assert.equal(row.crossKeyEquivocationProof, null);
});

test('fork detection cannot erase an irreversible observation already exposed', () => {
  const row = irreversibleObservationCounterexample();
  assert.ok(row.proof);
  assert.equal(row.observationErasedByDetection, false);
  assert.notEqual(row.observedBeforeDetection.alice, row.observedBeforeDetection.bob);
});

test('derived projection can self-repair from an anchor but authoritative fork choice remains ambiguous', () => {
  const { left, right } = forkHistories();
  const repaired = repairDerivedProjection({ root: 'corrupt', seq: 99 }, left);
  assert.equal(repaired.status, 'repaired');
  assert.equal(repaired.projection.root, left.at(-1).body.root);
  assert.equal(chooseAuthoritativeFork([left, right]).status, 'ambiguous-fork');
});

test('finite communication prefix cannot establish eventual fork detection', () => {
  const row = finitePrefixEventualDetection([['a','b'],['c','d']], [['b','c']]);
  assert.equal(row.decidableFromPrefix, false);
  assert.ok(row.extensionDetects.length > row.extensionNeverConnects.length);
});

test('assurance placement separates prevention, comparison, continuity, liveness and repair', () => {
  assert.deepEqual(classifyGuarantees(), {
    semanticPrecondition: 'single-trace-safety/prevent-inline',
    nonEquivocation: 'hyperproperty/compare-observers-or-consensus',
    antiRollback: 'state-continuity/requires-nonrollback-anchor',
    eventualDetection: 'liveness/requires-eventual-contact',
    projectionRecovery: 'self-stabilizing-with-retained-anchor',
  });
});

test('a longer malicious fork is not a canonicality proof', async () => {
  const m = await import('../scripts/reality-accountability-model.mjs');
  const { signer, left, right } = m.forkHistories();
  const longer = [...right, m.checkpoint({ signer, previous: right.at(-1), event: { type: 'extra', side: 'right' } })];
  const result = m.longestForkIsNotAuthority(left, longer);
  assert.equal(result.chosen.length, 3);
  assert.equal(result.safeToChoose, false);
});

test('one-round gossip topology is exhaustively classified for a four-client two-fork model', async () => {
  const m = await import('../scripts/reality-accountability-model.mjs');
  const { left, right } = m.forkHistories();
  const row = m.enumerateOneRoundGossipGraphs({ a:left, b:left, c:right, d:right });
  assert.deepEqual(row, { nodes:['a','b','c','d'], edgeCount:6, graphs:64, detect:60, silent:4 });
});

test('session-local monotonic checks disappear on restart unless an anchor survives', async () => {
  const m = await import('../scripts/reality-accountability-model.mjs');
  const signer = m.fixtureIdentity('session-reset-host');
  const one = m.checkpoint({ signer, event:{n:1} });
  const two = m.checkpoint({ signer, previous:one, event:{n:2} });
  const current = [one,two], old=[one];
  const monitor = new m.SessionOnlyMonitor();
  assert.equal(monitor.observe(current).ok, true);
  assert.equal(monitor.observe(old).reason, 'rollback');
  const restarted = new m.SessionOnlyMonitor();
  assert.equal(restarted.observe(old).ok, true);
});
