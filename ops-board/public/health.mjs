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
  const alerts = (state?.alerts || []).filter(item => !['sync-failed', 'sync-stale', 'sync-unavailable', 'client-fetch', 'github-sync-degraded', 'delivery-stalled', 'ci-failed', 'action-failed', 'publication-failed', 'rescue-observation', 'rescue-manual', 'rescue-stale', 'rescue-configuration'].includes(item.type));
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
  // Surface failures from collapsed panels without interpreting cancelled history as a problem.
  for (const run of state?.recentActionFailures || []) {
    if (!FAILED_CONCLUSIONS.has(run.conclusion) || alerts.some(item => item.url && item.url === run.url)) continue;
    alerts.push({ type: 'action-failed', tone: 'danger', title: `${run.workflow || '自動処理'} が失敗`,
      detail: `${run.branch || ''} / ${run.conclusion}`, url: run.url, section: '#details-section' });
  }
  for (const app of state?.applications || []) {
    const failed = (app.targets || []).filter(target => target.state === 'failed' || target.updateState === 'failed');
    if (failed.length) alerts.push({ type: 'publication-failed', tone: 'danger', title: `${app.name || app.id} の公開更新に失敗`,
      detail: failed.map(target => `${target.label || '公開先'}${target.state === 'success' ? '（前の版は公開中）' : ''}`).join(' / '), section: '#apps-section' });
  }
  const rescue = state?.integrationRescue;
  if (rescue?.available) {
    const delayed = rescue.observationError || !Number.isFinite(Date.parse(rescue.generatedAt)) || now - Date.parse(rescue.generatedAt) > 12 * 60000;
    if (delayed) alerts.push({ type: 'rescue-observation', tone: 'warning', title: '自動修復の最新状態が未確認', detail: '前回の修復記録を表示しています。', section: '#rescue-section' });
    if (rescue.counts?.manual) alerts.push({ type: 'rescue-manual', tone: 'danger', title: `自動修復で確認が必要なPR ${rescue.counts.manual}件`,
      detail: `${(rescue.manual || []).slice(0, 5).map(item => `#${item.pr}`).join('・')}${rescue.counts.manual > 5 ? ' ほか' : ''} / 修復記録の理由を確認`, section: '#rescue-section' });
    const stale = (rescue.workers || []).filter(worker => worker.state === 'STALE' || worker.heartbeatStale || now - Date.parse(worker.heartbeatAt || worker.claimedAt) > rescue.staleMs).length;
    if (stale) alerts.push({ type: 'rescue-stale', tone: 'danger', title: `自動修復の応答が途絶えたWorker ${stale}件`, detail: '最後の応答と引き継ぎ状況を確認してください。', section: '#rescue-section' });
    if (rescue.status === 'CONFIGURATION_REQUIRED') alerts.push({ type: 'rescue-configuration', tone: 'warning', title: '自動修復の設定確認が必要', detail: rescue.coordinator?.reason || '自動修復の詳細を確認してください。', section: '#rescue-section' });
  }
  return alerts;
}

// A PR's queue observation only belongs to its exact current head.
export function pullProgress(pr, integration = {}) {
  if (pr.state !== 'Ready') return null;
  const item = (integration.queue || []).find(item => item.number === pr.number && item.headSha && item.headSha === pr.headSha);
  if (!item) return { label: '自動処理の状態を確認中', tone: 'info', reason: 'IntegrationがCI・統合を監視しています' };
  return { label: item.label, tone: item.tone, reason: item.reason };
}
