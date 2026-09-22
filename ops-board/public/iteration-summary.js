import { iterationOverview, iterationPresentation, iterationGameName, iterationTitle, iterationTimingSteps } from './iteration-status.mjs';
import { renderProgressMini } from './progress-mini.js';
const expanded = new Set();
const el = (tag, className = '', text = null) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = String(text);
  return node;
};
export function ensureIterationStyles() {
  if (document.querySelector('[data-iteration-readable-style]')) return;
  const link = el('link');
  link.rel = 'stylesheet';
  link.href = new URL('./iteration-summary.css', import.meta.url).href;
  link.setAttribute('data-iteration-readable-style', '');
  document.head.append(link);
}
export const iterationDetailHref = item => './iterations.html#iteration=' + encodeURIComponent(item.id || 'pr:' + item.pr?.number);
const clock = value => {
  const stamp = Date.parse(value || '');
  return Number.isFinite(stamp) ? new Intl.DateTimeFormat('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(stamp) : '時刻未記録';
};
export function renderIterationStatus(item, state = {}, { badge = true } = {}) {
  ensureIterationStyles();
  const view = iterationPresentation(item, { syncStatus: state.syncStatus || 'unknown' });
  const root = el('div', 'iteration-readable-status');
  if (badge) root.append(el('span', 'iteration-status-badge ' + view.tone, view.label));
  root.append(el('strong', 'iteration-status-headline', view.headline));
  root.append(el('p', 'iteration-status-reason', view.reason));
  root.append(el('p', 'iteration-status-next', '次：' + view.next));
  const outcome = el('div', 'iteration-outcome');
  outcome.append(el('span', view.publicationProblem ? 'iteration-publication-problem' : '', view.publicationText));
  if (view.merged || item.verdict) outcome.append(el('span', '', view.effect));
  root.append(outcome);
  return root;
}
export function renderIterationCard(item, state = {}) {
  const view = iterationPresentation(item, { syncStatus: state.syncStatus || 'unknown' });
  const card = el('article', 'iteration-summary-card ' + view.tone);
  card.dataset.iterationId = item.id || 'pr:' + item.pr?.number;
  const link = el('a', 'iteration-summary-main');
  link.href = iterationDetailHref(item);
  link.setAttribute('aria-label', iterationTitle(item) + '：' + view.label + '。詳細を開く');
  const header = el('div', 'iteration-summary-heading');
  header.append(el('span', 'iteration-summary-game', iterationGameName(item)));
  header.append(el('span', 'iteration-status-badge ' + view.tone, view.label));
  link.append(header, el('h3', 'iteration-summary-title', iterationTitle(item)));
  if (item.improvementSummary && item.improvementSummary !== item.theme) link.append(el('p', 'iteration-summary-change', item.improvementSummary));
  link.append(renderIterationStatus(item, state, { badge: false }));
  const identity = ['PR #' + (item.pr?.number || '?')];
  if (item.iteration) identity.push(item.iteration + (item.iterations ? '/' + item.iterations : '') + '回目');
  identity.push('最終記録 ' + clock(item.updatedAt));
  link.append(el('p', 'iteration-summary-meta', identity.join(' · ')), el('span', 'iteration-summary-open', '内容・根拠・対応を確認 →'));
  card.append(link);
  const details = el('details', 'iteration-duration-details');
  const key = card.dataset.iterationId;
  details.open = expanded.has(key);
  details.addEventListener('toggle', () => { if (details.open) expanded.add(key); else expanded.delete(key); });
  details.append(el('summary', '', '工程と所要時間を見る'));
  details.append(el('p', 'iteration-duration-help', '縦軸は所要時間です。完了率や品質ではありません。実行未確認の工程は時計を進めません。'));
  const ids = new Set(['observation', 'implementation', 'afterObservation', 'astraValidation', 'merge', 'devPublish']);
  const labels = { observation: '事前確認', implementation: '修正', afterObservation: '改善確認', astraValidation: '最終検証', merge: '反映', devPublish: '公開' };
  const phases = iterationTimingSteps(item, state).filter(step => ids.has(step.id)).map(step => ({ ...step, label: labels[step.id] }));
  const graph = renderProgressMini(phases, { className: 'iteration', ariaLabel: '記録された工程の所要時間' });
  if (graph) details.append(graph);
  card.append(details);
  return card;
}
export function renderIterationSummary(state = {}) {
  const root = document.querySelector('#rapid-iteration-list');
  const count = document.querySelector('#rapid-iteration-count');
  if (!root || !count) return;
  ensureIterationStyles();
  const { entries, counts } = iterationOverview(state);
  count.className = 'iteration-total';
  count.textContent = '記録 ' + entries.length + '件';
  root.replaceChildren();
  if (!entries.length) {
    root.append(el('p', 'rapid-empty', '取得できた範囲に自律改善の記録はありません。'));
    return;
  }
  const totals = el('div', 'iteration-status-counts');
  totals.setAttribute('aria-label', '取得した改善記録の内訳');
  for (const [key, label] of [['running', '実行中'], ['waiting', '待機・未確認'], ['problem', '要対応'], ['complete', '取込済み']]) {
    const cell = el('span', 'iteration-count-item ' + key);
    cell.append(el('strong', '', counts[key]), el('span', '', label));
    totals.append(cell);
  }
  root.append(totals);
  const note = '取込済み＝developへの反映完了。DEV公開・効果判定は別表示。';
  root.append(el('p', 'iteration-summary-note', note + (counts.publicationProblem ? ' 公開処理に問題 ' + counts.publicationProblem + '件。' : '')));
  if (state.syncStatus !== 'ok') root.append(el('p', 'iteration-sync-warning', '最新状態を確認できていません。保存された記録です。'));
  root.append(el('p', 'iteration-summary-meta', '照合 ' + clock(state.generatedAt) + ' · 取得できた直近の記録'));
  entries.slice(0, 3).forEach(({ item }) => root.append(renderIterationCard(item, state)));
  if (entries.length > 3) {
    const more = el('a', 'iteration-all-link', 'ほか ' + (entries.length - 3) + '件も見る（全' + entries.length + '件） →');
    more.href = './iterations.html';
    root.append(more);
  }
}
