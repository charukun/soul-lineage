import { createVillageAuthority, advanceVillageAuthority, createVillageCheckpoint, validateVillageCheckpoint } from '@soul/network';
import { normalizeConfig, MODES, STEP_MS, peerId, checksum } from './config.js';
import { makeWorld, stepWorld, snapshotWorld, restoreWorld, actorState, worldRoot, verifyCollapse } from './world.js';
import { ModelWire } from './wire.js';
import { Replication } from './replication.js';

/** One local coordinator models policy; this is not a consensus or secure multiplayer implementation. */
export class RealityExperiment {
  constructor(input, mode = 'cells') {
    if (!Object.hasOwn(MODES, mode)) throw Error('比較方式が不明です。');
    this.config = normalizeConfig(input); this.mode = mode; this.now = 0; this.world = makeWorld(this.config);
    this.alive = new Set(this.world.players.map(p => p.id)); this.wire = new ModelWire(this.config);
    this.authority = createVillageAuthority({ villageId: 'rrp-experiment', mayorId: peerId(0) });
    for (let i = 1; i < this.config.peers; i += 1) this.advance({ type: 'join', playerId: peerId(i), now: 0 });
    this.replication = new Replication(this); this.cellHosts = [null, null, null]; this.cellTerms = [0, 0, 0];
    this.checkpoints = new Map(); this.events = []; this.series = []; this.migrations = [];
    this.darkMs = 0; this.rollbackMs = 0; this.freezeViolations = 0; this.failureAt = null; this.restoreAt = null;
    this.disconnected = null; this.cellFailure = false; this.reconnected = false; this.failedHost = null; this.omenRecipients = new Set();
    this.assignCells(); this.publishCheckpoint(); this.log('start', '同じseed・自律移動で比較を開始');
  }
  advance(event) { this.authority = advanceVillageAuthority(this.authority, { now: this.now, ...event }); }
  log(type, message) { if (this.events.length < 120) this.events.push({ at: this.now, tick: this.world.tick, epoch: this.authority.epoch, type, message }); }
  send(from, to, payload, options = {}) {
    if (!this.alive.has(from) || !this.alive.has(to)) return;
    this.wire.send(from, to, payload, this.now, { primary: from === this.authority.hostId, ...options });
  }
  assignCells() {
    for (let cell = 0; cell < 3; cell += 1) {
      const next = this.world.players.find(p => p.cell === cell && this.alive.has(p.id))?.id ?? this.authority.hostId;
      if (next !== this.cellHosts[cell]) {
        const previous = this.cellHosts[cell]; this.cellHosts[cell] = next; this.cellTerms[cell] += 1;
        if (previous) this.log('cell-authority', `Cell ${cell + 1}: ${previous} → ${next ?? '不在'}`);
      }
    }
  }
  publishCheckpoint() {
    if (this.authority.phase !== 'open' || !this.alive.has(this.authority.hostId)) return;
    const snapshot = createVillageCheckpoint({ worldTimeMs: this.world.tick * STEP_MS, world: snapshotWorld(this.world),
      characters: this.world.players.map(a => ({ id: a.id, position: [actorState(a).x, 0, a.z] })),
      npcs: this.world.npcs.map(a => ({ id: a.id, position: [actorState(a).x, 0, a.z] })), randomState: { seed: this.config.seed } });
    this.advance({ type: 'checkpoint', playerId: this.authority.hostId, epoch: this.authority.epoch, checkpoint: snapshot });
    const envelope = this.authority.checkpoint;
    this.checkpoints.set(this.authority.hostId, structuredClone(envelope));
    for (const id of [...this.alive].filter(id => id !== this.authority.hostId).slice(0, 2)) {
      this.send(this.authority.hostId, id, { kind: 'checkpoint', epoch: this.authority.epoch, snapshot: envelope, hash: checksum(envelope) });
    }
  }
  receive(packet) {
    const { payload: p, to, from } = packet;
    if (p.kind === 'checkpoint') {
      if (p.epoch !== this.authority.epoch || from !== this.authority.hostId || p.hash !== checksum(p.snapshot)) return;
      validateVillageCheckpoint(p.snapshot);
      if (p.snapshot.revision > (this.checkpoints.get(to)?.revision ?? 0)) this.checkpoints.set(to, p.snapshot);
    } else if (p.kind === 'restore') {
      if (this.authority.phase !== 'migrating' || to !== this.authority.candidateId || p.epoch !== this.authority.epoch || p.hash !== checksum(p.snapshot)) return;
      if (p.snapshot.revision === this.authority.checkpoint?.revision) this.checkpoints.set(to, p.snapshot);
    } else if (p.kind === 'omen' && p.epoch === this.authority.epoch && from === (this.mode === 'cells' ? this.cellHosts[2] : this.authority.hostId)) {
      this.omenRecipients.add(to);
    } else if (['snapshot', 'repair', 'repair-request'].includes(p.kind)) this.replication.receive(packet);
  }
  coordination() {
    if (this.mode === 'cells' && this.now % 500 === 0) {
      for (let cell = 0; cell < 3; cell += 1) {
        const id = this.cellHosts[cell];
        this.send(this.authority.hostId, id, { kind: 'clock', epoch: this.authority.epoch, tick: this.world.tick, cell, term: this.cellTerms[cell] });
        if (this.now % 1000 === 0) this.send(id, this.authority.hostId, { kind: 'cell-report', epoch: this.authority.epoch, cell, actors: [...this.world.players, ...this.world.npcs].filter(a => a.cell === cell).map(actorState) });
      }
    }
    // An explicit causal subscription: a distant omen is relevant even when its cell has no spatial subscribers.
    if (this.world.tick >= 120 && this.now % 1000 === 0) {
      const from = this.mode === 'cells' ? this.cellHosts[2] : this.authority.hostId;
      this.omenRecipients.add(from);
      for (const to of this.alive) this.send(from, to, { kind: 'omen', epoch: this.authority.epoch, eventId: 'dragon-1', originCell: 2, effect: 'bell-red-sky' });
    }
  }
  injectFailures() {
    if (this.now >= 8000 && !this.disconnected && this.config.scenario === 'host') {
      this.disconnected = this.authority.hostId; this.failedHost = this.disconnected;
      this.alive.delete(this.disconnected); this.checkpoints.delete(this.disconnected); this.failureAt = this.now;
      this.log('host-lost', `${this.disconnected} の実行と通信を停止。lease期限まで故障判定待ち`);
    }
    if (this.failedHost && this.authority.phase === 'open' && this.now > this.authority.hostLeaseUntil) {
      this.advance({ type: 'disconnect', playerId: this.failedHost }); this.failedHost = null;
      this.log('darkness', '古い権限を失効。バックアップの復元待ち');
    }
    if (this.now >= 8000 && !this.cellFailure && this.config.scenario === 'cell') {
      const id = this.world.players.find(p => p.cell === 1 && p.id !== this.authority.hostId)?.id ?? peerId(1);
      this.cellFailure = true; this.alive.delete(id); this.checkpoints.delete(id); this.advance({ type: 'disconnect', playerId: id });
      this.log('cell-lost', `${id} 切断。ローカルcoordinatorが担当を再割当て`);
    }
    if (this.now >= 20000 && this.disconnected && !this.reconnected) {
      this.reconnected = true; this.alive.add(this.disconnected); this.replication.resetPeer(this.disconnected);
      this.advance({ type: 'connect', playerId: this.disconnected }); this.log('reconnect', `${this.disconnected} が空の受信状態で再接続`);
    }
  }
  recover() {
    if (this.authority.phase !== 'migrating') return;
    const candidate = this.authority.candidateId, expected = this.authority.checkpoint?.revision ?? 0;
    const held = this.checkpoints.get(candidate);
    if (held?.revision !== expected) {
      if (this.now % 500 === 0) {
        const source = [...this.checkpoints].find(([id, cp]) => this.alive.has(id) && cp.revision === expected);
        if (source) this.send(source[0], candidate, { kind: 'restore', epoch: this.authority.epoch, snapshot: source[1], hash: checksum(source[1]) });
      }
      return;
    }
    this.restoreAt ??= this.now + 500;
    if (this.now < this.restoreAt) return;
    validateVillageCheckpoint(held);
    this.rollbackMs += Math.max(0, this.world.tick * STEP_MS - held.worldTimeMs);
    restoreWorld(this.world, held.world);
    this.advance({ type: 'migration-ready', playerId: candidate, epoch: this.authority.epoch, checkpointRevision: expected });
    this.migrations.push(this.now - (this.failureAt ?? this.authority.migrationStartedAt ?? this.now));
    this.log('resumed', `${candidate} がrevision ${expected}を復元。世界時間を再開`);
    this.restoreAt = null; this.assignCells();
    for (const id of this.alive) this.replication.resetPeer(id);
  }
  step() {
    if (this.now >= this.config.durationMs) return false;
    this.now += STEP_MS; this.injectFailures();
    const paused = this.authority.phase !== 'open' || !this.alive.has(this.authority.hostId);
    const previousTick = this.world.tick;
    if (!paused) {
      this.advance({ type: 'heartbeat', playerId: this.authority.hostId, epoch: this.authority.epoch });
      stepWorld(this.world, this.mode, this.alive, this.config.scenario); this.assignCells();
      this.replication.broadcast(); this.coordination();
      if (this.now % 1000 === 0) this.publishCheckpoint();
    } else this.darkMs += STEP_MS;
    if (paused && this.world.tick !== previousTick) this.freezeViolations += 1;
    this.wire.drain(this.now, this.alive, p => this.receive(p));
    this.advance({ type: 'tick' }); this.recover();
    if (this.now % 500 === 0) {
      this.replication.measure();
      this.series.push({ at: this.now, worldMs: this.world.tick * STEP_MS, bytes: this.wire.bytes, phase: this.authority.phase, epoch: this.authority.epoch, queue: this.wire.pending.length });
    }
    return true;
  }
  finish() { while (this.step()) { /* virtual time only */ } return this; }
  result() {
    const w = this.wire, r = this.replication, seconds = this.now / 1000;
    const latency = [...w.latencies].sort((a, b) => a - b);
    return { mode: this.mode, elapsedMs: this.now, worldMs: this.world.tick * STEP_MS, epoch: this.authority.epoch, phase: this.authority.phase,
      root: worldRoot(this.world), payloadBytes: w.bytes, primaryKbps: (w.primaryBytes || 0) / seconds / 1000,
      maxPeerKbps: Math.max(0, ...Object.values(w.byPeer).map(p => p.tx)) / seconds / 1000,
      messages: w.sent, delivered: w.delivered, dropped: w.dropped, inFlight: w.pending.length, maxQueue: w.maxQueue,
      modelDeliveryP95Ms: latency.length ? latency[Math.ceil(latency.length * 0.95) - 1] : null,
      byPeer: structuredClone(w.byPeer), byKind: { ...w.byKind }, darkMs: this.darkMs, rollbackMs: this.rollbackMs,
      migrations: [...this.migrations], freezeViolations: this.freezeViolations, invalid: r.invalid, stale: r.stale, repairs: r.repairs,
      meanPositionError: r.errorSamples ? r.errorSum / r.errorSamples : null, maxPositionError: r.maxError, missingSamples: r.unknown,
      actorUpdates: this.world.updates, collapses: this.world.collapses, collapseMatchesReference: verifyCollapse(this.world), omenRecipients: [...this.omenRecipients].sort(),
      events: [...this.events], series: [...this.series] };
  }
}

export function runComparison(config) {
  return Object.keys(MODES).map(mode => new RealityExperiment(config, mode).finish().result());
}
