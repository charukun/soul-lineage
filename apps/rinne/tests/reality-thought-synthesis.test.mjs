import test from 'node:test';
import assert from 'node:assert/strict';
import {
  possibleWorlds, knows, refineKnowledge, mayPerform,
  causalEnvelope, syncRequiredForRegion,
  pairwiseProjectionConsistent, naturalJoin, localToGlobalConsistent,
  quotaSeparation, transferQuota, checkContracts,
  binaryRateDistortion, intervalAbstraction, intervalContainsAll, intervalProvesAtLeast, alphaAcyclic,
  knowsAt, commonKnowledgeAt, minimalEvidenceForDecision, evidenceDeterminesDecision,
} from '../scripts/reality-thought-synthesis-model.mjs';

const mutation = process.env.RRP_THOUGHT_MUTATION ?? 'none';

test('knowledge of a necessary precondition means all locally possible worlds satisfy it', () => {
  const states = [
    { rendered: 'same', stock: 0 },
    { rendered: 'same', stock: 1 },
  ];
  const possibilities = possibleWorlds(states, state => state.rendered, 'same');
  assert.equal(knows(possibilities, state => state.stock >= 1), false);
  assert.equal(mayPerform({ possibilities, precondition: state => state.stock >= 1, mutation }), false,
    'INVARIANT: an existentially-safe world cannot justify an irreversible action');
  const refined = refineKnowledge(possibilities, state => state.stock === 1);
  assert.equal(refined.monotone, true);
  assert.equal(refined.after, 1);
  assert.equal(mayPerform({ possibilities: refined.possibilities, precondition: state => state.stock >= 1 }), true);
});

test('current visual equality does not imply future observational equivalence', () => {
  const worlds = [
    { rendered: { hp: 2 }, projectile: 0 },
    { rendered: { hp: 2 }, projectile: 1 },
  ];
  assert.deepEqual(worlds[0].rendered, worlds[1].rendered);
  const advance = world => ({ rendered: { hp: world.rendered.hp - world.projectile }, projectile: 0 });
  assert.notDeepEqual(advance(worlds[0]).rendered, advance(worlds[1]).rendered);
});

test('bounded causal envelope can omit a remote detail only while it cannot reach the protected region', () => {
  const far = syncRequiredForRegion({ minPosition: 100, maxSpeed: 5, maxAcceleration: 2, horizonSeconds: 1 }, { min: 0, max: 10 });
  assert.equal(far.required, false);
  const near = syncRequiredForRegion({ minPosition: 15, maxSpeed: 5, maxAcceleration: 2, horizonSeconds: 1 }, { min: 0, max: 10 });
  assert.equal(near.required, true);
  const teleport = causalEnvelope({ minPosition: 100, maxSpeed: 0, horizonSeconds: 1, teleport: true });
  assert.equal(teleport.bounded, false);
});

test('pairwise-compatible local relations can still have no global world', () => {
  const relations = [
    { vars: ['A', 'B'], tuples: [[0, 0], [1, 1]] },
    { vars: ['B', 'C'], tuples: [[0, 0], [1, 1]] },
    { vars: ['A', 'C'], tuples: [[0, 1], [1, 0]] },
  ];
  assert.equal(pairwiseProjectionConsistent(relations), true);
  assert.deepEqual(naturalJoin(relations), [], 'INVARIANT: local/pairwise consistency is not composition safety');
  assert.equal(localToGlobalConsistent(relations, mutation), false, 'INVARIANT: pairwise agreement fabricated a global world');
});

test('resource separation proves coordination-free local spends only inside preallocated rights', () => {
  const proof = quotaSeparation({ total: 5, quotas: { a: 2, b: 2 } });
  assert.equal(proof.pass, true);
  assert.equal(proof.slack, 1);
  assert.equal(proof.exhaustiveSpendCases, 9);
  assert.equal(quotaSeparation({ total: 5, quotas: { a: 3, b: 3 } }).pass, false);
});

test('rights transfer must be linear/idempotent; duplication refutes local-resource safety', () => {
  const first = transferQuota({ total: 5, quotas: { a: 3, b: 2 }, from: 'a', to: 'b', amount: 1, transferId: 'x', mutation });
  assert.equal(first.accepted, true);
  assert.equal(first.invariant, true, 'INVARIANT: transfer duplicated scarce authority');
  const second = transferQuota({ total: 5, quotas: first.quotas, from: 'a', to: 'b', amount: 1, transferId: 'x', consumedTransfers: first.consumedTransfers, mutation });
  assert.equal(second.accepted, false, 'INVARIANT: same transfer capability consumed twice');
});

test('AND of local guarantees does not imply composition when relies are violated', () => {
  const result = checkContracts({ states: [{ a: 0, b: 0 }], mutation, components: [
    { id: 'A', steps: state => [{ ...state, a: 1 }], guarantee: (_before, after) => after.a <= 1,
      rely: (_before, after, actor) => actor === 'A' || after.b === 0 },
    { id: 'B', steps: state => [{ ...state, b: 1 }], guarantee: (_before, after) => after.b <= 1,
      rely: (_before, after, actor) => actor === 'B' || after.a === 0 },
  ] });
  assert.equal(result.localPass, true);
  assert.equal(result.compositionPass, false, 'INVARIANT: local guarantees were composed while rely conditions were violated');
  assert.equal(result.compositionViolations.length, 2);
});

test('rate-distortion gives a lower-bound shape, not a game benchmark', () => {
  assert.equal(binaryRateDistortion(0), 1);
  assert.equal(binaryRateDistortion(0.5), 0);
  assert.ok(binaryRateDistortion(0.1) > 0 && binaryRateDistortion(0.1) < 1);
  assert.ok(binaryRateDistortion(0.2) < binaryRateDistortion(0.1));
});

test('a sound interval abstraction may block progress but an under-approximation can create unsafe knowledge', () => {
  const concrete = [0, 1];
  const sound = intervalAbstraction(concrete);
  assert.equal(intervalContainsAll(sound, concrete), true);
  assert.equal(intervalProvesAtLeast(sound, 1), false);
  const forged = { min: 1, max: 1 };
  assert.equal(intervalContainsAll(forged, concrete, mutation), false, 'INVARIANT: an under-approximation was trusted as sound');
  assert.equal(intervalProvesAtLeast(forged, 1), true, 'INVARIANT: under-approximation fabricated knowledge');
});

test('cyclic local constraint covers lose the pairwise-to-global composition shortcut', () => {
  assert.equal(alphaAcyclic([['A', 'B'], ['B', 'C'], ['C', 'D']]), true);
  assert.equal(alphaAcyclic([['A', 'B'], ['B', 'C'], ['A', 'C']]), false);
});

test('an unreliable acknowledgement can make both agents know readiness without making it common knowledge', () => {
  const worlds = [
    { name: 'order-lost', ready: false, A: 'sent-order', B: 'none' },
    { name: 'ack-lost', ready: true, A: 'sent-order', B: 'got-order-sent-ack' },
    { name: 'ack-delivered', ready: true, A: 'got-ack', B: 'got-order-sent-ack' },
  ];
  const localView = (world, agent) => world[agent];
  for (const agent of ['A', 'B']) assert.equal(knowsAt({ worlds, actual: 2, agent, localView, predicate: world => world.ready }), true);
  const common = commonKnowledgeAt({ worlds, actual: 2, agents: ['A', 'B'], localView, predicate: world => world.ready });
  assert.equal(common.pass, false);
  assert.deepEqual(common.reachable, [0, 1, 2]);
});

test('finite decision evidence can be strictly smaller than world state and fails closed when a hidden rule matters', () => {
  const worlds = [];
  for (const stock of [0, 1]) for (const generation of [1, 2]) for (const cosmetic of ['red', 'blue']) for (const weather of ['sun', 'rain']) {
    worlds.push({ stock, generation, cosmetic, weather });
  }
  const extractors = {
    stock: world => world.stock,
    generation: world => world.generation,
    cosmetic: world => world.cosmetic,
    weather: world => world.weather,
  };
  const predicate = world => world.stock > 0 && world.generation === 2;
  const result = minimalEvidenceForDecision({ worlds, predicate, extractors });
  assert.equal(result.size, 2);
  assert.ok(result.sufficient.some(keys => keys.length === 2 && keys.includes('stock') && keys.includes('generation')));
  assert.equal(evidenceDeterminesDecision({ worlds, predicate, extractors, keys: ['stock'] }), false);

  const evolvedWorlds = worlds.flatMap(world => [{ ...world, curse: false }, { ...world, curse: true }]);
  const evolvedPredicate = world => world.stock > 0 && world.generation === 2 && !world.curse;
  assert.equal(evidenceDeterminesDecision({ worlds: evolvedWorlds, predicate: evolvedPredicate, extractors, keys: ['stock', 'generation'] }), false,
    'INVARIANT: an undeclared future rule invalidates the old evidence capsule');
  const evolved = minimalEvidenceForDecision({ worlds: evolvedWorlds, predicate: evolvedPredicate,
    extractors: { ...extractors, curse: world => world.curse } });
  assert.equal(evolved.size, 3);
});
