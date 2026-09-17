import test from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { observationQuotient } from '../src/game/reality-lab/observation-quotient.js';

// Separate oracle: search the product graph, without using quotient signatures.
function distinguishingContinuation(model, left, right) {
  const states = new Map(model.states.map(state => [state.id, state]));
  const pending = [{ left, right, trace: [] }], visited = new Set();
  for (let cursor = 0; cursor < pending.length; cursor++) {
    const pair = pending[cursor], key = JSON.stringify([pair.left, pair.right]);
    if (visited.has(key)) continue;
    visited.add(key);
    const a = states.get(pair.left), b = states.get(pair.right);
    if (!isDeepStrictEqual(a.observation, b.observation) || !isDeepStrictEqual(a.canon, b.canon)) {
      return pair.trace;
    }
    for (const action of model.actions) {
      const x = a.transitions[action], y = b.transitions[action], trace = [...pair.trace, action];
      if (!isDeepStrictEqual(x.output, y.output)) return trace;
      pending.push({ left: x.to, right: y.to, trace });
    }
  }
  return null;
}

function equivalent(classes, a, b) {
  return classes.some(group => group.includes(a) && group.includes(b));
}

function idleDetails() {
  const actions = ['walk', 'rest'], states = [];
  for (const moving of [false, true]) for (let detail = 0; detail < 3; detail++) {
    const id = `${moving ? 'moving' : 'idle'}${detail}`;
    states.push({ id, observation: { moving }, canon: { life: 'life1' }, transitions: {
      walk: { to: `moving${(detail + 1) % 3}`, output: 'step' },
      rest: { to: `idle${detail}`, output: 'rest' },
    } });
  }
  return { actions, states };
}

function laterConsequence() {
  return { actions: ['tick'], states: Array.from({ length: 6 }, (_, i) => ({
    id: `s${i}`, observation: i === 5 ? 'arrival' : 'empty', canon: [],
    transitions: { tick: { to: `s${Math.min(5, i + 1)}`, output: null } },
  })) };
}

test('irrelevant internal details can collapse while actions and life history are preserved', () => {
  const model = idleDetails(), result = observationQuotient(model);
  assert.equal(result.evidenceClass, 'model');
  assert.equal(result.states, 6);
  assert.equal(result.classes.length, 2);
  for (const group of result.classes) for (const a of group) for (const b of group) {
    assert.equal(distinguishingContinuation(model, a, b), null);
  }
});

test('adding a legitimate future inspection refines the observation contract', () => {
  const model = idleDetails();
  model.actions.push('inspect');
  for (const state of model.states) {
    state.transitions.inspect = { to: state.id, output: Number(state.id.at(-1)) };
  }
  assert.equal(observationQuotient(model).classes.length, 6);
});

test('same current picture is not equivalence when a delayed consequence distinguishes it', () => {
  const model = laterConsequence(), result = observationQuotient(model);
  assert.equal(result.classes.length, 6);
  assert.deepEqual(distinguishingContinuation(model, 's0', 's1'), ['tick', 'tick', 'tick', 'tick']);
  assert.ok(result.refinements > 1);
  // Deliberately unsafe current-picture-only grouping must fail the independent oracle.
  assert.notEqual(distinguishingContinuation(model, 's0', 's1'), null);
});

test('unrendered irreversible Canon cannot collapse into another history', () => {
  const model = { actions: ['wait'], states: ['life1', 'life2'].map(id => ({
    id, observation: 'same-face', canon: { born: id },
    transitions: { wait: { to: id, output: null } },
  })) };
  assert.equal(observationQuotient(model).classes.length, 2);
  assert.deepEqual(distinguishingContinuation(model, 'life1', 'life2'), []);
  // Removing Canon would merge these; the original-model oracle still rejects it.
  const stripped = structuredClone(model);
  stripped.states.forEach(state => { state.canon = null; });
  assert.equal(observationQuotient(stripped).classes.length, 1);
  assert.notEqual(distinguishingContinuation(model, 'life1', 'life2'), null);
});

test('transition records distinguish states even if every displayed state stays equal', () => {
  const model = { actions: ['claim'], states: ['a', 'b'].map(id => ({
    id, observation: null, canon: [],
    transitions: { claim: { to: id, output: { recipient: id } } },
  })) };
  assert.equal(observationQuotient(model).classes.length, 2);
  assert.deepEqual(distinguishingContinuation(model, 'a', 'b'), ['claim']);
});

test('equal individual marginals do not justify erasing joint classical records', () => {
  const pairs = [[0, 0], [1, 1], [0, 1], [1, 0]];
  for (let side = 0; side < 2; side++) {
    assert.deepEqual(pairs.slice(0, 2).map(pair => pair[side]).sort(),
      pairs.slice(2).map(pair => pair[side]).sort());
  }
  const model = { actions: ['record-left', 'compare-right-via-message'], states: pairs.map((pair, i) => ({
    id: `p${i}`, observation: 'not-yet-compared', canon: [], transitions: {
      'record-left': { to: `p${i}`, output: pair[0] },
      'compare-right-via-message': { to: `p${i}`, output: pair[1] },
    },
  })) };
  assert.equal(observationQuotient(model).classes.length, 4);
  assert.deepEqual(distinguishingContinuation(model, 'p0', 'p2'), ['compare-right-via-message']);
  // This is an explicit classical record fixture, not a quantum/probabilistic proof.
});

test('complete JSON content is compared independent of object key insertion order', () => {
  const model = { actions: ['wait'], states: [
    { id: 'a', observation: { x: 1, y: 2 }, canon: [], transitions: { wait: { to: 'a', output: null } } },
    { id: 'b', observation: { y: 2, x: 1 }, canon: [], transitions: { wait: { to: 'b', output: null } } },
  ] };
  assert.equal(observationQuotient(model).classes.length, 1);
  model.states[1].observation.x = 3;
  assert.equal(observationQuotient(model).classes.length, 2);
});

test('malformed, incomplete and unsupported models fail instead of silently dropping semantics', () => {
  const mutations = [
    model => { model.actions.push('walk'); },
    model => { model.states[1].id = model.states[0].id; },
    model => { delete model.states[0].canon; },
    model => { delete model.states[0].transitions.walk; },
    model => { model.states[0].transitions.wait = { to: 'idle0', output: null }; },
    model => { model.states[0].transitions.walk.to = 'missing'; },
    model => { model.states[0].observation = undefined; },
    model => { model.states[0].canon = Number.NaN; },
    model => { model.states[0].canon = -0; },
    model => { model.states[0].canon = new Date(); },
    model => { model.states[0].observation = model.states[0]; },
    model => { model.states[0].transitions.walk.probability = 0.5; },
    model => { model.actions = []; },
    model => { delete model.actions[0]; },
    model => { model.states[0].canon = Array(2); },
    model => { model.states[0].canon = { get hidden() { throw Error('getter must not run'); } }; },
  ];
  for (const mutate of mutations) {
    const model = idleDetails(); mutate(model);
    assert.throws(() => observationQuotient(model));
  }
  assert.throws(() => observationQuotient({ actions: ['a'], states: Array(257).fill({}) }), /states/);
});

test('partition and independent product search agree on all 5832 small deterministic graphs', () => {
  let graphs = 0, comparisons = 0;
  // 3^6 total two-action transition tables times 2^3 state-observation labellings.
  for (let table = 0; table < 729; table++) for (let observations = 0; observations < 8; observations++) {
    let encoding = table;
    const model = { actions: ['x', 'y'], states: [] };
    for (let i = 0; i < 3; i++) {
      const transitions = {};
      for (const action of model.actions) {
        transitions[action] = { to: `s${encoding % 3}`, output: null };
        encoding = Math.floor(encoding / 3);
      }
      model.states.push({ id: `s${i}`, observation: (observations >> i) & 1, canon: [], transitions });
    }
    const result = observationQuotient(model); graphs++;
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) {
      const expected = distinguishingContinuation(model, `s${a}`, `s${b}`) === null;
      assert.equal(equivalent(result.classes, `s${a}`, `s${b}`), expected,
        `table=${table}, observations=${observations}, pair=${a},${b}`);
      comparisons++;
    }
  }
  assert.equal(graphs, 5832);
  assert.equal(comparisons, 17496);
});
