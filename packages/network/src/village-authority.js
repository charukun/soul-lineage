export const VILLAGE_PHASE = Object.freeze({ OPEN: 'open', MIGRATING: 'migrating', CLOSED: 'closed' });
const defaults = Object.freeze({ hostLeaseMs: 4_000, migrationTimeoutMs: 10_000, recoveryNoticeMs: 30_000 });
const clone = value => structuredClone(value);

export function createVillageAuthority({ villageId, mayorId, now = 0, timings = {} }) {
  if (!villageId || !mayorId || !Number.isFinite(now)) throw new Error('Invalid village authority');
  return { protocolVersion: 1, villageId, mayorId, primaryHostId: mayorId, hostId: mayorId,
    phase: VILLAGE_PHASE.OPEN, epoch: 1, revision: 0,
    hostLeaseUntil: now + (timings.hostLeaseMs ?? defaults.hostLeaseMs), migrationStartedAt: null,
    candidateId: null, members: { [mayorId]: { connected: true, eligible: true, lastSeenAt: now } },
    checkpoint: null, reason: null, timings: { ...defaults, ...timings } };
}
function elect(state) {
  return Object.entries(state.members).filter(([id, m]) => id !== state.hostId && m.connected && m.eligible)
    .sort((a, b) => b[1].lastSeenAt - a[1].lastSeenAt || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}
function close(state, reason) {
  Object.assign(state, { phase: VILLAGE_PHASE.CLOSED, reason, hostId: null, candidateId: null, hostLeaseUntil: null, migrationStartedAt: null });
}
function migrate(state, now, reason) {
  Object.assign(state, { phase: VILLAGE_PHASE.MIGRATING, reason, hostId: null, hostLeaseUntil: null, migrationStartedAt: now });
  state.epoch += 1; state.candidateId = elect(state); if (!state.candidateId) close(state, 'no-eligible-host');
}
export function advanceVillageAuthority(current, event) {
  const state = clone(current), now = event.now; if (!Number.isFinite(now)) throw new Error('Event time is required');
  const member = id => state.members[id];
  switch (event.type) {
    case 'join':
      if (state.phase !== VILLAGE_PHASE.OPEN || !member(state.mayorId)?.connected) throw new Error('Village admission is closed');
      if (!event.playerId) throw new Error('Player ID is required');
      state.members[event.playerId] = { connected: true, eligible: event.hostEligible !== false, lastSeenAt: now }; break;
    case 'heartbeat':
      if (event.playerId !== state.hostId || event.epoch !== state.epoch || state.phase !== VILLAGE_PHASE.OPEN || !member(event.playerId)?.connected) return state;
      member(event.playerId).lastSeenAt = now; state.hostLeaseUntil = now + state.timings.hostLeaseMs; break;
    case 'disconnect':
      if (member(event.playerId)) member(event.playerId).connected = false;
      if (event.playerId === state.hostId) migrate(state, now, 'host-disconnected'); break;
    case 'connect':
      if (!event.playerId) throw new Error('Player ID is required');
      state.members[event.playerId] = { connected: true, eligible: event.hostEligible !== false, lastSeenAt: now };
      if (event.playerId === state.mayorId && state.phase === VILLAGE_PHASE.CLOSED) {
        state.phase = VILLAGE_PHASE.MIGRATING; state.reason = 'mayor-recovering'; state.epoch += 1;
        state.candidateId = state.mayorId; state.migrationStartedAt = now;
      } break;
    case 'checkpoint':
      if (event.playerId !== state.hostId || event.epoch !== state.epoch || state.phase !== VILLAGE_PHASE.OPEN) throw new Error('Stale host cannot publish');
      state.revision += 1; state.checkpoint = { ...clone(event.checkpoint), revision: state.revision, epoch: state.epoch }; break;
    case 'migration-ready':
      if (state.phase !== VILLAGE_PHASE.MIGRATING || event.playerId !== state.candidateId || event.epoch !== state.epoch) throw new Error('Invalid migration acknowledgement');
      if (event.checkpointRevision !== (state.checkpoint?.revision ?? 0)) throw new Error('Checkpoint acknowledgement required');
      Object.assign(state, { hostId: event.playerId, phase: VILLAGE_PHASE.OPEN, reason: null, candidateId: null, migrationStartedAt: null, hostLeaseUntil: now + state.timings.hostLeaseMs }); break;
    case 'candidate-failed':
      if (state.phase !== VILLAGE_PHASE.MIGRATING || event.playerId !== state.candidateId) return state;
      if (member(event.playerId)) member(event.playerId).eligible = false;
      state.candidateId = elect(state); if (!state.candidateId) close(state, 'migration-exhausted'); break;
    case 'tick':
      if (state.phase === VILLAGE_PHASE.OPEN && now > state.hostLeaseUntil) migrate(state, now, 'host-lease-expired');
      else if (state.phase === VILLAGE_PHASE.MIGRATING && now - state.migrationStartedAt > state.timings.migrationTimeoutMs) close(state, 'migration-timeout');
      break;
    default: throw new Error(`Unknown village event: ${event.type}`);
  }
  return state;
}
