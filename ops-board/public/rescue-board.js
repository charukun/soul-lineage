import { subscribe, disclosure, preserveView } from './view-state.js';
const root = document.querySelector('#integration-rescue');
const node = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = String(text); return n; };
const link = (label, path) => { const n = node('a', 'rs-link', label); n.href = `https://github.com/charukun/soul-lineage/${path}`; n.target = '_blank'; n.rel = 'noreferrer'; return n; };
const age = (time, now) => { const ms = now - Date.parse(time); if (!Number.isFinite(ms)) return '未記録'; const sec = Math.max(0, Math.floor(ms / 1000)); return sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${Math.floor(sec / 3600)}h ${Math.floor(sec % 3600 / 60)}m`; };
const pill = (text, tone = '') => node('span', `rs-pill ${tone}`, text);
const metric = (value, suffix = '') => value === null || value === undefined ? '—' : `${value}${suffix}`;
const labels = { DETECTED: '検知', QUEUED: '待機', BLOCKED_BY_RESCUE: '順番待ち', CLAIMED: 'Worker起動待ち', ANALYZING: '分析中', RESOLVING: '修復中', VALIDATING: '検証中', PUSHING: 'commit確定前', AWAITING_PUSH: 'Work push待ち', PUSHED: 'push完了', RETURNED_TO_INTEGRATION: 'Integration復帰', CHECKING: '通常gate確認待ち', MERGED: 'develop統合済み', DEV: 'DEV公開確認済み', FAILED_RETRYABLE: '再試行待ち', FAILED_MANUAL: '人の確認が必要', STALE: 'WORKER STALE' };
const reasonLabels = {
  DEVELOP_OVERLAP: 'develop更新と変更範囲が重なっています',
  MERGE_CONFLICT: 'developとのmerge conflictを検知しています',
  DEPENDENCY_WAIT: '依存PRの完了を待っています',
  HEAD_CHANGED: 'PRのheadが変わったため再評価が必要です',
  DEVELOP_ADVANCED: '検知後にdevelopが進んだため再評価が必要です',
  INTEGRATION_TRANSIENT: 'Integrationの一時的なAPI・実行失敗です',
  WORKER_STALE: 'Workerのheartbeatが途絶えています',
  QUEUE_PENDING: 'Integration queueで長時間待機しています',
  ORPHAN_READY: 'Ready PRがIntegration queueに取り込まれていません',
  EXTERNAL_REPOSITORY: '外部Repository由来のPRです',
  PROTECTED_BRANCH: '保護対象branchのため自動修復できません',
  CLOSED_PR: 'PRが閉じられています',
  DRAFT: 'Draft PRのためIntegration対象外です',
  UNTRUSTED_AUTHOR: '自動修復対象として信頼できる作成者か確認できません',
  EXPLICIT_HOLD: '明示的なIntegration holdがあります',
  INVALID_DEPENDENCY: '依存PRの記述を解釈できません',
  INCOMPLETE_SAFETY_EVIDENCE: '安全判定に必要な情報が不足しています',
  CHANGES_REQUESTED: 'レビューで変更要求があります',
  UNRESOLVED_THREAD: '未解決のレビューthreadがあります',
};
const order = ['DETECTED', 'QUEUED', 'CLAIMED', 'ANALYZING', 'RESOLVING', 'VALIDATING', 'PUSHING', 'AWAITING_PUSH', 'PUSHED', 'RETURNED_TO_INTEGRATION', 'CHECKING', 'MERGED', 'DEV'];
const waitingStates = new Set(['DETECTED', 'QUEUED', 'BLOCKED_BY_RESCUE', 'FAILED_RETRYABLE', 'AWAITING_PUSH', 'PUSHED', 'RETURNED_TO_INTEGRATION', 'CHECKING']);
const completeStates = new Set(['MERGED', 'DEV']);
const uniqueByPr = records => [...new Map(records.filter(Boolean).map(r => [r.pr, r])).values()];
const reasonText = record => {
  if (record.state === 'FAILED_MANUAL' && record.failureReason) return record.failureReason;
  if (record.state === 'FAILED_RETRYABLE' && record.failureReason) return record.failureReason;
  if (record.blockedBy?.length && record.waitingReason) return record.waitingReason;
  return reasonLabels[record.reason] || record.reason || record.failureReason || '状態を再評価しています';
};
const nextAction = record => {
  if (record.blockedBy?.length) return '先行PRのdevelop統合後に自動で再評価';
  return ({
    DETECTED: '優先度と競合範囲を判定してRescue queueへ投入',
    QUEUED: '次のRescue waveでWorkerを割り当て',
    BLOCKED_BY_RESCUE: '先行PRの完了後に再評価',
    CLAIMED: 'Worker起動後に原因分析へ進む',
    ANALYZING: '原因特定後に最小修復へ進む',
    RESOLVING: '修復後に高速検証へ進む',
    VALIDATING: '検証通過後にcommit / pushへ進む',
    PUSHING: 'push完了後にIntegrationへ戻す',
    AWAITING_PUSH: 'Work側のpush確認後にIntegrationへ戻す',
    PUSHED: '修復証跡を確定してIntegrationへ戻す',
    RETURNED_TO_INTEGRATION: '通常Integration gateの判定待ち',
    CHECKING: 'gate通過後にdevelop統合',
    MERGED: 'DEV公開状態を確認',
    DEV: '対応完了',
    FAILED_RETRYABLE: '再試行条件を満たした次回waveで再実行',
    FAILED_MANUAL: '人がPRと診断内容を確認',
    STALE: '旧Worker終了確認後に別Workerへ引き継ぎ',
  })[record.state] || '状態を再評価';
};
const statusText = record => record.state === 'STALE' ? 'WORKER STALE' : `${labels[record.state] || record.state} · ${record.state}`;
function labeledLine(label, value, cls = '') {
  const row = node('div', `rs-context-row ${cls}`); row.append(node('span', 'rs-context-label', label), node('span', 'rs-context-value', value)); return row;
}
function rail(record) {
  const box = node('ol', 'rs-rail');
  const delivery = [['CHECKING','CHECK'],['MERGED','MERGE'],['DEV','DEV']];
  const steps = record.returnedAt ? [...(record.repairVerified ? [['PUSHED','PUSH']] : []),['RETURNED_TO_INTEGRATION','RETURN'],...delivery] :
    ['MERGED','DEV'].includes(record.state) ? delivery :
    [['ANALYZING','ANALYZE'],['RESOLVING','RESOLVE'],['VALIDATING','VALIDATE'],['PUSHED','PUSH'],['RETURNED_TO_INTEGRATION','RETURN']];
  const at = order.indexOf(record.currentStep || record.state);
  box.setAttribute('aria-label', `現在: ${labels[record.state] || record.state}`);
  for (const [state, label] of steps) {
    const index = order.indexOf(state), cls = index < at ? 'done' : index === at ? 'current' : '';
    const step = node('li', cls, label); if (cls === 'current') step.setAttribute('aria-current', 'step'); box.append(step);
  }
  return box;
}
function card(record, now, staleMs) {
  const stale = record.lease && (record.state === 'STALE' || now - Date.parse(record.heartbeatAt || record.claimedAt) > staleMs);
  const manual = record.state === 'FAILED_MANUAL';
  const complete = completeStates.has(record.state);
  const waiting = waitingStates.has(record.state);
  const c = node('article', `rs-card ${stale ? 'rs-stale' : manual ? 'rs-manual' : complete ? 'rs-complete' : waiting ? 'rs-waiting' : 'rs-working'}`); c.dataset.viewKey = `rescue:${record.pr}`; c.dataset.pr = record.pr;
  if (record.workerId) c.append(node('p', 'rs-worker-id', `WORKER ${record.workerId}`));
  const top = node('div', 'rs-card-head'); top.append(link(`#${record.pr}`, `pull/${record.pr}`), pill(stale ? 'WORKER STALE' : statusText(record), stale || manual ? 'danger' : record.lease ? 'live' : complete ? 'success' : ''));
  c.append(top, node('h3', '', record.title || `PR #${record.pr}`));
  if (record.returnedAt || ['AWAITING_PUSH','MERGED','DEV'].includes(record.state)) {
    c.append(pill(({repaired:'修復push・検証を確認',staged:'commit準備済み・push待ち',reevaluated:'再評価のみ・修復pushなし',observed:'統合状況の観測・修復証跡なし'})[record.deliveryKind] || '修復証跡未確認'));
  }
  const context = node('div', 'rs-context');
  context.append(labeledLine('問題', reasonText(record), 'rs-problem-line'));
  context.append(labeledLine(complete ? '結果' : record.lease ? '対応中' : '現在', record.currentAction || labels[record.state] || record.state));
  context.append(labeledLine('次', nextAction(record)));
  c.append(context);
  if (record.lease || record.returnedAt || ['MERGED','DEV'].includes(record.state)) c.append(rail(record));
  const meta = node('div', 'rs-meta');
  meta.append(pill(record.risk || 'RED', (record.risk || 'RED').toLowerCase()), node('span', '', (record.scopes || []).join(' · ') || 'Scope未確定'));
  c.append(meta);
  if (record.currentFile) c.append(node('p', 'rs-file', `File: ${record.currentFile}`));
  if (record.blockedBy?.length) {
    const waitingFor = node('p', 'rs-blocker', `#${record.pr} WAITING FOR `);
    for (const pr of record.blockedBy) waitingFor.append(link(`#${pr}`, `pull/${pr}`), document.createTextNode(' '));
    c.append(waitingFor, node('p', 'rs-note', record.waitingReason || '先行PRのdevelop統合を待っています'));
  }
  if (record.lease) {
    c.append(node('p', `rs-timing ${stale ? 'danger' : ''}`, `稼働 ${age(record.claimedAt, now)} · Heartbeat ${age(record.heartbeatAt, now)} ago`));
    if (stale) c.append(node('p', 'rs-note', '旧Actions実行の終了を確認してから別Workerへ引き継ぎます'));
  } else if (['QUEUED','DETECTED','FAILED_RETRYABLE','BLOCKED_BY_RESCUE'].includes(record.state)) {
    c.append(node('p', 'rs-timing', `待機 ${age(record.detectedAt, now)} · Priority ${record.priority?.label || '未評価'}`));
    if (!record.blockedBy?.length) c.append(node('p', 'rs-note', 'Next candidate · 次Waveで再評価'));
  }
  if (record.state === 'VALIDATING') c.append(node('p', 'rs-test', 'Fast verification 実行中 · 完了後に結果を記録'));
  if (record.validation?.status === 'passed') c.append(node('p', 'rs-test', 'Fast verification PASSED'));
  c.append(node('p', 'rs-note', `Attempt ${record.attempt || 0} / ${record.maxAttempts || '—'}`));
  if (record.failureReason) c.append(node('p', 'rs-failure', `Previous failure: ${record.failureReason}`));
  if (manual) c.append(node('strong', 'rs-human', 'Human review required · PRで仕様と診断を確認'));
  if (record.stagedSha && !record.pushedSha) c.append(link(`Staged ${record.stagedSha.slice(0, 8)} · branch未反映`, `commit/${record.stagedSha}`));
  if (record.pushWorkerId) c.append(node('p', 'rs-note', `Push relay: ${record.pushWorkerId}`));
  if (record.heartbeatCount) c.append(node('p', 'rs-note', `Recorded worker heartbeats: ${record.heartbeatCount}`));
  if (record.pushedSha && /^[0-9a-f]{40}$/.test(record.pushedSha)) c.append(link(`Commit ${record.pushedSha.slice(0, 8)}`, `commit/${record.pushedSha}`));
  if (record.returnedAt) c.append(node('p', 'rs-resolution', `Result: ${labels[record.state] || record.state}${record.resolution ? ' · ' + record.resolution : ''}`));
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
function summaryCard(label, value, detail, tone, extraClass = '') {
  const box = node('article', `rs-summary-card ${tone} ${extraClass}`.trim());
  box.append(node('span', 'rs-summary-label', label), node('strong', 'rs-summary-value', value), node('span', 'rs-summary-detail', detail));
  return box;
}
function problemSummary(records, now, staleMs) {
  const section = node('section', 'rs-problem-summary');
  const title = node('div', 'rs-problem-title'); title.append(node('h3', 'rs-group-title', `現在の問題 · ${records.length}件`), node('span', 'rs-note', '優先度順'));
  section.append(title);
  const list = node('div', 'rs-problem-list');
  for (const record of records.slice(0, 6)) {
    const stale = record.lease && (record.state === 'STALE' || now - Date.parse(record.heartbeatAt || record.claimedAt) > staleMs);
    const row = node('article', `rs-problem-row ${stale || record.state === 'FAILED_MANUAL' ? 'attention' : record.lease ? 'working' : 'waiting'}`);
    const head = node('div', 'rs-problem-head'); head.append(link(`#${record.pr}`, `pull/${record.pr}`), pill(stale ? 'WORKER STALE' : labels[record.state] || record.state, stale || record.state === 'FAILED_MANUAL' ? 'danger' : record.lease ? 'live' : ''));
    row.append(head, node('strong', 'rs-problem-name', record.title || `PR #${record.pr}`), node('p', 'rs-problem-text', reasonText(record)), node('p', 'rs-problem-next', `次: ${nextAction(record)}`));
    list.append(row);
  }
  section.append(list);
  if (records.length > 6) section.append(node('p', 'rs-note', `ほか ${records.length - 6}件は下の対応中・対応待ち一覧に表示`));
  return section;
}
function controlPlaneSummary(view) {
  const performance = view.performance || {};
  const control = view.controlPlane || {};
  const section = node('section', 'rs-control-health');
  section.append(node('h3', 'rs-group-title', '速度・Control Plane Health'));
  const metrics = node('div', 'rs-metrics');
  metrics.append(
    summaryCard('最古待ち', metric(performance.oldestWaitingMinutes, 'm'), `検知→claim p50 ${metric(performance.detectedToClaimP50Minutes, 'm')}`, performance.oldestWaitingMinutes > 30 ? 'attention' : 'neutral'),
    summaryCard('Merge p50', metric(performance.detectedToMergeP50Minutes, 'm'), `p95 ${metric(performance.detectedToMergeP95Minutes, 'm')}`, 'working'),
    summaryCard('修復成功率', metric(performance.repairSuccessRatePct, '%'), `Retry率 ${metric(performance.retryRatePct, '%')}`, 'done'),
    summaryCard('Actions 24h', control.workflow?.runs24h ?? '—', `cancel ${control.workflow?.cancelled ?? '—'} · 重複 ${control.workflow?.duplicateRuns ?? '—'}`, (control.workflow?.cancelled || control.workflow?.duplicateRuns) ? 'waiting' : 'neutral')
  );
  section.append(metrics);
  const health = node('p', 'rs-diagnostics');
  health.append(
    document.createTextNode('Notification '), pill(control.notification?.label || 'UNKNOWN', control.notification?.label === 'HEALTHY' ? 'success' : control.notification?.label === 'MISCONFIGURED' || control.notification?.label === 'FAILED' ? 'danger' : ''),
    document.createTextNode(' · Canary '), pill(control.canary?.label || 'UNKNOWN', control.canary?.label === 'HEALTHY' ? 'success' : control.canary?.label === 'FAILED' ? 'danger' : ''),
    document.createTextNode(' · Wake '), pill(control.wakeup?.label || 'UNKNOWN', control.wakeup?.label === 'COALESCED' ? 'live' : control.wakeup?.label === 'FAILED' ? 'danger' : '')
  );
  section.append(health);
  if (control.observationError) section.append(node('p', 'rs-configuration', `Control health取得: ${control.observationError}`));
  return section;
}
export function renderRescue(view, now = Date.now()) {
  if (!root) return;
  root.replaceChildren();
  if (!view?.available) {
    root.append(node('p', 'rs-empty', 'RESCUE · 状態未取得'), node('p', 'rs-note', view?.observationError || '最初のCoordinator実行と状態取得を待っています。稼働数はまだ未確認です。')); return;
  }
  const c = view.counts, staleObservation = now - Date.parse(view.generatedAt) > 12 * 60000;
  const staleWorkers = view.workers.filter(r => r.state === 'STALE' || now - Date.parse(r.heartbeatAt || r.claimedAt) > view.staleMs).length;
  const downstreamWaiting = view.recent.filter(r => waitingStates.has(r.state));
  const unresolvedRecords = uniqueByPr([...view.manual, ...view.workers, ...view.queue, ...downstreamWaiting]);
  const unresolved = c.unresolved ?? unresolvedRecords.length;
  const handling = c.handling ?? c.active;
  const waiting = c.waiting ?? uniqueByPr([...view.queue, ...downstreamWaiting]).length;
  const completed = c.completed ?? view.recent.filter(r => completeStates.has(r.state)).length;
  const attention = c.attention ?? c.manual + staleWorkers;
  const top = node('div', 'rs-overview');
  const status = staleObservation || view.observationError ? 'OBSERVATION DELAYED' : staleWorkers ? 'WORKER STALE' : view.status.replaceAll('_', ' ');
  const caption = staleObservation || view.observationError ? '状態取得が遅延しています' : status === 'ALL CLEAR' ? '現在のRescue問題はありません' : status === 'ACTIVE' ? 'Rescue Workerが対応中です' : status === 'WAITING' ? '対応待ちがあります' : status === 'ATTENTION' ? '確認が必要な問題があります' : 'Rescue設定を確認してください';
  const statusBox = node('div', 'rs-status-stack'); statusBox.append(node('strong', `rs-status ${view.status === 'ALL_CLEAR' ? 'green' : staleWorkers || c.manual ? 'yellow' : ''}`, status), node('span', 'rs-status-caption', caption));
  top.append(statusBox, node('p', 'rs-note', `状態更新 ${age(view.generatedAt, now)} ago · GitHub state`));
  root.append(top);
  if (view.coordinator?.reason) root.append(node('p', 'rs-configuration', view.coordinator.reason));
  if (staleObservation || view.observationError) root.append(node('p', 'rs-configuration', '最新の状態を取得できていません。前回の記録を表示しています。'));

  const metrics = node('div', 'rs-metrics');
  metrics.append(
    summaryCard('未解決', unresolved, `要確認 ${attention} · すべての未完了Rescue`, attention ? 'attention' : 'neutral'),
    summaryCard('対応中', handling, `${c.active} / ${c.max} ACTIVE · Worker確保 ${view.workers.length}`, 'working', 'rs-workers-total'),
    summaryCard('対応待ち', waiting, `Queue ${view.queue.length} · push待ち ${c.awaitingPush || 0}`, waiting ? 'waiting' : 'neutral'),
    summaryCard('完了', completed, `保持中 · 24h修復 ${view.throughput.rescued} / 統合 ${view.throughput.merged}`, 'done')
  );
  root.append(metrics);
  const diagnostics = node('p', 'rs-diagnostics', `検証中 ${c.validating} · 再試行 ${c.retry} · Manual ${c.manual} · Stale ${staleWorkers}`); root.append(diagnostics);
  root.append(controlPlaneSummary(view));
  if (view.coordinator?.errors?.length) root.append(node('p', 'rs-configuration', `Coordinator: ${view.coordinator.errors.map(e => `${e.pr ? '#' + e.pr + ' ' : ''}${e.reason}`).join(' · ')}`));

  if (unresolvedRecords.length) root.append(problemSummary(unresolvedRecords, now, view.staleMs));
  else root.append(node('p', 'rs-empty rs-all-clear', '現在の問題はありません。Integration RescueはALL CLEARです。'));

  if (view.workers.length) root.append(group('対応中 · Worker Pool', view.workers, now, view.staleMs, 'rs-worker-pool'));
  if (view.manual.length) root.append(group('人の確認が必要', view.manual, now, view.staleMs, 'rs-manual-list'));
  if (view.queue.length) root.append(group('対応待ち · Queue / 順番待ち', view.queue, now, view.staleMs, 'rs-queue'));
  if (!view.workers.length && !view.queue.length && !view.manual.length && !downstreamWaiting.length) root.append(node('p', 'rs-empty', '実行中・対応待ちのRescueはありません'));

  if (view.recent.length) root.append(group('修復後・Integration進行 / 完了履歴', view.recent, now, view.staleMs, 'rs-recent'));
  const t = view.throughput;
  const stats = node('section', 'rs-throughput'); stats.append(node('h3', 'rs-group-title', '直近24時間 · 保持記録内'));
  stats.append(node('p', '', `Rescued ${t.rescued} · Merged ${t.merged} · Manual ${t.manual} · Retrying ${t.retrying}`)); root.append(stats);
  stats.append(node('p', 'rs-note', 'Rescued / Mergedは同じWorkerの検証・修復push・復帰を確認できた件数。証跡未保持の履歴は含みません。'));
  stats.append(node('p', 'rs-note', `修復証跡なしの観測: merge ${view.observed?.merged ?? 0} · DEV ${view.observed?.dev ?? 0}`));

  const technical = node('div', 'rs-technical-detail');
  if (view.waves.length) {
    const waves = node('section', 'rs-wave-list'); waves.append(node('h3', 'rs-group-title', 'Rescue Waves'));
    for (const w of view.waves.slice(0, 3)) {
      const box = node('article', 'rs-wave'); box.append(node('strong', '', w.id), pill(w.completedAt ? 'FINISHED' : 'ACTIVE'));
      const prs = node('p', '', 'Parallel: '); for (const pr of w.prs) prs.append(link(`#${pr}`, `pull/${pr}`), document.createTextNode(' ')); box.append(prs);
      box.append(node('p', 'rs-note', `${w.repaired} 修復push確認 · ${w.returnedCount ?? 0} / ${w.prs.length} Integration復帰`));
      for (const r of w.waiting) box.append(node('p', 'rs-blocker', `#${r.pr} → waiting for ${r.blockedBy.map(n => '#' + n).join(', ')}`));
      waves.append(box);
    }
    technical.append(waves);
  }
  const feed = node('section', 'rs-activity'); feed.append(node('h3', 'rs-group-title', 'Recent activity'));
  for (const e of view.activity.slice(0, 12)) {
    const item = node('div', 'rs-event'); item.append(node('time', '', new Date(e.at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })));
    const content = node('div'); if (e.pr) content.append(link(`#${e.pr}`, `pull/${e.pr}`)); content.append(node('p', '', e.action));
    if (['RETURNED_TO_INTEGRATION','MERGED','DEV'].includes(e.type) && !e.repairVerified) content.append(pill('修復証跡なしの観測'));
    item.append(content); feed.append(item);
  }
  if (!view.activity.length) feed.append(node('p', 'rs-note', '直近のRescueイベントはありません'));
  technical.append(feed);
  const legend = node('div'); for (const [color, description] of [['GREEN','変更領域が独立。並列処理'],['YELLOW','一部関連あり。完了時に再確認'],['RED','競合するため先行PRの統合後に処理']]) { const p = node('p'); p.append(pill(color, color.toLowerCase()), document.createTextNode(' ' + description)); legend.append(p); }
  technical.append(disclosure('rescue:risk-info', 'GREEN / YELLOW / RED の意味', legend));
  root.append(disclosure('rescue:technical', 'Rescue Waves・Activity・競合判定の詳細', technical));
}
let latest = null;
subscribe((state, error) => { if (!state || error) return; latest = state.integrationRescue; renderRescue(latest); });
setInterval(() => { if (!document.hidden && latest) preserveView(() => renderRescue(latest)); }, 15000);
