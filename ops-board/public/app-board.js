import { subscribe } from './view-state.js';
import { appHealth, appSummary } from './health.mjs';
const $ = selector => document.querySelector(selector);
const fmt = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' });
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
};
const APP_ICONS = { 'character-studio': './icons/character-studio.svg', rinne: './icons/rinne.svg', village: './icons/village.svg', demon: './icons/demon.svg', lanternfell: './icons/lanternfell.svg', 'visual-review': './icons/visual-review.svg', portal: './icons/wayfinder.svg', 'ops-board': './icons/ops-board.svg' };
const DEFAULT_ICON = './icons/default.svg';
const stateView = state => ({ success: ['公開中', 'ok'], deploying: ['更新中', 'progress'], waiting: ['公開待ち', 'warning'], failed: ['要対応', 'danger'], unknown: ['未確認', 'info'], missing: ['未公開', 'info'] })[state] || ['未確認', 'info'];
const safeHref = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null; } catch { return null; } };
const time = value => { const d = Date.parse(value || ''); return Number.isFinite(d) ? `${fmt.format(d)}（端末時刻）` : '記録なし'; };
let currentApps = [];
let selectedApp = null;
let returnFocusKey = null;

const dialog = el('dialog', 'app-dialog');
dialog.id = 'app-dialog';
dialog.setAttribute('aria-labelledby', 'app-dialog-title');
const dialogHead = el('div', 'app-dialog-head');
const dialogTitle = el('h2', '', '公開情報'); dialogTitle.id = 'app-dialog-title';
const close = el('button', 'app-dialog-close', '閉じる'); close.type = 'button';
const dialogContent = el('div', 'app-dialog-content');
dialogHead.append(dialogTitle, close); dialog.append(dialogHead, dialogContent); document.body.append(dialog);
close.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
dialog.addEventListener('close', () => {
  selectedApp = null;
  [...document.querySelectorAll('[data-view-key]')].find(node => node.dataset.viewKey === returnFocusKey)?.focus({ preventScroll: true });
});
function detailPair(root, title, value, mono = false) {
  root.append(el('dt', '', title), el('dd', mono ? 'sha' : '', value));
}
function fillDialog(app) {
  const scroll = dialog.scrollTop;
  dialogTitle.textContent = app.name || app.id;
  dialogContent.replaceChildren();
  for (const target of app.targets || []) {
    const section = el('section', 'app-public-detail');
    const [label, tone] = stateView(target.state);
    section.append(el('h3', '', `${target.label || '公開先'} / ${label}`));
    const values = el('dl');
    detailPair(values, '公開済みの版（SHA）', target.commit || '未確定', true);
    detailPair(values, '公開日時', time(target.deployedAt));
    detailPair(values, '取得元', target.source || '取得元未記録');
    if (target.updateState && target.updateState !== 'success') {
      detailPair(values, '次の更新', stateView(target.updateState)[0]);
    }
    section.append(values);
    if (target.note) section.append(el('p', 'empty', target.note));
    const url = safeHref(target.url);
    if (url) {
      const link = el('a', `app-detail-link ${tone}`, 'この公開先を開く ↗');
      link.href = url; link.target = '_blank'; link.rel = 'noreferrer';
      section.append(link, el('p', 'app-detail-url', url));
    }
    dialogContent.append(section);
  }
  if (!(app.targets || []).length) dialogContent.append(el('p', 'empty', '公開情報を確認できていません。'));
  dialog.scrollTop = scroll;
}
function iconFor(app) {
  const image = el('img', 'app-icon');
  image.src = APP_ICONS[String(app.id || '')] || DEFAULT_ICON;
  image.alt = ''; image.width = 32; image.height = 32; image.loading = 'lazy';
  image.addEventListener('error', () => { if (!image.src.endsWith('/icons/default.svg')) image.src = DEFAULT_ICON; }, { once: true });
  return image;
}
function targetSummary(target, app) {
  const [label, tone] = stateView(target.state);
  const url = safeHref(target.url);
  const node = el(url ? 'a' : 'div', `app-target-summary ${tone}${url ? ' is-link' : ''}`);
  if (url) { node.href = url; node.target = '_blank'; node.rel = 'noreferrer'; }
  node.setAttribute('aria-label', `${app.name || app.id} ${target.label || '公開先'} ${label}${url ? 'を開く' : ''}`);
  node.dataset.viewKey = `target:${app.id}:${target.id}`;
  const top = el('div', 'app-target-summary-top');
  const state = el('span', `mini-state ${tone}`);
  state.append(el('span', 'mini-dot'), el('span', '', label));
  top.append(el('strong', '', target.label || '公開先'), state); node.append(top);
  if (target.state === 'success' && ['failed', 'deploying', 'waiting'].includes(target.updateState)) {
    node.append(el('span', `app-update-note ${stateView(target.updateState)[1]}`,
      target.updateState === 'failed' ? '次の更新に失敗' : target.updateState === 'deploying' ? '次の更新中' : '次の更新待ち'));
  }
  return node;
}
function appCard(app) {
  const [label, tone] = appHealth(app);
  const card = el('article', `app-summary-card${tone === 'danger' ? ' app-card-attention' : ''}`);
  card.dataset.viewKey = `app:${app.id}`;
  const visual = el('div', 'app-summary-visual'); visual.append(iconFor(app), el('span', `app-kind ${tone}`, label));
  const title = el('h3', 'app-summary-title', app.name || app.id); title.title = app.name || app.id;
  card.append(visual, title);
  const targets = el('div', 'app-summary-targets');
  (app.targets || []).forEach(target => targets.append(targetSummary(target, app)));
  if (!(app.targets || []).length) targets.append(el('p', 'empty', '公開情報なし'));
  const more = el('button', 'app-more', '公開の詳細'); more.type = 'button'; more.dataset.viewKey = `app-more:${app.id}`;
  more.setAttribute('aria-haspopup', 'dialog'); more.setAttribute('aria-label', `${app.name || app.id}の公開の詳細`);
  more.addEventListener('click', () => { selectedApp = app.id; returnFocusKey = more.dataset.viewKey; fillDialog(app); dialog.showModal(); });
  card.append(targets, more); return card;
}
function groupSection(title, items) {
  const section = el('section', 'app-group');
  const head = el('div', 'app-group-head'); head.append(el('h3', '', title), el('span', 'muted', `${items.length}件`));
  const grid = el('div', 'app-grid'); items.forEach(app => grid.append(appCard(app)));
  section.append(head, grid); return section;
}
function render(apps) {
  currentApps = apps;
  const root = $('#applications'); root.replaceChildren();
  $('#app-summary').textContent = appSummary(apps);
  if (!apps.length) { root.append(el('p', 'card empty', '管理対象アプリを確認できませんでした')); return; }
  const games = apps.filter(app => app.kind !== 'tool'); const tools = apps.filter(app => app.kind === 'tool');
  if (games.length) root.append(groupSection('ゲーム / 専用開発版', games));
  if (tools.length) root.append(groupSection('開発ツール', tools));
  if (dialog.open) {
    const app = currentApps.find(item => item.id === selectedApp);
    if (app) fillDialog(app); else dialogContent.replaceChildren(el('p', 'empty', 'このアプリの最新情報は取得できませんでした。'));
  }
}
subscribe((state, error) => {
  if (state && !error) render(state.applications || []);
  else if (!state) $('#applications').replaceChildren(el('p', 'card empty', 'アプリ情報を取得できません。上部の取得状態を確認してください。'));
});
