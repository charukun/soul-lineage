import test from 'node:test';
import assert from 'node:assert/strict';
import {
  causalObservationHorizon,
  clientDisappearanceKnowledgeCounterexample,
  compileDeclaredInvariantKernel,
  compositionCounterexample,
  createCluster,
  createLocalNode,
  deliverAt,
  dropAt,
  enqueue,
  exploreBoundedCommitSchedules,
  fairArchitectureBaselines,
  independentOracle,
  modelRoot,
  pauseProcess,
  receiveLocal,
  resumeProcess,
  runIndependentCounterexamples,
  speculationBoundary,
  storageLoss,
} from '../src/game/reality-lab/independent-reconstruction.js';

function find(cluster, predicate) {
  return cluster.queue.findIndex(predicate);
}

function deliver(cluster, predicate) {
  const index = find(cluster, predicate);
  assert.notEqual(index, -1, `missing message in queue: ${cluster.queue.map(row => row.type).join(',')}`);
  return deliverAt(cluster, index);
}

function propose(cluster, invocationId = 'inv:1', payload = { value: 1 }) {
  enqueue(cluster, { to: 'n0', type: 'CLIENT_PROPOSE', operationTypeId: 'canon:set', invocationId, payload });
  deliver(cluster, row => row.type === 'CLIENT_PROPOSE');
}

function driveOneCommit(cluster, invocationId = 'inv:1', payload = { value: 1 }) {
  propose(cluster, invocationId, payload);
  deliver(cluster, row => row.type === 'PREPARE' && row.to === 'n1');
  deliver(cluster, row => row.type === 'PREPARED_ACK' && row.to === 'n0');
  deliver(cluster, row => row.type === 'COMMIT_CERT' && row.to === 'n1');
  deliver(cluster, row => row.type === 'COMMIT_ACK' && row.to === 'n0');
  return cluster.events.findLast(row => row.type === 'CLIENT_RESULT');
}

function proposal({ parent = 'genesis', invocationId = 'fork:1', payload = { value: 2 }, generation = 1, epoch = 1 } = {}) {
  const row = { epoch, generation, parent, operationTypeId: 'canon:set', invocationId, payload };
  row.root = modelRoot(row);
  return row;
}

function transition({ sourceGeneration, targetGeneration, predecessor, stateRoot }) {
  const row = { sourceGeneration, targetGeneration, predecessor, stateRoot };
  row.root = modelRoot(row);
  return row;
}

test('client result follows quorum durable commit acknowledgements without remote state reads', () => {
  const cluster = createCluster();
  const result = driveOneCommit(cluster);
  assert.ok(result);
  assert.equal(result.committedBy.length, 2);
  assert.equal(cluster.nodes.n0.persistent.commitHead, result.root);
  assert.equal(cluster.nodes.n1.persistent.commitHead, result.root);
  assert.equal(independentOracle(cluster).pass, true);
});

test('bounded scheduler explores delivery/drop/reorder and one process crash without safety violation', () => {
  const proof = exploreBoundedCommitSchedules({ maxDepth: 8 });
  assert.equal(proof.pass, true);
  assert.ok(proof.states > 500);
  assert.ok(proof.transitions > 1000);
  assert.ok(proof.resultStates > 0);
});

test('quorum-minus-one mutation is detected by an independent visibility oracle', () => {
  const cluster = createCluster({ mutations: { reduceQuorum: true } });
  propose(cluster, 'q:1');
  const result = cluster.events.find(row => row.type === 'CLIENT_RESULT');
  assert.ok(result);
  const oracle = independentOracle(cluster);
  assert.equal(oracle.pass, false);
  assert.ok(oracle.violations.some(row => row.type === 'visible-without-declared-quorum'));
});

test('compiler rejects duplicate resource ids and unsupported effect grammar', () => {
  assert.throws(() => compileDeclaredInvariantKernel({
    resources: [{ id: 'stock', type: 'bounded-counter', min: 0, max: 1 }, { id: 'stock', type: 'grow-only-set' }],
  }), /duplicate resource id/);
  assert.throws(() => compileDeclaredInvariantKernel({
    resources: [{ id: 'seen', type: 'grow-only-set' }],
    operations: [{ id: 'remove', effects: { seen: { remove: 'x' } } }],
  }), /only supports add/);
});

test('compiler checks concurrent invocations of the same operation definition', () => {
  const compiled = compileDeclaredInvariantKernel({
    resources: [{ id: 'stock', type: 'bounded-counter', min: 0, max: 1 }],
    operations: [{ id: 'reserve', effects: { stock: { delta: -1 } } }],
  });
  const self = compiled.conflicts.find(row => row.left === 'reserve' && row.right === 'reserve');
  assert.ok(self);
  assert.equal(self.sameDefinitionConcurrent, true);
});

test('dedupe mutation permits one invocation id to acquire two committed roots', () => {
  const safe = createCluster();
  const first = driveOneCommit(safe, 'same:1', { value: 1 });
  enqueue(safe, { to: 'n0', type: 'CLIENT_PROPOSE', operationTypeId: 'canon:set', invocationId: 'same:1', payload: { value: 2 } });
  deliver(safe, row => row.type === 'CLIENT_PROPOSE');
  assert.ok(safe.events.some(row => row.type === 'REJECT' && row.reason === 'invocation-conflict'));
  assert.equal(independentOracle(safe).pass, true);

  const mutant = createCluster({ mutations: { disableDedupe: true } });
  driveOneCommit(mutant, 'same:1', { value: 1 });
  while (mutant.queue.length) dropAt(mutant, 0);
  driveOneCommit(mutant, 'same:1', { value: 2 });
  const roots = new Set(Object.values(mutant.nodes).flatMap(node => node.persistent.commitLog.filter(row => row.invocationId === 'same:1').map(row => row.root)));
  assert.equal(roots.size, 2);
  assert.equal(independentOracle(mutant).pass, false);
  assert.notEqual(first.root, [...roots][1]);
});

test('parent-check mutation admits a fork that the independent oracle detects', () => {
  const safe = createCluster();
  const first = driveOneCommit(safe, 'first');
  const bad = proposal({ parent: 'genesis', invocationId: 'fork' });
  const cert = { proposal: bad, preparedBy: ['n0', 'n1'] };
  const before = safe.nodes.n0.persistent.commitHead;
  receiveLocal(safe.nodes.n0, { type: 'COMMIT_CERT', from: 'n1', cert });
  assert.equal(safe.nodes.n0.persistent.commitHead, before);

  const mutant = createCluster({ mutations: { disableParentCheck: true } });
  driveOneCommit(mutant, 'first');
  while (mutant.queue.length) dropAt(mutant, 0);
  for (const id of ['n0', 'n1']) receiveLocal(mutant.nodes[id], { type: 'COMMIT_CERT', from: 'n1', cert });
  assert.equal(mutant.nodes.n0.persistent.commitHead, bad.root);
  assert.equal(independentOracle(mutant).pass, false);
  assert.ok(independentOracle(mutant).violations.some(row => row.type === 'history-fork'));
  assert.ok(first.root);
});

test('durable fence rejects delayed old-generation work before target activation', () => {
  const members = ['n0', 'n1', 'n2'];
  const n0 = createLocalNode({ id: 'n0', members });
  const n1 = createLocalNode({ id: 'n1', members });
  const t = transition({ sourceGeneration: 1, targetGeneration: 2, predecessor: 'genesis', stateRoot: 'genesis' });
  receiveLocal(n0, { type: 'FENCE_PREPARE', from: 'n0', transition: t });
  receiveLocal(n1, { type: 'FENCE_PREPARE', from: 'n0', transition: t });
  const old = proposal({ generation: 1, invocationId: 'late:old' });
  const r0 = receiveLocal(n0, { type: 'PREPARE', from: 'n0', proposal: old });
  const r1 = receiveLocal(n1, { type: 'PREPARE', from: 'n0', proposal: old });
  assert.equal(r0.events[0].reason, 'generation-fenced');
  assert.equal(r1.events[0].reason, 'generation-fenced');
});

test('fence removal mutation allows an old-generation quorum after acknowledgements', () => {
  const members = ['n0', 'n1', 'n2'];
  const nodes = ['n0', 'n1'].map(id => createLocalNode({ id, members, mutations: { disableFence: true } }));
  const t = transition({ sourceGeneration: 1, targetGeneration: 2, predecessor: 'genesis', stateRoot: 'genesis' });
  for (const node of nodes) receiveLocal(node, { type: 'FENCE_PREPARE', from: 'n0', transition: t });
  const old = proposal({ generation: 1, invocationId: 'late:old' });
  assert.equal(receiveLocal(nodes[0], { type: 'PREPARE', from: 'n0', proposal: old }).events.length, 0);
  assert.equal(receiveLocal(nodes[1], { type: 'PREPARE', from: 'n0', proposal: old }).events.length, 0);
});

test('generation-check mutation defeats an otherwise persisted generation fence', () => {
  const members = ['n0', 'n1', 'n2'];
  const node = createLocalNode({ id: 'n0', members, mutations: { disableGenerationCheck: true } });
  const t = transition({ sourceGeneration: 1, targetGeneration: 2, predecessor: 'genesis', stateRoot: 'genesis' });
  receiveLocal(node, { type: 'FENCE_PREPARE', from: 'n0', transition: t });
  assert.equal(node.persistent.fencedThrough, 1);
  const old = proposal({ generation: 1, invocationId: 'late:old' });
  assert.equal(receiveLocal(node, { type: 'PREPARE', from: 'n0', proposal: old }).events.length, 0);
});

test('transition generation validation blocks chained rollback while its mutation reactivates an older generation', () => {
  const members = ['n0', 'n1', 'n2'];
  const activate = (node, t) => receiveLocal(node, { type: 'ACTIVATE_CERT', from: 'n0', cert: { transition: t, fencedBy: ['n0', 'n1'] } });
  const t1 = transition({ sourceGeneration: 1, targetGeneration: 2, predecessor: 'genesis', stateRoot: 's1' });
  const t2 = transition({ sourceGeneration: 2, targetGeneration: 3, predecessor: t1.root, stateRoot: 's2' });
  const rollback = transition({ sourceGeneration: 3, targetGeneration: 2, predecessor: t2.root, stateRoot: 'old' });
  const safe = createLocalNode({ id: 'n0', members });
  activate(safe, t1); activate(safe, t2);
  const rejected = activate(safe, rollback);
  assert.equal(safe.persistent.generation, 3);
  assert.equal(rejected.events[0].reason, 'bad-transition-generation');

  const mutant = createLocalNode({ id: 'n0', members, mutations: { disableGenerationCheck: true } });
  activate(mutant, t1); activate(mutant, t2); activate(mutant, rollback);
  assert.equal(mutant.persistent.generation, 2);
});

test('recovery is message-evidence based and one-reply mutation can roll visible history backward', () => {
  const members = ['n0', 'n1', 'n2'];
  const current = createLocalNode({ id: 'n0', members });
  const committed = proposal({ invocationId: 'keep' });
  receiveLocal(current, { type: 'COMMIT_CERT', from: 'n1', cert: { proposal: committed, preparedBy: ['n0', 'n1'] } });
  assert.equal(current.persistent.commitHead, committed.root);
  const genesisSnapshot = {
    epoch: 1, generation: 1, transitionHead: 'genesis', commitHead: 'genesis', commitLog: [], dedupe: {}, fencedThrough: 0, transitions: [],
  };
  const stateRoot = modelRoot(genesisSnapshot);
  const install = { requestId: 'r1', stateRoot, snapshot: genesisSnapshot, responders: ['n2'] };
  const base = receiveLocal(current, { type: 'RECOVERY_INSTALL', from: 'n2', install });
  assert.equal(base.events[0].reason, 'bad-recovery-proof');
  assert.equal(current.persistent.commitHead, committed.root);

  const mutant = createLocalNode({ id: 'n0', members, mutations: { disableRecoveryQuorum: true } });
  receiveLocal(mutant, { type: 'COMMIT_CERT', from: 'n1', cert: { proposal: committed, preparedBy: ['n0', 'n1'] } });
  receiveLocal(mutant, { type: 'RECOVERY_INSTALL', from: 'n2', install });
  assert.equal(mutant.persistent.commitHead, 'genesis');
});

test('persistent one-vote-per-epoch prevents concurrent same-epoch majorities', () => {
  const members = ['n0', 'n1', 'n2'];
  const nodes = Object.fromEntries(members.map(id => [id, createLocalNode({ id, members })]));
  const votesA = [];
  const votesB = [];
  for (const id of members) {
    const a = receiveLocal(nodes[id], { type: 'REQUEST_VOTE', from: 'n0', candidateId: 'n0', epoch: 2, generation: 1 });
    votesA.push(...a.outbox.filter(row => row.type === 'VOTE').map(row => row.from));
    const b = receiveLocal(nodes[id], { type: 'REQUEST_VOTE', from: 'n1', candidateId: 'n1', epoch: 2, generation: 1 });
    votesB.push(...b.outbox.filter(row => row.type === 'VOTE').map(row => row.from));
  }
  assert.equal(votesA.length, 3);
  assert.equal(votesB.length, 0);
  assert.ok(!(votesA.length >= 2 && votesB.length >= 2));
});

test('duplicates, pause/resume, and stale delayed messages do not bypass local guards', () => {
  const cluster = createCluster();
  propose(cluster, 'dup:1');
  const original = cluster.queue.find(row => row.type === 'PREPARE' && row.to === 'n1');
  enqueue(cluster, original);
  deliver(cluster, row => row.type === 'PREPARE' && row.to === 'n1');
  deliver(cluster, row => row.type === 'PREPARE' && row.to === 'n1');
  pauseProcess(cluster, 'n2');
  assert.equal(cluster.paused.n2, true);
  resumeProcess(cluster, 'n2');
  assert.equal(cluster.paused.n2, false);

  const node = cluster.nodes.n1;
  node.persistent.generation = 2;
  const stale = proposal({ generation: 1, invocationId: 'stale' });
  const result = receiveLocal(node, { type: 'PREPARE', from: 'n0', proposal: stale });
  assert.equal(result.events[0].reason, 'stale-generation');
});

test('process restart preserves persistent commit while storage loss is a distinct failure', () => {
  const cluster = createCluster();
  const result = driveOneCommit(cluster, 'restart:1');
  assert.equal(cluster.nodes.n0.persistent.commitHead, result.root);
  cluster.alive.n0 = false;
  resumeProcess(cluster, 'n0');
  assert.equal(cluster.nodes.n0.persistent.commitHead, result.root);
  storageLoss(cluster, 'n0');
  assert.equal(cluster.nodes.n0.persistent.commitHead, 'genesis');
  assert.equal(cluster.nodes.n1.persistent.commitHead, result.root);
});

test('old epoch protocol messages are rejected from local persistent epoch evidence', () => {
  const node = createLocalNode({ id: 'n1', members: ['n0', 'n1', 'n2'] });
  receiveLocal(node, { type: 'REQUEST_VOTE', from: 'n1', candidateId: 'n1', epoch: 2, generation: 1 });
  const stale = proposal({ epoch: 1, generation: 1, invocationId: 'old-epoch' });
  const result = receiveLocal(node, { type: 'PREPARE', from: 'n0', proposal: stale });
  assert.equal(result.events[0].reason, 'stale-epoch');
});

test('transition predecessor check closes a multi-handoff chain and its mutation admits a detached generation', () => {
  const members = ['n0', 'n1', 'n2'];
  const activate = (node, t) => receiveLocal(node, { type: 'ACTIVATE_CERT', from: 'n0', cert: { transition: t, fencedBy: ['n0', 'n1'] } });
  const t1 = transition({ sourceGeneration: 1, targetGeneration: 2, predecessor: 'genesis', stateRoot: 's1' });
  const detached = transition({ sourceGeneration: 2, targetGeneration: 3, predecessor: 'genesis', stateRoot: 'detached' });
  const safe = createLocalNode({ id: 'n0', members });
  activate(safe, t1);
  const rejected = activate(safe, detached);
  assert.equal(safe.persistent.generation, 2);
  assert.equal(rejected.events[0].reason, 'bad-transition-parent');

  const mutant = createLocalNode({ id: 'n0', members, mutations: { disableTransitionChain: true } });
  activate(mutant, t1);
  activate(mutant, detached);
  assert.equal(mutant.persistent.generation, 3);
  assert.equal(mutant.persistent.transitionHead, detached.root);
});

test('client disappearance leaves committed and uncommitted histories indistinguishable without later evidence', () => {
  const proof = clientDisappearanceKnowledgeCounterexample();
  assert.equal(proof.indistinguishableToClient, true);
  assert.equal(new Set(proof.histories.map(row => row.clientObservation)).size, 1);
});

test('component safety does not imply composition safety without a shared generation invariant', () => {
  const proof = compositionCounterexample();
  assert.match(proof.missingSharedInvariant, /generation/);
  assert.match(proof.counterexample, /stale generation/);
});

test('observation horizon is a classical causal lower-bound calculation with explicit completeness assumption', () => {
  assert.equal(causalObservationHorizon({ source: 'a', observer: 'c', edges: [], causalComplete: false }).usable, false);
  const proof = causalObservationHorizon({
    source: 'a', observer: 'c', causalComplete: true,
    edges: [{ from: 'a', to: 'b', minDelayMs: 25 }, { from: 'b', to: 'c', minDelayMs: 30 }, { from: 'a', to: 'c', minDelayMs: 80 }],
  });
  assert.equal(proof.earliestInfluenceMs, 55);
});

test('uncertainty budget is a classical prediction margin and forbids irreversible speculation', () => {
  assert.equal(speculationBoundary({ errorBound: 0.2, boundaryMargin: 0.3, rollbackable: true }).safe, true);
  assert.equal(speculationBoundary({ errorBound: 0.3, boundaryMargin: 0.3, rollbackable: true }).safe, false);
  assert.equal(speculationBoundary({ errorBound: 0.1, boundaryMargin: 1, rollbackable: true, irreversible: true }).safe, false);
});

test('fair baselines receive the same semantic split and topology freedoms', () => {
  const baselines = fairArchitectureBaselines();
  assert.ok(baselines.length >= 4);
  assert.ok(baselines.every(row => row.semanticSplit && row.batching && row.interestManagement && row.adaptiveTopology && row.irreversibleOnlyStrongPath));
  assert.ok(baselines.some(row => row.id === 'canon-only-raft-hybrid'));
});

test('combined reconstruction evidence is internally consistent', () => {
  assert.equal(runIndependentCounterexamples().pass, true);
});
