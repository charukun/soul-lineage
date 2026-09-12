export const STALE_SNAPSHOT_MS = 10 * 60 * 1000;
export const FAILED_CONCLUSIONS = new Set(['failure', 'timed_out', 'action_required', 'startup_failure', 'stale']);

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
  // Always derive transient warnings; never keep a resolved sync error in stored alerts.
  const alerts = (state?.alerts || []).filter(item => !['sync-failed', 'sync-stale', 'sync-unavailable', 'client-fetch', 'github-sync-degraded', 'delivery-stalled', 'ci-failed'].includes(item.type));
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
  if (state?.integration?.stalled) {
    alerts.push({ type: 'delivery-stalled', tone: 'danger', title: '開発版の公開処理が停止している可能性があります',
      detail: 'GitHub上の公開処理の更新が10分以上ありません。実行ログを確認してください。',
      since: state.integration.heartbeatAt, url: state.integration.latestRun?.url });
  }
  return alerts;
}
