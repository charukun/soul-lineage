const $ = selector => document.querySelector(selector);
const fmt = new Intl.DateTimeFormat('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
};

const badgeTone = state => ({ Draft: 'progress', Ready: 'warning', Merged: 'ok', Closed: 'info' })[state] || 'info';

function row(pr) {
  const link = el('a', `pull-row${pr.staleDraft ? ' stale-draft' : ''}`);
  link.href = pr.url;
  link.target = '_blank';
  link.rel = 'noreferrer';

  const top = el('div', 'pull-row-top');
  top.append(el('strong', 'pull-title', pr.title || `PR #${pr.number}`));
  top.append(el('span', `badge ${badgeTone(pr.state)}`, pr.state));

  const bottom = el('div', 'pull-row-bottom');
  bottom.append(el('span', 'pull-detail', pr.detail || '詳細未記載'));
  const meta = el('span', 'pull-meta');
  meta.append(el('span', 'pull-number', `#${pr.number}`));
  const updated = pr.updatedAt ? fmt.format(new Date(pr.updatedAt)) : '未記録';
  meta.append(el('span', '', `更新 ${updated}`));
  if (pr.staleDraft) meta.append(el('span', 'stale-note', '更新停滞'));
  bottom.append(meta);
  link.append(top, bottom);
  return link;
}

function rows(items, emptyText) {
  const root = el('div', 'pull-list');
  if (!items.length) root.append(el('p', 'empty', emptyText));
  else items.forEach(item => root.append(row(item)));
  return root;
}

function count(items, state) {
  return items.filter(item => item.state === state).length;
}

function completedSection(items) {
  const details = el('details', 'completed-pulls');
  details.append(el('summary', '', `完了済み ${items.length}件`), rows(items, '完了PRなし'));
  return details;
}

function render(data = {}) {
  const items = data.normal || [];
  const active = items.filter(item => item.state === 'Draft' || item.state === 'Ready');
  const completed = items.filter(item => item.state === 'Merged' || item.state === 'Closed');
  const root = $('#pulls');
  root.replaceChildren();

  const counts = el('div', 'pull-counts');
  for (const [state, tone] of [['Draft','progress'], ['Ready','warning'], ['Merged','ok'], ['Closed','info']]) {
    counts.append(el('span', `badge ${tone}`, `${state} ${count(items, state)}`));
  }
  root.append(counts, rows(active, '作業中 / Integration待ちPRなし'), completedSection(completed));
  if (data.truncated) root.append(el('p', 'empty', '直近100件を表示しています。'));

  const visualSection = $('#visual-review-section');
  const visualRoot = $('#visual-review-pulls');
  const visual = data.visualReview || [];
  visualRoot.replaceChildren(rows(visual, 'Visual Review Lab PRなし'));
  visualSection.hidden = visual.length === 0;
}

async function load() {
  try {
    const response = await fetch(`/api/state?pulls=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const state = await response.json();
    render(state.pullRequests || {});
  } catch (error) {
    const root = $('#pulls');
    root.replaceChildren(el('p', 'empty', `PR一覧取得失敗: ${error.message}`));
  }
}

$('#reload').addEventListener('click', load);
load();
setInterval(load, 60000);
