import { CHARACTER_CONTENT, MAX_CHARACTERS, LIFESPAN_MS, characterData, integer, identifier, invariant } from './master-character.js';
export const CHARACTER_PROTOCOL = 1;
const MAX_BYTES = 64 * 1024;
function authority(a) { identifier(a.peerId); integer(a.epoch, 0, Number.MAX_SAFE_INTEGER, 'authority epoch'); return { peerId: a.peerId, epoch: a.epoch }; }
function records(rows) {
  invariant(Array.isArray(rows) && rows.length <= MAX_CHARACTERS, 'Invalid character count');
  const result = rows.map(characterData);
  invariant(new Set(result.map(c => c.id)).size === result.length, 'Duplicate character ID');
  return result;
}
function boundedJson(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  invariant(typeof text === 'string' && text.length <= MAX_BYTES && new TextEncoder().encode(text).length <= MAX_BYTES, 'Snapshot too large');
  return JSON.parse(text);
}
/** Transport verifies peer identity; the host coordinator supplies epoch separately from messages. */
export class CharacterReplica {
  constructor({ sessionId, host }) {
    this.sessionId = identifier(sessionId); this.host = authority(host);
    this.sequence = -1; this.worldMs = 0; this.worldState = 'paused'; this.characters = new Map();
  }
  // Only call from a trusted Host Migration coordinator, never from received packet contents.
  migrateAuthority(host) {
    const next = authority(host); invariant(next.epoch > this.host.epoch, 'Authority epoch must advance');
    this.host = next; this.sequence = -1; this.worldState = 'paused';
    // Keep the last committed world time and characters as a rollback floor.
  }
  receive(payload, authenticatedPeerId) {
    const p = boundedJson(payload);
    invariant(p?.protocolVersion === CHARACTER_PROTOCOL && p.contentVersion === CHARACTER_CONTENT, 'Incompatible protocol/content');
    invariant(p.sessionId === this.sessionId, 'Wrong session');
    invariant(authenticatedPeerId === this.host.peerId && p.host?.peerId === this.host.peerId && p.host?.epoch === this.host.epoch, 'Not the current authenticated host');
    integer(p.sequence, 0, Number.MAX_SAFE_INTEGER, 'sequence'); invariant(p.sequence > this.sequence, 'Stale packet');
    integer(p.worldMs, this.worldMs, Number.MAX_SAFE_INTEGER, 'world time');
    invariant(['running', 'paused', 'closed'].includes(p.worldState), 'Invalid world state');
    let proposed;
    if (p.kind === 'snapshot') proposed = new Map(records(p.characters).map(c => [c.id, c]));
    else {
      invariant(p.kind === 'delta' && this.sequence >= 0 && p.baseSequence === this.sequence, 'Missing delta baseline');
      invariant(Array.isArray(p.remove) && p.remove.length <= MAX_CHARACTERS, 'Invalid removals');
      p.remove.forEach(id => identifier(id)); invariant(new Set(p.remove).size === p.remove.length, 'Duplicate removal');
      const upsert = records(p.upsert);
      invariant(upsert.every(c => !p.remove.includes(c.id)), 'Conflicting upsert/removal');
      proposed = new Map(this.characters); p.remove.forEach(id => proposed.delete(id));
      upsert.forEach(c => proposed.set(c.id, c)); invariant(proposed.size <= MAX_CHARACTERS, 'Crowd limit exceeded');
    }
    for (const [id, c] of proposed) {
      const old = this.characters.get(id); if (!old) continue;
      invariant(c.revision >= old.revision && c.ageMs >= old.ageMs && (old.lifeState !== 'dead' || c.lifeState === 'dead'), 'Character rollback');
      invariant(c.seed === old.seed && JSON.stringify(c.genome) === JSON.stringify(old.genome) && JSON.stringify(c.parents) === JSON.stringify(old.parents), 'Immutable lineage changed');
      if (c.revision === old.revision) invariant(JSON.stringify(c) === JSON.stringify(old), 'Changed character without revision');
      invariant(c.ageMs - old.ageMs <= Math.min(LIFESPAN_MS, p.worldMs - this.worldMs), 'Age advanced beyond world clock');
    }
    // Commit once, only after every row validates; a bad packet cannot poison the baseline.
    this.characters = proposed; this.sequence = p.sequence; this.worldMs = p.worldMs; this.worldState = p.worldState;
    return this.snapshot();
  }
  snapshot() { return { sequence: this.sequence, worldMs: this.worldMs, worldState: this.worldState,
    characters: [...this.characters.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(characterData) }; }
}
export function makeCharacterSnapshot({ sessionId, host, sequence, worldMs, worldState, characters }) {
  return { protocolVersion: CHARACTER_PROTOCOL, contentVersion: CHARACTER_CONTENT, kind: 'snapshot',
    sessionId: identifier(sessionId), host: authority(host), sequence: integer(sequence, 0, Number.MAX_SAFE_INTEGER, 'sequence'),
    worldMs: integer(worldMs, 0, Number.MAX_SAFE_INTEGER, 'worldMs'), worldState, characters: records(characters) };
}
/** Rendering policy only. Never use this to skip collision, AI, clock or network simulation. */
export function crowdPlan(actors, { maxFull = 6, nearDistance = 8, farDistance = 20 } = {}) {
  invariant(Array.isArray(actors) && actors.length <= MAX_CHARACTERS, 'Crowd capacity exceeded');
  integer(maxFull, 1, MAX_CHARACTERS, 'maxFull');
  invariant(Number.isFinite(nearDistance) && nearDistance > 0 && Number.isFinite(farDistance) && farDistance > nearDistance, 'Invalid LOD distances');
  const seen = new Set();
  const sorted = actors.map(a => {
    identifier(a.id); invariant(!seen.has(a.id), 'Duplicate actor'); seen.add(a.id);
    invariant(Number.isFinite(a.distance) && a.distance >= 0, 'Invalid distance');
    invariant(typeof a.visible === 'boolean' && typeof a.important === 'boolean', 'Invalid visibility/importance');
    return { ...a };
  }).sort((a, b) => Number(b.visible) - Number(a.visible) || Number(b.important) - Number(a.important) || a.distance - b.distance || (a.id < b.id ? -1 : 1));
  let full = 0;
  return sorted.map(a => {
    const tier = !a.visible ? 'hidden' : (a.important || a.distance < nearDistance) && full < maxFull ? 'full' : a.distance < farDistance ? 'mid' : 'far';
    if (tier === 'full') full++;
    return { id: a.id, tier, animationHz: { full: 60, mid: 15, far: 5, hidden: 0 }[tier],
      springBones: tier === 'full', castShadow: false, visible: a.visible };
  });
}
export class PoseSchedule {
  constructor() { this.elapsed = 0; this.first = true; }
  advance(deltaSeconds, hz) {
    invariant(Number.isFinite(deltaSeconds) && deltaSeconds >= 0 && deltaSeconds <= 60 && [0, 5, 15, 60].includes(hz), 'Invalid pose timing');
    if (hz === 0) { this.elapsed = 0; this.first = true; return null; }
    this.elapsed += deltaSeconds;
    if (!this.first && this.elapsed + 1e-10 < 1 / hz) return null;
    const elapsed = this.elapsed; this.elapsed = 0; this.first = false; return elapsed;
  }
}
