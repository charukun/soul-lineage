import { GENESIS, copy, equal, keyOf, compareBallot, validBallot } from './encoding.mjs';
import { initialApplication, validCommand, applyCommand } from './semantics.mjs';

export function initialReplica(id, members) {
  if (!members.includes(id)) throw new Error('Unknown member');
  return {
    id, members: [...members], mode: 'running',
    disk: { counter: 0, promise: {}, accepted: {}, chosen: {}, applied: [],
      application: initialApplication(), quarantined: false, manifest: null, snapshotReceipt: null },
    volatile: { writes: [], nextWrite: 1, campaign: null, observedRound: 0 },
  };
}
export function restartReplica(local, { storageLoss = false } = {}) {
  const next = initialReplica(local.id, local.members);
  if (!storageLoss) next.disk = copy(local.disk);
  else next.disk.quarantined = true; // Cannot reuse forgotten promises as a voter.
  return next;
}
const quorum = (local, mutation) => Math.floor(local.members.length / 2) + (mutation === 'quorum' ? 0 : 1);
const root = local => local.disk.applied.at(-1)?.root ?? GENESIS;
export const valueRoot = value => keyOf(value);
function validValue(value) {
  return value && Number.isSafeInteger(value.slot) && value.slot > 0 &&
    typeof value.prev === 'string' && validCommand(value.command) &&
    equal(Object.keys(value).sort(), ['command', 'prev', 'slot']);
}
export function validCertificate(local, value, ballot, certificate, ports, mutation = 'none') {
  if (!validValue(value) || !validBallot(ballot) || !Array.isArray(certificate)) return false;
  const senders = new Set();
  for (const signed of certificate) {
    const message = signed?.body;
    if (!ports.verify(signed) || message.type !== 'ACCEPTED' || !local.members.includes(message.from) ||
        message.slot !== value.slot || !equal(message.ballot, ballot) || !equal(message.value, value)) return false;
    senders.add(message.from);
  }
  return senders.size >= quorum(local, mutation);
}
function enqueueWrite(local, value) {
  const serial = local.volatile.nextWrite++;
  local.volatile.writes.push({ serial, ...copy(value) });
}
function send(local, ports, effects, to, type, data = {}) {
  effects.messages.push(ports.sign({ configuration: ports.configuration, from: local.id, to, type, ...copy(data) }));
}
function broadcast(local, ports, effects, type, data) {
  for (const id of local.members) send(local, ports, effects, id, type, data);
}
function phaseTwo(local, ports, effects) {
  const campaign = local.volatile.campaign;
  if (!campaign || campaign.phase !== 'prepare' || Object.keys(campaign.promises).length < quorum(local, effects.mutation)) return;
  const accepted = Object.values(campaign.promises).map(p => p.accepted).filter(Boolean);
  accepted.sort((a, b) => compareBallot(b.ballot, a.ballot));
  campaign.value = accepted[0]?.value ?? campaign.suggested;
  campaign.phase = 'accept';
  broadcast(local, ports, effects, 'ACCEPT', { slot: campaign.slot, ballot: campaign.ballot, value: campaign.value });
}
function receive(local, signed, ports, effects) {
  if (!ports.verify(signed) || signed.body.to !== local.id) return;
  const message = signed.body;
  if (['PREPARE', 'ACCEPT'].includes(message.type)) {
    if (local.disk.quarantined || !validBallot(message.ballot) || message.ballot[1] !== message.from ||
        !Number.isSafeInteger(message.slot) || message.slot < 1) return;
    if (message.type === 'ACCEPT' && (!validValue(message.value) || message.value.slot !== message.slot)) return;
    enqueueWrite(local, { kind: message.type, message });
  } else if (['PROMISE', 'ACCEPTED'].includes(message.type)) {
    const campaign = local.volatile.campaign;
    if (!campaign || message.slot !== campaign.slot || !equal(message.ballot, campaign.ballot)) return;
    if (message.type === 'PROMISE' && campaign.phase === 'prepare') {
      campaign.promises[message.from] = message;
      phaseTwo(local, ports, effects);
    } else if (message.type === 'ACCEPTED' && campaign.phase === 'accept' && equal(message.value, campaign.value)) {
      campaign.acks[message.from] = signed;
      if (Object.keys(campaign.acks).length >= quorum(local, effects.mutation)) {
        campaign.phase = 'learn';
        broadcast(local, ports, effects, 'LEARN', { value: campaign.value, ballot: campaign.ballot,
          certificate: Object.values(campaign.acks) });
      }
    }
  } else if (message.type === 'NACK') {
    if (validBallot(message.promise)) local.volatile.observedRound = Math.max(local.volatile.observedRound, message.promise[0]);
  } else if (message.type === 'LEARN' || message.type === 'RECOVER_RECORD') {
    if (validCertificate(local, message.value, message.ballot, message.certificate, ports, effects.mutation)) {
      enqueueWrite(local, { kind: 'LEARN', record: { value: message.value, ballot: message.ballot, certificate: message.certificate } });
    }
  } else if (message.type === 'SYNC') {
    for (const applied of local.disk.applied) {
      send(local, ports, effects, message.from, 'RECOVER_RECORD', local.disk.chosen[applied.value.slot]);
    }
    send(local, ports, effects, message.from, 'RECOVER_MANIFEST', {
      manifest: { count: local.disk.applied.length, root: root(local), application: keyOf(local.disk.application) },
    });
  } else if (message.type === 'RECOVER_MANIFEST') {
    const manifest = message.manifest;
    if (manifest && Number.isSafeInteger(manifest.count) && manifest.count >= 0 &&
        typeof manifest.root === 'string' && typeof manifest.application === 'string') {
      enqueueWrite(local, { kind: 'MANIFEST', manifest });
    }
  }
}
function persist(local, serial, ports, effects) {
  const index = local.volatile.writes.findIndex(write => write.serial === serial);
  if (index < 0) return;
  const [write] = local.volatile.writes.splice(index, 1);
  if (write.kind === 'START') {
    if (local.disk.quarantined || !validCommand(write.command)) return;
    const slot = local.disk.applied.length + 1;
    const round = Math.max(local.disk.counter, local.volatile.observedRound) + 1;
    if (!Number.isSafeInteger(round)) return;
    local.disk.counter = round;
    const ballot = [round, local.id];
    local.volatile.campaign = { slot, ballot, phase: 'prepare', promises: {}, acks: {},
      suggested: { slot, prev: root(local), command: write.command } };
    broadcast(local, ports, effects, 'PREPARE', { slot, ballot });
  } else if (write.kind === 'PREPARE' || write.kind === 'ACCEPT') {
    if (local.disk.quarantined) return;
    const message = write.message;
    const promise = local.disk.promise[message.slot];
    if (promise && compareBallot(message.ballot, promise) < 0 &&
        !(write.kind === 'ACCEPT' && effects.mutation === 'fence')) {
      send(local, ports, effects, message.from, 'NACK', { slot: message.slot, promise });
      return;
    }
    if (write.kind === 'PREPARE') {
      local.disk.promise[message.slot] = message.ballot;
      send(local, ports, effects, message.from, 'PROMISE', { slot: message.slot, ballot: message.ballot,
        accepted: local.disk.accepted[message.slot] ?? null });
    } else {
      const prior = local.disk.accepted[message.slot];
      if (prior && equal(prior.ballot, message.ballot) && !equal(prior.value, message.value)) return;
      if (!promise || compareBallot(message.ballot, promise) > 0) local.disk.promise[message.slot] = message.ballot;
      local.disk.accepted[message.slot] = { value: message.value, ballot: message.ballot };
      effects.observations.push({ type: 'accept', node: local.id, value: message.value, ballot: message.ballot });
      send(local, ports, effects, message.from, 'ACCEPTED', { slot: message.slot, value: message.value, ballot: message.ballot });
    }
  } else if (write.kind === 'LEARN') {
    const slot = write.record.value.slot;
    const prior = local.disk.chosen[slot];
    if (prior && !equal(prior.value, write.record.value)) {
      effects.observations.push({ type: 'conflicting-learn', node: local.id, slot });
      return;
    }
    local.disk.chosen[slot] = copy(write.record);
  } else if (write.kind === 'MANIFEST') {
    if (!local.disk.manifest || write.manifest.count >= local.disk.manifest.count) local.disk.manifest = write.manifest;
  }
}
function applyNext(local, effects) {
  const slot = local.disk.applied.length + 1;
  const record = local.disk.chosen[slot];
  if (!record) return;
  if (record.value.prev !== root(local)) {
    effects.observations.push({ type: 'broken-prefix', node: local.id, slot });
    return;
  }
  const { state, result } = applyCommand(local.disk.application, record.value.command, slot, effects.mutation);
  local.disk.application = state;
  const applied = { value: record.value, root: valueRoot(record.value), result };
  local.disk.applied.push(applied);
  effects.observations.push({ type: 'apply', node: local.id, ...copy(applied), application: copy(state) });
  if (local.volatile.campaign?.slot === slot) local.volatile.campaign = null;
}
function completeSnapshot(local, effects) {
  const manifest = local.disk.manifest;
  if (!manifest) return;
  const complete = manifest.count === local.disk.applied.length && manifest.root === root(local) &&
    manifest.application === keyOf(local.disk.application);
  if (!complete && effects.mutation !== 'recovery') return;
  if (equal(local.disk.snapshotReceipt, manifest)) return;
  local.disk.snapshotReceipt = copy(manifest);
  effects.observations.push({ type: 'snapshot-complete', node: local.id, manifest: copy(manifest),
    count: local.disk.applied.length, root: root(local), application: keyOf(local.disk.application) });
  // Deliberately NOT voter admission, leader election or global freshness evidence.
}

// Only this replica's state, one local event, and immutable crypto ports are inputs.
// No network, live set, remote disk, wall-clock oracle or observer is a capability.
export function transition(before, event, ports, mutation = 'none') {
  const local = copy(before);
  const effects = { messages: [], observations: [], mutation };
  if (local.mode !== 'running') return { local, ...effects };
  if (event.type === 'message') receive(local, event.message, ports, effects);
  else if (event.type === 'propose' && validCommand(event.command)) enqueueWrite(local, { kind: 'START', command: event.command });
  else if (event.type === 'persist') persist(local, event.serial, ports, effects);
  else if (event.type === 'apply') applyNext(local, effects);
  else if (event.type === 'snapshot-complete') completeSnapshot(local, effects);
  else if (event.type === 'sync') send(local, ports, effects, event.source, 'SYNC');
  else if (event.type === 'timer') {
    const campaign = local.volatile.campaign;
    if (campaign && campaign.phase !== 'learn' && local.volatile.observedRound >= campaign.ballot[0]) {
      // Retrying the rejected ballot forever is not recovery. Advance using only
      // a received NACK, durably persist the new ballot, and keep the old intent.
      if (!local.volatile.writes.some(write => write.kind === 'START')) {
        enqueueWrite(local, { kind: 'START', command: campaign.suggested.command });
      }
    } else if (campaign?.phase === 'prepare') broadcast(local, ports, effects, 'PREPARE', { slot: campaign.slot, ballot: campaign.ballot });
    else if (campaign?.phase === 'accept') broadcast(local, ports, effects, 'ACCEPT', {
      slot: campaign.slot, ballot: campaign.ballot, value: campaign.value,
    });
    else if (campaign?.phase === 'learn') broadcast(local, ports, effects, 'LEARN', {
      value: campaign.value, ballot: campaign.ballot, certificate: Object.values(campaign.acks),
    });
  }
  return { local, ...effects };
}
