import { compareScopes, RETURNED } from './integration-rescue-policy.mjs';
import { workRepairEligibility } from './integration-rescue-work-repair-policy.mjs';

const validTime = value => Number.isFinite(Date.parse(value || ''));
const workActive = (record, now) => record?.workRepair?.status === 'working' &&
  (!validTime(record.workRepair.expiresAt) || now < Date.parse(record.workRepair.expiresAt));
const poolActive = (record, now) => Boolean(record?.lease) || workActive(record, now);
const score = record => Number(record?.priority?.score || 0);
const detected = record => Date.parse(record?.detectedAt || record?.updatedAt || 0) || 0;

function scopeBlocker(state, record, now) {
  const ownScope = record.workRepair?.scope || record.scope;
  if (!ownScope?.files?.length) return 'SCOPE_NOT_READY';
  for (const peer of Object.values(state.records || {})) {
    if (peer.pr === record.pr) continue;
    const owns = poolActive(peer, now) || RETURNED.has(peer.state);
    if (!owns) continue;
    const peerScope = peer.workRepair?.scope || peer.scope;
    if (peerScope?.files?.length && compareScopes(ownScope, peerScope).risk === 'RED') return `SCOPE_LOCK:#${peer.pr}`;
  }
  return null;
}

function blocker(state, record, now) {
  if (record.lease) return 'ACTIONS_WORKER_OWNS_PR';
  if (workActive(record, now)) return 'WORK_REPAIR_ACTIVE';
  if (record.pushLease) return 'WORK_PUSH_OWNS_PR';
  if (record.browserRepair) return `BROWSER_REPAIR_OWNS_PR:#${record.browserRepair}`;
  if (Array.isArray(record.blockedBy) && record.blockedBy.length) return `DEPENDENCY_WAIT:${record.blockedBy.map(pr => `#${pr}`).join(',')}`;
  return scopeBlocker(state, record, now);
}

export function deriveWorkRepairWake(state, now = Date.now()) {
  const records = Object.values(state?.records || {});
  const max = Math.max(1, Number(state?.config?.maxConcurrency || 4));
  const active = records.filter(record => poolActive(record, now)).length;
  const capacity = Math.max(0, max - active);
  const candidates = records
    .filter(record => record.state === 'FAILED_MANUAL' && workRepairEligibility(record).eligible)
    .sort((a, b) => score(b) - score(a) || detected(a) - detected(b) || Number(a.pr) - Number(b.pr));
  const evaluated = candidates.map(record => ({
    pr: record.pr,
    priority: record.priority?.label || null,
    blocker: blocker(state, record, now),
  }));
  const claimable = evaluated.filter(item => !item.blocker);
  const blocked = evaluated.filter(item => item.blocker);
  const wakeRequired = capacity > 0 && claimable.length > 0;
  const status = wakeRequired ? 'WAKE_REQUIRED' : candidates.length ? 'BLOCKED' : active ? 'ACTIVE' : 'IDLE';
  const reason = wakeRequired
    ? `${claimable.length} AI repair candidate(s) can claim ${capacity} free worker slot(s)`
    : candidates.length && capacity === 0
      ? `Worker pool full (${active}/${max})`
      : candidates.length
        ? `All ${candidates.length} AI repair candidate(s) are fenced by current ownership/dependencies`
        : active
          ? `${active} worker(s) active; no additional AI repair candidate is waiting`
          : 'No AI repair candidate is waiting';
  return {
    status,
    wakeRequired,
    active,
    max,
    capacity,
    eligible: candidates.length,
    claimable: claimable.length,
    blocked: blocked.length,
    reason,
    candidates: evaluated.slice(0, 8),
  };
}
