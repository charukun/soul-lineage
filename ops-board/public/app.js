const $ = selector => document.querySelector(selector);
const fmt = new Intl.DateTimeFormat('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

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
const deployLabel = state => ({ success:'公開済み', deploying:'deploy中', waiting:'deploy待ち', failed:'失敗', unknown:'不明' })[state] || state || '不明';
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
    text.append(el('small', '', `merge ${time(pr.mergedAt)}`));
    row.append(text);
    list.append(row);
  }
  return list;
}

function details(title, content) {
  const root = el('details');
  root.append(el('summary', '', title), content);
  return root;
}

function environmentCard(env) {
  const card = el('article', 'environment');
  const head = el('div', 'environment-head');
  const left = el('div');
  left.append(el('h3', '', env.name), link(env.url, env.url, 'url'));
  head.append(left, badge(deployLabel(env.deployState), deployTone(env.deployState)));
  card.append(head);

  const metrics = el('div', 'metrics');
  const count = Number.isInteger(env.reflectedPrCount) ? `${env.reflectedPrCount}件` : '未確定';
  metrics.append(
    metric('deploy SHA', shortSha(env.deployedCommit), true),
    metric('deploy日時', time(env.deployedAt)),
    metric('反映済みPR', count),
    metric('branch', env.branch || '—'),
  );
  card.append(metrics);
  if (env.exactCommit === false) card.append(el('p', 'empty', '公開物が複数SHAのため、単一SHAを推測していません。'));
  card.append(details('反映済みPR一覧', prList(env.reflectedPrs, env.historyComplete === false ? '履歴の全件確定前です' : '該当PRなし')));
  if (env.deployQueue?.pulls?.length) card.append(details('branch merge済み・未deploy', prList(env.deployQueue.pulls)));
  return card;
}

function setSummary(id, value, note, tone = 'info') {
  const node = $(id);
  if (!node) return;
  node.textContent = value;
  const card = node.closest('.summary-card');
  if (card) card.className = `summary-card tone-${tone}`;
  const small = card?.querySelector('small');
  if (small && note !== undefined) small.textContent = note;
}

function renderOverview(state, integration) {
  const hero = $('#hero');
  const label = overallLabel(integration);
  hero.className = `summary-card tone-${integration?.tone || 'info'}${state.syncStatus === 'degraded' ? ' error' : ''}`;
  hero.replaceChildren(
    el('span', 'summary-label', '全体'),
    el('strong', 'summary-value', state.syncStatus === 'degraded' ? '同期注意' : label),
    el('small', '', state.syncStatus === 'degraded' ? 'データ取得が劣化中' : '自動統合'),
  );

  const apps = state.applications || [];
  const healthyApps = apps.filter(app => (app.targets || []).length && (app.targets || []).every(target => target.state === 'success')).length;
  const failedApps = apps.filter(app => (app.targets || []).some(target => target.state === 'failed')).length;
  const appTone = failedApps ? 'danger' : healthyApps === apps.length && apps.length ? 'ok' : 'warning';
  setSummary('#summary-apps', apps.length ? `${healthyApps}/${apps.length}` : '—', failedApps ? `要対応 ${failedApps}` : '正常アプリ', appTone);

  const pulls = [...(state.pullRequests?.normal || []), ...(state.pullRequests?.visualReview || [])];
  const drafts = pulls.filter(pr => pr.state === 'Draft').length;
  const ready = pulls.filter(pr => pr.state === 'Ready').length;
  setSummary('#summary-drafts', String(drafts), 'PR', drafts ? 'progress' : 'ok');
  setSummary('#summary-ready', String(ready), 'PR', ready ? 'warning' : 'ok');

  const diffCount = state.environmentDiff?.count;
  setSummary('#summary-diff', Number.isInteger(diffCount) ? (diffCount ? `+${diffCount}` : '0') : '—', 'Production比', Number.isInteger(diffCount) ? (diffCount ? 'warning' : 'ok') : 'info');

  const failures = state.recentActionFailures || [];
  setSummary('#summary-failures', String(failures.length), 'Actions', failures.length ? 'danger' : 'ok');
}

function renderAlerts(alerts = []) {
  const section = $('#alert-section');
  const root = $('#alerts');
  root.replaceChildren();
  section.hidden = alerts.length === 0;
  $('#alert-count').textContent = alerts.length ? `${alerts.length}件` : '';
  for (const item of alerts) {
    const box = safeHref(item.url) ? link('', item.url, `alert ${item.tone}`) : el('div', `alert ${item.tone}`);
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
  root.append(top, details('差分PR一覧', prList(diff?.pulls)));
}

function renderIntegration(integration = {}) {
  const root = $('#integration');
  root.replaceChildren();
  const top = el('div', 'integration-summary');
  const desc = el('div');
  const label = overallLabel(integration);
  desc.append(el('strong', '', label));
  desc.append(el('p', 'muted', `統合待ち警告: ${integration.watchdog?.staleReadyCount ?? 0}件 / 閾値 ${integration.watchdog?.stalledThresholdMinutes ?? 10}分`));
  top.append(desc, badge(label, integration.tone || 'info'));
  root.append(top);

  const list = el('div', 'queue-list');
  const queue = integration.queue || [];
  if (!queue.length) list.append(el('p', 'empty', 'Open Ready PRなし'));
  for (const item of queue) {
    const row = el('article', 'queue-item');
    const head = el('div', 'queue-head');
    head.append(link(`#${item.number} ${item.title}`, item.url), badge(item.label, item.tone));
    row.append(head, el('p', '', `${item.reason || ''}${Number.isFinite(item.stalledMs) ? ` / 滞留 ${duration(item.stalledMs)}` : ''}`));
    list.append(row);
  }
  root.append(list);
  if (integration.deployWaiting?.length) root.append(details('develop merge済み・deploy待ち', prList(integration.deployWaiting)));
}

function renderFailures(items = []) {
  const root = $('#failures');
  root.replaceChildren();
  if (!items.length) {
    root.append(el('p', 'empty', '直近のActions失敗なし'));
    return;
  }
  const list = el('div', 'failure-list');
  for (const run of items) {
    const row = el('div', 'failure');
    row.append(link(`${run.workflow} / ${run.branch || '—'}`, run.url), el('span', '', run.conclusion));
    list.append(row);
  }
  root.append(list);
}

function render(state) {
  const integration = state.integration || { label:'不明', tone:'info' };
  renderOverview(state, integration);
  renderAlerts(state.alerts || []);

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
  renderFailures(state.recentActionFailures || []);
  $('#last-updated').textContent = `最終更新: ${time(state.generatedAt)} / 取得試行: ${time(state.lastAttemptAt || state.generatedAt)}`;
  $('#source').textContent = `${state.syncSource || 'GitHub API'}${Number.isFinite(state.githubRateRemaining) ? ` / API残量 ${state.githubRateRemaining}` : ''}`;
}

async function load() {
  const button = $('#reload');
  button.disabled = true;
  try {
    const response = await fetch(`/api/state?view=${Date.now()}`, { cache:'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    render(await response.json());
  } catch (error) {
    const hero = $('#hero');
    hero.className = 'summary-card tone-danger error';
    hero.replaceChildren(el('span', 'summary-label', '全体'), el('strong', 'summary-value', '取得失敗'), el('small', '', error.message));
  } finally {
    button.disabled = false;
  }
}

$('#reload').addEventListener('click', load);
load();
setInterval(load, 60000);