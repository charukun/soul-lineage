import { createPresenceScheduler, encodePresenceState, presencePolicy } from '@soul/network/presence-lod';
import { checksum } from './config.js';
import { actorState, visibleActors } from './world.js';

export class Replication {
  constructor(model) {
    this.model = model; this.views = new Map(); this.schedulers = new Map(); this.sequences = new Map();
    this.invalid = 0; this.stale = 0; this.repairs = 0; this.repairRequests = 0; this.corrupted = false;
    this.errorSum = 0; this.errorSamples = 0; this.maxError = 0; this.unknown = 0;
  }
  source(cell) { return this.model.mode === 'cells' ? this.model.cellHosts[cell] : this.model.authority.hostId; }
  stamp(cell) { return this.model.mode === 'cells' ? this.model.cellTerms[cell] : 0; }
  resetPeer(id) { this.views.delete(id); this.schedulers.delete(id); }
  broadcast() {
    for (const id of this.model.alive) this.snapshotFor(id);
  }
  snapshotFor(id, repair = false) {
    const m = this.model, observer = actorState(m.world.players.find(p => p.id === id));
    const scheduler = this.schedulers.get(id) || createPresenceScheduler({ now: () => m.now });
    this.schedulers.set(id, scheduler);
    const groups = new Map();
    for (const entity of visibleActors(m.world, m.alive)) {
      const distance = Math.hypot(observer.x - entity.x, observer.z - entity.z);
      const policy = presencePolicy(m.mode === 'global' ? 0 : distance);
      if (!policy.hz || !repair && !scheduler.due(entity.id, policy)) continue;
      const cell = m.mode === 'cells' ? entity.cell : -1;
      if (!groups.has(cell)) groups.set(cell, []);
      groups.get(cell).push({ id: entity.id, cell: entity.cell, ...encodePresenceState(entity, policy) });
    }
    for (const [cell, entities] of groups) {
      const from = this.source(cell);
      if (!from) continue;
      const key = `${from}:${id}:${cell}`, sequence = (this.sequences.get(key) || 0) + 1;
      this.sequences.set(key, sequence);
      const payload = { kind: repair ? 'repair' : 'snapshot', epoch: m.authority.epoch, term: this.stamp(cell), cell, sequence, tick: m.world.tick, entities, hash: checksum(entities) };
      if (from === id) { this.receive({ from, to: id, payload }); continue; }
      const corrupt = m.config.scenario === 'divergence' && m.now >= 8000 && !this.corrupted;
      if (corrupt) { this.corrupted = true; m.log('corruption', 'パケット内容を破損（checksumは据え置き）'); }
      m.send(from, id, payload, { corrupt });
    }
  }
  receive({ from, to, payload: p }) {
    const m = this.model;
    if (p.epoch !== m.authority.epoch || m.authority.phase !== 'open') { this.stale += 1; return; }
    if (p.kind === 'repair-request') {
      if (to === this.source(p.cell) && p.term === this.stamp(p.cell)) this.snapshotFor(from, true);
      return;
    }
    if (from !== this.source(p.cell) || p.term !== this.stamp(p.cell)) { this.stale += 1; return; }
    if (!Array.isArray(p.entities) || p.hash !== checksum(p.entities)) {
      this.invalid += 1; this.repairRequests += 1; m.log('divergence', `${to} がchecksum不一致を検出`);
      m.send(to, from, { kind: 'repair-request', epoch: p.epoch, cell: p.cell, term: p.term });
      return;
    }
    const view = this.views.get(to) || { entities: new Map(), sequences: new Map() };
    const key = `${from}:${p.cell}:${p.epoch}:${p.term}`;
    if (p.sequence <= (view.sequences.get(key) || 0)) { this.stale += 1; return; }
    view.sequences.set(key, p.sequence);
    for (const entity of p.entities) view.entities.set(entity.id, { ...entity, tick: p.tick });
    this.views.set(to, view);
    if (p.kind === 'repair') { this.repairs += 1; m.log('resync', `${to} が再同期データを受信`); }
  }
  measure() {
    const m = this.model, actors = visibleActors(m.world, m.alive);
    for (const id of m.alive) {
      const observer = actors.find(a => a.id === id), view = this.views.get(id);
      for (const actor of actors.filter(a => a.cell === observer.cell)) {
        const seen = view?.entities.get(actor.id);
        if (!seen) { this.unknown += 1; continue; }
        const error = Math.hypot(actor.x - seen.x, actor.z - seen.z);
        this.errorSum += error; this.errorSamples += 1; this.maxError = Math.max(this.maxError, error);
      }
    }
  }
}
