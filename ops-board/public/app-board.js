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

function targetRow(target) {
  const row = el('div', `app-target state-${target.state || 'unknown'}`);
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
  const card = el('article', 'app-card');
  const head = el('div', 'app-card-head');
  head.append(el('h3', '', app.name || app.id));
  const healthy = (app.targets || []).every(target => target.state === 'success');
  const bad = (app.targets || []).some(target => target.state === 'failed');
  head.append(el('span', `app-kind ${bad ? 'danger' : healthy ? 'ok' : 'info'}`, bad ? '要確認' : healthy ? '正常' : '確認中'));
  card.append(head);
  const targets = el('div', 'app-targets');
  (app.targets || []).forEach(target => targets.append(targetRow(target)));
  card.append(targets);
  return card;
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
  apps.forEach(app => root.append(appCard(app)));
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
