import { canonical, copy, equal, keyOf, validId } from './encoding.mjs';

function validateSpec(spec) {
  if (!spec || !Array.isArray(spec.resources) || !spec.resources.length || spec.resources.length > 3 ||
      !Array.isArray(spec.operations) || !spec.operations.length || spec.operations.length > 8 ||
      !Number.isSafeInteger(spec.bound) || spec.bound < 1 || spec.bound > 4) throw new Error('Unsupported finite specification');
  const ids = spec.resources.map(resource => resource.id);
  if (ids.some(id => !validId(id)) || new Set(ids).size !== ids.length) throw new Error('Duplicate or invalid resource ID');
  if (spec.resources.some(resource => !['counter', 'set'].includes(resource.kind))) throw new Error('Unsupported resource grammar');
  const ops = spec.operations.map(op => op.id);
  if (ops.some(id => !validId(id)) || new Set(ops).size !== ops.length) throw new Error('Duplicate operation definition');
  for (const operation of spec.operations) {
    if (!Array.isArray(operation.effects) || !operation.effects.length) throw new Error('Missing effects');
    const touched = new Set();
    for (const effect of operation.effects) {
      const resource = spec.resources.find(row => row.id === effect.resource);
      if (!resource || touched.has(effect.resource)) throw new Error('Unknown or duplicate resource effect');
      touched.add(effect.resource);
      if (resource.kind === 'counter' && (effect.kind !== 'add' || !Number.isSafeInteger(effect.value) ||
          Math.abs(effect.value) > spec.bound)) throw new Error('Unsupported counter effect grammar');
      if (resource.kind === 'set' && (effect.kind !== 'insert' || !Number.isSafeInteger(effect.value) ||
          effect.value < 0 || effect.value >= spec.bound)) throw new Error('Unsupported set effect grammar');
      if (!equal(Object.keys(effect).sort(), ['kind', 'resource', 'value'])) throw new Error('Unknown effect fields');
    }
    if (!equal(Object.keys(operation).sort(), ['effects', 'id'])) throw new Error('Unknown operation fields');
  }
  for (const resource of spec.resources) if (!equal(Object.keys(resource).sort(), ['id', 'kind'])) throw new Error('Unknown resource fields');
  if (!equal(Object.keys(spec).sort(), ['bound', 'operations', 'resources'])) throw new Error('Unknown specification fields');
}
function ancestors(spec, index = 0, prefix = {}) {
  if (index === spec.resources.length) return [copy(prefix)];
  const resource = spec.resources[index];
  const domain = resource.kind === 'counter' ? Array.from({ length: spec.bound + 1 }, (_, i) => i) :
    Array.from({ length: 2 ** spec.bound }, (_, mask) => Array.from({ length: spec.bound }, (_, bit) => bit).filter(bit => mask & (1 << bit)));
  return domain.flatMap(value => ancestors(spec, index + 1, { ...prefix, [resource.id]: value }));
}
function branch(spec, initial, operation) {
  const state = copy(initial);
  for (const effect of operation.effects) {
    if (effect.kind === 'add') state[effect.resource] += effect.value;
    else state[effect.resource] = [...new Set([...state[effect.resource], effect.value])].sort();
  }
  return spec.resources.some(resource => resource.kind === 'counter' && state[resource.id] < 0) ? null : state;
}

// This is B evidence for a finite algebra, NOT a complete I-confluence compiler.
// Common ancestors: declared finite domain. Each branch: one arbitrary invocation.
// The two invocations have different occurrence IDs even for the SAME definition.
export function analyzeConcurrentInstances(spec) {
  validateSpec(spec);
  let checked = 0, witness = null;
  const states = ancestors(spec);
  for (const ancestor of states) for (const leftOp of spec.operations) for (const rightOp of spec.operations) {
    const left = branch(spec, ancestor, leftOp), right = branch(spec, ancestor, rightOp);
    if (!left || !right) continue;
    checked++;
    const merged = {};
    for (const resource of spec.resources) merged[resource.id] = resource.kind === 'counter' ?
      left[resource.id] + right[resource.id] - ancestor[resource.id] : [...new Set([...left[resource.id], ...right[resource.id]])].sort();
    const violation = spec.resources.find(resource => resource.kind === 'counter' && merged[resource.id] < 0);
    if (violation && !witness) witness = { ancestor, left: { definition: leftOp.id, instance: 'left:1' },
      right: { definition: rightOp.id, instance: 'right:1' }, merged, invariant: `${violation.id} >= 0` };
  }
  return { version: 'finite-instances-v1', specKey: keyOf(spec),
    scope: { ancestors: states.length, instancesPerBranch: 1, bound: spec.bound }, checked,
    verdict: witness ? 'coordination-or-escrow-required' : 'no-counterexample-within-bound', witness };
}
export function verifyAnalysisCertificate(spec, certificate) {
  try { return equal(analyzeConcurrentInstances(spec), certificate); } catch { return false; }
}

export function checkFiniteQuotient({ states, actions, projection, observe, step }) {
  let checked = 0;
  for (const left of states) for (const right of states) {
    if (!equal(projection(left), projection(right))) continue;
    checked++;
    if (!equal(observe(left), observe(right))) return { pass: false, checked, witness: { left, right, cause: 'observation' } };
    for (const action of actions) {
      if (!equal(projection(step(left, action)), projection(step(right, action)))) {
        return { pass: false, checked, witness: { left, right, action, cause: 'future-distinguishability' } };
      }
    }
  }
  const domain = new Set(states.map(canonical));
  for (const state of states) for (const action of actions) {
    if (!domain.has(canonical(step(state, action)))) return { pass: false, checked, witness: { state, action, cause: 'unclosed-domain' } };
  }
  return { pass: true, checked, scope: 'declared finite states/actions, including checked domain closure' };
}

export function dependencyClosure(graph, observed) {
  const required = new Set(), pending = [...observed];
  while (pending.length) {
    const variable = pending.pop();
    if (required.has(variable)) continue;
    if (!Object.hasOwn(graph, variable) || !Array.isArray(graph[variable])) throw new Error(`Unknown influence for ${variable}; widen or coordinate`);
    required.add(variable); pending.push(...graph[variable]);
  }
  return [...required].sort();
}

// Accounting inputs have no policy-name-dependent coefficients. This deliberately
// does not estimate Raft/Paxos byte cost from a designer-selected multiplier.
export function trafficLedger(measuredOrDeclared) {
  const keys = ['realtime', 'canon', 'recovery', 'control', 'retries', 'join', 'handoff'];
  if (!equal(Object.keys(measuredOrDeclared).sort(), [...keys].sort()) ||
      keys.some(key => !Number.isSafeInteger(measuredOrDeclared[key]) || measuredOrDeclared[key] < 0)) throw new Error('Incomplete wire-byte ledger');
  return { ...measuredOrDeclared, total: keys.reduce((sum, key) => sum + measuredOrDeclared[key], 0) };
}
