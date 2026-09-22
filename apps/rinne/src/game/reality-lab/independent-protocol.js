import { canonical, clone, distinct } from './independent-shared.js';

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

function receiveCommitMessage(node, message, outbox, events, reject) {
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
    default:
      return null;
  }
}

function receiveGenerationMessage(node, message, outbox, events, reject) {
  switch (message.type) {
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
    default:
      return null;
  }
}

function receiveElectionMessage(node, message, outbox, events, reject) {
  switch (message.type) {
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
    default:
      return null;
  }
}

function recoverySnapshot(node) {
  return {
    epoch: node.persistent.epoch,
    generation: node.persistent.generation,
    transitionHead: node.persistent.transitionHead,
    commitHead: node.persistent.commitHead,
    commitLog: clone(node.persistent.commitLog),
    dedupe: clone(node.persistent.dedupe),
    fencedThrough: node.persistent.fencedThrough,
    transitions: clone(node.persistent.transitions),
  };
}

function receiveRecoveryMessage(node, message, outbox, events, reject) {
  switch (message.type) {
    case 'RECOVERY_QUERY': {
      const snapshot = recoverySnapshot(node);
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
      return null;
  }
}

export function receiveLocal(node, message) {
  const outbox = [];
  const events = [];
  const reject = reason => ({ outbox, events: [...events, { type: 'REJECT', reason, messageType: message.type }] });
  return receiveCommitMessage(node, message, outbox, events, reject)
    ?? receiveGenerationMessage(node, message, outbox, events, reject)
    ?? receiveElectionMessage(node, message, outbox, events, reject)
    ?? receiveRecoveryMessage(node, message, outbox, events, reject)
    ?? reject('unknown-message');
}
