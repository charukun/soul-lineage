import { canonical, clone } from './independent-shared.js';
import { createLocalNode, majorityQuorum, receiveLocal } from './independent-protocol.js';

export function createCluster({ members = ['n0', 'n1', 'n2'], mutations = {} } = {}) {
  const nodes = Object.fromEntries(members.map(id => [id, createLocalNode({ id, members, mutations })]));
  return {
    members: [...members],
    nodes,
    alive: Object.fromEntries(members.map(id => [id, true])),
    paused: Object.fromEntries(members.map(id => [id, false])),
    queue: [],
    events: [],
    trace: [],
    declaredQuorum: majorityQuorum(members.length),
  };
}

export function enqueue(cluster, message) {
  cluster.queue.push(clone(message));
}

export function deliverAt(cluster, index) {
  const message = cluster.queue[index];
  if (!message) return false;
  cluster.queue.splice(index, 1);
  if (!cluster.nodes[message.to] || !cluster.alive[message.to] || cluster.paused[message.to]) {
    cluster.trace.push({ action: 'delivery-skipped', to: message.to, type: message.type });
    return false;
  }
  const result = receiveLocal(cluster.nodes[message.to], message);
  for (const outgoing of result.outbox) enqueue(cluster, outgoing);
  cluster.events.push(...result.events.map(event => ({ ...event, at: message.to })));
  cluster.trace.push({ action: 'deliver', to: message.to, type: message.type });
  return true;
}

export function dropAt(cluster, index) {
  const message = cluster.queue[index];
  if (!message) return false;
  cluster.queue.splice(index, 1);
  cluster.trace.push({ action: 'drop', to: message.to, type: message.type });
  return true;
}

export function crashProcess(cluster, id) {
  if (!cluster.nodes[id]) throw new Error('unknown node');
  cluster.alive[id] = false;
  cluster.trace.push({ action: 'crash-process', id });
}

export function resumeProcess(cluster, id) {
  if (!cluster.nodes[id]) throw new Error('unknown node');
  cluster.alive[id] = true;
  cluster.paused[id] = false;
  cluster.nodes[id].volatile = {
    preparedAcks: {}, commitAcks: {}, fenceAcks: {}, voteAcks: {}, recoveryReplies: {}, repliedInvocations: {},
  };
  cluster.trace.push({ action: 'resume-process', id });
}

export function pauseProcess(cluster, id) {
  if (!cluster.nodes[id]) throw new Error('unknown node');
  cluster.paused[id] = true;
  cluster.trace.push({ action: 'pause-process', id });
}

export function storageLoss(cluster, id) {
  if (!cluster.nodes[id]) throw new Error('unknown node');
  const replacement = createLocalNode({ id, members: cluster.members, mutations: cluster.nodes[id].mutations });
  cluster.nodes[id] = replacement;
  cluster.trace.push({ action: 'storage-loss', id });
}

export function durableRoots(cluster) {
  const roots = new Map();
  for (const node of Object.values(cluster.nodes)) {
    for (const entry of node.persistent.commitLog) {
      if (!roots.has(entry.root)) roots.set(entry.root, []);
      roots.get(entry.root).push(node.id);
    }
  }
  return roots;
}

export function independentOracle(cluster) {
  const violations = [];
  const durable = durableRoots(cluster);
  const byInvocation = new Map();
  for (const node of Object.values(cluster.nodes)) {
    for (const entry of node.persistent.commitLog) {
      if (!byInvocation.has(entry.invocationId)) byInvocation.set(entry.invocationId, new Set());
      byInvocation.get(entry.invocationId).add(entry.root);
    }
  }
  for (const [invocationId, roots] of byInvocation) {
    if (roots.size > 1) violations.push({ type: 'dedupe-divergence', invocationId, roots: [...roots] });
  }

  const parentByRoot = new Map();
  for (const node of Object.values(cluster.nodes)) for (const entry of node.persistent.commitLog) parentByRoot.set(entry.root, entry.parent);
  const children = new Map();
  for (const [root, parent] of parentByRoot) {
    if (!children.has(parent)) children.set(parent, new Set());
    children.get(parent).add(root);
  }
  for (const [parent, roots] of children) if (roots.size > 1) violations.push({ type: 'history-fork', parent, roots: [...roots] });

  for (const event of cluster.events.filter(event => event.type === 'CLIENT_RESULT' && !event.replay)) {
    const copies = durable.get(event.root)?.length ?? 0;
    if (copies < cluster.declaredQuorum) violations.push({ type: 'visible-without-declared-quorum', root: event.root, copies });
  }

  for (const node of Object.values(cluster.nodes)) {
    for (let index = 0; index < node.persistent.transitions.length; index += 1) {
      const transition = node.persistent.transitions[index];
      const expectedPredecessor = index === 0 ? 'genesis' : node.persistent.transitions[index - 1].root;
      if (transition.targetGeneration <= transition.sourceGeneration) violations.push({ type: 'generation-nonmonotonic', node: node.id, transition });
      if (transition.predecessor !== expectedPredecessor) violations.push({ type: 'transition-chain-gap', node: node.id, transition: transition.root, expectedPredecessor });
    }
  }

  return { pass: violations.length === 0, violations };
}

function clusterStateKey(cluster) {
  const nodeState = Object.fromEntries(cluster.members.map(id => [id, {
    alive: cluster.alive[id],
    paused: cluster.paused[id],
    persistent: cluster.nodes[id].persistent,
    volatile: cluster.nodes[id].volatile,
  }]));
  return canonical({ nodes: nodeState, queue: cluster.queue, events: cluster.events });
}

export function exploreBoundedCommitSchedules({ maxDepth = 8, maxStates = 50000 } = {}) {
  const initial = createCluster();
  enqueue(initial, { to: 'n0', type: 'CLIENT_PROPOSE', operationTypeId: 'canon:set', invocationId: 'inv:1', payload: { value: 1 } });
  const stack = [{ cluster: initial, depth: 0, crashUsed: false }];
  const visited = new Set();
  let states = 0;
  let transitions = 0;
  let resultStates = 0;
  const violations = [];

  while (stack.length) {
    const { cluster, depth, crashUsed } = stack.pop();
    const key = `${crashUsed ? 1 : 0}:${clusterStateKey(cluster)}`;
    if (visited.has(key)) continue;
    visited.add(key);
    states += 1;
    if (states > maxStates) throw new Error('state-space bound exceeded');

    const oracle = independentOracle(cluster);
    if (!oracle.pass) {
      violations.push({ trace: clone(cluster.trace), violations: oracle.violations });
      continue;
    }
    if (cluster.events.some(event => event.type === 'CLIENT_RESULT')) resultStates += 1;
    if (depth >= maxDepth) continue;

    for (let index = 0; index < cluster.queue.length; index += 1) {
      const delivered = clone(cluster);
      deliverAt(delivered, index);
      stack.push({ cluster: delivered, depth: depth + 1, crashUsed });
      transitions += 1;

      const dropped = clone(cluster);
      dropAt(dropped, index);
      stack.push({ cluster: dropped, depth: depth + 1, crashUsed });
      transitions += 1;
    }

    if (!crashUsed) {
      for (const id of cluster.members.filter(id => cluster.alive[id])) {
        const crashed = clone(cluster);
        crashProcess(crashed, id);
        stack.push({ cluster: crashed, depth: depth + 1, crashUsed: true });
        transitions += 1;
      }
    }
  }

  return {
    pass: violations.length === 0 && resultStates > 0,
    scope: '3 crash-fault nodes; one invocation; delivery/drop/reorder; at most one process crash; bounded depth; no liveness claim',
    maxDepth,
    states,
    transitions,
    resultStates,
    violations,
  };
}
