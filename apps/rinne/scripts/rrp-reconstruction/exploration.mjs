import { Network, command } from './network.mjs';

function afterAcceptedQuorum() {
  const n = new Network();
  n.propose('n0', command('credit', 'explore-uncertain', { amount: 1 })); n.persistAll('n0');
  for (const id of ['n0', 'n1']) n.deliverAndPersist('PREPARE', id, 'n0');
  for (const id of ['n0', 'n1']) n.deliverWhere(m => m.type === 'PROMISE' && m.from === id && m.to === 'n0');
  for (const id of ['n0', 'n1']) n.deliverAndPersist('ACCEPT', id, 'n0');
  return n;
}
function recoverySeed() {
  const n = new Network();
  n.propose('n0', command('credit', 'snapshot-record', { amount: 1 })); n.settle();
  n.fault('n2', 'storage-loss'); n.event('n2', { type: 'sync', source: 'n0' });
  n.deliverWhere(m => m.type === 'SYNC');
  return n;
}

export function explore({ seed = 'accepted-quorum', maxDepth = 5, maxStates = 1200 } = {}) {
  const start = seed === 'recovery' ? recoverySeed() : afterAcceptedQuorum();
  let layer = [{ network: start, faults: 0 }], visited = new Set([start.fingerprint() + ':0']);
  let transitions = 0, completedDepth = 0, cutoff = null, violation = null, frontier = layer.length;
  const kinds = new Set();
  for (let depth = 0; depth < maxDepth && layer.length; depth++) {
    const nextLayer = [];
    outer: for (const entry of layer) {
      const actions = entry.network.enabled();
      for (const id of entry.network.members) {
        const mode = entry.network.nodes[id].mode;
        if (mode === 'crashed') actions.push({ kind: 'restart', node: id });
        if (mode === 'paused') actions.push({ kind: 'resume', node: id });
      }
      if (entry.faults === 0) {
        for (const id of entry.network.members) if (entry.network.nodes[id].mode === 'running') {
          actions.push({ kind: 'crash', node: id }, { kind: 'pause', node: id }, { kind: 'storage-loss', node: id });
        }
        for (const packet of entry.network.queue) actions.push({ kind: 'drop', serial: packet.serial }, { kind: 'duplicate', serial: packet.serial });
      }
      for (const action of actions) {
        const network = entry.network.fork(); network.runAction(action);
        kinds.add(action.kind); transitions++;
        for (const id of network.members) network.event(id, { type: 'snapshot-complete' });
        const result = network.audit();
        if (!result.pass) { violation = { result, trace: network.trace }; break outer; }
        const faults = entry.faults + (['crash', 'pause', 'storage-loss', 'drop', 'duplicate'].includes(action.kind) ? 1 : 0);
        const hash = network.fingerprint() + `:${faults}`;
        if (!visited.has(hash)) {
          if (visited.size >= maxStates) { cutoff = 'state-budget'; break outer; }
          visited.add(hash); nextLayer.push({ network, faults });
        }
      }
    }
    frontier = nextLayer.length;
    if (violation || cutoff) break;
    completedDepth = depth + 1; layer = nextLayer;
  }
  if (!cutoff && !violation && layer.length && completedDepth === maxDepth) cutoff = 'depth-bound';
  return { seed, maxDepth, maxStates, states: visited.size, transitions, completedDepth, frontier,
    cutoff, exhaustiveUnbounded: false, passWithinExploredStates: !violation,
    faultBudgetPerPath: 1, eventKinds: [...kinds].sort(), violation,
    limits: 'One injected fault per path plus restart/resume; fixed three voters; not all combinations or a liveness proof.' };
}

function random(seed) {
  let value = seed >>> 0;
  return size => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) % size; };
}
export function seededFaults({ seeds = 72, steps = 36 } = {}) {
  let observations = 0, completed = 0;
  const eventCounts = {};
  for (let seed = 1; seed <= seeds; seed++) {
    const pick = random(seed), n = new Network();
    n.propose('n0', command('credit', `request-${seed}`, { amount: 1 }));
    n.propose('n2', command('credit', `concurrent-${seed}`, { amount: 2 }));
    for (let step = 0; step < steps; step++) {
      const choices = n.enabled();
      const id = n.members[pick(n.members.length)];
      if (step % 7 === 0) choices.push({ kind: 'crash', node: id }, { kind: 'pause', node: id }, { kind: 'restart', node: id });
      if (n.nodes[id].mode === 'paused') choices.push({ kind: 'resume', node: id });
      if (n.queue.length && step % 5 === 0) choices.push({ kind: 'duplicate', serial: n.queue[pick(n.queue.length)].serial },
        { kind: 'drop', serial: n.queue[pick(n.queue.length)].serial });
      if (!choices.length) break;
      const action = choices[pick(choices.length)];
      n.runAction(action); eventCounts[action.kind] = (eventCounts[action.kind] ?? 0) + 1;
      const result = n.audit();
      if (!result.pass) return { pass: false, seed, result, trace: n.trace };
    }
    for (const id of n.members) n.fault(id, 'restart');
    n.settle();
    // Stable proposer/fair delivery phase is explicit, not inferred from random success.
    n.propose('n1', command('nop', `recovery-${seed}`)); n.settle();
    for (let retry = 0; retry < 5 && !n.nodes.n1.disk.applied.length; retry++) {
      n.event('n1', { type: 'timer' }); n.settle();
    }
    const result = n.audit();
    if (!result.pass) return { pass: false, seed, result, trace: n.trace };
    if (n.nodes.n1.disk.applied.length) completed++;
    observations += n.observations.length;
  }
  return { pass: completed === seeds, seeds, steps, completed, observations, eventCounts,
    limits: 'Deterministic adversarial samples, not state-space exhaustion; storage loss and membership limits have separate directed tests.' };
}
