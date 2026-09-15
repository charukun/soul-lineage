export const REPOSITORY = 'charukun/soul-lineage';
export const GITHUB_API = `https://api.github.com/repos/${REPOSITORY}`;
export const PAGES_ROOT = 'https://charukun.github.io/soul-lineage/';
export const STALL_WARNING_MS = 10 * 60 * 1000;
export const API_HISTORY_PAGE_LIMIT = 10;

const FAILURE_CONCLUSIONS = new Set([
  'failure', 'timed_out', 'action_required', 'startup_failure', 'stale',
]);
const ACTIVE_RUN_STATES = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending']);
const HOLD_LABELS = new Set(['integration:hold', 'integration:manual', 'do-not-merge']);

export function shortSha(value) {
  return typeof value === 'string' && value.length >= 7 ? value.slice(0, 12) : null;
}

export function parseMergePulls(commits = []) {
  const byNumber = new Map();
  for (const item of commits) {
    const message = item?.commit?.message || '';
    const first = message.split('\n')[0] || '';
    const match = first.match(/^Merge pull request #(\d+) from /i);
    if (!match) continue;
    const number = Number(match[1]);
    const paragraphs = message.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
    const title = paragraphs[1]?.split('\n')[0]?.trim() || `PR #${number}`;
    if (!byNumber.has(number)) {
      byNumber.set(number, {
        number,
        title,
        mergedAt: item?.commit?.committer?.date || item?.commit?.author?.date || null,
        mergeCommit: item?.sha || null,
        url: `https://github.com/${REPOSITORY}/pull/${number}`,
      });
    }
  }
  return [...byNumber.values()].sort((a, b) => {
    const ad = a.mergedAt ? Date.parse(a.mergedAt) : 0;
    const bd = b.mergedAt ? Date.parse(b.mergedAt) : 0;
    return bd - ad || b.number - a.number;
  });
}

export function diffPulls(a = [], b = []) {
  const other = new Set(b.map(item => item.number));
  return a.filter(item => !other.has(item.number));
}

export function workflowFailure(run) {
  return run?.status === 'completed' && FAILURE_CONCLUSIONS.has(run?.conclusion);
}

export function latestRunForSha(runs, sha, workflowName = 'CI') {
  return (runs || []).find(run => run?.head_sha === sha &&
    (run?.name === workflowName || (workflowName === 'CI' && /^CI validation #/.test(run?.name || '')))) || null;
}

function explicitIntegrationHold(pr) {
  const labels = new Set((pr?.labels || []).map(item => item?.name).filter(Boolean));
  return [...HOLD_LABELS].some(label => labels.has(label)) || /^Integration-Hold:\s*\S+/im.test(pr?.body || '');
}

export function classifyPull(pr, runs = [], developRuns = [], now = Date.now()) {
  const ci = latestRunForSha(runs, pr?.head?.sha, 'CI');
  const base = {
    number: pr.number,
    title: pr.title,
    url: pr.html_url || `https://github.com/${REPOSITORY}/pull/${pr.number}`,
    headSha: pr?.head?.sha || null,
    monitoringOwner: pr.draft ? 'Implementation' : 'Integration',
    workerEnded: !pr.draft,
    updatedAt: pr.updated_at || pr.created_at || null,
    ci: ci ? {
      status: ci.status,
      conclusion: ci.conclusion,
      url: ci.html_url,
      updatedAt: ci.updated_at || ci.created_at || null,
    } : null,
  };

  if (pr.draft) {
    return { ...base, stage: 'READY_WAIT', label: '作業中', tone: 'info', reason: 'Draft PR' };
  }
  if (explicitIntegrationHold(pr)) {
    return { ...base, stage: 'HOLD', label: 'Integration保留', tone: 'info', reason: '明示的なIntegration hold' };
  }
  if (!ci || ci.status !== 'completed') {
    return { ...base, stage: 'READY_WAIT', label: ci ? '自動テスト中' : '自動テスト待ち', tone: 'info', reason: `${ci ? 'CI実行中' : 'CI待ち'} / Integrationが監視・実装Worker終了` };
  }
  if (FAILURE_CONCLUSIONS.has(ci.conclusion)) {
    return { ...base, stage: 'CI_FAILED', label: 'CI失敗', tone: 'danger', reason: ci.conclusion || 'failure' };
  }
  if (ci.conclusion !== 'success') {
    return { ...base, stage: 'READY_WAIT', label: '自動テスト未完了', tone: 'warning', reason: `CI: ${ci.conclusion || ci.status}` };
  }

  const ciTime = Date.parse(ci.updated_at || ci.created_at || pr.updated_at || pr.created_at || 0) || now;
  return {
    ...base,
    stage: 'READY_RECONCILE',
    label: '自動統合で評価中',
    tone: 'info',
    reason: '自動テスト成功 / Reconciliationのcurrent-state分類を待っています',
    eligibleSince: new Date(ciTime).toISOString(),
  };
}

const RECONCILIATION_LANES = [
  ['writer', 'INTEGRATING', 'develop統合候補', 'progress'],
  ['validating', 'VALIDATING', 'exact-head検証中', 'info'],
  ['repair', 'REPAIR', '修復待ち', 'warning'],
  ['active', 'REPAIR_ACTIVE', '修復中', 'progress'],
  ['blocked', 'BLOCKED', '保留・依存待ち', 'info'],
  ['deferred', 'DEFERRED', '次回評価待ち', 'info'],
];

function reconciliationEntries(plan) {
  const entries = [];
  for (const [lane, stage, label, tone] of RECONCILIATION_LANES) {
    for (const item of plan?.[lane] || []) entries.push({ lane, stage, label, tone, item });
  }
  for (const train of plan?.trains || []) {
    for (const item of train?.members || []) entries.push({ lane: 'train', stage: 'TRAIN', label: 'Train検証候補', tone: 'progress', item, trainId: train.id || null });
  }
  return entries;
}

export function reconcileIntegrationQueue(queue = [], plan = null, developSha = null) {
  const fresh = Boolean(plan && typeof developSha === 'string' && plan.develop === developSha);
  const exact = new Map();
  if (fresh) {
    for (const entry of reconciliationEntries(plan)) {
      const pr = Number(entry.item?.pr);
      const head = entry.item?.head || null;
      if (Number.isInteger(pr) && head) exact.set(`${pr}:${head}`, entry);
    }
  }
  const reconciled = queue.map(item => {
    if (item.stage !== 'READY_RECONCILE') return item;
    if (!fresh) return {
      ...item,
      stage: 'RECONCILE_UNKNOWN',
      label: '現在状態を再確認中',
      tone: 'info',
      reason: plan ? 'Reconciliation snapshotのdevelopが現在値と一致しません' : 'Reconciliation snapshotをまだ取得していません',
    };
    const entry = exact.get(`${item.number}:${item.headSha}`);
    if (!entry) return {
      ...item,
      stage: 'RECONCILE_UNKNOWN',
      label: '現在状態を再確認中',
      tone: 'info',
      reason: 'fresh Reconciliation planに現在のexact headがまだ収載されていません',
    };
    const task = entry.item || {};
    const reason = task.reason || item.reason;
    return {
      ...item,
      stage: entry.stage,
      label: entry.label,
      tone: entry.tone,
      reason,
      reconciliationLane: entry.lane,
      blockedBy: task.blockedBy || [],
      trainId: entry.trainId || null,
    };
  });
  return {
    queue: reconciled,
    fresh,
    reason: fresh ? null : plan ? 'develop-mismatch' : 'unavailable',
    generatedAt: plan?.generatedAt || null,
    actionableIdle: fresh && Boolean(plan?.actionableIdle),
    readyCount: fresh ? Number(plan?.totalReady || plan?.counts?.ready || 0) : reconciled.filter(item => !['READY_WAIT', 'HOLD'].includes(item.stage)).length,
  };
}

export function environmentDiff(dev, prod) {
  if (dev?.historyComplete !== true || prod?.historyComplete !== true) {
    return { count: null, pulls: [], label: 'DEV / Production差分は公開履歴を確定できるまで未確定', exact: false };
  }
  const pulls = diffPulls(dev.reflectedPrs || [], prod.reflectedPrs || []);
  return {
    count: pulls.length,
    pulls,
    label: pulls.length === 0 ? 'DEVとProductionは同一PR範囲' : `DEVはProductionより +${pulls.length} PR`,
    exact: true,
  };
}

export function publishedCommit(manifest, environment) {
  const snapshot = manifest?.environmentSnapshots?.[environment];
  if (snapshot?.commit) return { commit: snapshot.commit, deployedAt: snapshot.deployedAt || null, exact: true };
  if (environment === 'dev' && manifest?.validatedDevelop) {
    return { commit: manifest.validatedDevelop, deployedAt: null, exact: true };
  }
  const commits = [...new Set((manifest?.entries || [])
    .filter(entry => entry.environment === environment)
    .map(entry => entry?.version?.commit)
    .filter(Boolean))];
  if (commits.length === 1) return { commit: commits[0], deployedAt: null, exact: true };
  return { commit: null, deployedAt: null, exact: false, sourceCommits: commits };
}

export function deploymentQueue(compare) {
  if (!compare) return { state: 'unknown', commitsAhead: null, pulls: [], warning: false };
  const commits = compare.commits || [];
  return {
    state: compare.status || 'unknown',
    commitsAhead: Number(compare.ahead_by ?? commits.length),
    commitsBehind: Number(compare.behind_by ?? 0),
    totalCommits: Number(compare.total_commits ?? commits.length),
    pulls: parseMergePulls(commits),
    warning: compare.status === 'diverged' || Number(compare.behind_by || 0) > 0,
  };
}

export function overallIntegration(queue = [], latestDevelopRun = null, deployQueues = [], now = Date.now(), options = {}) {
  const deliveryVerified = options.deliveryVerified === true;
  if (queue.some(item => item.stage === 'FAILED' || item.stage === 'CI_FAILED') || (workflowFailure(latestDevelopRun) && !deliveryVerified)) {
    return { label: 'Failed', tone: 'danger', phase: 'failed', heartbeatAt: latestDevelopRun?.updated_at || null };
  }
  if (deployQueues.some(item => item?.warning)) return { label: 'Failed', tone: 'danger', phase: 'branch-diverged', heartbeatAt: latestDevelopRun?.updated_at || null };
  if (!deliveryVerified && latestDevelopRun && ACTIVE_RUN_STATES.has(latestDevelopRun.status)) {
    const heartbeatAt = latestDevelopRun.updated_at || latestDevelopRun.created_at || null;
    const heartbeatMs = Date.parse(heartbeatAt || 0) || now;
    const stalledMs = Math.max(0, now - heartbeatMs);
    if (stalledMs >= STALL_WARNING_MS) {
      return { label: 'DEV delivery停止疑い', tone: 'danger', phase: 'delivery', heartbeatAt, stalled: true, stalledMs };
    }
    return { label: 'DEV delivery中', tone: 'progress', phase: 'delivery', heartbeatAt, stalled: false, stalledMs };
  }
  if (queue.some(item => ['INTEGRATING', 'TRAIN', 'VALIDATING', 'REPAIR_ACTIVE'].includes(item.stage))) {
    return { label: '自動統合中', tone: 'progress', phase: 'reconciliation', heartbeatAt: latestDevelopRun?.updated_at || null };
  }
  if (options.actionableIdle) return { label: '再配分待ち', tone: 'warning', phase: 'reconciliation-idle', heartbeatAt: latestDevelopRun?.updated_at || null };
  if (queue.some(item => item.stage === 'REPAIR')) return { label: '修復待ち', tone: 'warning', phase: 'repair', heartbeatAt: latestDevelopRun?.updated_at || null };
  if (deployQueues.some(item => (item?.commitsAhead || 0) > 0)) return { label: 'deploy待ち', tone: 'warning', phase: 'deploy-wait', heartbeatAt: latestDevelopRun?.updated_at || null };
  if (queue.some(item => item.stage === 'BLOCKED')) return { label: '依存・保留あり', tone: 'info', phase: 'blocked', heartbeatAt: latestDevelopRun?.updated_at || null };
  if (queue.some(item => item.stage === 'HOLD')) return { label: '保留あり', tone: 'info', phase: 'hold', heartbeatAt: latestDevelopRun?.updated_at || null };
  if (queue.some(item => ['DEFERRED', 'RECONCILE_UNKNOWN', 'READY_RECONCILE'].includes(item.stage))) return { label: '再評価待ち', tone: 'info', phase: 'reconcile-wait', heartbeatAt: latestDevelopRun?.updated_at || null };
  if (queue.some(item => item.stage === 'READY_WAIT')) return { label: 'Ready待ち', tone: 'info', phase: 'ready-wait', heartbeatAt: latestDevelopRun?.updated_at || null };
  return { label: '正常', tone: 'ok', phase: 'idle', heartbeatAt: latestDevelopRun?.updated_at || null };
}
