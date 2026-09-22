import { createHash } from 'node:crypto';

// Data-only finite contracts. No eval, remote-state access or predicate supplied by a peer.
export function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  throw new TypeError('Contract values must be safe-integer JSON');
}
export const copy = value => structuredClone(value);
export const equal = (left, right) => canonical(left) === canonical(right);
export const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const id = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,100}$/.test(value);
const ownKeys = (value, keys) => value && equal(Object.keys(value).sort(), [...keys].sort());

export function indexMachine(machine) {
  if (!ownKeys(machine, ['name', 'states', 'actions', 'steps']) || !id(machine.name) ||
      !Array.isArray(machine.states) || !machine.states.length || machine.states.length > 2048 ||
      !Array.isArray(machine.actions) || !machine.actions.length || machine.actions.length > 32 ||
      !Array.isArray(machine.steps) || machine.steps.length > 65536) throw Error('Invalid finite machine');
  const states = new Map(), actions = new Set(), steps = new Map();
  for (const state of machine.states) {
    if (!ownKeys(state, ['id', 'observation']) || !id(state.id) || states.has(state.id)) throw Error('Duplicate/invalid state');
    canonical(state.observation); states.set(state.id, state);
  }
  for (const action of machine.actions) {
    if (!id(action) || actions.has(action)) throw Error('Duplicate/invalid action');
    actions.add(action);
  }
  for (const step of machine.steps) {
    if (!ownKeys(step, ['from', 'action', 'to', 'result']) || !states.has(step.from) ||
        !states.has(step.to) || !actions.has(step.action)) throw Error('Transition escapes declared domain');
    const key = canonical([step.from, step.action]);
    if (steps.has(key)) throw Error('Nondeterministic/duplicate transition');
    canonical(step.result); steps.set(key, step);
  }
  if (steps.size !== states.size * actions.size) throw Error('Non-total finite transition table');
  return { states, actions, steps };
}

// Checks a forward simulation of deterministic, closed finite tables. Success is
// exhaustive for these tables, NOT evidence that a real game's extraction is complete.
export function checkSimulation(source, target, mapping) {
  const left = indexMachine(source), right = indexMachine(target);
  if (!ownKeys(mapping, ['states', 'actions']) || !equal(Object.keys(mapping.states).sort(), [...left.states.keys()].sort()) ||
      !equal(Object.keys(mapping.actions).sort(), [...left.actions].sort())) throw Error('Incomplete mapping');
  let statesChecked = 0, stepsChecked = 0;
  const fail = (kind, witness) => ({ pass: false, kind, witness, statesChecked, stepsChecked });
  for (const state of source.states) {
    const translated = right.states.get(mapping.states[state.id]);
    statesChecked++;
    if (!translated) return fail('target-domain', { state: state.id });
    if (!equal(state.observation, translated.observation)) return fail('observation', { state, translated });
    for (const action of source.actions) {
      const next = left.steps.get(canonical([state.id, action]));
      const mappedAction = mapping.actions[action];
      if (!right.actions.has(mappedAction)) return fail('action-domain', { action, mappedAction });
      const translatedNext = right.steps.get(canonical([translated.id, mappedAction]));
      stepsChecked++;
      if (!equal(next.result, translatedNext.result)) return fail('result', { next, translatedNext });
      if (mapping.states[next.to] !== translatedNext.to) return fail('transition', { next, translatedNext });
    }
  }
  return { pass: true, statesChecked, stepsChecked, scope: 'declared deterministic closed tables and all mapped actions',
    contractRoot: digest({ source, target, mapping }) };
}

export function checkMerge({ states, targets, migrate, oldMerge, newMerge }) {
  if (!states.length || !targets.length) throw Error('Empty merge domain');
  const sourceDomain = new Set(states.map(canonical)), targetDomain = new Set(targets.map(canonical));
  let pairs = 0;
  for (const left of states) for (const right of states) {
    const merged = oldMerge(copy(left), copy(right));
    const a = migrate(copy(left)), b = migrate(copy(right)), translated = migrate(copy(merged));
    const joined = newMerge(copy(a), copy(b)); pairs++;
    if (!sourceDomain.has(canonical(merged)) || [a, b, translated, joined].some(x => !targetDomain.has(canonical(x)))) {
      return { pass: false, kind: 'domain', pairs, witness: { left, right } };
    }
    if (!equal(translated, joined)) return { pass: false, kind: 'merge', pairs, witness: { left, right, translated, joined } };
  }
  return { pass: true, pairs, scope: 'all pairs in declared finite merge domains' };
}

// A retained representation suffices for Q iff every fiber agrees on each query.
// One separating query is a constructive impossibility witness for that compaction.
export function checkRetention(histories, retain, queries) {
  if (!histories.length || !Object.keys(queries).length) throw Error('Empty retention obligation');
  let pairs = 0;
  for (let i = 0; i < histories.length; i++) for (let j = i + 1; j < histories.length; j++) {
    if (!equal(retain(copy(histories[i])), retain(copy(histories[j])))) continue;
    for (const [query, evaluate] of Object.entries(queries)) {
      pairs++;
      const left = evaluate(copy(histories[i])), right = evaluate(copy(histories[j]));
      if (!equal(left, right)) return { pass: false, pairs, witness: { i, j, query, left, right } };
    }
  }
  return { pass: true, pairs, scope: 'only the supplied finite history set and query family' };
}
