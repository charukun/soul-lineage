const $ = selector => document.querySelector(selector);
const fmt = new Intl.DateTimeFormat('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const REPOSITORY = 'charukun/soul-lineage';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
};

const badgeTone = state => ({ Draft: 'progress', Ready: 'warning', Merged: 'ok', Closed: 'info' })[state] || 'info';
const stateLabel = state => ({ Draft: '作業中', Ready: '統合待ち', Merged: '統合済み', Closed: '終了' })[state] || state;
const filterOptions = [
  ['all', 'すべて', 'info'],
  ['Draft', '作業中', 'progress'],
  ['Ready', '統合待ち', 'warning'],
  ['Merged', '統合済み', 'ok'],
  ['Closed', '終了', 'info'],
];
const targetRules = [
  ['rinne', '輪廻転焦', path => path.startsWith('apps/rinne/')],
  ['village', '村づくり', path => path.startsWith('apps/village/')],
  ['demon', '魔物側', path => path.startsWith('apps/demon/')],
  ['visual-review', 'Visual Review', path => /visual[-_]review/i.test(path)],
  ['ops-board', '開発状況', path => path.startsWith('ops-board/') || path === 'wrangler.ops.jsonc' || path === 'docs/OPS_BOARD.md' || /^tests\/ops-/.test(path) || path === '.github/workflows/ops-board.yml'],
  ['shared', '共通基盤', path => /^(packages|assets|templates)\//.test(path)],
  ['devops', '開発基盤', path => /^(\.github|scripts|tests|docs)\//.test(path)],
];

let selectedFilter = 'all';
let currentPullData = null;

function classifyTargets(files = []) {
  const found = new Map();
  for (const raw of files) {
    const path = String(raw || '');
    const rule = targetRules.find(([, , test]) => test(path));
    if (rule) found.set(rule[0], { id: rule[0], label: rule[1] });
  }
  if (!found.size && files.length) found.set('repository', { id: 'repository', label: 'Repository共通' });
  return [...found.values()];
}

function cacheKey(pr) {
  return `rinne-ops:targets:${pr.number}:${pr.updatedAt || 'unknown'}`;
}

function readCachedTargets(pr) {
  try {
    const value = localStorage.getItem(cacheKey(pr));
    return value ? JSON.parse(value) : null;
  } catch { return null; }
}

function writeCachedTargets(pr, targets) {
  try { localStorage.setItem(cacheKey(pr), JSON.stringify(targets)); } catch { /* storage unavailable */ }
}

async function changedFiles(number) {
  const files = [];
  for (let page = 1; page <= 5; page++) {
    const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/pulls/${number}/files?per_page=100&page=${page}`, {
      headers: { accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error(`GitHub ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('GitHub files response');
    files.push(...data.map(item => item.filename).filter(Boolean));
    if (data.length < 100) break;
  }
  return files;
}

function renderTargetChips(root, targets = [], loading = false) {
  root.replaceChildren();
  if (loading) {
    root.append(el('span', 'pull-target muted-target', '対象確認中'));
    return;
  }
  if (!targets.length) {
    root.append(el('span', 'pull-target muted-target', '対象未取得'));
    return;
  }
  targets.slice(0, 2).forEach(target => root.append(el('span', 'pull-target', target.label)));
  if (targets.length > 2) root.append(el('span', 'pull-target more-target', `+${targets.length - 2}`));
}

async function resolveTargets(pr, root) {
  if (Array.isArray(pr.targets) && pr.targets.length) {
    renderTargetChips(root, pr.targets);
    return;
  }
  const cached = readCachedTargets(pr);
  if (Array.isArray(cached)) {
    renderTargetChips(root, cached);
    return;
  }
  renderTargetChips(root, [], true);
  try {
    const targets = classifyTargets(await changedFiles(pr.number));
    writeCachedTargets(pr, targets);
    renderTargetChips(root, targets);
  } catch {
    renderTargetChips(root, []);
  }
}

function row(pr, resolveAppTargets = false) {
  const link = el('a', `pull-row${pr.staleDraft ? ' stale-draft' : ''}`);
  link.href = pr.url;
  link.target = '_blank';
  link.rel = 'noreferrer';

  const top = el('div', 'pull-row-top');
  top.append(el('strong', 'pull-title', pr.title || `PR #${pr.number}`));
  const status = el('span', `badge ${badgeTone(pr.state)}`, stateLabel(pr.state));
  status.title = pr.state;
  top.append(status);

  const bottom = el('div', 'pull-row-bottom');
  bottom.append(el('span', 'pull-detail', pr.detail || '詳細未記載'));
  const meta = el('span', 'pull-meta');
  const targetRoot = el('span', 'pull-targets');
  if (resolveAppTargets) resolveTargets(pr, targetRoot);
  else if (Array.isArray(pr.targets) && pr.targets.length) renderTargetChips(targetRoot, pr.targets);
  if (targetRoot.childNodes.length || resolveAppTargets) meta.append(targetRoot);
  meta.append(el('span', 'pull-number', `#${pr.number}`));
  const updated = pr.updatedAt ? fmt.format(new Date(pr.updatedAt)) : '未記録';
  meta.append(el('span', '', `更新 ${updated}`));
  if (pr.staleDraft) meta.append(el('span', 'stale-note', 'しばらく更新なし'));
  bottom.append(meta);
  link.append(top, bottom);
  return link;
}

function rows(items, emptyText, resolveAppTargets = false) {
  const root = el('div', 'pull-list');
  if (!items.length) root.append(el('p', 'empty', emptyText));
  else items.forEach(item => root.append(row(item, resolveAppTargets)));
  return root;
}

function count(items, state) {
  return state === 'all' ? items.length : items.filter(item => item.state === state).length;
}

function filterBar(items) {
  const root = el('div', 'pull-filters');
  root.setAttribute('aria-label', '開発タスクの状態フィルタ');
  for (const [state, label, tone] of filterOptions) {
    const button = el('button', `pull-filter ${tone}${selectedFilter === state ? ' active' : ''}`, `${label} ${count(items, state)}`);
    button.type = 'button';
    button.dataset.state = state;
    button.setAttribute('aria-pressed', selectedFilter === state ? 'true' : 'false');
    button.addEventListener('click', () => {
      if (selectedFilter === state) return;
      selectedFilter = state;
      render(currentPullData || {});
    });
    root.append(button);
  }
  return root;
}

function completedSection(items) {
  const details = el('details', 'completed-pulls');
  details.append(el('summary', '', `完了・終了 ${items.length}件`), rows(items, '完了PRなし'));
  return details;
}

function render(data = {}) {
  currentPullData = data;
  const items = data.normal || [];
  const active = items.filter(item => item.state === 'Draft' || item.state === 'Ready');
  const completed = items.filter(item => item.state === 'Merged' || item.state === 'Closed');
  const root = $('#pulls');
  root.replaceChildren();
  root.append(filterBar(items));

  if (selectedFilter === 'all') {
    root.append(rows(active, '現在、作業中・統合待ちのPRはありません', true), completedSection(completed));
  } else {
    const filtered = items.filter(item => item.state === selectedFilter);
    root.append(rows(filtered, `${stateLabel(selectedFilter)}のPRはありません`, true));
  }

  if (data.truncated) root.append(el('p', 'empty', '直近100件を表示しています。'));

  const visualSection = $('#visual-review-section');
  const visualRoot = $('#visual-review-pulls');
  const visual = data.visualReview || [];
  visualRoot.replaceChildren(rows(visual, 'Visual Review Lab PRなし', true));
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
    root.replaceChildren(el('p', 'empty', `PR一覧を取得できません: ${error.message}`));
  }
}

$('#reload').addEventListener('click', load);
load();
setInterval(load, 60000);
