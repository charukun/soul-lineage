import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, command } from '../scripts/rrp-reconstruction/network.mjs';
import { canonical, copy, fixturePorts, keyOf, GENESIS } from '../scripts/rrp-reconstruction/encoding.mjs';
import { initialReplica, transition, validCertificate } from '../scripts/rrp-reconstruction/replica.mjs';
import { validCommand } from '../scripts/rrp-reconstruction/semantics.mjs';

const mutation = process.env.RRP_MUTATION ?? 'none';
const make = () => new Network({ mutation });
function safe(network) {
  const result = network.audit();
  assert.equal(result.pass, true, `INVARIANT: ${result.errors.join('; ')}`);
}
function commit(network, cmd, leader = 'n0') {
  network.propose(leader, cmd); network.settle(); safe(network);
  assert.ok(network.nodes[leader].disk.applied.length, 'LIVENESS: bounded failure-free completion');
}
function reachPhaseTwo(network, proposer, value, voters) {
  network.propose(proposer, value); network.persistAll(proposer);
  for (const id of voters) network.deliverAndPersist('PREPARE', id, proposer);
  for (const id of voters) network.deliverWhere(m => m.type === 'PROMISE' && m.from === id && m.to === proposer);
}

test('a complete local persist-before-ACK quorum is required', () => {
  const network = make();
  network.fault('n1', 'pause'); network.fault('n2', 'pause');
  network.propose('n0', command('spend', 'one', { amount: 1 }));
  network.settle(); safe(network);
  assert.equal(network.nodes.n0.disk.applied.length, 0, 'INVARIANT: minority published');
});

test('old accepts cannot cross persistent promises after a concurrent election', () => {
  const network = make();
  reachPhaseTwo(network, 'n0', command('credit', 'left', { amount: 1 }), ['n0', 'n1']);
  reachPhaseTwo(network, 'n2', command('credit', 'right', { amount: 2 }), ['n1', 'n2']);
  for (const id of ['n1', 'n2']) network.deliverAndPersist('ACCEPT', id, 'n2');
  safe(network);
  for (const id of ['n0', 'n1']) network.deliverAndPersist('ACCEPT', id, 'n0');
  safe(network);
  network.settle(); safe(network);
});

test('quorum ACK is evidence of past storage, not an oracle of current remote liveness', () => {
  const network = make();
  reachPhaseTwo(network, 'n0', command('spend', 'historical', { amount: 1 }), ['n0', 'n1']);
  for (const id of ['n0', 'n1']) network.deliverAndPersist('ACCEPT', id, 'n0');
  network.fault('n1', 'crash');
  for (const id of ['n0', 'n1']) network.deliverWhere(m => m.type === 'ACCEPTED' && m.from === id && m.to === 'n0');
  network.settle(); safe(network);
  assert.equal(network.nodes.n0.disk.application.balance, 1);
});

test('uncertain chosen operation is recovered without its original client retry', () => {
  const network = make();
  reachPhaseTwo(network, 'n0', command('spend', 'vanished-client', { amount: 1 }), ['n0', 'n1']);
  for (const id of ['n0', 'n1']) network.deliverAndPersist('ACCEPT', id, 'n0');
  network.fault('n0', 'crash');
  network.queue = network.queue.filter(p => p.message.body.to !== 'n0');
  commit(network, command('nop', 'recovery-timer'), 'n1');
  assert.equal(network.nodes.n1.disk.applied[0].value.command.id, 'vanished-client');
  commit(network, command('life', 'following', { parent: 'origin', lifeId: 'life-1' }), 'n1');
  assert.equal(network.nodes.n1.disk.applied.length, 2);
  safe(network);
});

test('durable dedupe returns the original receipt across process replacement and later slots', () => {
  const network = make(), request = command('credit', 'stable-id', { amount: 3 });
  commit(network, request);
  network.fault('n0', 'restart');
  commit(network, request, 'n1');
  safe(network);
  assert.equal(network.nodes.n1.disk.application.balance, 5, 'INVARIANT: duplicate effect');
  assert.equal(network.nodes.n1.disk.applied[1].result.slot, 1);
  commit(network, command('credit', 'stable-id', { amount: 4 }), 'n2');
  assert.equal(network.nodes.n2.disk.applied.at(-1).result.status, 'id-conflict');
});

test('lineage parent and duplicate identity checks survive concurrent intents', () => {
  const network = make();
  commit(network, command('life', 'birth1', { parent: 'origin', lifeId: 'life-1' }));
  commit(network, command('life', 'birth2', { parent: 'origin', lifeId: 'life-2' }));
  safe(network);
  assert.equal(network.nodes.n0.disk.applied.at(-1).result.status, 'stale-parent');
  commit(network, command('life', 'birth3', { parent: 'life-1', lifeId: 'life-1' }));
  assert.equal(network.nodes.n0.disk.applied.at(-1).result.status, 'duplicate-resource');
});

test('A to B to C policy handoff shares one monotone generation; replay never restores a snapshot', () => {
  const network = make();
  const first = command('switch', 'switch-a-b', { policy: 'relay', authority: 'n1' });
  commit(network, first);
  commit(network, command('credit', 'between', { amount: 5 }, 2));
  commit(network, command('switch', 'switch-b-c', { policy: 'peer', authority: 'n2' }, 2));
  commit(network, first); // retry old activation is an idempotent receipt, not a restore
  commit(network, command('credit', 'old-writer', { amount: 7 }, 1));
  safe(network);
  assert.equal(network.nodes.n0.disk.application.balance, 7);
  assert.equal(network.nodes.n0.disk.application.generation, 3);
});

test('recovery is per-record transfer; a manifest alone cannot make a learner complete', () => {
  const network = make();
  commit(network, command('credit', 'checkpoint', { amount: 4 }));
  network.fault('n2', 'storage-loss');
  network.event('n2', { type: 'sync', source: 'n0' });
  network.deliverWhere(m => m.type === 'SYNC');
  network.deliverAndPersist('RECOVER_MANIFEST', 'n2');
  network.event('n2', { type: 'snapshot-complete' });
  safe(network);
  assert.equal(network.nodes.n2.disk.snapshotReceipt, null, 'INVARIANT: atomic-copy fiction');
  network.fault('n2', 'restart');
  network.settle(); network.event('n2', { type: 'snapshot-complete' }); safe(network);
  assert.equal(network.nodes.n2.disk.application.balance, 6);
  assert.ok(network.nodes.n2.disk.snapshotReceipt);
  assert.equal(network.nodes.n2.disk.quarantined, true, 'Snapshot completion is not voting admission');
});

test('storage-loss incarnation is quarantined even when delayed old ballots arrive', () => {
  const network = make();
  reachPhaseTwo(network, 'n0', command('credit', 'loss', { amount: 1 }), ['n0', 'n1']);
  network.fault('n1', 'storage-loss');
  network.deliverAndPersist('ACCEPT', 'n1', 'n0');
  network.propose('n1', command('nop', 'forgotten')); network.persistAll('n1');
  assert.equal(Object.keys(network.nodes.n1.disk.accepted).length, 0);
  safe(network);
});

test('reordered local storage completions recheck promises transactionally', () => {
  const network = make();
  reachPhaseTwo(network, 'n0', command('credit', 'older', { amount: 1 }), ['n0', 'n1']);
  network.deliverWhere(m => m.type === 'ACCEPT' && m.to === 'n1' && m.from === 'n0');
  network.propose('n2', command('credit', 'newer', { amount: 2 })); network.persistAll('n2');
  network.deliverWhere(m => m.type === 'PREPARE' && m.to === 'n1' && m.from === 'n2');
  const writes = network.nodes.n1.volatile.writes;
  network.persist('n1', writes.at(-1).serial); network.persistAll('n1');
  assert.equal(network.nodes.n1.disk.accepted[1], undefined, 'INVARIANT: stale storage write crossed a promise');
  safe(network);
});

test('message duplicates/reordering/drop, pause/resume and timer retries preserve safety', () => {
  const network = make();
  network.propose('n0', command('spend', 'packet-faults', { amount: 1 })); network.persistAll('n0');
  network.duplicate(network.queue[0].serial); network.drop(network.queue[1].serial);
  network.queue.reverse(); network.fault('n2', 'pause'); network.settle(); safe(network);
  network.fault('n2', 'resume'); network.event('n0', { type: 'timer' }); network.settle(); safe(network);
  network.event('n2', { type: 'sync', source: 'n0' }); network.settle(); safe(network);
  assert.equal(network.nodes.n2.disk.application.balance, 1);
});

test('correlated loss does not create availability by counting copies in a vanished domain', () => {
  const network = make();
  network.fault('n0', 'crash'); network.fault('n1', 'crash');
  network.propose('n2', command('spend', 'domain-loss', { amount: 1 })); network.settle(); safe(network);
  assert.equal(network.nodes.n2.disk.applied.length, 0, 'INVARIANT: correlated minority committed');
});

test('closed command grammar, duplicate voter IDs, unsupported live voter rotation', () => {
  assert.equal(validCommand({ type: 'arbitrary-effect', id: 'bad', generation: 1 }), false);
  assert.equal(validCommand({ type: 'membership', id: 'new-voters', generation: 1, members: ['n1', 'n2', 'n3'] }), false);
  assert.equal(validCommand({ ...command('credit', 'extra', { amount: 1 }), effect: 'evil' }), false);
  assert.throws(() => fixturePorts(['n0', 'n0', 'n2']), /unique/);
  assert.throws(() => canonical({ value: NaN }), /safe-integer/);
  assert.throws(() => canonical({ value: undefined }), /safe-integer/);
});

test('certificate validates actual distinct signers, content and ballot, not supplied pass flags', () => {
  const network = new Network();
  commit(network, command('spend', 'certificate', { amount: 1 }));
  const record = network.nodes.n0.disk.chosen[1], ports = network.ports.get('n2');
  const valid = certificate => validCertificate(network.nodes.n2, record.value, record.ballot, certificate, ports);
  assert.equal(valid(record.certificate), true);
  assert.equal(valid([record.certificate[0], record.certificate[0]]), false);
  const changed = copy(record.certificate); changed[0].body.value.command.amount++;
  assert.equal(valid(changed), false);
  assert.equal(valid([{ pass: true }]), false);
});

test('locally indistinguishable inputs produce equal effects despite different remote truths', () => {
  const ports = fixturePorts(['n0', 'n1', 'n2']);
  const local = initialReplica('n0', ['n0', 'n1', 'n2']);
  const event = { type: 'propose', command: command('nop', 'locality') };
  // There is intentionally no argument in which either remote world can be supplied.
  assert.deepEqual(transition(local, event, ports.get('n0')), transition(copy(local), copy(event), ports.get('n0')));
  assert.equal(local.disk.applied.length, 0);
  assert.equal(GENESIS, keyOf({ genesis: 'rrp-independent-reference-v1' }));
});

test('two different remote worlds are indistinguishable at the exact same ACK delivery', () => {
  const alive = make();
  reachPhaseTwo(alive, 'n0', command('credit', 'same-ack', { amount: 1 }), ['n0', 'n1']);
  for (const id of ['n0', 'n1']) alive.deliverAndPersist('ACCEPT', id, 'n0');
  alive.deliverWhere(m => m.type === 'ACCEPTED' && m.from === 'n0' && m.to === 'n0');
  const dead = alive.fork(); dead.fault('n1', 'crash');
  assert.notEqual(alive.nodes.n1.mode, dead.nodes.n1.mode);
  assert.deepEqual(alive.nodes.n0, dead.nodes.n0);
  for (const network of [alive, dead]) network.deliverWhere(m => m.type === 'ACCEPTED' && m.from === 'n1' && m.to === 'n0');
  assert.deepEqual(alive.nodes.n0, dead.nodes.n0);
  assert.deepEqual(alive.queue, dead.queue);
  safe(alive); safe(dead);
});

test('composition trace combines policy generations, vanished client, election, replay and torn recovery', () => {
  const network = make();
  const switchAB = command('switch', 'composed-a-b', { policy: 'relay', authority: 'n1' });
  commit(network, switchAB);
  reachPhaseTwo(network, 'n0', command('credit', 'composed-uncertain', { amount: 4 }, 2), ['n0', 'n1']);
  for (const id of ['n0', 'n1']) network.deliverAndPersist('ACCEPT', id, 'n0');
  network.fault('n0', 'crash');
  network.propose('n1', command('nop', 'replacement-timer', {}, 2)); network.settle();
  for (let tick = 0; tick < 3; tick++) { network.event('n1', { type: 'timer' }); network.settle(); }
  safe(network);
  assert.equal(network.nodes.n1.disk.application.balance, 6);
  commit(network, command('switch', 'composed-b-c', { policy: 'peer', authority: 'n2' }, 2), 'n1');
  commit(network, switchAB, 'n1');
  commit(network, command('credit', 'composed-old-token', { amount: 9 }, 2), 'n1');
  assert.equal(network.nodes.n1.disk.application.balance, 6);
  network.fault('n0', 'restart');
  network.event('n0', { type: 'sync', source: 'n1' }); network.settle(); safe(network);
  network.fault('n2', 'storage-loss');
  network.event('n2', { type: 'sync', source: 'n1' });
  network.deliverWhere(m => m.type === 'SYNC');
  network.deliverAndPersist('RECOVER_MANIFEST', 'n2');
  network.deliverWhere(m => m.type === 'RECOVER_RECORD' && m.to === 'n2');
  network.fault('n2', 'crash'); // received record, but its local durable write never completed
  network.fault('n2', 'restart');
  network.event('n2', { type: 'snapshot-complete' }); safe(network);
  assert.equal(network.nodes.n2.disk.snapshotReceipt, null, 'INVARIANT: torn recovery activated');
  network.event('n2', { type: 'sync', source: 'n1' }); network.queue.reverse(); network.settle();
  network.event('n2', { type: 'snapshot-complete' }); safe(network);
  assert.equal(network.nodes.n2.disk.application.generation, 3);
  assert.equal(network.nodes.n2.disk.application.balance, 6);
  assert.ok(network.nodes.n2.disk.snapshotReceipt);
});
