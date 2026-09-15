export const STALE_SNAPSHOT_MS = 10 * 60 * 1000;
export const PUBLICATION_GUIDE_MS = 10 * 60 * 1000;
export const FAILED_CONCLUSIONS = new Set(['failure', 'timed_out', 'action_required', 'startup_failure', 'stale']);
const ACTIVE_RUN_STATES = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending']);
const QUEUED_RUN_STATES = new Set(['queued', 'waiting', 'requested', 'pending']);
const MAX_ESTIMATE_SAMPLE_MS = 60 * 60 * 1000;

export function snapshotAge(state, now = Date.now()) {
  const date = Date.parse(state?.generatedAt || '');
  return Number.isFinite(date) ? Math.max(0, now - date) : null;
}

export function ageLabel(ms) {
  if (!Number.isFinite(ms)) return '未取得';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '1分未満前';
  if (minutes < 60) return `${minutes}分前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}時間${minutes % 60}分前`;
  return `${Math.floor(minutes / 1440)}日前`;
}

export function elapsedLabel(ms) {
  if (!Number.isFinite(ms)) return '経過時間未取得';
  const minutes = Math.floor(Math.max(0, ms) / 60000);
  if (minutes < 1) return '1分未満';
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}時間${rest}分` : `${hours}時間`;
}

export function estimatePublicationDuration(runs = []) {
  const samples = [];
  for (const run of runs) {
    if (run?.status !== 'completed' || run?.conclusion !== 'success') continue;
    const started = Date.parse(run.created_at || '');
    const ended = Date.parse(run.updated_at || '');
    const duration = ended - started;
    if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_ESTIMATE_SAMPLE_MS) continue;
    samples.push(duration);
    if (samples.length >= 12) break;
  }
  if (samples.length < 3) return { expectedMs: PUBLICATION_GUIDE_MS, sampleSize: samples.length, source: 'fallback' };
  const ordered = [...samples].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(ordered.length - 1, Math.ceil(ordered.length * 0.75) - 1));
  return { expectedMs: Math.max(60_000, ordered[index]), sampleSize: samples.length, source: 'recent-success-p75' };
}

function durationGuide(elapsedMs, estimate) {
  const expectedMs = Number(estimate?.expectedMs) > 0 ? Number(estimate.expectedMs) : PUBLICATION_GUIDE_MS;
  const expectedMinutes = Math.max(1, Math.ceil(expectedMs / 60000));
  if (!Number.isFinite(elapsedMs)) return `目安 約${expectedMinutes}分`;
  if (elapsedMs < expectedMs) {
    const remaining = Math.max(1, Math.ceil((expectedMs - elapsedMs) / 60000));
    return `あと約${remaining}分目安`;
  }
  return `${expectedMinutes}分目安を超えて処理中`;
}

function elapsedSince(value, now) {
  const at = Date.parse(value || '');
  return Number.isFinite(at) ? Math.max(0, now - at) : null;
}

export function devPublicationSummary(state, now = Date.now()) {
  const dev = (state?.environments || []).find(env => env.id === 'dev');
  if (!dev) return null;
  const integration = state?.integration || {};
  const run = integration.latestRun || dev.latestRun || null;
  const currentHead = dev.branchCommit || null;
  const runMatchesHead = Boolean(currentHead && run?.sha && currentHead === run.sha);
  const exactPublished = Boolean(currentHead && dev.deployedCommit === currentHead && dev.exactCommit !== false);
  if (exactPublished) return null;

  const commitsAhead = Number(dev.deployQueue?.commitsAhead || 0);
  const active = ACTIVE_RUN_STATES.has(run?.status);
  const elapsed = elapsedSince(run?.createdAt, now);
  const updateAge = elapsedSince(run?.updatedAt || run?.createdAt, now);
  const guide = durationGuide(elapsed, integration.deliveryEstimate);
  const elapsedText = Number.isFinite(elapsed) ? `${elapsedLabel(elapsed)}経過` : null;

  if (active && runMatchesHead) {
    if (Number.isFinite(updateAge) && updateAge >= PUBLICATION_GUIDE_MS) {
      return {
        state: 'stalled', tone: 'danger', value: 'DEV 公開遅延',
        detail: `マージ済み · ${elapsedText || '経過時間未取得'} · 10分以上更新なし`,
      };
    }
    if (integration.recovering) {
      return {
        state: 'recovering', tone: 'progress', value: 'DEV 解消中',
        detail: `前回失敗から再試行中 · ${elapsedText ? `${elapsedText} · ` : ''}${guide}`,
      };
    }
    if (QUEUED_RUN_STATES.has(run.status)) {
      return {
        state: 'queued', tone: 'progress', value: 'DEV 公開待機中',
        detail: `マージ済み · ${elapsedText ? `${elapsedText} · ` : ''}${guide}`,
      };
    }
    return {
      state: 'publishing', tone: 'progress', value: 'DEV 公開検証中',
      detail: `マージ済み · ${elapsedText ? `${elapsedText} · ` : ''}${guide}`,
    };
  }

  if (runMatchesHead && run?.status === 'completed' && FAILED_CONCLUSIONS.has(run?.conclusion)) {
    return {
      state: 'failed', tone: 'danger', value: 'DEV 公開で問題',
      detail: 'マージ済み · 公開検証に失敗 · 再試行待ち',
    };
  }

  if (runMatchesHead && run?.status === 'completed' && run?.conclusion === 'success') {
    const since = elapsedSince(run.updatedAt, now);
    return {
      state: 'reflecting', tone: 'progress', value: 'DEV 公開反映待ち',
      detail: `公開処理は完了 · 反映確認中${Number.isFinite(since) ? ` · ${elapsedLabel(since)}経過` : ''}`,
    };
  }

  if ((active && commitsAhead > 0) || commitsAhead > 0 || dev.deployState === 'waiting') {
    return {
      state: active ? 'coalescing' : 'waiting', tone: active ? 'progress' : 'warning',
      value: active ? 'DEV 公開待機中' : 'DEV 公開待ち',
      detail: active ? '最新developはマージ済み · 直前の公開処理を整理中' : 'マージ済み · 公開処理の開始待ち',
    };
  }
  return null;
}

export function appHealth(app) {
  const targets = app.targets || [];
  if (targets.some(target => target.state === 'failed' || target.updateState === 'failed')) return ['要対応', 'danger'];
  if (targets.some(target => target.state === 'deploying' || target.updateState === 'deploying')) return ['更新中', 'progress'];
  if (targets.some(target => target.state === 'waiting' || target.updateState === 'waiting')) return ['公開待ち', 'warning'];
  if (targets.some(target => target.state === 'missing')) return ['未公開あり', 'info'];
  if (targets.length && targets.every(target => target.state === 'success')) return ['正常', 'ok'];
  return ['未確認', 'info'];
}

export function appSummary(apps = []) {
  const counts = new Map();
  for (const app of apps) { const label = appHealth(app)[0]; counts.set(label, (counts.get(label) || 0) + 1); }
  return `${apps.length}アプリ` + [...counts].map(([label, n]) => ` / ${label} ${n}`).join('');
}

export function boardAlerts(state, now = Date.now(), loadError = null) {
  // Normal DEV publication lag belongs in the publication card, not in "needs action".
  const alerts = (state?.alerts || []).filter(item => {
    if ([
      'sync-failed', 'sync-stale', 'sync-unavailable', 'client-fetch', 'github-sync-degraded',
      'delivery-stalled', 'ci-failed', 'stalled-ready-pr',
    ].includes(item.type)) return false;
    if (item.type === 'deploy-wait' && (item.environment === 'dev' || /^DEV\b/.test(item.title || ''))) return false;
    return true;
  });
  const age = snapshotAge(state, now);
  if (loadError || state?.syncStatus === 'degraded') {
    alerts.unshift({ type: loadError ? 'client-fetch' : 'sync-failed', tone: 'danger', title: '最新情報を取得できていません',
      detail: `${loadError?.message || state?.syncError || '同期失敗'}。${age === null ? '状態は未確認です。' : `${ageLabel(age)}の確定情報を表示しています。`} 正常・解消済みとは判断しないでください。` });
  } else if (age === null || age >= STALE_SNAPSHOT_MS) {
    alerts.unshift({ type: age === null ? 'sync-unavailable' : 'sync-stale', tone: age !== null && age >= 30 * 60000 ? 'danger' : 'warning',
      title: age === null ? '状態をまだ確認できていません' : '更新が遅れています',
      detail: age === null ? 'GitHubと公開環境の取得結果を待っています。' : `最終取得は${ageLabel(age)}です。表示中の状態は現在と異なる可能性があります。` });
  }
  for (const item of state?.integration?.queue || []) {
    if (!['CI_FAILED', 'FAILED'].includes(item.stage)) continue;
    if (alerts.some(alert => alert.type === 'ci-failed' && alert.prNumber === item.number)) continue;
    alerts.push({ type: 'ci-failed', prNumber: item.number, tone: 'danger', title: `#${item.number} の自動テストが失敗`,
      detail: `${item.title || ''}${item.reason ? ` / ${item.reason}` : ''}`, url: item.ci?.url || item.url });
  }
  const publication = devPublicationSummary(state, now);
  if (publication?.state === 'stalled' && !alerts.some(alert => alert.type === 'delivery-stalled')) {
    alerts.push({ type: 'delivery-stalled', tone: 'danger', title: 'DEV公開の更新が止まっています',
      detail: `${publication.detail}。実行ログを確認してください。`,
      since: state?.integration?.latestRun?.updatedAt || state?.integration?.heartbeatAt, url: state?.integration?.latestRun?.url });
  }
  return alerts;
}
