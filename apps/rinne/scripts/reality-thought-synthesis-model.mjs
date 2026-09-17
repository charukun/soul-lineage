const clone = value => structuredClone(value);

export function possibleWorlds(states, observe, observation) {
  if (!Array.isArray(states) || !states.length) throw new Error('states required');
  return states.filter(state => Object.is(observe(state), observation) || JSON.stringify(observe(state)) === JSON.stringify(observation)).map(clone);
}

export function knows(possibilities, predicate) {
  if (!Array.isArray(possibilities) || !possibilities.length) return false;
  return possibilities.every(predicate);
}

export function refineKnowledge(possibilities, evidence) {
  const refined = possibilities.filter(evidence).map(clone);
  return { before: possibilities.length, after: refined.length, possibilities: refined, monotone: refined.length <= possibilities.length };
}

export function mayPerform({ possibilities, precondition, mutation = 'none' }) {
  if (!Array.isArray(possibilities) || !possibilities.length) return false;
  return mutation === 'existential-knowledge' ? possibilities.some(precondition) : possibilities.every(precondition);
}

export function causalEnvelope({ minPosition, maxPosition = minPosition, maxSpeed, maxAcceleration = 0, horizonSeconds, teleport = false }) {
  for (const value of [minPosition, maxPosition, maxSpeed, maxAcceleration, horizonSeconds]) if (!Number.isFinite(value)) throw new Error('finite dynamics required');
  if (maxPosition < minPosition || maxSpeed < 0 || maxAcceleration < 0 || horizonSeconds < 0) throw new Error('invalid dynamics');
  if (teleport) return { bounded: false, min: -Infinity, max: Infinity };
  const reach = maxSpeed * horizonSeconds + 0.5 * maxAcceleration * horizonSeconds ** 2;
  return { bounded: true, min: minPosition - reach, max: maxPosition + reach };
}

export function intersectsInterval(left, right) {
  return left.max >= right.min && right.max >= left.min;
}

export function syncRequiredForRegion(dynamics, region) {
  const envelope = causalEnvelope(dynamics);
  return { envelope, required: !envelope.bounded || intersectsInterval(envelope, region) };
}

function projection(relation, vars) {
  const indices = vars.map(name => relation.vars.indexOf(name));
  return new Set(relation.tuples.map(tuple => JSON.stringify(indices.map(index => tuple[index]))));
}

export function pairwiseProjectionConsistent(relations) {
  for (let i = 0; i < relations.length; i++) for (let j = i + 1; j < relations.length; j++) {
    const overlap = relations[i].vars.filter(variable => relations[j].vars.includes(variable));
    if (!overlap.length) continue;
    const a = projection(relations[i], overlap), b = projection(relations[j], overlap);
    if (a.size !== b.size || [...a].some(value => !b.has(value))) return false;
  }
  return true;
}

export function naturalJoin(relations) {
  let rows = [{}];
  for (const relation of relations) {
    const next = [];
    for (const row of rows) for (const tuple of relation.tuples) {
      let compatible = true;
      const merged = { ...row };
      for (let i = 0; i < relation.vars.length; i++) {
        const variable = relation.vars[i], value = tuple[i];
        if (Object.hasOwn(merged, variable) && merged[variable] !== value) { compatible = false; break; }
        merged[variable] = value;
      }
      if (compatible) next.push(merged);
    }
    rows = next;
  }
  const unique = new Map(rows.map(row => [JSON.stringify(Object.fromEntries(Object.entries(row).sort())), row]));
  return [...unique.values()];
}

export function localToGlobalConsistent(relations, mutation = 'none') {
  if (mutation === 'pairwise-as-global') return pairwiseProjectionConsistent(relations);
  return naturalJoin(relations).length > 0;
}

export function quotaSeparation({ total, quotas }) {
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('invalid total');
  const entries = Object.entries(quotas ?? {});
  if (!entries.length || entries.some(([, value]) => !Number.isSafeInteger(value) || value < 0)) throw new Error('invalid quotas');
  const allocated = entries.reduce((sum, [, value]) => sum + value, 0);
  if (allocated > total) return { pass: false, total, allocated, reason: 'overallocated' };
  let cases = 1;
  for (const [, value] of entries) cases *= value + 1;
  // If each participant may only decrement its own nonnegative quota, the maximum
  // concurrent spend is the sum of quotas. The exhaustive count is reported for the
  // finite integer envelope rather than materializing its Cartesian product.
  return { pass: allocated <= total, total, allocated, slack: total - allocated, exhaustiveSpendCases: cases };
}

export function transferQuota({ total, quotas, from, to, amount, transferId, consumedTransfers = new Set(), mutation = 'none' }) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('invalid amount');
  if (consumedTransfers.has(transferId) && mutation !== 'duplicate-transfer') return { accepted: false, quotas: clone(quotas), consumedTransfers: new Set(consumedTransfers), reason: 'duplicate-transfer' };
  if ((quotas[from] ?? 0) < amount) return { accepted: false, quotas: clone(quotas), consumedTransfers: new Set(consumedTransfers), reason: 'insufficient-rights' };
  const next = clone(quotas);
  if (mutation !== 'duplicate-transfer') next[from] -= amount;
  next[to] = (next[to] ?? 0) + amount;
  const nextConsumed = new Set(consumedTransfers); nextConsumed.add(transferId);
  return { accepted: true, quotas: next, consumedTransfers: nextConsumed, invariant: quotaSeparation({ total, quotas: next }).pass };
}

export function checkContracts({ states, components, mutation = 'none' }) {
  const local = [];
  const compositionViolations = [];
  for (const component of components) {
    for (const state of states) {
      for (const next of component.steps(state).map(clone)) {
        const ownGuarantee = component.guarantee(state, next);
        local.push({ component: component.id, state: clone(state), next: clone(next), ownGuarantee });
        if (!ownGuarantee) continue;
        for (const other of components) if (mutation !== 'ignore-rely' && other !== component && !other.rely(state, next, component.id)) {
          compositionViolations.push({ actor: component.id, victim: other.id, state: clone(state), next: clone(next) });
        }
      }
    }
  }
  return { localPass: local.every(row => row.ownGuarantee), compositionPass: compositionViolations.length === 0, compositionViolations, local };
}

export function binaryRateDistortion(distortion) {
  if (!Number.isFinite(distortion) || distortion < 0 || distortion > 0.5) throw new Error('binary Hamming distortion must be in [0, 0.5]');
  if (distortion === 0) return 1;
  if (distortion === 0.5) return 0;
  const entropy = -distortion * Math.log2(distortion) - (1 - distortion) * Math.log2(1 - distortion);
  return 1 - entropy;
}

export function intervalAbstraction(values) {
  if (!Array.isArray(values) || !values.length || values.some(value => !Number.isFinite(value))) throw new Error('finite values required');
  return { min: Math.min(...values), max: Math.max(...values) };
}

export function intervalContainsAll(interval, values, mutation = 'none') {
  if (mutation === 'trust-underapprox') return true;
  return values.every(value => value >= interval.min && value <= interval.max);
}

export function intervalProvesAtLeast(interval, threshold) {
  return interval.min >= threshold;
}

export function alphaAcyclic(edges) {
  let remaining = edges.map(edge => [...new Set(edge)]).filter(edge => edge.length);
  if (remaining.some(edge => !edge.length)) return true;
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < remaining.length; i++) for (let j = 0; j < remaining.length; j++) {
      if (i === j) continue;
      if (remaining[i].every(vertex => remaining[j].includes(vertex))) {
        remaining.splice(i, 1); changed = true; break outer;
      }
    }
    const counts = new Map();
    for (const edge of remaining) for (const vertex of edge) counts.set(vertex, (counts.get(vertex) ?? 0) + 1);
    for (const edge of remaining) {
      const kept = edge.filter(vertex => counts.get(vertex) > 1);
      if (kept.length !== edge.length) { edge.splice(0, edge.length, ...kept); changed = true; }
    }
    const before = remaining.length;
    remaining = remaining.filter(edge => edge.length);
    if (remaining.length !== before) changed = true;
  }
  return remaining.length === 0;
}

export function knowsAt({ worlds, actual, agent, localView, predicate }) {
  const view = localView(worlds[actual], agent);
  const possible = worlds.filter(world => JSON.stringify(localView(world, agent)) === JSON.stringify(view));
  return possible.length > 0 && possible.every(predicate);
}

export function commonKnowledgeAt({ worlds, actual, agents, localView, predicate }) {
  const reachable = new Set([actual]), pending = [actual];
  while (pending.length) {
    const index = pending.pop();
    for (const agent of agents) {
      const view = localView(worlds[index], agent);
      for (let candidate = 0; candidate < worlds.length; candidate++) {
        if (JSON.stringify(localView(worlds[candidate], agent)) === JSON.stringify(view) && !reachable.has(candidate)) {
          reachable.add(candidate); pending.push(candidate);
        }
      }
    }
  }
  return { pass: [...reachable].every(index => predicate(worlds[index])), reachable: [...reachable].sort((a, b) => a - b) };
}

function combinations(items, size, start = 0, prefix = [], out = []) {
  if (prefix.length === size) { out.push([...prefix]); return out; }
  for (let i = start; i <= items.length - (size - prefix.length); i++) {
    prefix.push(items[i]); combinations(items, size, i + 1, prefix, out); prefix.pop();
  }
  return out;
}

export function evidenceDeterminesDecision({ worlds, predicate, extractors, keys }) {
  const groups = new Map();
  for (const world of worlds) {
    const signature = JSON.stringify(keys.map(name => extractors[name](world)));
    const decision = Boolean(predicate(world));
    if (!groups.has(signature)) groups.set(signature, decision);
    else if (groups.get(signature) !== decision) return false;
  }
  return true;
}

export function minimalEvidenceForDecision({ worlds, predicate, extractors }) {
  const names = Object.keys(extractors ?? {});
  if (!Array.isArray(worlds) || !worlds.length || !names.length) throw new Error('finite worlds and evidence extractors required');
  for (let size = 0; size <= names.length; size++) {
    const sufficient = combinations(names, size).filter(keys => evidenceDeterminesDecision({ worlds, predicate, extractors, keys }));
    if (sufficient.length) return { size, sufficient };
  }
  return { size: Infinity, sufficient: [] };
}
