import { subscribe, disclosure, preserveView } from './view-state.js';
const root = document.querySelector('#integration-rescue');
const node = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = String(text); return n; };
const link = (label, path) => { const n = node('a', 'rs-link', label); n.href = `https://github.com/charukun/soul-lineage/${path}`; n.target = '_blank'; n.rel = 'noreferrer'; return n; };
const age = (time, now) => { const ms = now - Date.parse(time); if (!Number.isFinite(ms)) return '未記録'; const sec = Math.max(0, Math.floor(ms / 1000)); return sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${Math.floor(sec / 3600)}h ${Math.floor(sec % 3600 / 60)}m`; };
const pill = (text, tone = '') => node('span', `rs-pill ${tone}`, text);
const labels = { DETECTED: '検知', QUEUED: '待機', BLOCKED_BY_RESCUE: '順番待ち', CLAIMED: 'Worker起動待ち', ANALYZING: '分析中', RESOLVING: '修復中', VALIDATING: '検証中', PUSHING: 'commit確定前', AWAITING_PUSH: 'Work push待ち', PUSHED: 'push完了', RETURNED_TO_INTEGRATION: 'Integration復帰', CHECKING: '通常gate確認待ち', MERGED: 'develop統合済み', DEV: 'DEV公開確認済み', FAILED_RETRYABLE: '再試行待ち', FAILED_MANUAL: '人の確認が必要', STALE: 'WORKER STALE' };
const order = ['DETECTED', 'QUEUED', 'CLAIMED', 'ANALYZING', 'RESOLVING', 'VALIDATING', 'PUSHING', 'AWAITING_PUSH', 'PUSHED', 'RETURNED_TO_INTEGRATION', 'CHECKING', 'MERGED', 'DEV'];
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
  const c = node('article', `rs-card ${stale ? 'rs-stale' : manual ? 'rs-manual' : ''}`); c.dataset.viewKey = `rescue:${record.pr}`; c.dataset.pr = record.pr;
  if (record.workerId) c.append(node('p', 'rs-worker-id', `WORKER ${record.workerId}`));
  const top = node('div', 'rs-card-head'); top.append(link(`#${record.pr}`, `pull/${record.pr}`), pill(stale ? 'WORKER STALE' : record.state, stale || manual ? 'danger' : record.lease ? 'live' : ''));
  c.append(top, node('h3', '', record.title || `PR #${record.pr}`));
  if (record.returnedAt || ['AWAITING_PUSH','MERGED','DEV'].includes(record.state)) {
    c.append(pill(({repaired:'修復push・検証を確認',staged:'commit準備済み・push待ち',reevaluated:'再評価のみ・修復pushなし',observed:'統合状況の観測・修復証跡なし'})[record.deliveryKind] || '修復証跡未確認'));
  }
  c.append(node('p', 'rs-action', record.currentAction || labels[record.state] || record.state));
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
  } else if (['QUEUED','DETECTED','FAILED_RETRYABLE','BLOCKED_BY_RESCUE'].includes(record.state)) {
    c.append(node('p', 'rs-timing', `Wait ${age(record.detectedAt, now)} · Priority ${record.priority?.label || '未評価'}`));
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
export function renderRescue(view, now = Date.now()) {
  if (!root) return;
  root.replaceChildren();
  const summary = document.querySelector('#rescue-summary');
  if (summary) {
    const stale = !Number.isFinite(Date.parse(view?.generatedAt)) || now - Date.parse(view?.generatedAt) > 12 * 60000;
    summary.textContent = !view?.available ? '未取得' : stale || view.observationError ? '最新状態は未確認' : `修復中 ${view.counts.active} · 待ち ${view.counts.queued + view.counts.blocked} · 要確認 ${view.counts.manual + view.counts.stale}`;
  }
  if (!view?.available) {
    root.append(node('p', 'rs-empty', 'RESCUE · 状態未取得'), node('p', 'rs-note', view?.observationError || '最初のCoordinator実行と状態取得を待っています。稼働数はまだ未確認です。')); return;
  }
  const c = view.counts, staleObservation = now - Date.parse(view.generatedAt) > 12 * 60000;
  const staleWorkers = view.workers.filter(r => r.state === 'STALE' || now - Date.parse(r.heartbeatAt || r.claimedAt) > view.staleMs).length;
  const top = node('div', 'rs-overview');
  const status = staleObservation || view.observationError ? 'OBSERVATION DELAYED' : staleWorkers ? 'WORKER STALE' : view.status.replaceAll('_', ' ');
  top.append(node('strong', `rs-status ${view.status === 'ALL_CLEAR' ? 'green' : staleWorkers || c.manual ? 'yellow' : ''}`, status));
  top.append(node('p', 'rs-note', `状態更新 ${age(view.generatedAt, now)} ago · GitHub state`));
  root.append(top);
  if (view.workers.length) {
    const glance = node('div', 'rs-live-prs');
    for (const r of view.workers) {
      const item = node('div', 'rs-live-pr');
      item.append(link(`#${r.pr}`, `pull/${r.pr}`), node('span', r.state === 'STALE' ? 'yellow' : '', labels[r.state] || r.state));
      glance.append(item);
    }
    root.append(glance);
  }
  if (view.coordinator?.reason) root.append(node('p', 'rs-configuration', view.coordinator.reason));
  if (staleObservation || view.observationError) root.append(node('p', 'rs-configuration', '最新の状態を取得できていません。前回の記録を表示しています。'));
  const metrics = node('div', 'rs-metrics');
  for (const [name, value, cls] of [['WORKERS', `${c.active} / ${c.max} ACTIVE`, 'rs-workers-total'], ['QUEUED', c.queued, ''], ['BLOCKED', c.blocked, ''], ['VALIDATING', c.validating, ''], ['WORK PUSH', c.awaitingPush || 0, ''], ['RETURNED', c.returned, ''], ['MANUAL', c.manual, ''], ['FAILED / RETRY', c.retry, ''], ['STALE', staleWorkers, '']]) {
    const tone = Number(value) > 0 && ['MANUAL','FAILED / RETRY','STALE'].includes(name) ? name === 'MANUAL' ? 'red' : 'yellow' : '';
    const box = node('div', `rs-metric ${cls}`); box.append(node('span', '', name), node('strong', tone, value)); metrics.append(box);
  }
  root.append(metrics);
  if (view.coordinator?.errors?.length) root.append(node('p', 'rs-configuration', `Coordinator: ${view.coordinator.errors.map(e => `${e.pr ? '#' + e.pr + ' ' : ''}${e.reason}`).join(' · ')}`));
  if (view.workers.length) root.append(group('Worker Pool', view.workers, now, view.staleMs, 'rs-worker-pool'));
  else root.append(node('p', 'rs-empty', view.status === 'ALL_CLEAR' ? '修復待ちはありません。ALL CLEAR' : '実行中のWorkerはありません'));
  if (view.manual.length) root.append(group('Manual required', view.manual, now, view.staleMs, 'rs-manual-list'));
  if (view.waves.length) {
    const waves = node('section', 'rs-wave-list'); waves.append(node('h3', 'rs-group-title', 'Rescue Waves'));
    for (const w of view.waves.slice(0, 3)) {
      const box = node('article', 'rs-wave'); box.append(node('strong', '', w.id), pill(w.completedAt ? 'FINISHED' : 'ACTIVE'));
      const prs = node('p', '', 'Parallel: '); for (const pr of w.prs) prs.append(link(`#${pr}`, `pull/${pr}`), document.createTextNode(' ')); box.append(prs);
      box.append(node('p', 'rs-note', `${w.repaired} 修復push確認 · ${w.returnedCount ?? 0} / ${w.prs.length} Integration復帰`));
      for (const r of w.waiting) box.append(node('p', 'rs-blocker', `#${r.pr} → waiting for ${r.blockedBy.map(n => '#' + n).join(', ')}`));
      waves.append(box);
    }
    root.append(waves);
  }
  if (view.queue.length) root.append(group('Queue · 次Wave候補 / 順番待ち', view.queue, now, view.staleMs, 'rs-queue'));
  if (view.recent.length) root.append(group('修復・再評価・Integration / DEV観測', view.recent, now, view.staleMs, 'rs-recent'));
  const t = view.throughput;
  const stats = node('section', 'rs-throughput'); stats.append(node('h3', 'rs-group-title', 'Last 24h · 保持記録内'));
  stats.append(node('p', '', `Rescued ${t.rescued} · Merged ${t.merged} · Manual ${t.manual} · Retrying ${t.retrying}`)); root.append(stats);
  stats.append(node('p', 'rs-note', 'Rescued / Mergedは同じWorkerの検証・修復push・復帰を確認できた件数。証跡未保持の履歴は含みません。'));
  stats.append(node('p', 'rs-note', `修復証跡なしの観測: merge ${view.observed?.merged ?? 0} · DEV ${view.observed?.dev ?? 0}`));
  const feed = node('section', 'rs-activity'); feed.append(node('h3', 'rs-group-title', 'Recent activity'));
  for (const e of view.activity.slice(0, 12)) {
    const item = node('div', 'rs-event'); item.append(node('time', '', new Date(e.at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })));
    const content = node('div'); if (e.pr) content.append(link(`#${e.pr}`, `pull/${e.pr}`)); content.append(node('p', '', e.action));
    if (['RETURNED_TO_INTEGRATION','MERGED','DEV'].includes(e.type) && !e.repairVerified) content.append(pill('修復証跡なしの観測'));
    item.append(content); feed.append(item);
  }
  if (!view.activity.length) feed.append(node('p', 'rs-note', '直近のRescueイベントはありません'));
  root.append(feed);
  const legend = node('div'); for (const [color, description] of [['GREEN','変更領域が独立。並列処理'],['YELLOW','一部関連あり。完了時に再確認'],['RED','競合するため先行PRの統合後に処理']]) { const p = node('p'); p.append(pill(color, color.toLowerCase()), document.createTextNode(' ' + description)); legend.append(p); }
  root.append(disclosure('rescue:risk-info', 'GREEN / YELLOW / RED の意味', legend));
}
let latest = null;
subscribe((state, error) => { if (!state || error) return; latest = state.integrationRescue; renderRescue(latest); });
setInterval(() => { if (!document.hidden && latest) preserveView(() => renderRescue(latest)); }, 15000);
