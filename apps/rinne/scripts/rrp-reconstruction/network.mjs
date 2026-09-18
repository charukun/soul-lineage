import { copy, fixturePorts, keyOf } from './encoding.mjs';
import { initialReplica, restartReplica, transition } from './replica.mjs';
import { audit } from './oracle.mjs';

// The scheduler may inspect the whole simulation. No scheduler capability is passed
// to a replica; real systems replace these actions with transport/storage callbacks.
export class Network {
  constructor({ members = ['n0', 'n1', 'n2'], mutation = 'none', ports = null } = {}) {
    this.members = members;
    this.ports = ports ?? fixturePorts(members);
    this.mutation = mutation;
    this.nodes = Object.fromEntries(members.map(id => [id, initialReplica(id, members)]));
    this.queue = []; this.observations = []; this.trace = []; this.serial = 1;
  }
  event(id, event) {
    const result = transition(this.nodes[id], event, this.ports.get(id), this.mutation);
    this.nodes[id] = result.local;
    for (const message of result.messages) this.queue.push({ serial: this.serial++, message });
    this.observations.push(...result.observations);
    this.trace.push({ node: id, event: copy(event) });
    return result;
  }
  propose(id, command) { this.event(id, { type: 'propose', command }); }
  persist(id, serial = this.nodes[id].volatile.writes[0]?.serial) {
    if (serial !== undefined) this.event(id, { type: 'persist', serial });
  }
  persistAll(id) {
    for (let i = 0; this.nodes[id].volatile.writes.length && i < 1000; i++) this.persist(id);
  }
  deliver(serial) {
    const index = this.queue.findIndex(packet => packet.serial === serial);
    if (index < 0) return false;
    const [packet] = this.queue.splice(index, 1);
    this.event(packet.message.body.to, { type: 'message', message: packet.message });
    return true;
  }
  deliverWhere(predicate) {
    const packet = this.queue.find(packet => predicate(packet.message.body));
    if (!packet) return false;
    return this.deliver(packet.serial);
  }
  deliverAndPersist(type, to, from = null) {
    const found = this.deliverWhere(body => body.type === type && body.to === to && (!from || body.from === from));
    if (found) this.persistAll(to);
    return found;
  }
  drop(serial) {
    const index = this.queue.findIndex(packet => packet.serial === serial);
    if (index >= 0) this.queue.splice(index, 1);
    this.trace.push({ fault: 'drop', serial });
  }
  duplicate(serial) {
    const packet = this.queue.find(packet => packet.serial === serial);
    if (packet) this.queue.push({ serial: this.serial++, message: copy(packet.message) });
    this.trace.push({ fault: 'duplicate', serial });
  }
  fault(id, action) {
    if (action === 'crash') {
      this.nodes[id].mode = 'crashed';
      this.nodes[id].volatile = { writes: [], nextWrite: 1, campaign: null, observedRound: 0 };
    } else if (action === 'pause') this.nodes[id].mode = 'paused';
    else if (action === 'resume') this.nodes[id].mode = 'running';
    else if (action === 'restart') this.nodes[id] = restartReplica(this.nodes[id]);
    else if (action === 'storage-loss') {
      this.nodes[id] = restartReplica(this.nodes[id], { storageLoss: true });
      this.observations.push({ type: 'storage-loss', node: id });
    } else throw new Error(`Unsupported scheduler fault: ${action}`);
    this.trace.push({ fault: action, node: id });
  }
  enabled() {
    const events = [];
    for (const id of this.members) {
      const node = this.nodes[id];
      if (node.mode !== 'running') continue;
      for (const write of node.volatile.writes) events.push({ kind: 'persist', node: id, serial: write.serial });
      if (node.disk.chosen[node.disk.applied.length + 1]) events.push({ kind: 'apply', node: id });
    }
    for (const packet of this.queue) {
      if (this.nodes[packet.message.body.to].mode === 'running') events.push({ kind: 'deliver', serial: packet.serial });
    }
    return events;
  }
  runAction(action) {
    if (action.kind === 'deliver') this.deliver(action.serial);
    else if (action.kind === 'persist') this.persist(action.node, action.serial);
    else if (action.kind === 'apply') this.event(action.node, { type: 'apply' });
    else if (action.kind === 'drop') this.drop(action.serial);
    else if (action.kind === 'duplicate') this.duplicate(action.serial);
    else this.fault(action.node, action.kind);
  }
  settle(limit = 20000) {
    for (let count = 0; count < limit; count++) {
      const action = this.enabled()[0];
      if (!action) return count;
      this.runAction(action);
      const result = this.audit();
      if (!result.pass) return count + 1;
    }
    throw new Error('Scheduler exhausted its explicit fair-drain bound');
  }
  audit() { return audit(this.observations, this.members); }
  fork() {
    const clone = new Network({ members: this.members, mutation: this.mutation, ports: this.ports });
    for (const key of ['nodes', 'queue', 'observations', 'trace']) clone[key] = copy(this[key]);
    clone.serial = this.serial;
    return clone;
  }
  fingerprint() {
    // Include oracle history: merging equal disks while forgetting already-chosen
    // values would make a broken exploration unsound. Event trace is redundant.
    return keyOf({ nodes: this.nodes, queue: this.queue, observations: this.observations, serial: this.serial });
  }
}
export const command = (type, id, fields = {}, generation = 1) => ({ type, id, generation, ...fields });
