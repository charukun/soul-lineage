import { subscribe, disclosure, preserveView } from './view-state.js';
import { boardAlerts, snapshotAge, ageLabel, STALE_SNAPSHOT_MS, FAILED_CONCLUSIONS } from './health.mjs';
const $ = selector => document.querySelector(selector);
const fmt = new Intl.DateTimeFormat('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
};
const safeHref = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
};
const link = (text, href, className = '') => {
  const node = el('a', className, text);
  const safe = safeHref(href);
  if (safe) {
    node.href = safe;
    node.target = '_blank';
    node.rel = 'noreferrer';
  }
  return node;
};
const time = value => {
  if (!value) return '未記録';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '未記録' : fmt.format(date);
};
const duration = ms => {
  if (!Number.isFinite(ms)) return '';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}分`;
  return `${Math.floor(minutes / 60)}時間${minutes % 60}分`;
};
const shortSha = value => value ? String(value).slice(0, 12) : '確定不能';
const badge = (label, tone = 'info') => el('span', `badge ${tone}`, label);
const deployLabel = state => ({ success:'公開済み', deploying:'公開処理中', waiting:'公開待ち', failed:'失敗', unknown:'不明' })[state] || state || '不明';
const deployTone = state => ({ success:'ok', deploying:'progress', waiting:'warning', failed:'danger', unknown:'info' })[state] || 'info';
const overallLabel = integration => ({ ok:'正常', progress:'処理中', warning:'確認', danger:'要対応', info:'確認中' })[integration?.tone] || '確認中';

function metric(label, value, isSha = false) {
  const box = el('div', 'metric');
  box.append(el('span', '', label), el('strong', isSha ? 'sha' : '', value));
  return box;
}

function prList(items, emptyText = 'PRなし') {
  if (!items?.length) return el('p', 'empty', emptyText);
  const list = el('ul', 'pr-list');
  for (const pr of items) {
    const row = el('li', 'pr');
    row.append(link(`#${pr.number}`, pr.url, 'pr-no'));
    const text = el('div', 'pr-title', pr.title || `PR #${pr.number}`);
    text.append(el('small', '', `統合 ${time(pr.mergedAt)}`));
    row.append(text);
    list.append(row);
  }
  return list;
}

function details(title, content, key = title) {
  return disclosure(key, title, content);
}

function environmentCard(env) {
  const card = el('article', 'environment');
  card.dataset.viewKey = `environment:${env.id}`;
  const head = el('div', 'environment-head');
  const left = el('div');
  left.append(el('h3', '', env.name), link(env.url, env.url, 'url'));
  head.append(left, badge(deployLabel(env.deployState), deployTone(env.deployState)));
  card.append(head);

  const metrics = el('div', 'metrics');
  const count = Number.isInteger(env.reflectedPrCount) ? `${env.reflectedPrCount}件` : '未確定';
  metrics.append(
    metric('公開SHA', shortSha(env.deployedCommit), true),
    metric('公開日時', time(env.deployedAt)),
    metric('反映済みPR', count),
    metric('元branch', env.branch || '—'),
  );
  card.append(metrics);
  if (env.exactCommit === false) card.append(el('p', 'empty', '公開物が複数SHAのため、単一SHAを推測していません。'));
  card.append(details('反映済みPRを見る', prList(env.reflectedPrs, env.historyComplete === false ? '履歴の全件確定前です' : '該当PRなし'), `env:${env.id}:reflected`));
  if (env.deployQueue?.pulls?.length) card.append(details('merge済み・まだ未公開', prList(env.deployQueue.pulls), `env:${env.id}:waiting`));
  return card;
}

function renderAlerts(alerts = []) {
  const section = $('#alert-section');
  const root = $('#alerts');
  root.replaceChildren();
  section.hidden = alerts.length === 0;
  $('#alert-count').textContent = alerts.length ? `${alerts.length}件` : '';
  for (const item of alerts) {
    const box = safeHref(item.url) ? link('', item.url, `alert ${item.tone}`) : el('div', `alert ${item.tone}`);
    box.dataset.viewKey = `alert:${item.type}:${item.prNumber || item.url || item.title}`;
    box.append(el('strong', '', item.title));
    box.append(el('p', '', `${item.detail || ''}${item.since ? ` / ${time(item.since)}から` : ''}`));
    root.append(box);
  }
}

function renderDiff(diff) {
  const root = $('#diff');
  root.replaceChildren();
  const top = el('div', 'diff-title');
  const exactCount = Number.isInteger(diff?.count);
  top.append(el('strong', '', diff?.label || '差分を確定できません'), badge(exactCount ? (diff.count ? `+${diff.count}` : '0') : '—', exactCount ? (diff.count ? 'warning' : 'ok') : 'info'));
  root.append(top, details('差分PRを見る', prList(diff?.pulls), 'diff:pulls'));
}

function renderIntegration(integration = {}) {
  const root = $('#integration');
  root.replaceChildren();
  const top = el('div', 'integration-summary');
  const desc = el('div');
  const label = ({delivery: integration.stalled ? '公開処理の停止疑い' : '開発版を公開・検証中',
    integration: '変更を統合中', hold: '意図的な保留あり', 'deploy-wait': '次の公開待ち',
    'ready-queue': '統合待ちを確認', failed: '処理の失敗を確認', idle: '自動処理は待機中'})[integration.phase] || overallLabel(integration);
  desc.append(el('strong', '', label));
  desc.append(el('p', 'muted', `統合待ち警告 ${integration.watchdog?.staleReadyCount ?? 0}件 / 判定 ${integration.watchdog?.stalledThresholdMinutes ?? 10}分`));
  top.append(desc, badge(label, integration.tone || 'info'));
  root.append(top);
  if (integration.heartbeatAt) root.append(el('p', 'muted', `処理の最終更新 ${time(integration.heartbeatAt)}`));

  const list = el('div', 'queue-list');
  const queue = integration.queue || [];
  if (!queue.length) list.append(el('p', 'empty', 'Ready状態で待っているPRはありません'));
  for (const item of queue) {
    const row = el('article', 'queue-item');
    row.dataset.viewKey = `queue:${item.number}`;
    const head = el('div', 'queue-head');
    head.append(link(`#${item.number} ${item.title}`, item.url), badge(item.label, item.tone));
    row.append(head, el('p', '', `${item.reason || ''}${Number.isFinite(item.stalledMs) ? ` / 滞留 ${duration(item.stalledMs)}` : ''}`));
    list.append(row);
  }
  root.append(list);
  if (integration.deployWaiting?.length) root.append(details('merge済み・deploy待ち', prList(integration.deployWaiting), 'integration:waiting'));
}

function failureRows(items) {
  const list = el('div', 'failure-list');
  for (const run of items) {
    const row = el('div', 'failure'); row.dataset.viewKey = `run:${run.id}`;
    const text = el('div');
    text.append(link(`${run.workflow} / ${run.branch || '記録なし'}`, run.url));
    text.append(el('p', 'muted', time(run.updatedAt || run.createdAt)));
    const label = run.historyLabel || ({ failure: '失敗', cancelled: '中断', timed_out: '時間切れ', action_required: '確認待ち', startup_failure: '起動失敗', stale: '期限切れ' })[run.conclusion] || '未確認';
    const result = el('span', run.historyLabel || run.conclusion === 'cancelled' ? 'history-result' : '', label);
    row.append(text, result); list.append(row);
  }
  return list;
}
function renderFailures(state) {
  const root = $('#failures'); root.replaceChildren();
  const current = (state.recentActionFailures || []).filter(run => FAILED_CONCLUSIONS.has(run.conclusion));
  const history = state.actionHistory || (state.recentActionFailures || []).filter(run => run.conclusion === 'cancelled');
  root.append(el('strong', 'failure-heading', `対応が必要な失敗 ${current.length}件`));
  if (current.length) root.append(failureRows(current));
  else root.append(el('p', 'empty', state.syncStatus === 'degraded' ? '前回取得した範囲に失敗はありません。最新状態は未確認です。' : '今回取得した範囲に、未解消の失敗はありません。'));
  if (history.length) root.append(details(`中断・過去の記録 ${history.length}件`, failureRows(history), 'actions:history'));
}
let currentState = null;
let currentError = null;
function renderFreshness() {
  const state = currentState;
  const age = snapshotAge(state);
  const stale = age === null || age >= STALE_SNAPSHOT_MS;
  const failed = Boolean(currentError) || state?.syncStatus === 'degraded';
  const stamp = $('#sync-freshness');
  if (stamp) {
    stamp.textContent = `${failed ? '更新失敗 · ' : stale ? '更新確認 · ' : ''}最終取得 ${ageLabel(age)}`;
    stamp.className = `sync-freshness ${failed ? 'danger' : stale ? 'warning' : 'info'}`;
    stamp.title = `最終取得 ${time(state?.generatedAt)} / 取得試行 ${time(state?.lastAttemptAt || state?.generatedAt)}`;
  }
  renderAlerts(boardAlerts(state, Date.now(), currentError));
}

function render(state) {
  const integration = state.integration || { label:'不明', tone:'info' };
  currentState = state; currentError = null;
  renderFreshness();

  const envs = state.environments || [];
  $('#env-count').textContent = `${envs.length}件`;
  const environmentRoot = $('#environments');
  environmentRoot.replaceChildren();
  if (!envs.length) {
    const empty = el('div', 'card');
    empty.append(el('p', 'empty', '公開環境を検出できませんでした'));
    environmentRoot.append(empty);
  } else {
    envs.forEach(env => environmentRoot.append(environmentCard(env)));
  }
  renderDiff(state.environmentDiff);
  renderIntegration(integration);
  renderFailures(state);
  $('#last-updated').textContent = `最終更新: ${time(state.generatedAt)} / 取得試行: ${time(state.lastAttemptAt || state.generatedAt)}`;
  $('#source').textContent = `${state.syncSource || 'GitHub API'}${Number.isFinite(state.githubRateRemaining) ? ` / API残量 ${state.githubRateRemaining}` : ''}`;
}

subscribe((state, error) => {
  if (error) { currentState = state; currentError = error; renderFreshness(); }
  else if (state) render(state);
});
// Refresh age labels even while the same saved snapshot is being shown.
setInterval(() => preserveView(renderFreshness), 15000);
