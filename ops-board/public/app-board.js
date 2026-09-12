const $ = selector => document.querySelector(selector);
const fmt = new Intl.DateTimeFormat('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
};
const stateView = state => ({
  success: ['公開中', 'ok'],
  deploying: ['更新中', 'progress'],
  waiting: ['公開待ち', 'warning'],
  failed: ['要対応', 'danger'],
  unknown: ['確認中', 'info'],
})[state] || ['確認中', 'info'];
const shortSha = value => value ? String(value).slice(0, 10) : '未確定';
const time = value => {
  if (!value) return '記録なし';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '記録なし' : fmt.format(date);
};

function targetChip(target) {
  const [label, tone] = stateView(target.state);
  const chip = el('span', `target-chip ${tone}`);
  chip.append(el('span', 'target-dot'), el('span', '', `${target.label || '公開先'} ${label}`));
  return chip;
}

function targetRow(target) {
  const row = el('div', `app-target state-${target.state || 'unknown'}${target.note ? ' has-note' : ''}`);
  const header = el('div', 'app-target-head');
  const [label, tone] = stateView(target.state);
  header.append(el('strong', '', target.label || '公開先'), el('span', `badge ${tone}`, label));
  row.append(header);
  if (target.url) {
    const link = el('a', 'app-url', target.url);
    link.href = target.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    row.append(link);
  } else {
    row.append(el('span', 'app-url unavailable', '公開URL 未確定'));
  }
  const meta = el('div', 'app-target-meta');
  meta.append(el('span', '', `公開版 ${shortSha(target.commit)}`), el('span', '', `更新 ${time(target.deployedAt)}`));
  row.append(meta);
  if (target.note) row.append(el('p', 'app-note', target.note));
  return row;
}

function appCard(app) {
  const targets = app.targets || [];
  const healthy = targets.length > 0 && targets.every(target => target.state === 'success');
  const bad = targets.some(target => target.state === 'failed');
  const active = targets.some(target => target.state === 'deploying' || target.state === 'waiting');
  const card = el('details', `app-card${bad ? ' app-card-attention' : ''}`);
  card.open = bad;

  const summary = el('summary', 'app-card-summary');
  const title = el('div', 'app-title-block');
  title.append(el('h3', '', app.name || app.id));
  const chips = el('div', 'target-chips');
  targets.forEach(target => chips.append(targetChip(target)));
  title.append(chips);

  const state = bad ? ['要確認','danger'] : active ? ['更新中','progress'] : healthy ? ['正常','ok'] : ['確認中','info'];
  summary.append(title, el('span', `app-kind ${state[1]}`, state[0]));
  card.append(summary);

  const body = el('div', 'app-card-body');
  const grid = el('div', 'app-targets');
  targets.forEach(target => grid.append(targetRow(target)));
  body.append(grid);
  card.append(body);
  return card;
}

function groupSection(title, items) {
  const section = el('section', 'app-group');
  const head = el('div', 'app-group-head');
  head.append(el('h3', '', title), el('span', 'muted', `${items.length}件`));
  section.append(head);
  const grid = el('div', 'app-grid');
  items.forEach(app => grid.append(appCard(app)));
  section.append(grid);
  return section;
}

function render(apps = []) {
  const root = $('#applications');
  root.replaceChildren();
  const summary = $('#app-summary');
  const errors = apps.filter(app => (app.targets || []).some(target => target.state === 'failed')).length;
  summary.textContent = `${apps.length}アプリ${errors ? ` / 要確認 ${errors}` : ' / 正常'}`;
  if (!apps.length) {
    root.append(el('div', 'card empty', '管理対象アプリを確認できませんでした'));
    return;
  }

  const games = apps.filter(app => app.kind !== 'tool');
  const tools = apps.filter(app => app.kind === 'tool');
  if (games.length) root.append(groupSection('ゲーム / 専用開発版', games));
  if (tools.length) root.append(groupSection('開発ツール', tools));
}

async function load() {
  try {
    const response = await fetch(`/api/state?apps=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const state = await response.json();
    render(state.applications || []);
  } catch (error) {
    const root = $('#applications');
    root.replaceChildren(el('div', 'card empty', `アプリ状態を取得できません: ${error.message}`));
  }
}

$('#reload').addEventListener('click', load);
load();
setInterval(load, 60000);