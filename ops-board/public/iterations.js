import { subscribe } from './view-state.js';
import { buildIterationRepairPrompt } from './issue-repair-prompt.js';
import { iterationOverview, iterationPresentation, iterationTimingSteps, iterationPhaseName, iterationGameName, iterationTitle } from './iteration-status.mjs';
import { renderIterationStatus, renderIterationChronology, ensureIterationStyles } from './iteration-summary.js';
import { progressStepDurationMs } from './progress-mini.js';

const $ = selector => document.querySelector(selector);
const el = (tag, className = '', text = null) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = String(text);
  return node;
};
const svgEl = (tag, attrs = {}) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
};
const clock = value => {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? new Intl.DateTimeFormat('ja-JP', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' }).format(ms) : '未記録';
};
const duration = ms => {
  if (!Number.isFinite(ms)) return '未計測';
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? seconds + '秒' : Math.floor(seconds / 60) + '分' + seconds % 60 + '秒';
};
function externalLink(text, url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return el('span', '', text);
    const link = el('a', '', text);
    link.href = parsed.href; link.target = '_blank'; link.rel = 'noreferrer';
    return link;
  } catch { return el('span', '', text); }
}
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
    const input = el('textarea', 'iteration-copy-fallback');
    input.value = text; document.body.append(input); input.select();
    const ok = Boolean(document.execCommand?.('copy')); input.remove(); return ok;
  } catch { return false; }
}
let currentState = null, currentError = null, gameFilter = 'all', statusFilter = 'all';
let order = new URLSearchParams(location.search).get('order') === 'oldest' ? 'oldest' : 'newest';
let lastRevealed = null;
function requestedId() {
  if (!location.hash.startsWith('#iteration=')) return null;
  try { return decodeURIComponent(location.hash.slice(11)); } catch { return null; }
}
function revealRequested() {
  const id = requestedId();
  if (!id || id === lastRevealed) return;
  const node = [...document.querySelectorAll('[data-iteration-id]')].find(item => item.dataset.iterationId === id);
  if (!node) return;
  node.classList.add('requested'); node.setAttribute('tabindex', '-1');
  node.scrollIntoView({ block:'start', behavior:'auto' }); node.focus({ preventScroll:true }); lastRevealed = id;
}
function createGraph(steps) {
  const wrap = el('div', 'iteration-chart-scroll');
  const svg = svgEl('svg', { class:'iteration-chart', viewBox:'0 0 760 210', role:'img', 'aria-label':'記録された工程ごとの所要時間。完了率ではありません。' });
  const values = steps.map(step => progressStepDurationMs(step));
  const measured = values.filter(Number.isFinite);
  const max = Math.max(10, ...measured.map(value => value / 1000));
  const left = 44, width = 694, top = 20, height = 148;
  for (const fraction of [0, .5, 1]) {
    const y = top + height - height * fraction;
    const label = svgEl('text', { x:left - 6, y:y + 3, 'text-anchor':'end' });
    label.textContent = Math.round(max * fraction) + '秒';
    svg.append(svgEl('line', { x1:left, y1:y, x2:left + width, y2:y, class:'grid' }), label);
  }
  let segment = [];
  const flush = () => {
    if (segment.length > 1) svg.append(svgEl('path', { class:'line', d:segment.map((p, n) => (n ? 'L' : 'M') + p.x + ' ' + p.y).join(' ') }));
    segment = [];
  };
  steps.forEach((step, index) => {
    const x = left + index * width / Math.max(1, steps.length - 1);
    const label = svgEl('text', { x, y:188, 'text-anchor':'middle' });
    label.textContent = step.label;
    svg.append(label);
    if (!Number.isFinite(values[index])) { flush(); return; }
    const y = top + height - values[index] / 1000 / max * height;
    segment.push({ x, y });
    svg.append(svgEl('circle', { cx:x, cy:y, r:4, class:'point' + (step.state === 'running' ? ' running' : '') }));
  });
  flush();
  if (!measured.length) {
    const label = svgEl('text', { x:380, y:95, 'text-anchor':'middle' });
    label.textContent = '所要時間の記録はありません'; svg.append(label);
  }
  wrap.append(svg); return wrap;
}
function timingPanel(item, state) {
  const panel = el('section', 'iteration-panel iteration-timeline-panel');
  panel.append(el('h3', '', '工程の流れと記録時刻'));
  panel.append(el('p', 'iteration-duration-help', '左から工程順 → 縦軸は所要時間です。下の記録は上から順に読めます。未計測は推測しません。'));
  const steps = iterationTimingSteps(item, state);
  panel.append(createGraph(steps));
  const list = el('ol', 'iteration-step-history');
  const labels = { done:'完了', skipped:'対象外', running:'実行中', problem:'問題の記録', pending:'未記録', waiting:'実行未確認' };
  for (const step of steps) {
    const node = el('li', 'iteration-step-entry ' + step.state);
    node.append(el('strong', '', iterationPhaseName(step)), el('span', 'iteration-step-duration', duration(progressStepDurationMs(step))), el('span', 'iteration-step-state', labels[step.state] || '未確認'));
    node.append(el('span', 'iteration-step-clock', '開始 ' + clock(step.startedAt) + ' → 終了 ' + clock(step.completedAt)));
    list.append(node);
  }
  panel.append(list); return panel;
}
function copyPanel(item, view) {
  const panel = el('section', 'iteration-panel iteration-copy');
  panel.append(el('h3', '', '改修内容'), el('p', '', item.improvementSummary || item.theme || '詳細な改修内容は未記録です。'));
  const addList = (title, values) => {
    if (!values?.length) return;
    panel.append(el('h3', '', title)); const list = el('ul');
    for (const value of values) list.append(el('li', '', typeof value === 'string' ? value : value.summary || value.key || value.id || '内容未記録'));
    panel.append(list);
  };
  addList('変更点', item.changes); addList('原因', item.rootCauses);
  if (item.changedPaths?.length) {
    panel.append(el('h3', '', '変更ファイル')); const paths = el('div', 'iteration-paths');
    item.changedPaths.forEach(path => paths.append(el('code', '', path))); panel.append(paths);
  }
  panel.append(el('h3', '', '改善効果の判定'), el('p', '', view.effect + (item.verdict ? '（' + item.verdict + '）' : '')));
  return panel;
}
function card(item, state) {
  const view = iterationPresentation(item, { syncStatus:state.syncStatus });
  const article = el('article', 'iteration-card ' + view.status);
  article.dataset.iterationId = item.id || 'pr:' + item.pr?.number;
  const head = el('div', 'iteration-card-head');
  const title = el('div'); const line = el('div', 'iteration-titleline');
  line.append(el('span', 'iteration-game', iterationGameName(item)), el('span', 'iteration-number', 'PR #' + (item.pr?.number || '?')));
  if (item.iteration) line.append(el('span', 'iteration-number', item.iteration + (item.iterations ? '/' + item.iterations : '') + '回目'));
  line.append(el('span', 'iteration-status-badge ' + view.tone, view.label));
  title.append(line, el('h2', '', iterationTitle(item))); head.append(title);
  article.append(head, renderIterationChronology(item), timingPanel(item, state), renderIterationStatus(item, state));
  article.append(copyPanel(item, view));
  const meta = el('div', 'iteration-meta');
  meta.append(el('span', '', '最終記録 ' + clock(item.updatedAt)), el('span', '', '記録形式 ' + (item.telemetry === 'recorded' ? '実行記録' : '旧形式からの推定')));
  if (item.runKey) meta.append(el('span', '', '実行ID ' + item.runKey));
  if (item.pr?.url) meta.append(externalLink('PR #' + item.pr.number + 'を確認 ↗', item.pr.url));
  if (item.publication?.url) meta.append(externalLink('DEV公開処理の結果 ↗', item.publication.url));
  if (item.execution?.url && !view.merged) meta.append(externalLink('実行の根拠 ↗', item.execution.url));
  if (item.validatedHead) meta.append(el('span', '', '検証版 ' + item.validatedHead.slice(0, 10)));
  if (item.mergeSha) meta.append(el('span', '', '反映版 ' + item.mergeSha.slice(0, 10)));
  if (item.repairAttempts) meta.append(el('span', 'iteration-retry', '再検証 ' + item.repairAttempts + '回'));
  if (view.status === 'problem') {
    const action = el('div', 'iteration-repair-action');
    const copy = el('button', 'iteration-repair-button', '修復プロンプトをコピー'); copy.type = 'button';
    const status = el('span', 'iteration-repair-status'); status.setAttribute('role', 'status');
    copy.addEventListener('click', async () => { status.textContent = await copyText(buildIterationRepairPrompt(item, state)) ? 'コピー済み。新しいChatへ貼り付けできます' : 'コピーできませんでした'; });
    if (item.lastFailure?.url) action.append(externalLink('失敗した処理を確認 ↗', item.lastFailure.url));
    action.append(copy, status); article.append(action);
  }
  article.append(meta); return article;
}
function render() {
  const root = $('#iteration-list');
  if (!currentState) { root.replaceChildren(el('div', 'iteration-empty', currentError ? '状態を取得できません。再読込してください。' : '改善記録を取得しています')); return; }
  const state = currentError ? { ...currentState, syncStatus:'degraded' } : currentState;
  const { entries, counts } = iterationOverview(state, { order });
  for (const key of ['running', 'waiting', 'problem', 'complete']) { const node = $('#iteration-' + key + '-count'); if (node) node.textContent = counts[key]; }
  $('#iteration-session-count').textContent = new Set(entries.map(({ item }) => item.runKey).filter(Boolean)).size;
  $('#iteration-updated-at').textContent = clock(state.generatedAt);
  $('#iteration-sync-state').textContent = state.syncStatus === 'ok' ? '取得できた直近の改善記録を開始記録順に表示しています。日時未記録は末尾。取込済みはdevelopへの反映完了です。DEV公開・効果判定は別表示です。' : '最新状態は未確認です。保存された記録を表示しています。';
  const rows = entries.filter(({ item, view }) => (gameFilter === 'all' || item.game === gameFilter)
    && (statusFilter === 'all' || statusFilter === 'active' && view.status !== 'complete' || view.status === statusFilter));
  root.replaceChildren();
  if (!rows.length) root.append(el('div', 'iteration-empty', 'この条件に一致する改善記録はありません'));
  rows.forEach(({ item }) => root.append(card(item, state)));
  requestAnimationFrame(revealRequested);
}
ensureIterationStyles();
$('#iteration-order').value = order;
$('#iteration-order')?.addEventListener('change', event => { order = event.target.value === 'oldest' ? 'oldest' : 'newest'; render(); });
$('#iteration-game-filter')?.addEventListener('change', event => { gameFilter = event.target.value; render(); });
$('#iteration-status-filter')?.addEventListener('change', event => { statusFilter = event.target.value; render(); });
window.addEventListener('hashchange', () => { lastRevealed = null; gameFilter = statusFilter = 'all'; $('#iteration-game-filter').value = $('#iteration-status-filter').value = 'all'; render(); });
subscribe((state, error) => { if (state) currentState = state; currentError = error || null; render(); });
