import { dependencies } from './integration-policy.mjs';
import { compareScopes, manualReason, RETURNED } from './integration-rescue-policy.mjs';
import { criticalPathOrder, flowPressure, quarantineDecision } from './integration-flow-control.mjs';
import { workRepairEligibility } from './integration-rescue-work-repair-policy.mjs';

const REPAIR_QUEUE_STATES = new Set(['DETECTED', 'QUEUED', 'BLOCKED_BY_RESCUE', 'FAILED_RETRYABLE', 'STALE']);
const TERMINAL_RECORD_STATES = new Set(['MERGED', 'DEV', 'CLOSED']);

const values = source => source instanceof Map ? source : new Map(Object.entries(source || {}).map(([key, value]) => [Number(key), value]));
const labelNames = pr => new Set((pr?.labels || []).map(label => typeof label === 'string' ? label : label?.name).filter(Boolean));
const entry = (pr, extra = {}) => ({ pr: Number(pr.number), head: pr.head?.sha || null, title: pr.title || null, ...extra });

function structuralBlock(pr) {
  const reason = manualReason(pr, { complete: false });
  return reason === 'INCOMPLETE_SAFETY_EVIDENCE' ? null : reason;
}

function repairDisposition(record) {
  if (!record || TERMINAL_RECORD_STATES.has(record.state) || RETURNED.has(record.state)) return null;
  if (record.workRepair?.status === 'working' || record.lease) {
    return { kind: 'active-repair', reason: record.currentAction || record.failureReason || record.reason || 'repair executor active' };
  }
  const quarantine = quarantineDecision(record);
  if (quarantine.quarantined) return { kind: 'repair', reason: quarantine.reason || 'QUARANTINED', repairKind: 'deep' };
  if (record.state === 'FAILED_MANUAL') {
    const eligibility = workRepairEligibility(record);
    if (eligibility.eligible) return { kind: 'repair', reason: record.failureReason || eligibility.kind || 'FAILED_MANUAL', repairKind: eligibility.kind || 'work' };
    return { kind: 'blocked', reason: eligibility.reason || record.failureReason || 'FAILED_MANUAL' };
  }
  if (REPAIR_QUEUE_STATES.has(record.state)) {
    return { kind: 'repair', reason: record.failureReason || record.reason || record.state, repairKind: 'rescue' };
  }
  return null;
}

function writerOrder(items) {
  const repair = [], normal = [];
  for (const item of items) (labelNames(item).has('integration:repair') ? repair : normal).push(item);
  return [...criticalPathOrder(repair), ...criticalPathOrder(normal)];
}

function trainGroups(items, scopeByPr, maxTrainSize) {
  const remaining = [...items];
  const trains = [];
  const singles = [];
  while (remaining.length) {
    const seed = remaining.shift();
    const seedScope = scopeByPr.get(Number(seed.number));
    if (!seedScope?.files?.length) {
      singles.push(seed);
      continue;
    }
    const group = [seed];
    for (let index = 0; index < remaining.length && group.length < maxTrainSize;) {
      const candidate = remaining[index];
      const scope = scopeByPr.get(Number(candidate.number));
      const compatible = scope?.files?.length && group.every(member =>
        compareScopes(scope, scopeByPr.get(Number(member.number))).risk === 'GREEN');
      if (!compatible) {
        index += 1;
        continue;
      }
      group.push(candidate);
      remaining.splice(index, 1);
    }
    if (group.length >= 2) trains.push({
      id: `train-${trains.length + 1}`,
      members: group.map(item => entry(item)),
      size: group.length,
      risk: 'GREEN',
    });
    else singles.push(seed);
  }
  return { trains, singles };
}

export function buildReconciliationPlan({
  ready = [],
  scopeByPr = new Map(),
  dependencyStateByPr = new Map(),
  recordsByPr = new Map(),
  preflightByPr = new Map(),
  requirePreflight = false,
  deferred = [],
  maxTrainSize = 5,
  now = Date.now(),
} = {}) {
  const scopes = values(scopeByPr);
  const dependencyStates = values(dependencyStateByPr);
  const records = values(recordsByPr);
  const preflights = values(preflightByPr);
  const blocked = [];
  const repair = [];
  const active = [];
  const validating = [];
  const candidates = [];

  for (const pr of ready) {
    const basic = structuralBlock(pr);
    if (basic) {
      blocked.push(entry(pr, { reason: basic, kind: 'structural' }));
      continue;
    }

    let deps;
    try {
      deps = dependencies(pr.body || '');
    } catch (error) {
      blocked.push(entry(pr, { reason: error.message, kind: 'dependency' }));
      continue;
    }
    const waiting = deps.filter(number => !dependencyStates.get(Number(number))?.merged);
    if (waiting.length) {
      blocked.push(entry(pr, { reason: `dependency wait: ${waiting.map(number => `#${number}`).join(', ')}`, kind: 'dependency', blockedBy: waiting }));
      continue;
    }

    const disposition = repairDisposition(records.get(Number(pr.number)));
    if (disposition?.kind === 'active-repair') {
      active.push(entry(pr, disposition));
      continue;
    }
    if (disposition?.kind === 'repair') {
      repair.push(entry(pr, disposition));
      continue;
    }
    if (disposition?.kind === 'blocked') {
      blocked.push(entry(pr, { ...disposition, kind: 'repair-blocked' }));
      continue;
    }

    const preflight = preflights.get(Number(pr.number));
    if (requirePreflight && !preflight) {
      validating.push(entry(pr, { reason: 'preflight evidence unavailable', kind: 'preflight' }));
      continue;
    }
    if (preflight?.error) {
      validating.push(entry(pr, { reason: preflight.error, kind: 'preflight' }));
      continue;
    }
    if (preflight?.reviewRejected || preflight?.unresolved) {
      blocked.push(entry(pr, { reason: preflight.reviewRejected ? 'Changes requested on current head' : 'unresolved review thread', kind: 'review' }));
      continue;
    }
    if (preflight?.mergeable === false || preflight?.mergeableState === 'dirty') {
      repair.push(entry(pr, { reason: 'merge conflict / mergeability requires repair', kind: 'repair', repairKind: 'merge' }));
      continue;
    }
    if (requirePreflight && preflight?.checksPassed !== true) {
      validating.push(entry(pr, { reason: 'exact-head fast/browser/check evidence pending or failed', kind: 'validation' }));
      continue;
    }
    candidates.push(pr);
  }

  const ordered = writerOrder(candidates);
  const grouped = trainGroups(ordered, scopes, Math.max(2, Math.min(5, Number(maxTrainSize) || 5)));
  const trainMembers = new Set(grouped.trains.flatMap(train => train.members.map(member => member.pr)));
  const writer = ordered.map(pr => entry(pr, {
    lane: trainMembers.has(Number(pr.number)) ? 'train' : 'single',
    controlPlane: Boolean(scopes.get(Number(pr.number))?.control),
  }));
  const pressure = flowPressure({ ready: ready.length });
  const pending = writer.length + repair.length + active.length + validating.length + blocked.length + deferred.length;
  const actionable = writer.length + repair.length;

  return {
    schema: 1,
    generatedAt: new Date(now).toISOString(),
    pressure,
    counts: {
      ready: ready.length,
      pending,
      writer: writer.length,
      trains: grouped.trains.length,
      trainMembers: trainMembers.size,
      repair: repair.length,
      active: active.length,
      validating: validating.length,
      blocked: blocked.length,
      deferred: deferred.length,
    },
    writer,
    writerOrder: writer.map(item => item.pr),
    trains: grouped.trains,
    singles: grouped.singles.map(pr => entry(pr)),
    repair,
    active,
    validating,
    blocked,
    deferred: deferred.map(item => ({ ...item, pr: Number(item.pr) })),
    wakeAgain: actionable > 0,
    actionableIdle: repair.length > 0 && active.length === 0,
  };
}

export function finalizeReconciliationPlan(plan, integrationReport = {}) {
  const merged = new Map((integrationReport.merged || []).map(item => [Number(item.pr), item]));
  const held = new Map((integrationReport.held || []).map(item => [Number(item.pr), item]));
  const deferred = new Map((integrationReport.deferred || []).map(item => [Number(item.pr), item]));
  const writer = (plan?.writer || []).filter(item => !merged.has(item.pr)).map(item => held.has(item.pr)
    ? { ...item, outcome: 'held', reason: held.get(item.pr).reason }
    : deferred.has(item.pr)
      ? { ...item, outcome: 'deferred', reason: deferred.get(item.pr).reason }
      : { ...item, outcome: 'pending' });
  return {
    ...plan,
    finalizedAt: new Date().toISOString(),
    writer,
    merged: [...merged.values()].map(item => ({ pr: Number(item.pr), head: item.head || null, merge: item.merge || null })),
    counts: {
      ...(plan?.counts || {}),
      merged: merged.size,
      writerRemaining: writer.length,
      integrationHeld: held.size,
      integrationDeferred: deferred.size,
    },
    wakeAgain: Boolean(integrationReport.retry) || (plan?.repair || []).length > 0,
  };
}
