import { subscribe, disclosure, preserveView } from './view-state.js';
const root = document.querySelector('#integration-rescue');
const node = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = String(text); return n; };
const link = (label, path) => { const n = node('a', 'rs-link', label); n.href = `https://github.com/charukun/soul-lineage/${path}`; n.target = '_blank'; n.rel = 'noreferrer'; return n; };
const age = (time, now) => { const ms = now - Date.parse(time); if (!Number.isFinite(ms)) return '未記録'; const sec = Math.max(0, Math.floor(ms / 1000)); return sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${Math.floor(sec / 3600)}h ${Math.floor(sec % 3600 / 60)}m`; };
const pill = (text, tone = '') => node('span', `rs-pill ${tone}`, text);
const labels = { DETECTED: '検知', QUEUED: '待機', BLOCKED_BY_RESCUE: '順番待ち', CLAIMED: 'Worker起動待ち', ANALYZING: '分析中', RESOLVING: '修復中', VALIDATING: '検証中', PUSHING: 'commit確定前', AWAITING_PUSH: 'Work push待ち', PUSHED: 'push完了', RETURNED_TO_INTEGRATION: 'Integration復帰', CHECKING: '通常gate確認待ち', MERGED: 'develop統合済み', DEV: 'DEV公開確認済み', FAILED_RETRYABLE: '再試行待ち', FAILED_MANUAL: '手動停止', STALE: 'WORKER STALE' };
const order = ['DETECTED', 'QUEUED', 'CLAIMED', 'ANALYZING', 'RESOLVING', 'VALIDATING', 'PUSHING', 'AWAITING_PUSH', 'PUSHED', 'RETURNED_TO_INTEGRATION', 'CHECKING', 'MERGED', 'DEV'];
const aiRecoverable = record => record.state === 'FAILED_MANUAL' && record.manualKind === 'work-recoverable';
const stateLabelFor = record => record.state === 'FAILED_MANUAL' ? aiRecoverable(record) ? 'AI修復待ち' : record.manualKind === 'human-required' ? '人の判断が必要' : '手動確認' : labels[record.state] || record.state;
function rail(record) {
  const box = node('ol', 'rs-rail');
  const delivery = [['CHECKING','CHECK'],['MERGED','MERGE'],['DEV','DEV']];
  const steps = record.returnedAt ? [...(record.repairVerified ? [['PUSHED','PUSH']] : []),['RETURNED_TO_INTEGRATION','RETURN'],...delivery] :
    ['MERGED','DEV'].includes(record.state) ? delivery :
    [['ANALYZING','ANALYZE'],['RESOLVING','RESOLVE'],['VALIDATING','VALIDATE'],['PUSHED','PUSH'],['RETURNED_TO_INTEGRATION','RETURN']];
  const at = order.indexOf(record.currentStep || record.state);
  box.setAttribute('aria-label', `現在: ${stateLabelFor(record)}`);
  for (const [state, label] of steps) {
    const index = order.indexOf(state), cls = index < at ? 'done' : index === at ? 'current' : '';
    const step = node('li', cls, label); if (cls === 'current') step.setAttribute('aria-current', 'step'); box.append(step);
  }
  return box;
}
function card(record, now, staleMs) {
  const stale = record.lease && (record.state === 'STALE' || now - Date.parse(record.heartbeatAt || record.claimedAt) > staleMs);
  const manual = record.state === 'FAILED_MANUAL';
  const recoverable = aiRecoverable(record);
  const c = node('article', `rs-card ${stale ? 'rs-stale' : manual && !recoverable ? 'rs-manual' : recoverable ? 'rs-waiting' : ''}`); c.dataset.viewKey = `rescue:${record.pr}`; c.dataset.pr = record.pr;
  if (record.workerId) c.append(node('p', 'rs-worker-id', `WORKER ${record.workerId}`));
  const top = node('div', 'rs-card-head'); top.append(link(`#${record.pr}`, `pull/${record.pr}`), pill(stale ? 'WORKER STALE' : stateLabelFor(record), stale || manual && !recoverable ? 'danger' : record.lease ? 'live' : ''));
  c.append(top, node('h3', '', record.title || `PR #${record.pr}`));
  if (record.returnedAt || ['AWAITING_PUSH','MERGED','DEV'].includes(record.state)) {
    c.append(pill(({repaired:'修復push・検証を確認',staged:'commit準備済み・push待ち',reevaluated:'再評価のみ・修復pushなし',observed:'統合状況の観測・修復証跡なし'})[record.deliveryKind] || '修復証跡未確認'));
  }
  c.append(node('p', 'rs-action', record.currentAction || stateLabelFor(record)));
  if (record.lease || record.returnedAt || ['MERGED','DEV'].includes(record.state)) c.append(rail(record));
  const meta = node('div', 'rs-meta');
  meta.append(pill(record.risk || 'RED', (record.risk || 'RED').toLowerCase()), node('span', '', (record.scopes || []).join(' · ') || 'Scope未確定'));
  c.append(meta, node('p', 'rs-note', `Reason: ${record.reason || '状態再評価'}`));
  if (record.currentFile) c.append(node('p', 'rs-file', `File: ${record.currentFile}`));
  if (record.blockedBy?.length) {
    const waiting = node('p', 'rs-blocker', `#${record.pr} WAITING FOR `);
    for (const pr of record.blockedBy) waiting.append(link(`#${pr}`, `pull/${pr}`), document.createTextNode(' '));
    c.append(waiting, node('p', 'rs-note', record.waitingReason || '先行PRのdevelop統合を待っています'));
  }
  if (record.lease) {
    c.append(node('p', `rs-timing ${stale ? 'danger' : ''}`, `Duration ${age(record.claimedAt, now)} · Heartbeat ${age(record.heartbeatAt, now)} ago`));
    if (stale) c.append(node('p', 'rs-note', '旧Actions実行の終了を確認してから別Workerへ引き継ぎます'));
  } else if (['QUEUED','DETECTED','FAILED_RETRYABLE','BLOCKED_BY_RESCUE'].includes(record.state) || recoverable) {
    c.append(node('p', 'rs-timing', `Wait ${age(record.detectedAt, now)} · Priority ${record.priority?.label || '未評価'}`));
    if (!record.blockedBy?.length) c.append(node('p', 'rs-note', recoverable ? 'AI repair candidate · 次のWork実行で再取得' : 'Next candidate · 次Waveで再評価'));
  }
  if (record.state === 'VALIDATING') c.append(node('p', 'rs-test', 'Fast verification 実行中 · 完了後に結果を記録'));
  if (record.validation?.status === 'passed') c.append(node('p', 'rs-test', 'Fast verification PASSED'));
  c.append(node('p', 'rs-note', `Actions attempt ${record.attempt || 0} / ${record.maxAttempts || '—'}`));
  if (manual) c.append(node('p', 'rs-note', `Work repair ${record.workRepairAttempts || 0} / ${record.maxWorkRepairAttempts || '—'} · baseline churn ${record.baselineChurns || 0} / ${record.maxBaselineChurns || '—'}`));
  if (record.failureReason) c.append(node('p', 'rs-failure', `Previous failure: ${record.failureReason}`));
  if (recoverable) c.append(node('strong', 'rs-human', 'AI repair queued · 仕様両立とfast検証をWorkが担当'));
  else if (manual && record.manualKind === 'human-required') c.append(node('strong', 'rs-human', 'Human decision required · 仕様選択が必要'));
  else if (manual) c.append(node('strong', 'rs-human', 'Manual hold · 自動解除しない安全条件'));
  if (record.stagedSha && !record.pushedSha) c.append(link(`Staged ${record.stagedSha.slice(0, 8)} · branch未反映`, `commit/${record.stagedSha}`));
  if (record.pushWorkerId) c.append(node('p', 'rs-note', `Push relay: ${record.pushWorkerId}`));
  if (record.heartbeatCount) c.append(node('p', 'rs-note', `Recorded worker heartbeats: ${record.heartbeatCount}`));
  if (record.pushedSha && /^[0-9a-f]{40}$/.test(record.pushedSha)) c.append(link(`Commit ${record.pushedSha.slice(0, 8)}`, `commit/${record.pushedSha}`));
  if (record.returnedAt) c.append(node('p', 'rs-resolution', `Result: ${stateLabelFor(record)}${record.resolution ? ' · ' + record.resolution : ''}`));
  const details = node('div', 'rs-details');
  details.append(node('p', '', `Rescue ID: ${record.rescueId || '未claim'}`), node('p', '', record.riskReason || '変更領域を比較して処理順を決定'));
  if (record.priority?.explanation) details.append(node('p', '', record.priority.explanation));
  const files = node('ul'); for (const path of record.files || []) files.append(node('li', '', path)); details.append(files);
  for (const f of record.failures || []) details.append(node('p', '', `Attempt ${f.attempt} · ${f.workerId || 'worker未起動'} · ${f.reason}`));
  const timeline = node('p', '', order.map(s => s === record.state ? `[${s}]` : s).join(' → ')); details.append(timeline);
  c.append(disclosure(`rescue:${record.pr}:detail`, 'Files・試行履歴・工程を見る', details));
  return c;
}
function group(title, records, now, staleMs, className = '') {
  const section = node('section', `rs-group ${className}`); section.append(node('h3', 'rs-group-title', title));
  const cards = node('div', 'rs-cards'); for (const r of records) cards.append(card(r, now, staleMs)); section.append(cards); return section;
}
function summaryMetric(label, value, note = '', tone = '') {
  const box = node('div', `rs-summary-metric ${tone}`);
  box.append(node('span', 'rs-summary-label', label), node('strong', 'rs-summary-value', value));
  if (note) box.append(node('span', 'rs-summary-note', note));
  return box;
}
function detailDisclosure(key, title, content) {
  return disclosure(`rescue:${key}`, title, content, 'rs-detail-disclosure');
}
function waveList(view) {
  const waves = node('section', 'rs-wave-list');
  for (const w of view.waves.slice(0, 3)) {
    const box = node('article', 'rs-wave'); box.append(node('strong', '', w.id), pill(w.completedAt ? 'FINISHED' : 'ACTIVE'));
    const prs = node('p', '', 'Parallel: '); for (const pr of w.prs) prs.append(link(`#${pr}`, `pull/${pr}`), document.createTextNode(' ')); box.append(prs);
    box.append(node('p', 'rs-note', `${w.repaired} 修復push確認 · ${w.returnedCount ?? 0} / ${w.prs.length} Integration復帰`));
    for (const r of w.waiting) box.append(node('p', 'rs-blocker', `#${r.pr} → waiting for ${r.blockedBy.map(n => '#' + n).join(', ')}`));
    waves.append(box);
  }
  return waves;
}
function throughput(view) {
  const t = view.throughput;
  const stats = node('section', 'rs-throughput');
  stats.append(node('p', '', `Rescued ${t.rescued} · Merged ${t.merged} · Manual ${t.manual} · Retrying ${t.retrying}`));
  stats.append(node('p', 'rs-note', 'Rescued / Mergedは同じWorkerの検証・修復push・復帰を確認できた件数。証跡未保持の履歴は含みません。'));
  stats.append(node('p', 'rs-note', `修復証跡なしの観測: merge ${view.observed?.merged ?? 0} · DEV ${view.observed?.dev ?? 0}`));
  return stats;
}
function activityFeed(view) {
  const feed = node('section', 'rs-activity');
  for (const e of view.activity.slice(0, 12)) {
    const item = node('div', 'rs-event'); item.append(node('time', '', new Date(e.at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })));
    const content = node('div'); if (e.pr) content.append(link(`#${e.pr}`, `pull/${e.pr}`)); content.append(node('p', '', e.action));
    if (['RETURNED_TO_INTEGRATION','MERGED','DEV'].includes(e.type) && !e.repairVerified) content.append(pill('修復証跡なしの観測'));
    item.append(content); feed.append(item);
  }
  if (!view.activity.length) feed.append(node('p', 'rs-note', '直近のRescueイベントはありません'));
  return feed;
}
function riskLegend() {
  const legend = node('div');
  for (const [color, description] of [['GREEN','変更領域が独立。並列処理'],['YELLOW','一部関連あり。完了時に再確認'],['RED','競合するため先行PRの統合後に処理']]) {
    const p = node('p'); p.append(pill(color, color.toLowerCase()), document.createTextNode(' ' + description)); legend.append(p);
  }
  return legend;
}
export function renderRescue(view, now = Date.now()) {
  if (!root) return;
  root.replaceChildren();
  if (!view?.available) {
    root.append(node('p', 'rs-empty', 'REPAIR · 状態未取得'), node('p', 'rs-note', view?.observationError || '最初のCoordinator実行と状態取得を待っています。稼働数はまだ未確認です。')); return;
  }
  const c = view.counts, staleObservation = now - Date.parse(view.generatedAt) > 12 * 60000;
  const staleWorkers = view.workers.filter(r => r.state === 'STALE' || now - Date.parse(r.heartbeatAt || r.claimedAt) > view.staleMs).length;
  const recoverableManual = view.recoverableManual || view.manual.filter(aiRecoverable);
  const humanManual = view.humanManual || view.manual.filter(r => r.manualKind === 'human-required');
  const manualHold = view.manualHold || view.manual.filter(r => !recoverableManual.includes(r) && !humanManual.includes(r));
  const repairWaiting = (c.queued || 0) + (c.blocked || 0) + recoverableManual.length;
  const autoHold = manualHold.length + (c.retry || 0) + staleWorkers;
  const configurationRequired = view.status === 'CONFIGURATION_REQUIRED';
  const needsHuman = configurationRequired || humanManual.length > 0;
  const state = staleObservation || view.observationError ? 'delayed' : needsHuman ? 'attention' : c.active ? 'working' : repairWaiting || autoHold ? 'waiting' : 'healthy';
  const summaryStateLabel = configurationRequired ? '設定確認が必要' : humanManual.length ? '人の判断が必要' : staleObservation || view.observationError ? '状態取得に遅延' : c.active ? '修復処理中' : repairWaiting ? '自動修復待ち' : autoHold ? '自動修復に保留あり' : 'ALL CLEAR';
  const summary = node('section', `rs-summary state-${state}`);
  const summaryHead = node('div', 'rs-summary-head');
  const headline = node('div', 'rs-summary-status');
  headline.append(node('span', 'rs-summary-dot'), node('div', 'rs-summary-status-copy'));
  headline.lastElementChild.append(node('span', 'rs-summary-eyebrow', 'REPAIR LANE'), node('strong', '', summaryStateLabel));
  const updated = node('div', 'rs-summary-updated');
  updated.append(node('span', '', `更新 ${age(view.generatedAt, now)} ago`), node('span', '', 'GitHub state'));
  summaryHead.append(headline, updated);
  const metrics = node('div', 'rs-summary-grid');
  metrics.append(
    summaryMetric('ACTIVE', `${c.active} / ${c.max}`, c.active ? 'repair workers running' : 'repair worker idle', c.active ? 'active' : ''),
    summaryMetric('REPAIR WAITING', repairWaiting, `${c.queued || 0} queue · ${c.blocked || 0} dependency · ${recoverableManual.length} AI修復`, repairWaiting ? 'waiting' : ''),
    summaryMetric('AUTO HOLD', autoHold, `${manualHold.length} policy hold · ${c.retry || 0} retry · ${staleWorkers} stale`, autoHold ? 'waiting' : ''),
    summaryMetric('HUMAN', humanManual.length, humanManual.length ? 'あなたの判断が必要' : 'あなたの操作は不要', humanManual.length ? 'attention' : '')
  );
  summary.append(summaryHead, metrics);
  if (view.workers.length) {
    const glance = node('div', 'rs-summary-live');
    glance.append(node('span', 'rs-summary-live-label', 'NOW'));
    for (const r of view.workers.slice(0, 3)) {
      const item = node('span', `rs-summary-live-item ${r.state === 'STALE' ? 'attention' : ''}`);
      item.append(link(`#${r.pr}`, `pull/${r.pr}`), node('span', '', stateLabelFor(r)));
      glance.append(item);
    }
    if (view.workers.length > 3) glance.append(node('span', 'rs-summary-more', `+${view.workers.length - 3}`));
    summary.append(glance);
  } else if (humanManual.length) {
    summary.append(node('p', 'rs-summary-empty', `人の判断が必要なPRが ${humanManual.length}件あります。`));
  } else if (recoverableManual.length) {
    summary.append(node('p', 'rs-summary-empty', `AI修復待ち ${recoverableManual.length}件 · Fast Laneとは別に後追い処理します。`));
  } else if (autoHold) {
    summary.append(node('p', 'rs-summary-empty', `自動修復の保留が ${autoHold}件あります。通常のFast Lane mergeは止まりません。`));
  } else {
    summary.append(node('p', 'rs-summary-empty', view.status === 'ALL_CLEAR' ? 'Repair待ちはありません。Fast Laneは平常です。' : '実行中のRepair Workerはありません。'));
  }
  if (configurationRequired && view.coordinator?.reason) summary.append(node('p', 'rs-summary-warning', view.coordinator.reason));
  if (staleObservation || view.observationError) summary.append(node('p', 'rs-summary-warning', '最新状態を取得できていません。前回の記録を表示しています。'));
  root.append(summary);

  const detail = node('div', 'rs-detail-body');
  if (view.coordinator?.reason) detail.append(node('p', 'rs-configuration', view.coordinator.reason));
  if (view.coordinator?.errors?.length) detail.append(node('p', 'rs-configuration', `Coordinator: ${view.coordinator.errors.map(e => `${e.pr ? '#' + e.pr + ' ' : ''}${e.reason}`).join(' · ')}`));

  const fullMetrics = node('div', 'rs-metrics');
  for (const [name, value, cls] of [
    ['WORKERS', `${c.active} / ${c.max} ACTIVE`, 'rs-workers-total'], ['QUEUED', c.queued, ''], ['BLOCKED', c.blocked, ''], ['VALIDATING', c.validating, ''], ['WORK PUSH', c.awaitingPush || 0, ''], ['RETURNED', c.returned, ''],
    ['AI REPAIR', recoverableManual.length, ''], ['HUMAN', humanManual.length, ''], ['MANUAL HOLD', manualHold.length, ''], ['FAILED / RETRY', c.retry, ''], ['STALE', staleWorkers, '']
  ]) {
    const tone = Number(value) > 0 && ['HUMAN','MANUAL HOLD','FAILED / RETRY','STALE'].includes(name) ? ['HUMAN','MANUAL HOLD'].includes(name) ? 'red' : 'yellow' : '';
    const box = node('div', `rs-metric ${cls}`); box.append(node('span', '', name), node('strong', tone, value)); fullMetrics.append(box);
  }
  detail.append(detailDisclosure('metrics', '全Repairステータス', fullMetrics));
  if (view.workers.length) detail.append(detailDisclosure('workers', `Repair Worker Pool (${view.workers.length})`, group('', view.workers, now, view.staleMs, 'rs-worker-pool')));
  if (recoverableManual.length) detail.append(detailDisclosure('ai-repair', `AI修復待ち (${recoverableManual.length})`, group('', recoverableManual, now, view.staleMs, 'rs-queue')));
  if (humanManual.length) detail.append(detailDisclosure('human', `人の判断が必要 (${humanManual.length})`, group('', humanManual, now, view.staleMs, 'rs-manual-list')));
  if (manualHold.length) detail.append(detailDisclosure('manual-hold', `自動保留 (${manualHold.length})`, group('', manualHold, now, view.staleMs, 'rs-manual-list')));
  if (view.waves.length) detail.append(detailDisclosure('waves', `過去のRescue Waves (${view.waves.length})`, waveList(view)));
  if (view.queue.length) detail.append(detailDisclosure('queue', `Repair Queue / 依存待ち (${view.queue.length})`, group('', view.queue, now, view.staleMs, 'rs-queue')));
  if (view.recent.length) detail.append(detailDisclosure('recent', `Repair・Integration / DEV観測 (${view.recent.length})`, group('', view.recent, now, view.staleMs, 'rs-recent')));
  detail.append(detailDisclosure('throughput', 'Last 24h / repair throughput', throughput(view)));
  detail.append(detailDisclosure('activity', `Recent repair activity (${Math.min(view.activity.length, 12)})`, activityFeed(view)));
  detail.append(detailDisclosure('risk-info', 'GREEN / YELLOW / RED の意味', riskLegend()));

  const detailTitle = `Repair詳細 · Worker ${view.workers.length} · 待ち ${repairWaiting} · AI修復 ${recoverableManual.length} · Human ${humanManual.length}`;
  root.append(disclosure('rescue:details', detailTitle, detail, 'rs-drilldown'));
}
let latest = null;
subscribe((state, error) => { if (!state || error) return; latest = state.integrationRescue; renderRescue(latest); });
setInterval(() => { if (!document.hidden && latest) preserveView(() => renderRescue(latest)); }, 15000);
