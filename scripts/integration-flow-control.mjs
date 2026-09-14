import { compareScopes, observationOnlyReason } from './integration-rescue-policy.mjs';
import { dependencies } from './integration-policy.mjs';

export const FLOW_THRESHOLDS = Object.freeze({ busyReady: 5, burnDownReady: 10, trainSize: 5, staleReadyHours: 72 });
export const FLOW_LIMITS = Object.freeze({ minTrain: 2, maxTrain: 5, minRescueConcurrency: 3, maxRescueConcurrency: 6, minEvaluations: 12, maxEvaluations: 24, quarantineFailures: 3 });
const HOUR_MS = 60 * 60 * 1000;
const ARCHIVABLE = new Set(['DEV', 'CLOSED']);

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

export function dependencyGraph(items = []) {
  const byNumber = new Map(items.map(item => [Number(item.number), item]));
  const direct = new Map(), reverse = new Map();
  for (const item of items) {
    let parsed = [];
    try { parsed = dependencies(item.body || '').filter(number => byNumber.has(number)); } catch { parsed = []; }
    direct.set(Number(item.number), parsed);
    for (const dep of parsed) reverse.set(dep, [...(reverse.get(dep) || []), Number(item.number)]);
  }
  const memo = new Map();
  function downstream(number, trail = new Set()) {
    if (memo.has(number)) return memo.get(number);
    if (trail.has(number)) return new Set();
    const nextTrail = new Set(trail).add(number), result = new Set();
    for (const child of reverse.get(number) || []) {
      result.add(child);
      for (const nested of downstream(child, nextTrail)) result.add(nested);
    }
    memo.set(number, result);
    return result;
  }
  const unblockCount = new Map([...byNumber.keys()].map(number => [number, downstream(number).size]));
  return { byNumber, direct, reverse, unblockCount };
}

export function criticalPathOrder(items = [], { now = Date.now() } = {}) {
  const graph = dependencyGraph(items);
  return [...items].sort((a, b) => {
    const unblock = (graph.unblockCount.get(Number(b.number)) || 0) - (graph.unblockCount.get(Number(a.number)) || 0);
    if (unblock) return unblock;
    const aAge = Math.max(0, now - Date.parse(a.created_at || a.updated_at || now));
    const bAge = Math.max(0, now - Date.parse(b.created_at || b.updated_at || now));
    if (aAge !== bAge) return bAge - aAge;
    return Number(a.number) - Number(b.number);
  });
}

export function planIntegrationTrain(items, scopeByPr = new Map(), { max = FLOW_THRESHOLDS.trainSize } = {}) {
  const selected = [], deferred = [];
  const ordered = criticalPathOrder(items);
  for (const item of ordered) {
    if (selected.length >= max) { deferred.push(item); continue; }
    const scope = scopeByPr.get(item.number);
    if (!scope?.files?.length) { deferred.push(item); continue; }
    const directDeps = dependencyGraph(ordered).direct.get(Number(item.number)) || [];
    if (directDeps.some(number => !selected.some(entry => Number(entry.number) === number))) { deferred.push(item); continue; }
    const independent = selected.every(existing => {
      if (directDeps.includes(Number(existing.number))) return true;
      return compareScopes(scope, scopeByPr.get(existing.number)).risk === 'GREEN';
    });
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
  const implementationToReady = records.map(r => duration(r.implementationStartedAt || r.createdAt, r.readyAt || r.detectedAt)).filter(Number.isFinite);
  const readyToMerge = records.map(r => duration(r.readyAt || r.detectedAt, r.mergedAt)).filter(Number.isFinite);
  const mergeToDev = records.map(r => duration(r.mergedAt, r.devAt)).filter(Number.isFinite);
  const implementationToDev = records.map(r => duration(r.implementationStartedAt || r.createdAt, r.devAt)).filter(Number.isFinite);
  const readyToDev = records.map(r => duration(r.readyAt || r.detectedAt, r.devAt)).filter(Number.isFinite);
  const metric = values => ({ samples: values.length, p50Ms: percentile(values, 0.50), p95Ms: percentile(values, 0.95) });
  return { implementationToReady: metric(implementationToReady), readyToMerge: metric(readyToMerge), mergeToDev: metric(mergeToDev), readyToDev: metric(readyToDev), implementationToDev: metric(implementationToDev) };
}

export function quarantineDecision(record) {
  if (!record || record.state === 'DEV' || record.state === 'CLOSED' || record.workRepair?.status === 'human-required') return { quarantined:false, failures:0 };
  const meaningful = (record.failures || []).filter(item => !observationOnlyReason(String(item?.reason || '')));
  const recent = meaningful.slice(-FLOW_LIMITS.quarantineFailures);
  const distinct = new Set(recent.map(item => String(item.reason || '').replace(/[0-9a-f]{40}/ig, ':sha').replace(/\d+/g, ':n')));
  const quarantined = recent.length >= FLOW_LIMITS.quarantineFailures && distinct.size >= 2;
  return { quarantined, failures: meaningful.length, reason: quarantined ? `Repeated repair failures (${meaningful.length}); isolate from normal train and use deep AI repair` : null };
}

export function adaptiveFlowTuning({ ready = 0, recoverableManual = 0, latency = {}, failureRate = 0, rateRemaining = null } = {}) {
  const pressure = flowPressure({ ready, recoverableManual });
  const p95 = Number(latency?.implementationToDev?.p95Ms ?? latency?.readyToDev?.p95Ms ?? 0);
  const apiTight = Number.isFinite(rateRemaining) && rateRemaining < 300;
  const unstable = Number(failureRate) >= 0.25;
  if (apiTight || unstable) return { pressure, trainSize:2, rescueConcurrency:3, maxEvaluations:12, reason: apiTight ? 'GitHub API reserve is tight' : 'Recent repair failure rate is high' };
  if (pressure.mode === 'BURN_DOWN' && p95 >= 20 * 60000) return { pressure, trainSize:5, rescueConcurrency:6, maxEvaluations:24, reason:'Backlog and p95 latency are high; use bounded maximum throughput' };
  if (pressure.mode === 'BUSY' || p95 >= 10 * 60000) return { pressure, trainSize:4, rescueConcurrency:5, maxEvaluations:20, reason:'Queue is busy; raise bounded throughput' };
  return { pressure, trainSize:3, rescueConcurrency:4, maxEvaluations:16, reason:'Normal bounded operating point' };
}

export function contentSupersessionProof(paths = [], headEntries = new Map(), developEntries = new Map()) {
  if (!paths.length) return { equivalent:false, reason:'NO_CHANGED_PATHS' };
  for (const path of paths) {
    const head = headEntries.get(path) ?? null;
    const develop = developEntries.get(path) ?? null;
    if (head !== develop) return { equivalent:false, reason:`CONTENT_DIFF:${path}` };
  }
  return { equivalent:true, reason:'EXACT_TOUCHED_CONTENT_MATCH' };
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
    if (record.state === 'FAILED_MANUAL' && Array.isArray(record.baseChanges) && record.baseChanges.length) {
      record.baseChangeCount = record.baseChanges.length;
      record.baseChangesCompacted = true;
      delete record.baseChanges;
    }
    if (!ARCHIVABLE.has(record.state)) continue;
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