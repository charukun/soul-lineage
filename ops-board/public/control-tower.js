import { subscribe } from './view-state.js';

const $ = selector => document.querySelector(selector);
const VIEW_KEY = 'rinne-ops:last-seen:v2';
const fmt = new Intl.DateTimeFormat('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const toneFor = status => ({ SYNCED: 'ok', PROCESSING: 'progress', RECOVERING: 'progress', NEEDS_USER: 'danger', UNKNOWN: 'warning' })[status] || 'info';
const stateLabel = status => ({ SYNCED: '同期済み', PROCESSING: '処理中', RECOVERING: '自動復旧中', NEEDS_USER: '確認必要', UNKNOWN: '確認中' })[status] || '確認中';

let previousSeen = null;
let latestSeen = null;
let replaySnapshots = [];
try { previousSeen = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null'); } catch { /* optional storage */ }

const el = (tag, className = '', text = null) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null && text !== undefined) node.textContent = String(text);
  return node;
};
const shortSha = value => value ? String(value).slice(0, 12) : '未記録';
const time = value => {
  if (!value) return '未記録';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '未記録' : fmt.format(date);
};
const elapsed = value => {
  const at = Date.parse(value || '');
  if (!Number.isFinite(at)) return '未記録';
  const minutes = Math.max(0, Math.floor((Date.now() - at) / 60000));
  if (minutes < 1) return '1分未満';
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours}時間${rest}分` : `${hours}時間`;
  return `${Math.floor(hours / 24)}日`;
};
const duration = ms => {
  if (!Number.isFinite(ms)) return '所要時間未記録';
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return '1分未満';
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}時間${rest}分` : `${hours}時間`;
};

function seenSnapshot(state) {
  const tower = state?.controlTower || {};
  return {
    fingerprint: tower.fingerprint || null,
    status: tower.status || 'UNKNOWN',
    sourceIdentity: tower.sourceIdentity || null,
    publishedIdentity: tower.publishedIdentity || null,
    counts: tower.counts || {},
    generatedAt: state?.generatedAt || null,
  };
}

function deltaText(current) {
  if (!previousSeen) return '今回の表示を基準として記録します';
  const changes = [];
  if (previousSeen.status && current.status && previousSeen.status !== current.status) changes.push(`${stateLabel(previousSeen.status)}→${stateLabel(current.status)}`);
  if (previousSeen.publishedIdentity && current.publishedIdentity && previousSeen.publishedIdentity !== current.publishedIdentity) changes.push('DEV公開更新');
  const fields = [['draft', '作業'], ['ready', '統合待ち'], ['userActions', '要確認']];
  for (const [key, label] of fields) {
    const before = Number(previousSeen.counts?.[key] || 0);
    const after = Number(current.counts?.[key] || 0);
    const diff = after - before;
    if (diff) changes.push(`${label}${diff > 0 ? '+' : ''}${diff}`);
  }
  return changes.length ? `前回閲覧から ${changes.join(' / ')}` : '前回閲覧から変化なし';
}

function compactFlow(flow = []) {
  const groups = [
    { id:'work', label:'作業', ids:['work','implementation'] },
    { id:'ready', label:'Ready', ids:['ready'] },
    { id:'integration', label:'統合', ids:['integration','develop'] },
    { id:'dev', label:'DEV', ids:['publication','dev'] },
  ];
  const rank = state => ({ active:4, current:4, progress:4, waiting:2, done:1 })[state] || 2;
  return groups.map(group => {
    const matched = flow.filter(step => group.ids.includes(step.id));
    if (!matched.length) return { ...group, state:'waiting', count:0 };
    const state = [...matched].sort((a,b) => rank(b.state) - rank(a.state))[0]?.state || 'waiting';
    const count = matched.reduce((sum, step) => sum + Number(step.count || 0), 0);
    const done = matched.every(step => step.state === 'done');
    return { ...group, state: done ? 'done' : state, count };
  });
}
function renderFlow(flow = []) {
  const root = $('#control-flow');
  if (!root) return;
  root.replaceChildren();
  for (const step of compactFlow(flow)) {
    const item = el('div', `control-flow-step ${step.state || 'waiting'}`);
    item.append(el('span', 'control-flow-dot'));
    const copy = el('span', 'control-flow-copy');
    copy.append(el('strong', '', step.label), el('small', '', step.count ? `${step.count}件` : step.state === 'done' ? '完了' : '待機'));
    item.append(copy);
    root.append(item);
  }
}

function renderImpacts(tower) {
  const root = $('#control-impact');
  if (!root) return;
  root.replaceChildren();
  const labels = tower?.impactLabels || [];
  if (!labels.length) {
    root.append(el('span', 'control-chip ok', '影響なし'));
    return;
  }
  labels.forEach(label => root.append(el('span', 'control-chip', label)));
  if (!(tower?.impacts || []).includes('production')) root.append(el('span', 'control-chip ok', 'Production影響なし'));
}

function renderTimeline(tower) {
  const root = $('#control-timeline');
  if (!root) return;
  root.replaceChildren();
  const items = [...(tower?.timeline || [])].reverse();
  if (!items.length) {
    root.append(el('p', 'empty', '状態遷移はまだありません'));
    return;
  }
  for (const item of items.slice(0, 8)) {
    const row = el('div', 'control-timeline-row');
    row.append(el('time', '', time(item.at)));
    const copy = el('div');
    copy.append(el('strong', '', item.headline || stateLabel(item.status)), el('span', '', item.cause || '状態更新'));
    row.append(copy);
    root.append(row);
  }
}

function renderSelfHealth(tower) {
  const root = $('#control-self-health');
  if (!root) return;
  root.replaceChildren();
  for (const item of tower?.selfHealth || []) {
    const row = el('div', 'control-health-row');
    row.append(el('span', `control-health-dot ${item.state || 'unknown'}`), el('span', '', item.label));
    if (item.detail) row.append(el('small', '', item.detail));
    root.append(row);
  }
}

function renderPublications(history = {}) {
  const root = $('#publication-history');
  const summary = $('#history-summary');
  if (!root) return;
  root.replaceChildren();
  const publications = [...(history.publications || [])].reverse();
  if (summary) summary.textContent = publications.length ? `${publications.length}回 / 最新 ${time(publications[0].publishedAt || publications[0].observedAt)}` : '履歴なし';
  if (!publications.length) {
    root.append(el('p', 'empty', '公開履歴はこれから蓄積されます'));
    return;
  }
  for (const item of publications) {
    const row = el('article', 'publication-history-row');
    const head = el('div', 'publication-history-head');
    head.append(el('strong', '', time(item.publishedAt || item.observedAt)), el('span', 'sha', shortSha(item.commit)));
    const meta = el('p', 'muted', `公開処理 ${duration(item.durationMs)}${Number.isInteger(item.reflectedPrCount) ? ` · 反映済みPR ${item.reflectedPrCount}件` : ''}`);
    row.append(head, meta);
    if (item.url) {
      const link = el('a', 'publication-history-link', 'この公開版を開く');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      row.append(link);
    }
    root.append(row);
  }
}

function replaySnapshot(index) {
  const item = replaySnapshots[index];
  const root = $('#history-replay');
  if (!root || !item) return;
  root.hidden = false;
  root.replaceChildren(
    el('p', 'diagnostic-kicker', 'SNAPSHOT REPLAY'),
    el('strong', '', `${time(item.at)} · ${stateLabel(item.status)}`),
    el('p', '', item.cause || '状態記録'),
    el('p', 'muted', `develop ${shortSha(item.sourceIdentity)} / DEV ${shortSha(item.publishedIdentity)} / 作業 ${item.counts?.draft || 0} / Ready ${item.counts?.ready || 0} / 要確認 ${item.counts?.userActions || 0}`),
  );
}

function renderSnapshots(history = {}) {
  const root = $('#control-history');
  if (!root) return;
  root.replaceChildren();
  replaySnapshots = [...(history.snapshots || [])].reverse();
  if (!replaySnapshots.length) {
    root.append(el('p', 'empty', '状態履歴はこれから蓄積されます'));
    return;
  }
  replaySnapshots.slice(0, 12).forEach((item, index) => {
    const button = el('button', 'control-history-row');
    button.type = 'button';
    button.dataset.replayIndex = String(index);
    button.append(el('span', '', time(item.at)), el('strong', '', stateLabel(item.status)), el('small', '', item.cause || '状態更新'));
    root.append(button);
  });
}

function retryLabel(state, tower) {
  const at = Date.parse(state?.nextRetryAt || '');
  if (Number.isFinite(at) && at > Date.now()) {
    const minutes = Math.max(1, Math.ceil((at - Date.now()) / 60000));
    return `自動再試行まで約${minutes}分`;
  }
  if (state?.syncStatus === 'degraded' || tower?.status === 'RECOVERING') return '自動で再試行します';
  return tower?.nextAction || '次の状態更新を待ちます';
}
function render(state, error) {
  const root = $('#control-tower');
  if (!root) return;
  const tower = state?.controlTower;
  const since = $('#control-since');

  if (!tower) {
    root.className = 'control-tower warning';
    $('#control-headline').textContent = '自動復旧中';
    $('#control-summary').textContent = '現在状態を取得できません。PULSEが自動で再試行しています。';
    if (since) since.hidden = true;
    $('#control-next').textContent = 'あなたの操作は不要です';
    $('#control-completeness').textContent = '状態未取得';
    $('#control-github-change').textContent = 'GitHub変化 未確認';
    $('#control-refreshed').textContent = 'PULSE反映 未確認';
    $('#control-delta').textContent = 'Last Known Goodがまだありません';
    renderFlow([]);
    renderImpacts(null);
    renderTimeline(null);
    renderSelfHealth(null);
    renderPublications({});
    renderSnapshots({});
    return;
  }

  const recovering = state?.syncStatus === 'degraded' && tower.status !== 'NEEDS_USER';
  const tone = error || recovering ? 'warning' : toneFor(tower.status);
  root.className = `control-tower ${tone}`;
  $('#control-headline').textContent = recovering ? '自動復旧中' : (tower.headline || '状態を確認中');
  $('#control-summary').textContent = error
    ? '最新取得に失敗しています。前回確定値を表示中です。'
    : recovering
      ? '最新状態を再取得しています。今は操作不要です。'
      : (tower.summary || '');
  if (since) {
    const known = elapsed(tower.enteredAt);
    since.hidden = known === '未記録';
    since.textContent = known === '未記録' ? '' : `この状態 ${known}`;
  }
  $('#control-next').textContent = retryLabel(state, tower);
  $('#control-completeness').textContent = tower.completeness?.label || '確認中';
  $('#control-github-change').textContent = tower.lastGitHubChangeAt ? `GitHub変化 ${elapsed(tower.lastGitHubChangeAt)}前` : 'GitHub変化 未記録';
  $('#control-refreshed').textContent = tower.lastRefreshedAt ? `PULSE反映 ${elapsed(tower.lastRefreshedAt)}前` : 'PULSE反映 未記録';

  const current = seenSnapshot(state);
  $('#control-delta').textContent = error ? `${deltaText(current)} / 最新取得は再試行中` : deltaText(current);
  latestSeen = current;
  try { localStorage.setItem(VIEW_KEY, JSON.stringify(current)); } catch { /* optional storage */ }

  renderFlow(tower.flow);
  renderImpacts(tower);
  renderTimeline(tower);
  renderSelfHealth(tower);
  renderPublications(state.history);
  renderSnapshots(state.history);
}

subscribe(render);

document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-replay-index]');
  if (!button) return;
  replaySnapshot(Number(button.dataset.replayIndex));
});

addEventListener('pagehide', () => {
  if (!latestSeen) return;
  try { localStorage.setItem(VIEW_KEY, JSON.stringify(latestSeen)); } catch { /* optional storage */ }
});
