import { compareScopes } from './integration-rescue-policy.mjs';

export const FLOW_THRESHOLDS = Object.freeze({ busyReady: 5, burnDownReady: 10, trainSize: 5, staleReadyHours: 72 });
const HOUR_MS = 60 * 60 * 1000;
const TERMINAL = new Set(['MERGED', 'DEV', 'CLOSED']);

export function flowPressure({ ready = 0, recoverableManual = 0 } = {}) {
  const demand = Math.max(0, Number(ready) || 0) + Math.max(0, Number(recoverableManual) || 0);
  const mode = demand >= FLOW_THRESHOLDS.burnDownReady ? 'BURN_DOWN' : demand >= FLOW_THRESHOLDS.busyReady ? 'BUSY' : 'NORMAL';
  return {
    mode,
    demand,
    pauseMaintenance: mode !== 'NORMAL',
    prioritizeOldest: mode === 'BURN_DOWN',
    reason: mode === 'BURN_DOWN' ? `Ready/AI-repair backlog ${demand} >= ${FLOW_THRESHOLDS.burnDownReady}` :
      mode === 'BUSY' ? `Ready/AI-repair backlog ${demand} >= ${FLOW_THRESHOLDS.busyReady}` : 'Queue pressure is normal',
  };
}

export function planIntegrationTrain(items, scopeByPr = new Map(), { max = FLOW_THRESHOLDS.trainSize } = {}) {
  const selected = [], deferred = [];
  for (const item of items) {
    if (selected.length >= max) { deferred.push(item); continue; }
    const scope = scopeByPr.get(item.number);
    if (!scope?.files?.length) { deferred.push(item); continue; }
    const independent = selected.every(existing => compareScopes(scope, scopeByPr.get(existing.number)).risk === 'GREEN');
    if (independent) selected.push(item); else deferred.push(item);
  }
  return { selected, deferred, max };
}

export function prioritizeIntegrationTrain(items, scopeByPr = new Map(), options = {}) {
  const train = planIntegrationTrain(items, scopeByPr, options);
  const selected = new Set(train.selected.map(item => item.number));
  return [...train.selected, ...items.filter(item => !selected.has(item.number))];
}

function finiteDurations(values) {
  return values.filter(value => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
}
export function percentile(values, q) {
  const sorted = finiteDurations(values);
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return Math.round(sorted[index]);
}
function duration(start, end) {
  const a = Date.parse(start || ''), b = Date.parse(end || '');
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? b - a : null;
}
export function deliveryLatencyMetrics(records = []) {
  const readyToMerge = records.map(r => duration(r.readyAt || r.detectedAt, r.mergedAt)).filter(Number.isFinite);
  const mergeToDev = records.map(r => duration(r.mergedAt, r.devAt)).filter(Number.isFinite);
  const readyToDev = records.map(r => duration(r.readyAt || r.detectedAt, r.devAt)).filter(Number.isFinite);
  const metric = values => ({ samples: values.length, p50Ms: percentile(values, 0.50), p95Ms: percentile(values, 0.95) });
  return { readyToMerge: metric(readyToMerge), mergeToDev: metric(mergeToDev), readyToDev: metric(readyToDev) };
}

export function staleReadyCandidate(pr, now = Date.now()) {
  const created = Date.parse(pr?.created_at || pr?.updated_at || '');
  if (!Number.isFinite(created) || pr?.draft || pr?.state !== 'open') return false;
  return now - created >= FLOW_THRESHOLDS.staleReadyHours * HOUR_MS;
}

export function compactRescueState(state, now = Date.now(), { terminalRetentionMs = 48 * HOUR_MS, maxWaves = 48, maxOutbox = 120 } = {}) {
  if (!state?.records) return state;
  state.history ||= { archivedTerminal: 0, byState: {}, lastCompactedAt: null };
  for (const [pr, record] of Object.entries(state.records)) {
    if (!TERMINAL.has(record.state)) continue;
    const age = now - Date.parse(record.updatedAt || record.devAt || record.mergedAt || 0);
    if (!Number.isFinite(age) || age < terminalRetentionMs) continue;
    state.history.archivedTerminal++;
    state.history.byState[record.state] = (state.history.byState[record.state] || 0) + 1;
    delete state.records[pr];
  }
  const completed = (state.waves || []).filter(w => w.completedAt).slice(-maxWaves);
  const active = (state.waves || []).filter(w => !w.completedAt);
  state.waves = [...completed, ...active].slice(-maxWaves);
  state.activity = (state.activity || []).filter(e => now - Date.parse(e.at) < 24 * HOUR_MS).slice(-400);
  state.outbox = (state.outbox || []).filter(n => !n.sentAt || now - Date.parse(n.sentAt) < 24 * HOUR_MS).slice(-maxOutbox);
  state.history.lastCompactedAt = new Date(now).toISOString();
  return state;
}
