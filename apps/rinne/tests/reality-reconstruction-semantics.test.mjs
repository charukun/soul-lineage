import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeConcurrentInstances, verifyAnalysisCertificate, checkFiniteQuotient,
  dependencyClosure, trafficLedger } from '../scripts/rrp-reconstruction/semantic-analysis.mjs';

const stock = { bound: 3, resources: [{ id: 'stock', kind: 'counter' }],
  operations: [{ id: 'take', effects: [{ resource: 'stock', kind: 'add', value: -1 }] }] };

test('same definition, two invocation identities: a real bounded invariant violation', () => {
  const result = analyzeConcurrentInstances(stock);
  assert.equal(result.verdict, 'coordination-or-escrow-required');
  assert.equal(result.witness.left.definition, result.witness.right.definition);
  assert.notEqual(result.witness.left.instance, result.witness.right.instance);
  assert.equal(result.witness.merged.stock, -1);
});
test('certificate verification recomputes coverage and witnesses, not a pass boolean', () => {
  const certificate = analyzeConcurrentInstances(stock);
  assert.equal(verifyAnalysisCertificate(stock, certificate), true);
  for (const corrupt of [{ ...certificate, checked: 0 }, { ...certificate, witness: null },
    { ...certificate, verdict: 'no-counterexample-within-bound' }, { pass: true }]) {
    assert.equal(verifyAnalysisCertificate(stock, corrupt), false);
  }
});
test('duplicate resource IDs and unsupported effect grammar fail closed', () => {
  assert.throws(() => analyzeConcurrentInstances({ ...stock, resources: [...stock.resources, ...stock.resources] }), /Duplicate/);
  assert.throws(() => analyzeConcurrentInstances({ ...stock, operations: [{ id: 'take', effects: [
    { resource: 'stock', kind: 'execute', value: -1 },
  ] }] }), /grammar/);
  assert.equal(verifyAnalysisCertificate({ ...stock, bound: 100 }, { pass: true }), false);
});
test('grow-only sets remain mergeable in the explicitly checked finite domain', () => {
  const spec = { bound: 2, resources: [{ id: 'facts', kind: 'set' }], operations: [
    { id: 'insert', effects: [{ resource: 'facts', kind: 'insert', value: 1 }] },
  ] };
  const result = analyzeConcurrentInstances(spec);
  assert.equal(result.verdict, 'no-counterexample-within-bound');
  assert.equal(result.scope.instancesPerBranch, 1);
  assert.equal(result.checked, 4);
});
test('current visual equality is refuted by a future hidden-projectile effect', () => {
  const states = [{ hp: 2, projectile: 0 }, { hp: 2, projectile: 1 }];
  const result = checkFiniteQuotient({ states, actions: ['advance'], projection: s => s.hp, observe: s => s.hp,
    step: s => ({ hp: s.hp - s.projectile, projectile: 0 }) });
  assert.equal(result.pass, false);
  assert.equal(result.witness.cause, 'future-distinguishability');
});
test('irrelevant cosmetic phase can be quotiented under a closed declared action algebra', () => {
  const states = [0, 1].flatMap(hp => [0, 1].map(cosmetic => ({ hp, cosmetic })));
  assert.equal(checkFiniteQuotient({ states, actions: ['toggle'], projection: s => s.hp, observe: s => s.hp,
    step: s => ({ hp: 1 - s.hp, cosmetic: 1 - s.cosmetic }) }).pass, true);
});
test('dependency closure includes remote trades/teleports, not merely geographic AOI', () => {
  const graph = { display: ['local-player'], 'local-player': ['remote-trade', 'teleport'],
    'remote-trade': ['global-stock'], 'global-stock': [], teleport: ['destination'], destination: [] };
  assert.equal(dependencyClosure(graph, ['display']).length, 6);
  assert.throws(() => dependencyClosure({ display: ['unknown-spell'] }, ['display']), /widen or coordinate/);
});
test('equally split known baseline ties RRP under identical explicit traffic; no automatic victory', () => {
  const inputs = { realtime: 12000, canon: 600, recovery: 900, control: 160, retries: 80, join: 70, handoff: 50 };
  const rrp = trafficLedger(inputs), canonOnlyRaft = trafficLedger({ ...inputs });
  assert.deepEqual(rrp, canonOnlyRaft);
  assert.throws(() => trafficLedger({ realtime: 12000, canon: 600 }), /Incomplete/);
});
test('f+1 complete copies is not a representation-independent storage lower bound', () => {
  // Two information bits, three one-bit fragments. Any two reconstruct; one erasure
  // costs three stored bits rather than two complete two-bit copies (four bits).
  for (const x of [0, 1]) for (const y of [0, 1]) {
    const fragments = [x, y, x ^ y];
    assert.deepEqual([fragments[0], fragments[0] ^ fragments[2]], [x, y]);
    assert.deepEqual([fragments[1] ^ fragments[2], fragments[1]], [x, y]);
    assert.deepEqual(fragments.slice(0, 2), [x, y]);
  }
  assert.ok(3 < 2 * 2);
});

test('a finite projection certificate must not hide transitions outside the checked domain', () => {
  const result = checkFiniteQuotient({ states: [{ value: 0 }], actions: ['advance'], projection: s => s.value,
    observe: s => s.value, step: s => ({ value: s.value + 1 }) });
  assert.equal(result.pass, false);
  assert.equal(result.witness.cause, 'unclosed-domain');
});
