const $ = selector => document.querySelector(selector);
const fmt = new Intl.DateTimeFormat('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
};

const APP_ICONS = {
  rinne: './icons/rinne.svg',
  village: './icons/village.svg',
  demon: './icons/demon.svg',
  lanternfell: './icons/lanternfell.svg',
  'character-studio': './icons/character-studio.svg',
  'visual-review': './icons/visual-review.svg',
  portal: './icons/wayfinder.svg',
  'ops-board': './icons/ops-board.svg',
};
const DEFAULT_ICON = './icons/default.svg';

const stateView = state => ({
  success: ['公開中', 'ok'],
  deploying: ['更新中', 'progress'],
  waiting: ['公開待ち', 'warning'],
  failed: ['要対応', 'danger'],
  missing: ['未公開', 'warning'],
  unknown: ['確認中', 'info'],
})[state] || ['確認中', 'info'];
const shortSha = value => value ? String(value).slice(0, 8) : '未確定';
const time = value => {
  if (!value) return '記録なし';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '記録なし' : fmt.format(date);
};

function iconFor(app) {
  const image = el('img', 'app-icon');
  const id = String(app.id || '');
  image.src = APP_ICONS[id] || (id.startsWith('preview:') ? APP_ICONS.lanternfell : DEFAULT_ICON);
  image.alt = '';
  image.loading = 'lazy';
  image.addEventListener('error', () => {
    if (!image.src.endsWith('/icons/default.svg')) image.src = DEFAULT_ICON;
  }, { once: true });
  return image;
}

function targetSummary(target) {
  const [label, tone] = stateView(target.state);
  const node = el(target.url ? 'a' : 'div', `app-target-summary ${tone}${target.url ? ' is-link' : ''}`);
  if (target.url) {
    node.href = target.url;
    node.target = '_blank';
    node.rel = 'noreferrer';
    node.title = `${target.label || '公開先'}を開く`;
  }
  const top = el('div', 'app-target-summary-top');
  top.append(el('strong', '', target.label || '公開先'));
  const state = el('span', `mini-state ${tone}`);
  state.append(el('span', 'mini-dot'), el('span', '', label));
  top.append(state);
  node.append(top);

  const meta = el('div', 'app-target-summary-meta');
  meta.append(el('span', '', shortSha(target.commit)), el('span', '', time(target.deployedAt)));
  node.append(meta);
  if (target.note && !target.url) node.title = target.note;
  return node;
}

function appCard(app) {
  const targets = app.targets || [];
  const healthy = targets.length > 0 && targets.every(target => target.state === 'success');
  const bad = targets.some(target => target.state === 'failed' || target.state === 'missing');
  const active = targets.some(target => target.state === 'deploying' || target.state === 'waiting');
  const state = bad ? ['要確認','danger'] : active ? ['更新中','progress'] : healthy ? ['正常','ok'] : ['確認中','info'];

  const card = el('article', `app-summary-card${bad ? ' app-card-attention' : ''}`);
  const visual = el('div', 'app-summary-visual');
  visual.append(iconFor(app), el('span', `app-kind ${state[1]}`, state[0]));
  card.append(visual, el('h3', 'app-summary-title', app.name || app.id));

  const targetsRoot = el('div', 'app-summary-targets');
  targets.forEach(target => targetsRoot.append(targetSummary(target)));
  if (!targets.length) targetsRoot.append(el('div', 'app-target-summary info', '公開情報なし'));
  card.append(targetsRoot);
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
  const errors = apps.filter(app => !(app.targets || []).length || app.targets.some(target => target.state !== 'success')).length;
  summary.textContent = apps.length ? `${apps.length}アプリ${errors ? ` / 未公開・要確認 ${errors}` : ' / 正常'}` : '公開情報なし';
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