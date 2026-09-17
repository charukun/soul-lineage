import { copy, checkSimulation, checkMerge, checkRetention } from './finite.mjs';

// Synthetic life algebra: ages 0..3, generations 1..2. Not Rinne gameplay constants.
export function lifeTables() {
  const oldRows = [], newRows = [];
  for (let generation = 1; generation <= 2; generation++) for (let age = 0; age <= 3; age++) {
    oldRows.push({ id: `o${generation}:${age}`, generation, age });
    newRows.push({ id: `n${generation}:${age}:${age === 3 ? 'natural' : 'living'}`, generation, age,
      cause: age === 3 ? 'natural' : null });
    if (age < 3) newRows.push({ id: `n${generation}:${age}:battle`, generation, age, cause: 'battle' });
  }
  const observation = row => ({ generation: row.generation, age: row.age, ended: row.cause !== null });
  const source = { name: 'life-v1', states: oldRows.map(row => ({ id: row.id,
    observation: { generation: row.generation, age: row.age, ended: row.age === 3 } })), actions: ['idle', 'tick', 'rebirth'], steps: [] };
  for (const row of oldRows) for (const action of source.actions) {
    let generation = row.generation, age = row.age, result = 'unchanged';
    if (action === 'tick' && age < 3) { age++; result = age === 3 ? 'ended' : 'advanced'; }
    if (action === 'rebirth') {
      if (age !== 3 || generation === 2) result = 'denied';
      else { generation++; age = 0; result = 'born'; }
    }
    source.steps.push({ from: row.id, action, to: `o${generation}:${age}`, result });
  }
  // Separately expressed target transitions, rather than decoding through source.step.
  const target = { name: 'life-v2', states: newRows.map(row => ({ id: row.id, observation: observation(row) })),
    actions: ['idle', 'tick', 'rebirth', 'fatal'], steps: [] };
  for (const row of newRows) for (const action of target.actions) {
    const next = copy(row); let result = 'unchanged';
    switch (action) {
      case 'tick':
        if (next.cause === null) {
          next.age += 1; next.cause = next.age === 3 ? 'natural' : null;
          result = next.cause ? 'ended' : 'advanced';
        }
        break;
      case 'rebirth':
        if (next.cause === null || next.generation === 2) result = 'denied';
        else { next.generation += 1; next.age = 0; next.cause = null; result = 'born'; }
        break;
      case 'fatal': if (next.cause === null) { next.cause = 'battle'; result = 'ended'; } break;
    }
    target.steps.push({ from: row.id, action, to: `n${next.generation}:${next.age}:${next.cause ?? 'living'}`, result });
  }
  const forward = { states: Object.fromEntries(oldRows.map(row => [row.id,
    `n${row.generation}:${row.age}:${row.age === 3 ? 'natural' : 'living'}`])),
    actions: { idle: 'idle', tick: 'tick', rebirth: 'rebirth' } };
  const backward = { states: Object.fromEntries(newRows.map(row => [row.id, `o${row.generation}:${row.age}`])),
    actions: { idle: 'idle', tick: 'tick', rebirth: 'rebirth', fatal: 'idle' } };
  return { source, target, forward, backward };
}

export function replaceKnownFields(oldView) {
  return { name: oldView.name, hp: oldView.hp };
}
export function patchName(original, name) { return { ...copy(original), name }; }
export const validNewActor = actor => actor.dead === (actor.hp === 0);

// Historical verdict and current entitlement are deliberately different questions.
export function historicalVerdict(record, registry, mutation = 'none') {
  const key = mutation === 'reinterpret-history' ? 'award-v2' : record.rule;
  const rule = Object.hasOwn(registry, key) ? registry[key] : null;
  if (!rule) return { status: 'unknown', reason: 'historical-interpreter-unavailable' };
  if (!['award-v1', 'award-v2'].includes(key)) return { status: 'unknown', reason: 'unsupported-rule' };
  if (!Number.isSafeInteger(record.score) || !Number.isSafeInteger(rule.threshold)) {
    return { status: 'unknown', reason: 'unsupported-record-or-rule' };
  }
  return { status: 'verified', awarded: record.score >= rule.threshold };
}

export function semanticEvidence() {
  const { source, target, forward, backward } = lifeTables();
  const states = [[], ['a'], ['b'], ['a', 'b']];
  const union = (a, b) => [...new Set([...a, ...b])].sort();
  const count = checkMerge({ states, targets: [0, 1, 2], migrate: s => s.length,
    oldMerge: union, newMerge: Math.max });
  const bits = checkMerge({ states, targets: [0, 1, 2, 3],
    migrate: s => (s.includes('a') ? 1 : 0) | (s.includes('b') ? 2 : 0),
    oldMerge: union, newMerge: (a, b) => a | b });
  const histories = [{ ended: true, cause: 'natural' }, { ended: true, cause: 'battle' }];
  return {
    forward: checkSimulation(source, target, forward), backward: checkSimulation(target, source, backward),
    lossyMerge: count, preservingMerge: bits,
    retentionNow: checkRetention(histories, h => ({ ended: h.ended }), { ended: h => h.ended }),
    retentionAfterNewRule: checkRetention(histories, h => ({ ended: h.ended }), { battleReward: h => h.cause === 'battle' }),
    pathDependence: { input: 155, directCents: 155, throughWholeUnitsCents: Math.floor(155 / 100) * 100 },
    unknownFields: { source: { name: 'A', hp: 0, dead: true },
      lossyRoundtrip: replaceKnownFields({ name: 'A', hp: 0, dead: true }),
      retainedButInvalidEdit: { name: 'A', hp: 1, dead: true } },
  };
}
