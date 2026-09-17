import test from 'node:test';
import assert from 'node:assert/strict';
import {
  correlatedFailureDomainBoundary,
  directMembershipSwitchCounterexample,
} from '../src/game/reality-lab/independent-boundaries.js';
import {
  createCluster,
  deliverAt,
  enqueue,
  modelRoot,
  receiveLocal,
  resumeProcess,
} from '../src/game/reality-lab/independent-reconstruction.js';

function deliver(cluster, predicate) {
  const index = cluster.queue.findIndex(predicate);
  assert.notEqual(index, -1);
  deliverAt(cluster, index);
}

function commit(cluster, invocationId, payload) {
  enqueue(cluster, { to: 'n0', type: 'CLIENT_PROPOSE', operationTypeId: 'canon:set', invocationId, payload });
  deliver(cluster, row => row.type === 'CLIENT_PROPOSE');
  deliver(cluster, row => row.type === 'PREPARE' && row.to === 'n1');
  deliver(cluster, row => row.type === 'PREPARED_ACK' && row.to === 'n0');
  deliver(cluster, row => row.type === 'COMMIT_CERT' && row.to === 'n1');
  deliver(cluster, row => row.type === 'COMMIT_ACK' && row.to === 'n0');
  return cluster.events.findLast(row => row.type === 'CLIENT_RESULT');
}

function transition(sourceGeneration, targetGeneration, predecessor, stateRoot) {
  const row = { sourceGeneration, targetGeneration, predecessor, stateRoot };
  row.root = modelRoot(row);
  return row;
}

test('two durable copies in one failure domain do not imply one-domain fault tolerance', () => {
  const proof = correlatedFailureDomainBoundary({
    holders: ['n0', 'n1'],
    domainByMember: { n0: 'wifi-router-a', n1: 'wifi-router-a', n2: 'carrier-b' },
    failedDomain: 'wifi-router-a',
  });
  assert.equal(proof.independentDomains, 1);
  assert.equal(proof.survives, false);
  assert.deepEqual(proof.survivors, []);
});

test('placing quorum copies in distinct domains changes the correlated-failure result', () => {
  const proof = correlatedFailureDomainBoundary({
    holders: ['n0', 'n1'],
    domainByMember: { n0: 'wifi-a', n1: 'carrier-b' },
    failedDomain: 'wifi-a',
  });
  assert.equal(proof.independentDomains, 2);
  assert.equal(proof.survives, true);
  assert.deepEqual(proof.survivors, ['n1']);
});

test('direct membership replacement has disjoint old/new quorums and therefore needs a reconfiguration protocol', () => {
  const proof = directMembershipSwitchCounterexample();
  assert.equal(proof.unsafeDirectSwitch, true);
  assert.deepEqual(proof.intersection, []);
});

test('combined commit, durable policy fence, restart, delayed old message, and stable retry remains fail-closed', () => {
  const cluster = createCluster();
  const first = commit(cluster, 'combo:1', { value: 1 });
  assert.ok(first);
  cluster.queue.length = 0;

  const t = transition(1, 2, 'genesis', first.root);
  const fenceAcks = [];
  for (const id of ['n0', 'n1']) {
    const result = receiveLocal(cluster.nodes[id], { type: 'FENCE_PREPARE', from: 'n0', transition: t });
    fenceAcks.push(...result.outbox.filter(row => row.type === 'FENCE_ACK').map(row => row.from));
  }
  assert.deepEqual(new Set(fenceAcks), new Set(['n0', 'n1']));
  const cert = { transition: t, fencedBy: ['n0', 'n1'] };
  for (const id of cluster.members) receiveLocal(cluster.nodes[id], { type: 'ACTIVATE_CERT', from: 'n0', cert });
  assert.ok(cluster.members.every(id => cluster.nodes[id].persistent.generation === 2));

  cluster.alive.n1 = false;
  resumeProcess(cluster, 'n1');
  assert.equal(cluster.nodes.n1.persistent.generation, 2);

  const stale = { epoch: 1, generation: 1, parent: first.root, operationTypeId: 'canon:set', invocationId: 'late:old', payload: { value: 9 } };
  stale.root = modelRoot(stale);
  const rejected = receiveLocal(cluster.nodes.n1, { type: 'PREPARE', from: 'n0', proposal: stale });
  assert.equal(rejected.events[0].reason, 'stale-generation');

  enqueue(cluster, { to: 'n0', type: 'CLIENT_PROPOSE', operationTypeId: 'canon:set', invocationId: 'combo:1', payload: { value: 1 } });
  deliver(cluster, row => row.type === 'CLIENT_PROPOSE');
  const replay = cluster.events.findLast(row => row.type === 'CLIENT_RESULT');
  assert.equal(replay.replay, true);
  assert.equal(replay.root, first.root);
});
