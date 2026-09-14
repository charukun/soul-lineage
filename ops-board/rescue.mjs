import { REPOSITORY, ACTIVE, RETURNED, rescueConfig } from '../scripts/integration-rescue-policy.mjs';

const safeString = (value, max = 240) => typeof value === 'string' ? value.slice(0, max) : null;
const duration = (from, to) => {
  const a = Date.parse(from || ''), b = Date.parse(to || '');
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? b - a : null;
};
const percentile = (values, p) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
};
const minutes = value => Number.isFinite(value) ? Math.round(value / 6000) / 10 : null;
function repairEvidence(r) {
  const w=r.workRepair,result=w?.result;
  if(w?.status==='returned')return result?.head===r.pushedSha && result.validation?.status==='passed' && result.validation.tree===result.tree && result.commit?.tree?.sha===result.tree && result.commit?.sha===result.head && /^[0-9a-f]{40}$/.test(result.head) && result.commit.parents?.[0]?.sha===w.sourceHead && result.commit.parents?.[1]?.sha===w.develop && Date.parse(w.startedAt)<=Date.parse(r.pushedAt) && Date.parse(r.pushedAt)<=Date.parse(r.returnedAt) && ['RETURNED_TO_INTEGRATION','CHECKING','MERGED','DEV'].includes(r.state);
  const claimed = Date.parse(r.claimedAt), pushed = Date.parse(r.pushedAt), returned = Date.parse(r.returnedAt);
  return r.mode !== 'reevaluate' && Number.isSafeInteger(r.attempt) && r.attempt > 0 && Boolean(r.rescueId && r.claimedBy) &&
    /^[0-9a-f]{40}$/.test(r.pushedSha || '') && r.validation?.status === 'passed' && r.validation.head === r.pushedSha &&
    Number.isFinite(claimed) && claimed <= pushed && pushed <= returned &&
    ['PUSHED', 'RETURNED_TO_INTEGRATION', 'CHECKING', 'MERGED', 'DEV'].includes(r.state);
}
export function rescueView(state, now = Date.now()) {
  if (!state || state.schema !== 1 || state.repository !== REPOSITORY) return { available: false, status: 'UNAVAILABLE', reason: 'Rescue状態をまだ取得していません', workers: [], queue: [], recent: [], manual: [], waves: [], activity: [] };
  const config = state.config || rescueConfig();
  const records = Object.values(state.records).map(r => ({
    pr: r.pr, title: safeString(r.title), branch: safeString(r.branch), state: r.workRepair?.status==='working'?'RESOLVING':r.state, sourceState:r.state,
    repairVerified: repairEvidence(r),
    deliveryKind: repairEvidence(r) ? 'repaired' : r.state === 'AWAITING_PUSH' ? 'staged' : r.mode === 'reevaluate' && r.returnedAt ? 'reevaluated' : 'observed',
    rescueId: r.rescueId || null, workerId: r.workRepair?.workerId || r.claimedBy || null, wave: r.wave || null, lease: Boolean(r.lease || r.workRepair?.status==='working'),
    currentStep: r.currentStep, currentAction: safeString(r.currentAction), currentFile: safeString(r.currentFile), waitingReason: safeString(r.waitingReason),
    scopes: r.scope?.scopes || [], files: r.scope?.files || [], risk: r.risk || 'RED', riskReason: safeString(r.riskReason), reason: r.reason,
    priority: r.priority || null, blockedBy: r.blockedBy || [], dependencies: r.dependencies || [], attempt: r.attempt, maxAttempts: r.maxAttempts,
    detectedAt: r.detectedAt, claimedAt: r.workRepair?.startedAt || r.claimedAt, heartbeatAt: r.workRepair?.heartbeatAt || r.heartbeatAt, updatedAt: r.updatedAt,
    heartbeatStale: r.workRepair?.status==='working' ? now-Date.parse(r.workRepair.heartbeatAt)>config.staleMs : Boolean(r.lease) && now - Date.parse(r.heartbeatAt || r.claimedAt) > config.staleMs,
    returnedAt: r.returnedAt || null, pushedAt: r.pushedAt || null, mergedAt: r.mergedAt || null, devAt: r.devAt || null,
    pushedSha: r.pushedSha || null, mergeCommit: r.mergeCommit || null, devCommit: r.devCommit || null,
    stagedSha: r.stagedSha || null, stagedAt: r.stagedAt || null, pushWorkerId: r.pushWorkerId || null, heartbeatCount: r.heartbeatCount || 0,
    resolution: safeString(r.resolution), failureReason: safeString(r.failureReason, 400), failures: (r.failures || []).slice(-3),
    validation: r.validation ? { status: r.validation.status, command: safeString(r.validation.command), at: r.validation.at, head: r.validation.head } : null,
    url: `https://github.com/${REPOSITORY}/pull/${r.pr}`, runUrl: r.workRepair ? null : safeString(r.runUrl),
  }));
  const workers = records.filter(r => r.lease), queue = records.filter(r => ['DETECTED', 'QUEUED', 'BLOCKED_BY_RESCUE', 'FAILED_RETRYABLE'].includes(r.state));
  const manual = records.filter(r => r.state === 'FAILED_MANUAL');
  const waitingStates = new Set(['DETECTED', 'QUEUED', 'BLOCKED_BY_RESCUE', 'FAILED_RETRYABLE', ...RETURNED]);
  const completedStates = new Set(['MERGED', 'DEV']);
  const counts = { active: workers.filter(r => !r.heartbeatStale && ACTIVE.has(r.state)).length, reserved: workers.length, max: config.maxConcurrency,
    handling: records.filter(r => ACTIVE.has(r.state) && !r.heartbeatStale).length,
    waiting: records.filter(r => waitingStates.has(r.state)).length,
    unresolved: records.filter(r => r.state !== 'CLOSED' && !completedStates.has(r.state)).length,
    completed: records.filter(r => completedStates.has(r.state)).length,
    attention: records.filter(r => r.state === 'FAILED_MANUAL' || r.state === 'STALE' || r.heartbeatStale).length,
    queued: queue.filter(r => r.state !== 'BLOCKED_BY_RESCUE').length, blocked: queue.filter(r => r.state === 'BLOCKED_BY_RESCUE').length,
    validating: records.filter(r => r.state === 'VALIDATING').length, awaitingPush: records.filter(r => r.state === 'AWAITING_PUSH').length,
    returned: records.filter(r => RETURNED.has(r.state) && r.state !== 'AWAITING_PUSH' && r.returnedAt).length,
    manual: manual.length, retry: records.filter(r => r.state === 'FAILED_RETRYABLE').length,
    stale: workers.filter(r => r.state === 'STALE' || r.heartbeatStale).length };
  const recent = records.filter(r => RETURNED.has(r.state) || ['MERGED', 'DEV'].includes(r.state)).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 20);
  const activity = state.activity.filter(e => now - Date.parse(e.at) >= 0 && now - Date.parse(e.at) < 86400000);
  // Legacy events contain no immutable repair proof. Attribute them only to the
  // same retained claim, after its validated push/return; missing evidence is not success.
  const repairedEvent = e => {
    const r = records.find(r => r.pr === e.pr);
    return Boolean(r?.repairVerified && e.workerId === r.workerId && e.id?.startsWith(`${r.rescueId}:`) && Date.parse(e.at) >= Date.parse(r.returnedAt));
  };
  const count = (types, predicate = () => true) => new Set(activity.filter(e => types.includes(e.type) && predicate(e)).map(e => e.pr)).size;
  const rescued = count(['RETURNED_TO_INTEGRATION'], repairedEvent);
  const merged = count(['MERGED'], repairedEvent);
  const manual24h = count(['FAILED_MANUAL']);
  const status = !state.coordinator?.configured ? 'CONFIGURATION_REQUIRED' : counts.manual || counts.stale ? 'ATTENTION' : counts.active ? 'ACTIVE' : counts.queued || counts.blocked || counts.returned || counts.awaitingPush ? 'WAITING' : 'ALL_CLEAR';
  const waitingAges = records.filter(r => !completedStates.has(r.state)).map(r => duration(r.detectedAt, new Date(now).toISOString())).filter(Number.isFinite);
  const completed24h = records.filter(r => r.mergedAt && now - Date.parse(r.mergedAt) >= 0 && now - Date.parse(r.mergedAt) < 86400000);
  const claimDurations = completed24h.map(r => duration(r.detectedAt, r.claimedAt)).filter(Number.isFinite);
  const mergeDurations = completed24h.map(r => duration(r.detectedAt, r.mergedAt)).filter(Number.isFinite);
  const attempted24h = records.filter(r => r.detectedAt && now - Date.parse(r.detectedAt) >= 0 && now - Date.parse(r.detectedAt) < 86400000);
  const retries24h = attempted24h.filter(r => Number(r.attempt || 0) > 1 || (r.failures || []).length > 0).length;
  return { available: true, status, generatedAt: state.updatedAt, staleMs: config.staleMs,
    coordinator: { heartbeatAt: state.coordinator?.heartbeatAt, phase: state.coordinator?.phase, reason: safeString(state.coordinator?.configurationReason), errors: state.coordinator?.errors || [] },
    counts, workers, queue: queue.sort((a, b) => (b.priority?.score || 0) - (a.priority?.score || 0)), manual, recent,
    waves: state.waves.slice(-5).reverse().map(w => ({ ...w,
      repaired: records.filter(r => w.rescueIds.includes(r.rescueId) && r.repairVerified).length,
      returnedCount: records.filter(r => w.rescueIds.includes(r.rescueId) && r.returnedAt && r.state !== 'AWAITING_PUSH').length,
      waiting: queue.filter(r => r.blockedBy.some(pr => w.prs.includes(pr))).map(r => ({ pr: r.pr, blockedBy: r.blockedBy, waitingReason: r.waitingReason })) })),
    throughput: { rescued, merged, manual: manual24h, retrying: counts.retry, windowHours: 24, retainedEvents: activity.length },
    performance: {
      oldestWaitingMinutes: minutes(waitingAges.length ? Math.max(...waitingAges) : null),
      detectedToClaimP50Minutes: minutes(percentile(claimDurations, 50)),
      detectedToMergeP50Minutes: minutes(percentile(mergeDurations, 50)),
      detectedToMergeP95Minutes: minutes(percentile(mergeDurations, 95)),
      repairSuccessRatePct: rescued + manual24h > 0 ? Math.round((rescued / (rescued + manual24h)) * 1000) / 10 : null,
      retryRatePct: attempted24h.length ? Math.round((retries24h / attempted24h.length) * 1000) / 10 : null,
    },
    observed: { merged: count(['MERGED'], e => !repairedEvent(e)), dev: count(['DEV'], e => !repairedEvent(e)) },
    activity: activity.slice(-30).reverse().map(e => ({ at: e.at, pr: e.pr, workerId: e.workerId, type: e.type, repairVerified: repairedEvent(e), action: safeString(e.action) })),
    notification: state.outbox.filter(n => n.sentAt).at(-1)?.channel || 'not configured',
  };
}
export async function collectRescue(client, previous, now = Date.now()) {
  try {
    const { data } = await client.get('/contents/rescue-state.json?ref=automation%2Fintegration-rescue-state');
    if (data.encoding !== 'base64' || !data.content) throw new Error('Rescue state format/size');
    const bytes = Uint8Array.from(atob(data.content.replace(/\s/g, '')), c => c.charCodeAt(0));
    return rescueView(JSON.parse(new TextDecoder().decode(bytes)), now);
  } catch (error) {
    return { ...(previous || rescueView(null)), observationError: safeString(error.message), observedAt: new Date(now).toISOString() };
  }
}
