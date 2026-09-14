import { REPOSITORY, ACTIVE, RETURNED, rescueConfig } from '../scripts/integration-rescue-policy.mjs';
import { workRepairEligibility } from '../scripts/integration-rescue-work-repair-policy.mjs';

const safeString = (value, max = 240) => typeof value === 'string' ? value.slice(0, max) : null;
function repairEvidence(r) {
  const w=r.workRepair,result=w?.result;
  if(w?.status==='returned')return result?.head===r.pushedSha && result.validation?.status==='passed' && result.validation.tree===result.tree && result.commit?.tree?.sha===result.tree && result.commit?.sha===result.head && /^[0-9a-f]{40}$/.test(result.head) && result.commit.parents?.[0]?.sha===w.sourceHead && result.commit.parents?.[1]?.sha===w.develop && Date.parse(w.startedAt)<=Date.parse(r.pushedAt) && Date.parse(r.pushedAt)<=Date.parse(r.returnedAt) && ['RETURNED_TO_INTEGRATION','CHECKING','MERGED','DEV'].includes(r.state);
  const claimed = Date.parse(r.claimedAt), pushed = Date.parse(r.pushedAt), returned = Date.parse(r.returnedAt);
  return r.mode !== 'reevaluate' && Number.isSafeInteger(r.attempt) && r.attempt > 0 && Boolean(r.rescueId && r.claimedBy) &&
    /^[0-9a-f]{40}$/.test(r.pushedSha || '') && r.validation?.status === 'passed' && r.validation.head === r.pushedSha &&
    Number.isFinite(claimed) && claimed <= pushed && pushed <= returned &&
    ['PUSHED', 'RETURNED_TO_INTEGRATION', 'CHECKING', 'MERGED', 'DEV'].includes(r.state);
}
function manualDisposition(r) {
  if (r.state !== 'FAILED_MANUAL') return null;
  const eligibility = workRepairEligibility(r);
  if (eligibility.eligible) return { kind:'work-recoverable', reason:null, eligibility };
  if (r.workRepair?.status === 'human-required' || eligibility.reason === 'HUMAN_DECISION_REQUIRED') return { kind:'human-required', reason:eligibility.reason, eligibility };
  return { kind:'manual-hold', reason:eligibility.reason, eligibility };
}
export function rescueView(state, now = Date.now()) {
  if (!state || state.schema !== 1 || state.repository !== REPOSITORY) return { available: false, status: 'UNAVAILABLE', reason: 'Rescue状態をまだ取得していません', workers: [], queue: [], recent: [], manual: [], recoverableManual: [], humanManual: [], manualHold: [], waves: [], activity: [] };
  const config = state.config || rescueConfig();
  const records = Object.values(state.records).map(r => {
    const disposition=manualDisposition(r), eligibility=disposition?.eligibility;
    return {
      pr: r.pr, title: safeString(r.title), branch: safeString(r.branch), state: r.workRepair?.status==='working'?'RESOLVING':r.state, sourceState:r.state,
      repairVerified: repairEvidence(r),
      deliveryKind: repairEvidence(r) ? 'repaired' : r.state === 'AWAITING_PUSH' ? 'staged' : r.mode === 'reevaluate' && r.returnedAt ? 'reevaluated' : 'observed',
      rescueId: r.rescueId || null, workerId: r.workRepair?.workerId || r.claimedBy || null, wave: r.wave || null, lease: Boolean(r.lease || r.workRepair?.status==='working'),
      currentStep: r.currentStep, currentAction: safeString(r.currentAction), currentFile: safeString(r.currentFile), waitingReason: safeString(r.waitingReason),
      scopes: r.scope?.scopes || [], files: r.scope?.files || [], risk: r.risk || 'RED', riskReason: safeString(r.riskReason), reason: r.reason,
      priority: r.priority || null, blockedBy: r.blockedBy || [], dependencies: r.dependencies || [], attempt: r.attempt, maxAttempts: r.maxAttempts,
      manualKind: disposition?.kind || null, manualReason: disposition?.reason || null,
      workRepairAttempts: Number(r.workRepairAttempts || 0), maxWorkRepairAttempts: eligibility?.maxAttempts ?? r.workRepair?.maxAttempts ?? 2,
      baselineChurns: Number(r.workRepairBaselineChurns || r.workRepair?.baselineChurns || 0), maxBaselineChurns: eligibility?.maxBaselineChurns ?? r.workRepair?.maxBaselineChurns ?? 8,
      detectedAt: r.detectedAt, claimedAt: r.workRepair?.startedAt || r.claimedAt, heartbeatAt: r.workRepair?.heartbeatAt || r.heartbeatAt, updatedAt: r.updatedAt,
      heartbeatStale: r.workRepair?.status==='working' ? now-Date.parse(r.workRepair.heartbeatAt)>config.staleMs : Boolean(r.lease) && now - Date.parse(r.heartbeatAt || r.claimedAt) > config.staleMs,
      returnedAt: r.returnedAt || null, pushedAt: r.pushedAt || null, mergedAt: r.mergedAt || null, devAt: r.devAt || null,
      pushedSha: r.pushedSha || null, mergeCommit: r.mergeCommit || null, devCommit: r.devCommit || null,
      stagedSha: r.stagedSha || null, stagedAt: r.stagedAt || null, pushWorkerId: r.pushWorkerId || null, heartbeatCount: r.heartbeatCount || 0,
      resolution: safeString(r.resolution), failureReason: safeString(r.failureReason, 400), failures: (r.failures || []).slice(-3),
      validation: r.validation ? { status: r.validation.status, command: safeString(r.validation.command), at: r.validation.at, head: r.validation.head } : null,
      url: `https://github.com/${REPOSITORY}/pull/${r.pr}`, runUrl: r.workRepair ? null : safeString(r.runUrl),
    };
  });
  const workers = records.filter(r => r.lease), queue = records.filter(r => ['DETECTED', 'QUEUED', 'BLOCKED_BY_RESCUE', 'FAILED_RETRYABLE'].includes(r.state));
  const manual = records.filter(r => r.state === 'FAILED_MANUAL');
  const recoverableManual=manual.filter(r=>r.manualKind==='work-recoverable');
  const humanManual=manual.filter(r=>r.manualKind==='human-required');
  const manualHold=manual.filter(r=>r.manualKind==='manual-hold');
  const waitingStates = new Set(['DETECTED', 'QUEUED', 'BLOCKED_BY_RESCUE', 'FAILED_RETRYABLE', ...RETURNED]);
  const completedStates = new Set(['MERGED', 'DEV']);
  const counts = { active: workers.filter(r => !r.heartbeatStale && ACTIVE.has(r.state)).length, reserved: workers.length, max: config.maxConcurrency,
    handling: records.filter(r => ACTIVE.has(r.state) && !r.heartbeatStale).length,
    waiting: records.filter(r => waitingStates.has(r.state)).length + recoverableManual.length,
    unresolved: records.filter(r => r.state !== 'CLOSED' && !completedStates.has(r.state)).length,
    completed: records.filter(r => completedStates.has(r.state)).length,
    attention: humanManual.length + manualHold.length + records.filter(r => r.state === 'STALE' || r.heartbeatStale).length,
    queued: queue.filter(r => r.state !== 'BLOCKED_BY_RESCUE').length, blocked: queue.filter(r => r.state === 'BLOCKED_BY_RESCUE').length,
    validating: records.filter(r => r.state === 'VALIDATING').length, awaitingPush: records.filter(r => r.state === 'AWAITING_PUSH').length,
    returned: records.filter(r => RETURNED.has(r.state) && r.state !== 'AWAITING_PUSH' && r.returnedAt).length,
    manual: manual.length, recoverableManual:recoverableManual.length, humanManual:humanManual.length, manualHold:manualHold.length,
    retry: records.filter(r => r.state === 'FAILED_RETRYABLE').length,
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
  const status = !state.coordinator?.configured ? 'CONFIGURATION_REQUIRED' : counts.humanManual || counts.manualHold || counts.stale ? 'ATTENTION' : counts.active ? 'ACTIVE' : counts.queued || counts.blocked || counts.returned || counts.awaitingPush || counts.recoverableManual ? 'WAITING' : 'ALL_CLEAR';
  return { available: true, status, generatedAt: state.updatedAt, staleMs: config.staleMs,
    coordinator: { heartbeatAt: state.coordinator?.heartbeatAt, phase: state.coordinator?.phase, reason: safeString(state.coordinator?.configurationReason), errors: state.coordinator?.errors || [] },
    counts, workers, queue: queue.sort((a, b) => (b.priority?.score || 0) - (a.priority?.score || 0)), manual, recoverableManual, humanManual, manualHold, recent,
    waves: state.waves.slice(-5).reverse().map(w => ({ ...w,
      repaired: records.filter(r => w.rescueIds.includes(r.rescueId) && r.repairVerified).length,
      returnedCount: records.filter(r => w.rescueIds.includes(r.rescueId) && r.returnedAt && r.state !== 'AWAITING_PUSH').length,
      waiting: queue.filter(r => r.blockedBy.some(pr => w.prs.includes(pr))).map(r => ({ pr: r.pr, blockedBy: r.blockedBy, waitingReason: r.waitingReason })) })),
    throughput: { rescued: count(['RETURNED_TO_INTEGRATION'], repairedEvent), merged: count(['MERGED'], repairedEvent), manual: count(['FAILED_MANUAL']), retrying: counts.retry, windowHours: 24, retainedEvents: activity.length },
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
