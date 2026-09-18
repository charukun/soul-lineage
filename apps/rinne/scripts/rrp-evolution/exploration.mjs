import { canonical, copy } from './finite.mjs';
import { initialOwner, transition, rawCommand } from './cutover.mjs';
import { initialOracle, observe } from './oracle.mjs';

export function step(model, event, mutation = 'none') {
  const { local, effects } = transition(model.local, event, mutation);
  // The observer reads returned state itself instead of trusting a node's claim
  // about its own view. This observation never flows back into transition().
  const view = { type: 'view', active: local.disk.active, revision: local.disk.revision,
    rows: copy(local.disk.active === 1 ? local.disk.v1 : local.disk.v2) };
  return { ...model, local, oracle: observe(model.oracle, [...effects, view]) };
}
export const initialModel = () => ({ local: initialOwner(), oracle: initialOracle() });
export function transact(model, kind, extra = {}, mutation = 'none') {
  let next = step(model, { type: 'request', kind, ...extra }, mutation);
  const token = next.local.volatile.writes.length > model.local.volatile.writes.length
    ? next.local.volatile.writes.at(-1)?.token : null;
  if (token) next = step(next, { type: 'flush', token }, mutation);
  return next;
}
function enabled(state) {
  const { local, used, crashUsed } = state, d = local.disk, m = d.migration;
  if (!local.running) return [{ type: 'restart' }];
  const actions = local.volatile.writes.map(job => ({ type: 'flush', token: job.token }));
  const pending = kind => local.volatile.writes.some(job => job.kind === kind);
  if (!used.includes('x')) actions.push({ type: 'request', kind: 'command', raw: rawCommand('x', 'a', d.active), once: 'x' });
  if (!used.includes('y')) actions.push({ type: 'request', kind: 'command', raw: rawCommand('y', 'b', d.active), once: 'y' });
  if (!m && !pending('begin')) actions.push({ type: 'request', kind: 'begin' });
  if (m && d.active === 1) {
    for (const key of ['a', 'b']) if (!Object.hasOwn(m.shadow, key) &&
        !local.volatile.writes.some(job => job.kind === 'copy' && job.key === key)) {
      actions.push({ type: 'request', kind: 'copy', key });
    }
    if (m.cursor < d.revision && !pending('replay')) actions.push({ type: 'request', kind: 'replay' });
    if (m.cut === null && !pending('seal')) actions.push({ type: 'request', kind: 'seal' });
    if (m.cut !== null && !pending('activate')) actions.push({ type: 'request', kind: 'activate' });
  }
  if (!crashUsed) actions.push({ type: 'crash' });
  return actions;
}
export function explore({ maxDepth = 12, maxStates = 16000, mutation = 'none', seed = 'start' } = {}) {
  let root = initialModel();
  if (seed === 'snapshot-plus-tail') {
    root = transact(root, 'begin'); root = transact(root, 'copy', { key: 'a' });
    root = transact(root, 'command', { raw: rawCommand('x') });
    root = transact(root, 'copy', { key: 'b' });
  } else if (seed !== 'start') throw Error('Unknown exploration seed');
  const initial = { ...root, used: seed === 'start' ? [] : ['x'], crashUsed: false };
  let layer = [{ state: initial, trace: [] }], visited = new Set([canonical(initial)]);
  let transitions = 0, completedDepth = 0, cutoff = null, violation = null, activatedStates = 0;
  const kinds = new Set();
  for (let depth = 0; depth < maxDepth && layer.length; depth++) {
    const nextLayer = [];
    outer: for (const { state, trace } of layer) for (const action of enabled(state)) {
      let next = step(state, action, mutation); transitions++; kinds.add(action.kind ?? action.type);
      next.used = action.once ? [...state.used, action.once].sort() : state.used;
      next.crashUsed = state.crashUsed || action.type === 'crash';
      const nextTrace = [...trace, copy(action)];
      if (next.oracle.errors.length) { violation = { errors: next.oracle.errors, trace: nextTrace }; break outer; }
      const fingerprint = canonical(next);
      if (!visited.has(fingerprint)) {
        if (visited.size === maxStates) { cutoff = 'state-budget'; break outer; }
        visited.add(fingerprint); nextLayer.push({ state: next, trace: nextTrace });
        if (next.local.disk.active === 2) activatedStates++;
      }
    }
    if (violation || cutoff) break;
    completedDepth = depth + 1; layer = nextLayer;
  }
  if (!cutoff && !violation && layer.length && completedDepth === maxDepth) cutoff = 'depth-bound';
  return { seed, passWithinExploredStates: !violation, maxDepth, maxStates, states: visited.size,
    transitions, completedDepth, cutoff, activatedStates, eventKinds: [...kinds].sort(), violation,
    bounds: 'One trusted owner, two rows, at most two submitted command identities and one crash/restart. Request/flush are separate. No network quorum, storage loss or unbounded liveness proof.' };
}

// Exhausts crash positions in ONE explicit end-to-end trace, not arbitrary schedules.
export function crashCuts() {
  let state = initialModel(); const trace = [];
  const action = event => { trace.push(copy(event)); state = step(state, event); };
  function transaction(kind, extra = {}) {
    action({ type: 'request', kind, ...extra });
    action({ type: 'flush', token: state.local.volatile.writes.at(-1).token });
  }
  transaction('begin'); transaction('copy', { key: 'a' });
  transaction('command', { raw: rawCommand('x') }); transaction('copy', { key: 'b' });
  transaction('command', { raw: rawCommand('y', 'b') }); transaction('seal');
  transaction('replay'); transaction('replay'); transaction('activate');
  transaction('command', { raw: rawCommand('z', 'a', 2) });
  let completed = 0;
  for (let cut = 0; cut <= trace.length; cut++) {
    let m = initialModel();
    for (const event of trace.slice(0, cut)) m = step(m, event);
    m = step(step(m, { type: 'crash' }), { type: 'restart' });
    if (!m.local.disk.migration) m = transact(m, 'begin');
    if (m.local.disk.active === 1) {
      for (const key of ['a', 'b']) if (!Object.hasOwn(m.local.disk.migration.shadow, key)) m = transact(m, 'copy', { key });
      m = transact(m, 'seal');
      for (let i = 0; i < 10 && m.local.disk.migration.cursor < m.local.disk.migration.cut; i++) m = transact(m, 'replay');
      m = transact(m, 'activate');
    }
    if (m.oracle.errors.length || m.local.disk.active !== 2) return { pass: false, cut, errors: m.oracle.errors };
    completed++;
  }
  return { pass: true, completed, traceEvents: trace.length,
    scope: 'Each crash cut in one two-row/three-command trace, followed by explicit fair local completion; only accepted commands must survive.' };
}
