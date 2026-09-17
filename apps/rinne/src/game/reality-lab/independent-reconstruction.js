// Independent adversarial model for RRP reconstruction.
// This is research evidence, not a production consensus implementation.

export const RECONSTRUCTION_EVIDENCE = Object.freeze({
  THEOREM: 'A',
  BOUNDED_MODEL: 'B',
  ASSUMPTION: 'C',
  HEURISTIC: 'D',
  EMPIRICAL: 'E',
  UNKNOWN: 'F',
});

const clone = value => structuredClone(value);
const distinct = values => [...new Set(values)];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

function canonical(value) {
  return JSON.stringify(stable(value));
}

// Deterministic identity for the bounded model only. It is deliberately not a
// cryptographic certificate and must never be treated as one in production.
export function modelRoot(value) {
  const text = canonical(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `model:${hash.toString(16).padStart(8, '0')}`;
}

export function majorityQuorum(memberCount) {
  if (!Number.isInteger(memberCount) || memberCount < 1) throw new Error('memberCount must be positive');
  return Math.floor(memberCount / 2) + 1;
}

function mutationDefaults(mutations = {}) {
  return {
    reduceQuorum: Boolean(mutations.reduceQuorum),
    disableFence: Boolean(mutations.disableFence),
    disableDedupe: Boolean(mutations.disableDedupe),
    disableParentCheck: Boolean(mutations.disableParentCheck),
    disableGenerationCheck: Boolean(mutations.disableGenerationCheck),
    disableTransitionChain: Boolean(mutations.disableTransitionChain),
    disableRecoveryQuorum: Boolean(mutations.disableRecoveryQuorum),
  };
}

export function createLocalNode({ id, members, mutations = {} }) {
  if (!id || !Array.isArray(members) || !members.includes(id) || new Set(members).size !== members.length) {
    throw new Error('node id must belong to a unique member set');
  }
  const declaredQuorum = majorityQuorum(members.length);
  const flags = mutationDefaults(mutations);
  const protocolQuorum = flags.reduceQuorum ? Math.max(1, declaredQuorum - 1) : declaredQuorum;
  return {
    id,
    members: [...members],
    declaredQuorum,
    protocolQuorum,
    mutations: flags,
    persistent: {
      epoch: 1,
      generation: 1,
      leaderId: members[0],
      votedFor: {},
      commitHead: 'genesis',
      commitLog: [],
      dedupe: {},
      prepares: {},
      fencedThrough: 0,
      transitionHead: 'genesis',
      transitions: [],
      pendingTransition: null,
    },
    volatile: {
      preparedAcks: {},
      commitAcks: {},
      fenceAcks: {},
      voteAcks: {},
      recoveryReplies: {},
      repliedInvocations: {},
    },
  };
}

function send(to, type, body) {
  return { to, type, ...clone(body) };
}

function proposalRoot(proposal) {
  return modelRoot({
    epoch: proposal.epoch,
    generation: proposal.generation,
    parent: proposal.parent,
    operationTypeId: proposal.operationTypeId,
    invocationId: proposal.invocationId,
    payload: proposal.payload,
  });
}

function transitionRoot(transition) {
  return modelRoot({
    sourceGeneration: transition.sourceGeneration,
    targetGeneration: transition.targetGeneration,
    predecessor: transition.predecessor,
    stateRoot: transition.stateRoot,
  });
}

function validMemberProof(node, ids, quorum = node.protocolQuorum) {
  const proof = distinct(ids ?? []);
  return proof.length >= quorum && proof.every(id => node.members.includes(id));
}

function commitLocally(node, proposal) {
  const root = proposal.root ?? proposalRoot(proposal);
  const entry = { ...clone(proposal), root };
  const existing = node.persistent.commitLog.find(row => row.root === root);
  if (!existing) node.persistent.commitLog.push(entry);
  node.persistent.commitHead = root;
  if (!node.mutations.disableDedupe) {
    node.persistent.dedupe[proposal.invocationId] = {
      root,
      payloadRoot: modelRoot({ operationTypeId: proposal.operationTypeId, payload: proposal.payload }),
    };
  }
  return entry;
}

function maybeEmitCommit(node, proposal, outbox, events) {
  const acks = distinct(node.volatile.preparedAcks[proposal.root] ?? []);
  if (acks.length < node.protocolQuorum) return;
  if (!node.persistent.commitLog.some(row => row.root === proposal.root)) commitLocally(node, proposal);
  node.volatile.commitAcks[proposal.root] ??= [];
  if (!node.volatile.commitAcks[proposal.root].includes(node.id)) node.volatile.commitAcks[proposal.root].push(node.id);
  const cert = { proposal, preparedBy: acks };
  for (const member of node.members) if (member !== node.id) outbox.push(send(member, 'COMMIT_CERT', { from: node.id, cert }));
  maybeReplyClient(node, proposal, events);
}

function maybeReplyClient(node, proposal, events) {
  const acks = distinct(node.volatile.commitAcks[proposal.root] ?? []);
  if (acks.length < node.protocolQuorum || node.volatile.repliedInvocations[proposal.invocationId]) return;
  node.volatile.repliedInvocations[proposal.invocationId] = true;
  events.push({
    type: 'CLIENT_RESULT',
    invocationId: proposal.invocationId,
    root: proposal.root,
    epoch: proposal.epoch,
    generation: proposal.generation,
    committedBy: acks,
  });
}

function acceptProposal(node, proposal) {
  if (!proposal || proposal.root !== proposalRoot(proposal)) return { ok: false, reason: 'bad-root' };
  if (proposal.epoch !== node.persistent.epoch) return { ok: false, reason: 'stale-epoch' };
  if (!node.mutations.disableGenerationCheck) {
    if (proposal.generation !== node.persistent.generation) return { ok: false, reason: 'stale-generation' };
    if (proposal.generation <= node.persistent.fencedThrough) return { ok: false, reason: 'generation-fenced' };
  }
  if (!node.mutations.disableParentCheck && proposal.parent !== node.persistent.commitHead) {
    return { ok: false, reason: 'parent-mismatch' };
  }
  if (!node.mutations.disableDedupe) {
    const prior = node.persistent.dedupe[proposal.invocationId];
    const payloadRoot = modelRoot({ operationTypeId: proposal.operationTypeId, payload: proposal.payload });
    if (prior && prior.payloadRoot !== payloadRoot) return { ok: false, reason: 'invocation-conflict' };
  }
  return { ok: true };
}

export function receiveLocal(node, message) {
  const outbox = [];
  const events = [];
  const reject = reason => ({ outbox, events: [...events, { type: 'REJECT', reason, messageType: message.type }] });

  switch (message.type) {
    case 'CLIENT_PROPOSE': {
      if (node.persistent.leaderId !== node.id) return reject('not-leader');
      if (!message.invocationId || !message.operationTypeId) return reject('missing-operation-identity');
      const prior = node.persistent.dedupe[message.invocationId];
      const payloadRoot = modelRoot({ operationTypeId: message.operationTypeId, payload: message.payload });
      if (prior && !node.mutations.disableDedupe) {
        if (prior.payloadRoot !== payloadRoot) return reject('invocation-conflict');
        events.push({ type: 'CLIENT_RESULT', invocationId: message.invocationId, root: prior.root, replay: true });
        return { outbox, events };
      }
      const proposal = {
        epoch: node.persistent.epoch,
        generation: node.persistent.generation,
        parent: node.persistent.commitHead,
        operationTypeId: message.operationTypeId,
        invocationId: message.invocationId,
        payload: clone(message.payload),
      };
      proposal.root = proposalRoot(proposal);
      const accepted = acceptProposal(node, proposal);
      if (!accepted.ok) return reject(accepted.reason);
      node.persistent.prepares[proposal.root] = clone(proposal);
      node.volatile.preparedAcks[proposal.root] = [node.id];
      for (const member of node.members) if (member !== node.id) outbox.push(send(member, 'PREPARE', { from: node.id, proposal }));
      maybeEmitCommit(node, proposal, outbox, events);
      return { outbox, events };
    }

    case 'PREPARE': {
      const accepted = acceptProposal(node, message.proposal);
      if (!accepted.ok) return reject(accepted.reason);
      node.persistent.prepares[message.proposal.root] = clone(message.proposal);
      outbox.push(send(message.from, 'PREPARED_ACK', {
        from: node.id,
        root: message.proposal.root,
        epoch: message.proposal.epoch,
        generation: message.proposal.generation,
      }));
      return { outbox, events };
    }

    case 'PREPARED_ACK': {
      if (node.persistent.leaderId !== node.id) return reject('not-leader');
      const proposal = node.persistent.prepares[message.root];
      if (!proposal) return reject('unknown-prepare');
      if (message.epoch !== proposal.epoch || message.generation !== proposal.generation) return reject('ack-mismatch');
      node.volatile.preparedAcks[message.root] ??= [node.id];
      if (!node.volatile.preparedAcks[message.root].includes(message.from)) node.volatile.preparedAcks[message.root].push(message.from);
      maybeEmitCommit(node, proposal, outbox, events);
      return { outbox, events };
    }

    case 'COMMIT_CERT': {
      const { proposal, preparedBy } = message.cert ?? {};
      if (!proposal || !validMemberProof(node, preparedBy)) return reject('bad-prepare-certificate');
      const accepted = acceptProposal(node, proposal);
      if (!accepted.ok) {
        const already = node.persistent.commitLog.some(row => row.root === proposal.root);
        if (!already) return reject(accepted.reason);
      }
      commitLocally(node, proposal);
      outbox.push(send(message.from, 'COMMIT_ACK', { from: node.id, root: proposal.root }));
      return { outbox, events };
    }

    case 'COMMIT_ACK': {
      if (node.persistent.leaderId !== node.id) return reject('not-leader');
      const proposal = node.persistent.commitLog.find(row => row.root === message.root);
      if (!proposal) return reject('unknown-commit');
      node.volatile.commitAcks[message.root] ??= [node.id];
      if (!node.volatile.commitAcks[message.root].includes(message.from)) node.volatile.commitAcks[message.root].push(message.from);
      maybeReplyClient(node, proposal, events);
      return { outbox, events };
    }

    case 'FENCE_PREPARE': {
      const t = message.transition;
      if (!t || t.root !== transitionRoot(t)) return reject('bad-transition-root');
      if (!node.mutations.disableGenerationCheck) {
        if (t.sourceGeneration !== node.persistent.generation || t.targetGeneration !== t.sourceGeneration + 1) return reject('bad-transition-generation');
      }
      if (!node.mutations.disableTransitionChain && t.predecessor !== node.persistent.transitionHead) return reject('bad-transition-parent');
      node.persistent.pendingTransition = clone(t);
      if (!node.mutations.disableFence) node.persistent.fencedThrough = Math.max(node.persistent.fencedThrough, t.sourceGeneration);
      outbox.push(send(message.from, 'FENCE_ACK', { from: node.id, root: t.root, sourceGeneration: t.sourceGeneration }));
      return { outbox, events };
    }

    case 'FENCE_ACK': {
      const pending = node.persistent.pendingTransition;
      if (!pending || pending.root !== message.root) return reject('unknown-transition');
      node.volatile.fenceAcks[pending.root] ??= [];
      if (!node.volatile.fenceAcks[pending.root].includes(message.from)) node.volatile.fenceAcks[pending.root].push(message.from);
      if (!node.volatile.fenceAcks[pending.root].includes(node.id) && node.persistent.fencedThrough >= pending.sourceGeneration) {
        node.volatile.fenceAcks[pending.root].push(node.id);
      }
      const acks = distinct(node.volatile.fenceAcks[pending.root]);
      if (acks.length >= node.protocolQuorum) {
        const cert = { transition: pending, fencedBy: acks };
        for (const member of node.members) outbox.push(send(member, 'ACTIVATE_CERT', { from: node.id, cert }));
      }
      return { outbox, events };
    }

    case 'ACTIVATE_CERT': {
      const { transition: t, fencedBy } = message.cert ?? {};
      if (!t || t.root !== transitionRoot(t) || !validMemberProof(node, fencedBy)) return reject('bad-transition-certificate');
      if (!node.mutations.disableGenerationCheck) {
        if (t.sourceGeneration !== node.persistent.generation || t.targetGeneration !== t.sourceGeneration + 1) return reject('bad-transition-generation');
      }
      if (!node.mutations.disableTransitionChain && t.predecessor !== node.persistent.transitionHead) return reject('bad-transition-parent');
      node.persistent.fencedThrough = Math.max(node.persistent.fencedThrough, t.sourceGeneration);
      node.persistent.generation = t.targetGeneration;
      node.persistent.transitionHead = t.root;
      if (!node.persistent.transitions.some(row => row.root === t.root)) node.persistent.transitions.push(clone(t));
      node.persistent.pendingTransition = null;
      return { outbox, events: [...events, { type: 'GENERATION_ACTIVATED', generation: t.targetGeneration, root: t.root }] };
    }

    case 'REQUEST_VOTE': {
      if (!Number.isInteger(message.epoch) || message.epoch < node.persistent.epoch) return reject('stale-election');
      if (message.epoch > node.persistent.epoch) {
        node.persistent.epoch = message.epoch;
        node.persistent.leaderId = null;
      }
      const already = node.persistent.votedFor[message.epoch];
      if (already && already !== message.candidateId) return reject('already-voted');
      if (!node.mutations.disableGenerationCheck && message.generation < node.persistent.generation) return reject('candidate-generation-behind');
      node.persistent.votedFor[message.epoch] = message.candidateId;
      outbox.push(send(message.candidateId, 'VOTE', { from: node.id, epoch: message.epoch, candidateId: message.candidateId }));
      return { outbox, events };
    }

    case 'VOTE': {
      if (message.candidateId !== node.id || message.epoch !== node.persistent.epoch) return reject('vote-mismatch');
      node.volatile.voteAcks[message.epoch] ??= [];
      if (!node.volatile.voteAcks[message.epoch].includes(message.from)) node.volatile.voteAcks[message.epoch].push(message.from);
      const voters = distinct(node.volatile.voteAcks[message.epoch]);
      if (voters.length >= node.protocolQuorum) {
        const cert = { epoch: message.epoch, leaderId: node.id, votedBy: voters };
        for (const member of node.members) outbox.push(send(member, 'EPOCH_CERT', { from: node.id, cert }));
      }
      return { outbox, events };
    }

    case 'EPOCH_CERT': {
      const cert = message.cert ?? {};
      if (!validMemberProof(node, cert.votedBy) || cert.epoch < node.persistent.epoch) return reject('bad-election-certificate');
      node.persistent.epoch = cert.epoch;
      node.persistent.leaderId = cert.leaderId;
      return { outbox, events: [...events, { type: 'LEADER_ACTIVATED', epoch: cert.epoch, leaderId: cert.leaderId }] };
    }

    case 'RECOVERY_QUERY': {
      const snapshot = {
        epoch: node.persistent.epoch,
        generation: node.persistent.generation,
        transitionHead: node.persistent.transitionHead,
        commitHead: node.persistent.commitHead,
        commitLog: clone(node.persistent.commitLog),
        dedupe: clone(node.persistent.dedupe),
        fencedThrough: node.persistent.fencedThrough,
        transitions: clone(node.persistent.transitions),
      };
      const stateRoot = modelRoot(snapshot);
      outbox.push(send(message.from, 'RECOVERY_REPLY', { from: node.id, requestId: message.requestId, stateRoot, snapshot }));
      return { outbox, events };
    }

    case 'RECOVERY_REPLY': {
      node.volatile.recoveryReplies[message.requestId] ??= [];
      const replies = node.volatile.recoveryReplies[message.requestId];
      if (!replies.some(row => row.from === message.from)) replies.push(clone(message));
      const groups = new Map();
      for (const reply of replies) {
        if (!groups.has(reply.stateRoot)) groups.set(reply.stateRoot, []);
        groups.get(reply.stateRoot).push(reply);
      }
      const needed = node.mutations.disableRecoveryQuorum ? 1 : node.protocolQuorum;
      const selected = [...groups.values()]
        .filter(rows => rows.length >= needed)
        .sort((a, b) => {
          const sa = a[0].snapshot;
          const sb = b[0].snapshot;
          return sb.generation - sa.generation || sb.commitLog.length - sa.commitLog.length || a[0].stateRoot.localeCompare(b[0].stateRoot);
        })[0];
      if (selected) {
        const proof = selected.slice(0, needed).map(row => row.from);
        const install = { requestId: message.requestId, stateRoot: selected[0].stateRoot, snapshot: selected[0].snapshot, responders: proof };
        for (const member of node.members) outbox.push(send(member, 'RECOVERY_INSTALL', { from: node.id, install }));
      }
      return { outbox, events };
    }

    case 'RECOVERY_INSTALL': {
      const { snapshot, stateRoot, responders } = message.install ?? {};
      const needed = node.mutations.disableRecoveryQuorum ? 1 : node.protocolQuorum;
      if (!snapshot || modelRoot(snapshot) !== stateRoot || !validMemberProof(node, responders, needed)) return reject('bad-recovery-proof');
      if (!node.mutations.disableGenerationCheck && snapshot.generation < node.persistent.generation) return reject('recovery-generation-rollback');
      node.persistent.epoch = Math.max(node.persistent.epoch, snapshot.epoch);
      node.persistent.generation = snapshot.generation;
      node.persistent.transitionHead = snapshot.transitionHead;
      node.persistent.commitHead = snapshot.commitHead;
      node.persistent.commitLog = clone(snapshot.commitLog);
      node.persistent.dedupe = clone(snapshot.dedupe);
      node.persistent.fencedThrough = snapshot.fencedThrough;
      node.persistent.transitions = clone(snapshot.transitions);
      outbox.push(send(message.from, 'RECOVERY_ACK', { from: node.id, requestId: message.install.requestId, stateRoot }));
      return { outbox, events };
    }

    case 'RECOVERY_ACK':
      return { outbox, events };

    default:
      return reject('unknown-message');
  }
}

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
  // Volatile state is gone after process restart; persistent state survives.
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

function normalizeResources(resources) {
  const ids = new Set();
  return resources.map(resource => {
    const id = String(resource?.id ?? '');
    if (!id) throw new Error('resource id required');
    if (ids.has(id)) throw new Error(`duplicate resource id: ${id}`);
    ids.add(id);
    switch (resource.type) {
      case 'bounded-counter':
        if (!Number.isInteger(resource.min) || !Number.isInteger(resource.max) || resource.min > resource.max) throw new Error('invalid bounded-counter');
        return { id, type: resource.type, min: resource.min, max: resource.max };
      case 'grow-only-set':
      case 'unique-register':
      case 'single-use-token':
        return { id, type: resource.type };
      default:
        throw new Error(`unsupported resource type: ${resource.type}`);
    }
  });
}

function normalizeEffect(resource, effect) {
  if (!effect || typeof effect !== 'object') throw new Error(`effect required for ${resource.id}`);
  switch (resource.type) {
    case 'bounded-counter':
      if (!Number.isInteger(effect.delta)) throw new Error(`bounded-counter only supports integer delta: ${resource.id}`);
      if (Object.keys(effect).some(key => key !== 'delta')) throw new Error(`unsupported bounded-counter effect: ${resource.id}`);
      return { delta: effect.delta };
    case 'grow-only-set':
      if (!Object.hasOwn(effect, 'add') || Object.keys(effect).some(key => key !== 'add')) throw new Error(`grow-only-set only supports add: ${resource.id}`);
      return { add: clone(effect.add) };
    case 'unique-register':
      if (!Object.hasOwn(effect, 'assign') || Object.keys(effect).some(key => key !== 'assign')) throw new Error(`unique-register only supports assign: ${resource.id}`);
      return { assign: clone(effect.assign) };
    case 'single-use-token':
      if (effect.consume !== true || Object.keys(effect).some(key => key !== 'consume')) throw new Error(`single-use-token only supports consume=true: ${resource.id}`);
      return { consume: true };
    default:
      throw new Error('unsupported resource');
  }
}

function pairWitness(resource, left, right) {
  if (!left || !right) return null;
  if (resource.type === 'grow-only-set') return null;
  if (resource.type === 'single-use-token') return left.consume && right.consume ? { resourceId: resource.id, reason: 'double-consume' } : null;
  if (resource.type === 'unique-register') {
    return canonical(left.assign) === canonical(right.assign) ? null : { resourceId: resource.id, reason: 'different-unique-assignment', left: left.assign, right: right.assign };
  }
  if (resource.type === 'bounded-counter') {
    for (let base = resource.min; base <= resource.max; base += 1) {
      const a = base + left.delta;
      const b = base + right.delta;
      const merged = base + left.delta + right.delta;
      const individuallyValid = a >= resource.min && a <= resource.max && b >= resource.min && b <= resource.max;
      const mergedValid = merged >= resource.min && merged <= resource.max;
      if (individuallyValid && !mergedValid) return { resourceId: resource.id, reason: 'bounded-counter-merge', base, merged };
    }
  }
  return null;
}

export function compileDeclaredInvariantKernel({ resources = [], operations = [] } = {}) {
  const normalizedResources = normalizeResources(resources);
  const resourceMap = new Map(normalizedResources.map(resource => [resource.id, resource]));
  const operationIds = new Set();
  const normalizedOperations = operations.map(operation => {
    const id = String(operation?.id ?? '');
    if (!id) throw new Error('operation id required');
    if (operationIds.has(id)) throw new Error(`duplicate operation id: ${id}`);
    operationIds.add(id);
    const effects = {};
    for (const [resourceId, effect] of Object.entries(operation.effects ?? {})) {
      const resource = resourceMap.get(resourceId);
      if (!resource) throw new Error(`unknown resource: ${resourceId}`);
      effects[resourceId] = normalizeEffect(resource, effect);
    }
    return { id, effects };
  });

  const conflicts = [];
  const safePairs = [];
  for (let i = 0; i < normalizedOperations.length; i += 1) {
    for (let j = i; j < normalizedOperations.length; j += 1) {
      const left = normalizedOperations[i];
      const right = normalizedOperations[j];
      const shared = Object.keys(left.effects).filter(id => Object.hasOwn(right.effects, id));
      const witnesses = shared.map(resourceId => pairWitness(resourceMap.get(resourceId), left.effects[resourceId], right.effects[resourceId])).filter(Boolean);
      const pair = { left: left.id, right: right.id, sameDefinitionConcurrent: i === j, shared, witnesses };
      if (witnesses.length) conflicts.push(pair); else safePairs.push(pair);
    }
  }

  return {
    resources: normalizedResources,
    operations: normalizedOperations,
    conflicts,
    safePairs,
    scope: 'finite declared effect grammar only; not a general I-confluence decision procedure',
  };
}

export function causalObservationHorizon({ edges = [], source, observer, causalComplete = false } = {}) {
  if (!causalComplete) return { usable: false, reason: 'causal graph completeness is an explicit assumption' };
  const nodes = new Set([source, observer]);
  for (const edge of edges) {
    if (!Number.isFinite(edge.minDelayMs) || edge.minDelayMs < 0) throw new Error('minDelayMs must be a sound nonnegative lower bound');
    nodes.add(edge.from); nodes.add(edge.to);
  }
  const distance = Object.fromEntries([...nodes].map(node => [node, Infinity]));
  distance[source] = 0;
  const unvisited = new Set(nodes);
  while (unvisited.size) {
    let current = null;
    for (const node of unvisited) if (current === null || distance[node] < distance[current]) current = node;
    if (current === null || distance[current] === Infinity) break;
    unvisited.delete(current);
    for (const edge of edges.filter(edge => edge.from === current)) {
      distance[edge.to] = Math.min(distance[edge.to], distance[current] + edge.minDelayMs);
    }
  }
  return {
    usable: true,
    earliestInfluenceMs: distance[observer],
    deferBeforeMs: distance[observer],
    condition: 'safe only if every path capable of changing this observer output is present and every minDelayMs bound is sound',
  };
}

export function speculationBoundary({ errorBound, boundaryMargin, rollbackable, irreversible = false } = {}) {
  if (![errorBound, boundaryMargin].every(Number.isFinite) || errorBound < 0 || boundaryMargin < 0) throw new Error('bounds must be finite and nonnegative');
  const safe = Boolean(rollbackable) && !irreversible && errorBound < boundaryMargin;
  return {
    safe,
    headroom: boundaryMargin - errorBound,
    condition: 'a classical prediction bound, not Heisenberg uncertainty; reconcile before the bound reaches a discrete/irreversible decision boundary',
  };
}

export function clientDisappearanceKnowledgeCounterexample() {
  return {
    evidence: RECONSTRUCTION_EVIDENCE.THEOREM,
    histories: [
      { server: 'committed', reply: 'lost', clientObservation: 'timeout' },
      { server: 'not-committed', reply: 'none', clientObservation: 'timeout' },
    ],
    indistinguishableToClient: true,
    conclusion: 'without later communication or an external witness, a disappeared client cannot know from the timeout alone whether its operation committed',
  };
}

export function compositionCounterexample() {
  return {
    evidence: RECONSTRUCTION_EVIDENCE.THEOREM,
    individuallySafe: ['election chooses one leader per epoch', 'commit preserves a parent chain inside one generation', 'handoff fences one source generation'],
    missingSharedInvariant: 'commit acceptance must bind the active generation/transition certificate',
    counterexample: 'a leader elected safely in epoch e can accept a generation-g write after a separately safe g→g+1 handoff unless the commit rule rejects that stale generation',
    conclusion: 'component safety predicates do not compose by conjunction alone',
  };
}

export function fairArchitectureBaselines() {
  const commonFreedom = {
    semanticSplit: true,
    batching: true,
    interestManagement: true,
    adaptiveTopology: true,
    irreversibleOnlyStrongPath: true,
  };
  return [
    { id: 'canon-only-raft-hybrid', ...commonFreedom, strongPlane: 'Raft/replicated log', weakPlane: 'CRDT/causal or local projection', realtime: 'authoritative prediction/rollback/state sync' },
    { id: 'vr-chain-hybrid', ...commonFreedom, strongPlane: 'Viewstamped Replication or Chain Replication with a membership service', weakPlane: 'eventual/causal', realtime: 'snapshot/state sync' },
    { id: 'paxos-family-hybrid', ...commonFreedom, strongPlane: 'Paxos/Flexible/EPaxos chosen by conflict and latency assumptions', weakPlane: 'CRDT/causal', realtime: 'rollback/state sync' },
    { id: 'peer-canon-candidate', ...commonFreedom, strongPlane: 'custom peer crash protocol only if infrastructure constraints justify its proof burden', weakPlane: 'CRDT/causal', realtime: 'peer-host prediction/rollback' },
  ];
}

export function runIndependentCounterexamples() {
  const client = clientDisappearanceKnowledgeCounterexample();
  const composition = compositionCounterexample();
  const horizon = causalObservationHorizon({
    source: 'A', observer: 'C', causalComplete: true,
    edges: [{ from: 'A', to: 'B', minDelayMs: 40 }, { from: 'B', to: 'C', minDelayMs: 30 }, { from: 'A', to: 'C', minDelayMs: 100 }],
  });
  const speculation = speculationBoundary({ errorBound: 0.2, boundaryMargin: 0.5, rollbackable: true });
  return {
    pass: client.indistinguishableToClient && composition.missingSharedInvariant && horizon.earliestInfluenceMs === 70 && speculation.safe,
    client,
    composition,
    horizon,
    speculation,
    baselines: fairArchitectureBaselines(),
  };
}
