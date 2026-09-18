const CONTROL_STATES = new Set(['SYNCED', 'PROCESSING', 'RECOVERING', 'NEEDS_USER', 'UNKNOWN']);
const ACTIVE_RUN_STATES = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending']);
const ACTIVE_INTEGRATION_STAGES = new Set([
  'READY_RECONCILE', 'RECONCILE_UNKNOWN', 'INTEGRATING', 'VALIDATING', 'REPAIR', 'REPAIR_ACTIVE', 'TRAIN', 'DEFERRED',
]);
const MAX_TIMELINE = 16;
const MAX_HISTORY = 48;
const MAX_PUBLICATIONS = 24;

const validDate = value => {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : null;
};
const iso = (value = Date.now()) => new Date(value).toISOString();
const uniq = values => [...new Set(values.filter(Boolean))];

function latestTime(values) {
  let latest = null;
  for (const value of values) {
    const at = validDate(value);
    if (at !== null && (latest === null || at > latest)) latest = at;
  }
  return latest === null ? null : iso(latest);
}

function pullCounts(state) {
  const pulls = state?.pullRequests?.normal || [];
  return {
    draft: pulls.filter(item => item.state === 'Draft').length,
    ready: pulls.filter(item => item.state === 'Ready').length,
    total: pulls.length,
  };
}

function queueCounts(state) {
  const queue = state?.integration?.queue || [];
  return {
    active: queue.filter(item => ACTIVE_INTEGRATION_STAGES.has(item.stage)).length,
    repair: queue.filter(item => ['REPAIR', 'REPAIR_ACTIVE'].includes(item.stage)).length,
    blocked: queue.filter(item => item.stage === 'BLOCKED').length,
    failed: queue.filter(item => ['CI_FAILED', 'FAILED'].includes(item.stage)).length,
    hold: queue.filter(item => item.stage === 'HOLD').length,
  };
}

function impactFor(item = {}) {
  if (item.environment === 'prod' || /Production/i.test(item.title || '')) return 'production';
  if (item.environment === 'dev' || /^DEV\b/i.test(item.title || '') || /DEV公開/.test(item.title || '')) return 'dev-publication';
  if (/integration|reconciliation|CI/i.test(`${item.type || ''} ${item.title || ''}`)) return 'integration';
  if (/sync|github|refresh/i.test(`${item.type || ''} ${item.title || ''}`)) return 'pulse';
  return 'development';
}

function impactLabel(value) {
  return ({
    pulse: 'PULSE表示',
    development: '開発状況',
    integration: '自動統合',
    'dev-publication': 'DEV公開',
    production: 'Production',
  })[value] || value;
}

function manualIncident(item, state) {
  if (item?.userActionRequired === true) return true;
  if (item?.type === 'branch-diverged') return true;
  if (item?.type === 'sync-failed' || item?.type === 'github-sync-degraded') {
    return ['auth-required', 'permission', 'forbidden'].includes(state?.githubFailure?.kind);
  }
  return false;
}

function incidentFromAlert(item, state) {
  const impact = impactFor(item);
  return {
    id: `${item.type || 'alert'}:${item.prNumber || item.environment || item.url || item.title || 'unknown'}`,
    type: item.type || 'alert',
    title: item.title || '確認事項',
    detail: item.detail || '',
    tone: item.tone || 'warning',
    url: item.url || null,
    since: item.since || null,
    impact,
    impactLabel: impactLabel(impact),
    userActionRequired: manualIncident(item, state),
  };
}

function deriveIncidents(state) {
  const incidents = (state?.alerts || []).map(item => incidentFromAlert(item, state));
  if (state?.syncStatus === 'degraded' && !incidents.some(item => item.type === 'github-sync-degraded' || item.type === 'sync-failed')) {
    const item = {
      type: 'sync-failed',
      title: 'GitHub同期を再確認中',
      detail: state?.syncError || '最新のGitHub状態を取得できていません。',
      tone: 'warning',
    };
    incidents.unshift(incidentFromAlert(item, state));
  }
  for (const queueItem of state?.integration?.queue || []) {
    if (!['CI_FAILED', 'FAILED', 'BLOCKED'].includes(queueItem.stage)) continue;
    const type = queueItem.stage === 'BLOCKED' ? 'integration-blocked' : 'ci-failed';
    if (incidents.some(item => item.id === `${type}:${queueItem.number}`)) continue;
    const impact = 'integration';
    incidents.push({
      id: `${type}:${queueItem.number}`,
      type,
      title: `#${queueItem.number} ${queueItem.label || '自動統合を確認中'}`,
      detail: queueItem.reason || queueItem.title || '',
      tone: queueItem.stage === 'BLOCKED' ? 'info' : 'warning',
      url: queueItem.ci?.url || queueItem.url || null,
      since: queueItem.updatedAt || null,
      impact,
      impactLabel: impactLabel(impact),
      userActionRequired: false,
    });
  }
  return incidents;
}

function deriveCompleteness(state) {
  if (!state || !state.generatedAt) return { state: 'unknown', label: '状態未取得', confidence: 'unknown' };
  if (state.syncStatus === 'degraded') return { state: 'last-known-good', label: '前回確定値を併用', confidence: 'limited' };
  if (state?.pullRequests?.truncated || state?.pullSync?.complete === false || (state?.pullRequests?.targetLookup?.pending || 0) > 0) {
    return { state: 'partial', label: '一部確認中', confidence: 'partial' };
  }
  return { state: 'confirmed', label: '状態確定', confidence: 'confirmed' };
}

function deriveSelfHealth(state) {
  return [
    { id: 'runtime', label: 'PULSE runtime', state: state ? 'ok' : 'unknown' },
    { id: 'event-refresh', label: 'GitHub event', state: state?.syncReason ? 'ok' : 'unknown', detail: state?.syncReason || null },
    { id: 'snapshot', label: 'Snapshot', state: state?.syncStatus === 'ok' ? 'ok' : state?.syncStatus === 'degraded' ? 'warning' : 'unknown' },
    { id: 'ui', label: 'UI contract', state: state?.schemaVersion === 2 ? 'ok' : 'warning' },
  ];
}

function deriveFlow(state) {
  const pulls = pullCounts(state);
  const queue = queueCounts(state);
  const dev = (state?.environments || []).find(item => item.id === 'dev');
  const exactDev = Boolean(dev?.branchCommit && dev?.deployedCommit === dev.branchCommit && dev?.exactCommit !== false);
  const deployActive = ['deploying', 'waiting'].includes(dev?.deployState) || Number(dev?.deployQueue?.commitsAhead || 0) > 0;
  const deployProblem = dev?.deployState === 'failed';
  return [
    { id: 'work', label: '実装', count: pulls.draft, state: pulls.draft ? 'active' : 'done' },
    { id: 'ready', label: 'Ready', count: pulls.ready, state: pulls.ready ? 'active' : 'done' },
    { id: 'integration', label: '統合', count: queue.active + queue.repair, state: queue.failed ? 'problem' : (queue.active + queue.repair) ? 'active' : 'done' },
    { id: 'develop', label: 'develop', count: dev?.branchCommit ? 1 : 0, state: dev?.branchCommit ? 'done' : 'waiting' },
    { id: 'publication', label: 'DEV公開', count: exactDev ? 0 : 1, state: deployProblem ? 'problem' : exactDev ? 'done' : deployActive ? 'active' : 'waiting' },
    { id: 'pulse', label: 'PULSE', count: state?.syncStatus === 'ok' ? 0 : 1, state: state?.syncStatus === 'ok' ? 'done' : state?.syncStatus === 'degraded' ? 'problem' : 'waiting' },
  ];
}

function lastGitHubChangeAt(state) {
  const values = [];
  for (const item of state?.pullRequests?.normal || []) values.push(item.updatedAt, item.updated_at, item.createdAt, item.created_at);
  for (const item of state?.integration?.queue || []) values.push(item.updatedAt, item.ci?.updatedAt);
  values.push(state?.integration?.latestRun?.updatedAt, state?.integration?.latestRun?.createdAt);
  for (const env of state?.environments || []) values.push(env.deployedAt, env.latestRun?.updatedAt, env.latestRun?.createdAt);
  values.push(state?.integrationRescue?.generatedAt);
  return latestTime(values);
}

function deriveStatus(state, incidents, counts, completeness) {
  const manual = incidents.filter(item => item.userActionRequired);
  const queue = queueCounts(state);
  const dev = (state?.environments || []).find(item => item.id === 'dev');
  const exactDev = Boolean(dev?.branchCommit && dev?.deployedCommit === dev.branchCommit && dev?.exactCommit !== false);
  const activeRun = ACTIVE_RUN_STATES.has(state?.integration?.latestRun?.status);
  const recovering = Boolean(state?.integration?.recovering) || queue.repair > 0 ||
    incidents.some(item => ['integration-failed', 'delivery-stalled', 'ci-failed'].includes(item.type));

  if (!state || completeness.state === 'unknown') return 'UNKNOWN';
  if (manual.length) return 'NEEDS_USER';
  if (state.syncStatus === 'degraded') return state?.nextRetryAt ? 'RECOVERING' : 'UNKNOWN';
  if (recovering) return 'RECOVERING';
  if (counts.draft || counts.ready || queue.active || activeRun || !exactDev) return 'PROCESSING';
  return 'SYNCED';
}

function statusCopy(status, { incidents, completeness }) {
  const manual = incidents.filter(item => item.userActionRequired);
  switch (status) {
    case 'NEEDS_USER':
      return {
        headline: '確認が必要',
        summary: `${manual.length || 1}件だけ確認が必要です`,
        nextAction: manual[0]?.title || '詳細を確認してください',
      };
    case 'RECOVERING':
      return {
        headline: '自動対応中',
        summary: '復旧・再試行は自動で進んでいます。今は操作不要です',
        nextAction: '自動復旧の次回結果を待ちます',
      };
    case 'PROCESSING':
      return {
        headline: '放置でOK',
        summary: '開発・統合・公開処理が進行中です',
        nextAction: '自動処理が次の工程へ進みます',
      };
    case 'SYNCED':
      return {
        headline: '放置でOK',
        summary: 'GitHubと公開状態は同期済みです',
        nextAction: '新しいGitHubイベントがあれば自動更新します',
      };
    default:
      return {
        headline: '状態を確認中',
        summary: completeness.state === 'last-known-good' ? '前回確定値を表示しながら再取得を待っています' : '現在状態を確定しています',
        nextAction: '次の同期結果を待ちます',
      };
  }
}

function stateFingerprint({ status, cause, dev, counts, incidents, completeness }) {
  return [
    status,
    cause,
    dev?.branchCommit || '',
    dev?.deployedCommit || '',
    counts.draft,
    counts.ready,
    counts.integration,
    completeness.state,
    incidents.map(item => `${item.type}:${item.userActionRequired ? 1 : 0}`).sort().join(','),
  ].join('|');
}

function transitionTimeline(previous, current, at) {
  const timeline = Array.isArray(previous?.timeline) ? previous.timeline.slice(-MAX_TIMELINE + 1) : [];
  if (!previous || previous.status !== current.status || previous.cause !== current.cause || previous.actionKey !== current.actionKey) {
    timeline.push({
      at,
      status: current.status,
      headline: current.headline,
      cause: current.cause,
      nextAction: current.nextAction,
      userActionRequired: current.userActionRequired,
    });
  }
  return timeline.slice(-MAX_TIMELINE);
}

export function deriveControlTower(state, previous = null, { now = Date.now() } = {}) {
  const at = validDate(state?.generatedAt) !== null ? state.generatedAt : iso(now);
  const incidents = deriveIncidents(state);
  const completeness = deriveCompleteness(state);
  const pulls = pullCounts(state);
  const queue = queueCounts(state);
  const counts = {
    draft: pulls.draft,
    ready: pulls.ready,
    integration: queue.active + queue.repair,
    incidents: incidents.length,
    userActions: incidents.filter(item => item.userActionRequired).length,
  };
  const status = deriveStatus(state, incidents, counts, completeness);
  const manual = incidents.filter(item => item.userActionRequired);
  const cause = manual[0]?.title || incidents[0]?.title ||
    (status === 'PROCESSING' ? '開発フロー進行中' : status === 'SYNCED' ? 'GitHub状態に変化なし' : '状態を再確認中');
  const copy = statusCopy(status, { incidents, completeness });
  const dev = (state?.environments || []).find(item => item.id === 'dev');
  const impacts = uniq(incidents.map(item => item.impact));
  const actionKey = manual.map(item => item.id).sort().join('|');
  const userActionRequired = status === 'NEEDS_USER';
  const enteredAt = previous?.status === status && previous?.cause === cause && previous?.enteredAt ? previous.enteredAt : at;
  const current = {
    schema: 1,
    status,
    headline: copy.headline,
    summary: copy.summary,
    enteredAt,
    cause,
    nextAction: copy.nextAction,
    userActionRequired,
    actionKey,
    impacts,
    impactLabels: impacts.map(impactLabel),
    completeness,
    lastGitHubChangeAt: lastGitHubChangeAt(state),
    lastRefreshedAt: state?.generatedAt || null,
    sourceIdentity: dev?.branchCommit || state?.publicManifest?.validatedDevelop || null,
    publishedIdentity: dev?.deployedCommit || null,
    incidents,
    counts,
    flow: deriveFlow(state),
    selfHealth: deriveSelfHealth(state),
  };
  current.fingerprint = stateFingerprint({ status, cause, dev, counts, incidents, completeness });
  current.notification = {
    shouldNotify: userActionRequired && Boolean(actionKey) && actionKey !== (previous?.actionKey || ''),
    key: actionKey || null,
    title: userActionRequired ? 'PULSE 確認が必要' : null,
    body: userActionRequired ? `${copy.summary}。${copy.nextAction}` : null,
  };
  current.timeline = transitionTimeline(previous, current, at);
  return current;
}

export function compactHistoryEntry(state) {
  const control = state?.controlTower || deriveControlTower(state, null);
  const dev = (state?.environments || []).find(item => item.id === 'dev') || {};
  return {
    at: state?.generatedAt || iso(),
    fingerprint: control.fingerprint,
    status: control.status,
    headline: control.headline,
    cause: control.cause,
    sourceIdentity: control.sourceIdentity,
    publishedIdentity: control.publishedIdentity,
    devPublishedAt: dev.deployedAt || null,
    counts: control.counts,
    impacts: control.impacts,
    completeness: control.completeness?.state || 'unknown',
    userActionRequired: control.userActionRequired,
  };
}

export function publicationHistoryEntry(state) {
  const dev = (state?.environments || []).find(item => item.id === 'dev');
  if (!dev?.deployedCommit || dev.exactCommit === false) return null;
  const run = state?.integration?.latestRun || dev.latestRun || null;
  const started = run?.sha === dev.deployedCommit ? validDate(run.createdAt) : null;
  const ended = run?.sha === dev.deployedCommit ? validDate(run.updatedAt || dev.deployedAt) : null;
  const durationMs = started !== null && ended !== null && ended >= started ? ended - started : null;
  return {
    commit: dev.deployedCommit,
    publishedAt: dev.deployedAt || run?.updatedAt || state?.generatedAt || null,
    observedAt: state?.generatedAt || null,
    durationMs,
    reflectedPrCount: Number.isInteger(dev.reflectedPrCount) ? dev.reflectedPrCount : null,
    sourceCommit: dev.branchCommit || null,
    url: dev.url || null,
  };
}

export function appendControlHistory(history, state) {
  const current = history && typeof history === 'object' ? history : {};
  const snapshots = Array.isArray(current.snapshots) ? [...current.snapshots] : [];
  const publications = Array.isArray(current.publications) ? [...current.publications] : [];
  const entry = compactHistoryEntry(state);
  if (!snapshots.length || snapshots.at(-1)?.fingerprint !== entry.fingerprint) snapshots.push(entry);
  const publication = publicationHistoryEntry(state);
  if (publication && !publications.some(item => item.commit === publication.commit)) publications.push(publication);
  return {
    schema: 1,
    snapshots: snapshots.slice(-MAX_HISTORY),
    publications: publications.slice(-MAX_PUBLICATIONS),
  };
}

export function publicControlHistory(history) {
  return {
    schema: 1,
    snapshots: Array.isArray(history?.snapshots) ? history.snapshots.slice(-MAX_HISTORY) : [],
    publications: Array.isArray(history?.publications) ? history.publications.slice(-MAX_PUBLICATIONS) : [],
  };
}

export function controlStateLabel(value) {
  return CONTROL_STATES.has(value) ? value : 'UNKNOWN';
}
