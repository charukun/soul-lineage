import { dependencies, reviewDecision } from './integration-policy.mjs';

export const REPOSITORY = 'charukun/soul-lineage';
export const STATE_BRANCH = 'automation/integration-rescue-state';
export const STATE_FILE = 'rescue-state.json';
export const ACTIVE = new Set(['CLAIMED', 'ANALYZING', 'RESOLVING', 'VALIDATING', 'PUSHING']);
export const RETURNED = new Set(['PUSHED', 'RETURNED_TO_INTEGRATION', 'CHECKING']);
export const TERMINAL = new Set(['MERGED', 'DEV', 'FAILED_MANUAL', 'CLOSED']);
export const STATES = new Set(['DETECTED', 'QUEUED', 'BLOCKED_BY_RESCUE', ...ACTIVE, ...RETURNED,
  ...TERMINAL, 'FAILED_RETRYABLE', 'STALE']);
const number = (env, key, fallback, min, max) => {
  const value = env[key] === undefined || env[key] === '' ? fallback : Number(env[key]);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${key}: expected ${min}..${max}`);
  return value;
};
export function rescueConfig(env = {}) {
  return {
    maxConcurrency: number(env, 'MAX_RESCUE_CONCURRENCY', 4, 1, 16),
    maxAttempts: number(env, 'MAX_RESCUE_ATTEMPTS', 3, 1, 10),
    heartbeatMs: number(env, 'RESCUE_HEARTBEAT_SECONDS', 120, 60, 300) * 1000,
    staleMs: number(env, 'RESCUE_STALE_SECONDS', 600, 360, 3600) * 1000,
    queueStallMs: number(env, 'RESCUE_QUEUE_STALL_SECONDS', 900, 300, 86400) * 1000,
    retryMs: number(env, 'RESCUE_RETRY_SECONDS', 300, 60, 3600) * 1000,
    scanMinMs: number(env, 'RESCUE_SCAN_MIN_SECONDS', 120, 60, 600) * 1000,
    apiReserve: number(env, 'RESCUE_API_RESERVE', 200, 100, 500),
    maxEvaluations: number(env, 'RESCUE_MAX_EVALUATIONS', 12, 1, 24),
    maxRequests: number(env, 'RESCUE_MAX_REQUESTS', 160, 40, 300),
  };
}
export function manualReason(pr, { reviews, unresolved, complete = true } = {}) {
  if (pr.base?.repo?.full_name !== REPOSITORY || pr.head?.repo?.full_name !== REPOSITORY) return 'EXTERNAL_REPOSITORY';
  if (pr.base?.ref !== 'develop' || /^(main|develop|production|prod)$/i.test(pr.head?.ref || '')) return 'PROTECTED_BRANCH';
  if (pr.state !== 'open') return 'CLOSED_PR';
  if (pr.draft) return 'DRAFT';
  if (!['OWNER', 'MEMBER', 'COLLABORATOR'].includes(pr.author_association)) return 'UNTRUSTED_AUTHOR';
  if ((pr.labels || []).some(l => ['integration:hold', 'integration:manual', 'do-not-merge'].includes(l.name)) ||
    /^Integration-Hold:\s*\S+/im.test(pr.body || '')) return 'EXPLICIT_HOLD';
  try { dependencies(pr.body || ''); } catch { return 'INVALID_DEPENDENCY'; }
  if (!complete) return 'INCOMPLETE_SAFETY_EVIDENCE';
  if (reviews && reviewDecision(reviews, pr.head.sha).rejected) return 'CHANGES_REQUESTED';
  if (unresolved) return 'UNRESOLVED_THREAD';
  return null;
}

// Persist a stable machine code; legacy Integration descriptions remain readable.
export function integrationRescueReason(reason = '') {
  if (/overlapping changes since PR base/i.test(reason)) return 'DEVELOP_OVERLAP';
  if (/mergeability|merge conflict|dirty/i.test(reason)) return 'MERGE_CONFLICT';
  if (/dependency PR/i.test(reason)) return 'DEPENDENCY_WAIT';
  if (/PR changed|stale head/i.test(reason)) return 'HEAD_CHANGED';
  if (/develop.*(moved|update)/i.test(reason)) return 'DEVELOP_ADVANCED';
  if (/HTTP (?:429|5\d\d)|timeout|rate.limit|time budget|deferred/i.test(reason)) return 'INTEGRATION_TRANSIENT';
  return null;
}
export function detectReason({ pr, queue, mergeBase, develop, baseChanges = [], previous, now, config }) {
  if (previous?.state === 'STALE') return 'WORKER_STALE';
  if (pr.mergeable === false || pr.mergeable_state === 'dirty') return 'MERGE_CONFLICT';
  const machine = integrationRescueReason(queue?.description);
  if (machine) return machine;
  if (mergeBase !== develop && baseChanges.length) return 'DEVELOP_ADVANCED';
  if (queue?.state === 'pending' && now - Date.parse(queue.created_at) >= config.queueStallMs) return 'QUEUE_PENDING';
  if (!queue && now - Date.parse(previous?.detectedAt || pr.updated_at || pr.created_at) >= config.queueStallMs) return 'ORPHAN_READY';
  return null;
}

export const fileScope = path => /^(apps|packages)\//.test(path) ? path.split('/').slice(0, 2).join('/') : path.startsWith('docs/') ? 'docs' : path.startsWith('ops-board/') ? 'ops-board' : 'repository';
const control = path => /^(\.github\/|scripts\/|AGENTS\.md$|package(?:-lock)?\.json$|wrangler|docs\/(?:DEVELOPMENT|INTEGRATION|BROWSER_SELF_HEALING))/.test(path);
const contract = path => /(?:^|[\/_.-])(?:schema|migration|save-format|protocol|contract)(?:[\/_.-]|$)/i.test(path);
export function conflictScope(files, body = '', consumers = {}) {
  const unique = [...new Set(files)].sort();
  const scopes = [...new Set(unique.map(fileScope))];
  const shared = unique.filter(f => f.startsWith('packages/')).map(fileScope);
  const related = [...new Set([...scopes, ...shared.flatMap(s => consumers[s] || [])])];
  const specs = [...String(body).matchAll(/(?:Rescue-Spec:\s*|(?:Closes|Fixes|Resolves)\s+)([^\n]+)/ig)].map(m => m[1].trim().toLowerCase());
  return { files: unique, scopes, related, shared: [...new Set(shared)], control: unique.some(control), contract: unique.some(contract), specs };
}
const intersects = (a = [], b = []) => a.some(x => b.includes(x));
export function compareScopes(a, b) {
  if (!a || !b || !a.files?.length || !b.files?.length) return { risk: 'RED', reason: 'scope evidence incomplete' };
  if (intersects(a.files, b.files)) return { risk: 'RED', reason: 'same file (including renamed paths)' };
  if (intersects(a.specs, b.specs)) return { risk: 'RED', reason: 'same declared specification' };
  if (a.control || b.control) return { risk: 'RED', reason: 'Integration/control plane lock' };
  if (a.contract || b.contract) return { risk: 'RED', reason: 'schema/save/API contract lock' };
  if ((a.shared.length || b.shared.length) && intersects(a.related, b.related)) return { risk: 'RED', reason: 'shared package / transitive consumer lock' };
  if (intersects(a.scopes, b.scopes)) return { risk: 'YELLOW', reason: 'same package, different files; recheck required' };
  return { risk: 'GREEN', reason: 'independent changed scopes' };
}
export function evaluateSnapshot(record, { head, develop, baseChanges, consumers }) {
  if (head !== record.headSha) return { valid: false, reason: 'HEAD_CHANGED' };
  if (develop === record.developSha) return { valid: true, recheck: false };
  if (!Array.isArray(baseChanges)) return { valid: false, reason: 'INCOMPLETE_BASE_COMPARISON' };
  if (!baseChanges.length) return { valid: true, recheck: false };
  const relation = compareScopes(record.scope, conflictScope(baseChanges, '', consumers));
  return relation.risk === 'GREEN' ? { valid: true, recheck: false, develop } : { valid: false, reason: 'RELATED_DEVELOP_ADVANCED', relation };
}
export function priority(record, records, now) {
  const blockers = records.filter(r => r.dependencies?.includes(record.pr)).length;
  const ageHours = Math.min(72, Math.max(0, (now - Date.parse(record.detectedAt)) / 3600000));
  const small = record.scope.files.length <= 5 && record.changes <= 150;
  const score = (record.repair ? 100 : 0) + Math.min(blockers, 10) * 20 + Math.floor(ageHours) + (small ? 15 : 0) -
    (record.scope.control || record.scope.contract || record.scope.shared.length ? 10 : 0) - (record.changes > 1000 ? 10 : 0);
  return { score, label: score >= 60 ? 'HIGH' : score >= 15 ? 'NORMAL' : 'LOW',
    explanation: `repair ${record.repair ? '+100' : '0'}; dependents +${Math.min(blockers, 10) * 20}; age +${Math.floor(ageHours)}; small ${small ? '+15' : '0'}; risk/size penalty` };
}

export function newState(config = rescueConfig()) {
  return { schema: 1, repository: REPOSITORY, revision: 0, config, records: {}, waves: [], activity: [], outbox: [], cursor: 0, updatedAt: null, coordinator: {} };
}
export function event(state, record, type, action, now) {
  state.activity.push({ id: `${record?.rescueId || (record?.pr ? 'pr-' + record.pr : 'coordinator')}:${type}:${now}:${state.revision}`, at: new Date(now).toISOString(), pr: record?.pr || null, workerId: record?.claimedBy || null, type, action: String(action).slice(0, 240) });
  state.activity = state.activity.filter(e => now - Date.parse(e.at) < 86400000).slice(-400);
}
export function transition(state, record, next, action, now) {
  if (!STATES.has(next)) throw new Error(`Invalid state ${next}`);
  if (record.state !== next) event(state, record, next, action, now);
  record.state = next; record.currentStep = next; record.currentAction = String(action).slice(0, 240); record.updatedAt = new Date(now).toISOString();
}
export function failure(state, record, reason, now, manual = false) {
  record.failures = [...(record.failures || []), { reason: String(reason).slice(0, 400), at: new Date(now).toISOString(), workerId: record.claimedBy, attempt: record.attempt, runId: record.runId, rescueId: record.rescueId }].slice(-10);
  record.failureReason = String(reason).slice(0, 400);
  record.lease = null;
  record.nextAttemptAt = new Date(now + state.config.retryMs * Math.max(1, record.attempt)).toISOString();
  transition(state, record, manual || record.attempt >= record.maxAttempts ? 'FAILED_MANUAL' : 'FAILED_RETRYABLE', reason, now);
  if (record.state === 'FAILED_MANUAL') state.outbox.push({ id: `${record.rescueId || 'pr-' + record.pr}:manual:${record.attempt}`, type: 'manual', pr: record.pr, reason: record.failureReason, attempt: record.attempt, maxAttempts: record.maxAttempts });
}
export function owned(state, pr, rescueId, workerId) {
  const r = state.records[pr];
  if (!r || r.rescueId !== rescueId || r.claimedBy !== workerId || !r.lease) throw new Error('CLAIM_REJECTED: lease fenced or replaced');
  return r;
}
export function heartbeat(state, pr, rescueId, workerId, progress, now) {
  const r = owned(state, pr, rescueId, workerId);
  if (!ACTIVE.has(r.state) && r.state !== 'STALE') throw new Error('CLAIM_REJECTED: worker no longer active');
  r.heartbeatAt = new Date(now).toISOString();
  if (r.state === 'STALE') transition(state, r, ACTIVE.has(r.staleFrom) ? r.staleFrom : 'ANALYZING', 'Worker heartbeat recovered; original lease retained', now);
  // Worker summaries never control lifecycle, claims, validation results or push authorization.
  if (progress?.currentAction) r.currentAction = String(progress.currentAction).replace(/[\r\n]+/g, ' ').slice(0, 240);
  r.currentFile = r.scope.files.includes(progress?.currentFile) ? progress.currentFile : null;
  if (['ANALYZING', 'RESOLVING'].includes(r.state) && ['ANALYZING', 'RESOLVING'].includes(progress?.currentStep)) transition(state, r, progress.currentStep, r.currentAction, now);
  return r;
}
export function recoverStale(state, runStates, now) {
  for (const r of Object.values(state.records).filter(r => r.lease)) {
    const old = now - Date.parse(r.heartbeatAt || r.claimedAt) > state.config.staleMs;
    const terminalRun = runStates[r.runId] === 'completed';
    if (!old && !terminalRun) continue;
    if (old) { if (r.state !== 'STALE') r.staleFrom = r.state; transition(state, r, 'STALE', 'Worker heartbeat lost; waiting for Actions run termination before reclaim', now); }
    // Never evict a merely slow live runner. Its per-PR job lock and finite timeout remain in force.
    if (terminalRun) failure(state, r, old ? 'WORKER_STALE' : 'WORKER_DIED', now);
  }
}

export function planWave(state, { runId, now, id }) {
  const all = Object.values(state.records);
  const occupied = all.filter(r => r.lease);
  const locks = all.filter(r => r.lease || RETURNED.has(r.state));
  const candidates = all.filter(r => ['DETECTED', 'QUEUED', 'BLOCKED_BY_RESCUE', 'FAILED_RETRYABLE'].includes(r.state) &&
    !r.lease && (!r.nextAttemptAt || Date.parse(r.nextAttemptAt) <= now));
  for (const r of candidates) r.priority = priority(r, all, now);
  candidates.sort((a, b) => b.priority.score - a.priority.score || a.pr - b.pr);
  const selected = [];
  for (const r of candidates) {
    if (r.browserRepair) {
      r.risk = 'RED'; r.waitingReason = `Browser self-healing ticket #${r.browserRepair} owns this PR`;
      transition(state, r, 'BLOCKED_BY_RESCUE', r.waitingReason, now); continue;
    }
    if (r.attempt >= r.maxAttempts) { failure(state, r, 'RETRY_EXHAUSTED', now, true); continue; }
    const dependenciesWaiting = (r.dependencies || []).filter(pr => !r.mergedDependencies?.includes(pr));
    const blockers = [...new Set([...dependenciesWaiting, ...locks.filter(p => p.pr !== r.pr && compareScopes(r.scope, p.scope).risk === 'RED').map(p => p.pr)])];
    r.blockedBy = blockers;
    if (blockers.length) {
      r.risk = 'RED'; r.waitingReason = `Waiting for ${blockers.map(pr => `#${pr}`).join(', ')} to merge into develop`;
      for (const pr of blockers) {
        const predecessor = state.records[pr];
        if (predecessor && (predecessor.lease || RETURNED.has(predecessor.state))) {
          predecessor.risk = 'RED'; predecessor.riskReason = `Sequential predecessor; #${r.pr} waits for this PR to merge`;
        }
      }
      transition(state, r, 'BLOCKED_BY_RESCUE', r.waitingReason, now); continue;
    }
    const relations = locks.filter(p => p.pr !== r.pr).map(p => compareScopes(r.scope, p.scope));
    r.risk = relations.some(x => x.risk === 'YELLOW') ? 'YELLOW' : 'GREEN';
    r.riskReason = r.risk === 'YELLOW' ? 'Same package; latest develop recheck before/after push' : 'Independent changed scopes';
    for (const peer of locks) if (peer.pr !== r.pr && compareScopes(r.scope, peer.scope).risk === 'YELLOW' && peer.risk !== 'RED') {
      peer.risk = 'YELLOW'; peer.riskReason = 'Same package; latest develop recheck before/after push';
    }
    r.waitingReason = null;
    transition(state, r, 'QUEUED', 'Eligible for next Wave', now);
    if (occupied.length + selected.length >= state.config.maxConcurrency) continue;
    r.previousPushedSha = r.pushedSha || r.previousPushedSha || null;
    for (const key of ['returnedAt', 'pushedAt', 'pushedSha', 'pendingIntegration', 'validation', 'integrationRequestedAt']) delete r[key];
    r.attempt++; r.rescueId = `${id}-pr-${r.pr}-a${r.attempt}`;
    r.wave = id; r.runId = String(runId); r.claimedBy = `${runId}/pr-${r.pr}/a${r.attempt}`;
    r.claimedAt = r.heartbeatAt = new Date(now).toISOString(); r.lease = r.rescueId;
    r.snapshot = { headSha: r.headSha, developSha: r.developSha, mergeBaseSha: r.mergeBaseSha };
    transition(state, r, 'CLAIMED', 'Isolated Actions Worker reserved; preparing PR analysis', now);
    selected.push(r); locks.push(r);
  }
  if (selected.length) state.waves.push({ id, startedAt: new Date(now).toISOString(), prs: selected.map(r => r.pr), rescueIds: selected.map(r => r.rescueId) });
  state.waves = state.waves.slice(-100);
  return selected.map(r => ({ pr: r.pr, rescueId: r.rescueId, workerId: r.claimedBy, head: r.headSha, branch: r.branch, develop: r.developSha }));
}
