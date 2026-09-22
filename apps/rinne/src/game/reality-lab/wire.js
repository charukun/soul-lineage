import { random } from './config.js';

/** Bounded, seeded, one-way datagram model. It does not model SCTP, NAT, TURN or uplink queues. */
export class ModelWire {
  constructor(config) {
    this.config = config; this.rng = random(config.seed ^ 0x6a09e667);
    this.pending = []; this.serial = 0; this.sent = 0; this.delivered = 0; this.dropped = 0;
    this.bytes = 0; this.byPeer = {}; this.byKind = {}; this.maxQueue = 0; this.latencies = [];
  }
  peer(id) { return this.byPeer[id] ??= { tx: 0, rx: 0 }; }
  send(from, to, payload, now, { primary = false, corrupt = false } = {}) {
    if (from === to) return false;
    const copy = structuredClone(payload);
    if (corrupt && copy.entities?.length) copy.entities[0].x += 40;
    const bytes = new TextEncoder().encode(JSON.stringify(copy)).byteLength;
    this.bytes += bytes; this.sent += 1; this.peer(from).tx += bytes;
    this.byKind[payload.kind] = (this.byKind[payload.kind] || 0) + bytes;
    if (primary) this.primaryBytes = (this.primaryBytes || 0) + bytes;
    if (this.rng() < this.config.loss) { this.dropped += 1; return true; }
    const delay = Math.max(0, this.config.latencyMs + (this.rng() * 2 - 1) * this.config.jitterMs);
    this.pending.push({ from, to, payload: copy, bytes, sentAt: now, at: now + delay, serial: this.serial++ });
    this.maxQueue = Math.max(this.maxQueue, this.pending.length);
    if (this.pending.length > 20000) throw Error('模擬通信キューの上限を超えました。');
    return true;
  }
  drain(now, alive, receive) {
    const due = [], pending = [];
    for (const packet of this.pending) (packet.at <= now ? due : pending).push(packet);
    this.pending = pending;
    due.sort((a, b) => a.at - b.at || a.serial - b.serial);
    for (const packet of due) {
      if (!alive.has(packet.to) || !alive.has(packet.from)) { this.dropped += 1; continue; }
      this.peer(packet.to).rx += packet.bytes; this.delivered += 1; this.latencies.push(now - packet.sentAt);
      receive(packet);
    }
  }
}
