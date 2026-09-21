import { subscribe } from './view-state.js';
import { ageLabel, FAILED_CONCLUSIONS } from './health.mjs';
import { eventDrivenAlerts } from './freshness.mjs';

const $ = selector => document.querySelector(selector);
const el = (tag, className = '', text = null) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null && text !== undefined) node.textContent = String(text);
  return node;
};
const safeHref = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};
const parsedAt = value => {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : 0;
};
const clock = value => {
  const ms = parsedAt(value);
  if (!ms) return '未記録';
  return new Intl.DateTimeFormat('ja-JP', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }).format(ms);
};
const relative = value => {
  const ms = parsedAt(value);
  return ms ? ageLabel(Math.max(0, Date.now() - ms)) : '更新時刻未記録';
};
const stateView = state => ({
  success: ['LIVE', 'ok', 'DEV公開済み'],
  deploying: ['DEPLOYING', 'progress', 'DEV更新中'],
  waiting: ['QUEUED', 'warning', 'DEV公開待ち'],
  failed: ['ISSUE', 'danger', 'DEV公開で問題'],
  missing: ['NO DEV', 'info', 'DEV未公開'],
  unknown: ['CHECK', 'info', 'DEV確認中'],
})[state] || ['CHECK', 'info', 'DEV確認中'];
const taskView = state => state === 'Ready' ? ['READY', 'warning'] : ['WORKING', 'progress'];

function primaryTarget(app) {
  const targets = app?.targets || [];
  return targets.find(target => target.environment === 'dev-fast')
    || targets.find(target => target.environment === 'dev')
    || targets[0]
    || null;
}
function managedApps(state) {
  return (state?.applications || []).filter(app => ['game','tool','reference','control'].includes(app.kind));
}
function activePulls(state) {
  return (state?.pullRequests?.normal || []).filter(pr => pr.state === 'Draft' || pr.state === 'Ready');
}
function relatedPulls(state, appId) {
  return (state?.pullRequests?.normal || [])
    .filter(pr => (pr.targets || []).some(target => target.id === appId))
    .sort((a, b) => parsedAt(b.updatedAt) - parsedAt(a.updatedAt))
    .slice(0, 3);
}
function externalLink(text, href, className = '') {
  const safe = safeHref(href);
  const node = el(safe ? 'a' : 'span', className, text);
  if (safe) {
    node.href = safe;
    node.target = '_blank';
    node.rel = 'noreferrer';
  }
  return node;
}

function renderActive(state) {
  const root = $('#rapid-active-list');
  const count = $('#rapid-active-count');
  if (!root || !count) return;
  const pulls = activePulls(state);
  count.textContent = pulls.length ? String(pulls.length) + '件' : '0件';
  root.replaceChildren();
  if (!pulls.length) {
    root.append(el('p', 'rapid-empty rapid-empty-ok', '現在の作業中タスクはありません'));
    return;
  }
  for (const pr of pulls.slice(0, 2)) {
    const href = safeHref(pr.url);
    const row = el(href ? 'a' : 'article', 'rapid-task-row');
    if (href) {
      row.href = href;
      row.target = '_blank';
      row.rel = 'noreferrer';
    }
    const copy = el('span', 'rapid-task-copy');
    const title = el('strong', '', pr.title || 'PR #' + pr.number);
    const target = (pr.targets || []).slice(0, 2).map(item => item.label).join(' / ') || '対象確認中';
    const detail = el('span', '', target + ' · ' + (pr.detail || '作業内容を確認中'));
    copy.append(title, detail);
    const meta = el('span', 'rapid-task-meta');
    const view = taskView(pr.state);
    meta.append(el('span', 'rapid-state ' + view[1], view[0]), el('time', '', relative(pr.updatedAt)));
    row.append(copy, meta);
    root.append(row);
  }
  if (pulls.length > 2) root.append(el('p', 'rapid-more-note', 'ほか ' + (pulls.length - 2) + '件'));
}

function appHistory(state, app) {
  const details = el('details', 'rapid-app-history');
  const pulls = relatedPulls(state, app.id);
  const summary = el('summary', '', pulls.length ? '変更履歴 ' + pulls.length : '変更履歴');
  details.append(summary);
  const list = el('div', 'rapid-app-history-list');
  if (!pulls.length) list.append(el('p', 'rapid-empty', '対象アプリとして記録された直近PRはありません'));
  for (const pr of pulls) {
    const href = safeHref(pr.url);
    const row = el(href ? 'a' : 'div', 'rapid-app-history-row');
    if (href) {
      row.href = href;
      row.target = '_blank';
      row.rel = 'noreferrer';
    }
    row.append(el('strong', '', '#' + pr.number + ' ' + (pr.title || '')), el('span', '', pr.state + ' · ' + clock(pr.updatedAt)));
    list.append(row);
  }
  details.append(list);
  return details;
}
function renderApps(state) {
  const root = $('#rapid-app-list');
  const count = $('#rapid-app-count');
  if (!root || !count) return;
  const appRows = managedApps(state);
  count.textContent = appRows.length ? String(appRows.length) + ' Apps' : '0 Apps';
  root.replaceChildren();
  if (!appRows.length) {
    root.append(el('p', 'rapid-empty', '管理対象アプリを取得できていません'));
    return;
  }
  for (const app of appRows) {
    const target = primaryTarget(app);
    const view = stateView(target?.state);
    const label = view[0];
    const tone = view[1];
    const detail = view[2];
    const card = el('article', 'rapid-app-card ' + tone);
    const head = el('div', 'rapid-app-head');
    head.append(el('strong', '', app.name || app.id), el('span', 'rapid-state ' + tone, label));
    const published = target?.state === 'success'
      ? detail + ' · ' + clock(target.deployedAt)
      : detail + ' · ' + relative(target?.deployedAt);
    card.append(head, el('p', 'rapid-app-meta', published));
    const actions = el('div', 'rapid-app-actions');
    const open = externalLink('DEVを開く ↗', target?.url, 'rapid-app-open');
    actions.append(open);
    actions.append(el('span', 'rapid-app-target', target?.label || 'DEV'));
    card.append(actions, appHistory(state, app));
    root.append(card);
  }
}

function collectIssues(state, error) {
  const items = eventDrivenAlerts(state, Date.now(), error).map(item => ({ ...item }));
  for (const app of managedApps(state)) {
    const target = primaryTarget(app);
    if (!target || target.state !== 'failed') continue;
    items.push({
      type: 'app-dev-failed',
      appId: app.id,
      tone: 'danger',
      title: (app.name || app.id) + ' のDEV公開に問題',
      detail: target.note || '公開処理の状態を確認してください',
      url: target.url || null,
    });
  }
  for (const run of state?.recentActionFailures || []) {
    if (!FAILED_CONCLUSIONS.has(run.conclusion)) continue;
    if (items.some(item => item.url && item.url === run.url)) continue;
    items.push({
      type: 'action-failed',
      tone: 'danger',
      title: (run.workflow || 'GitHub Actions') + ' が失敗',
      detail: run.branch ? run.branch + ' · ' + run.conclusion : run.conclusion,
      url: run.url || null,
      since: run.updatedAt || run.createdAt,
    });
  }
  return items;
}
function renderIssues(state, error) {
  const root = $('#rapid-issue-list');
  const count = $('#rapid-issue-count');
  if (!root || !count) return [];
  const issues = collectIssues(state, error);
  count.textContent = issues.length ? String(issues.length) + '件' : '0件';
  root.replaceChildren();
  if (!issues.length) {
    const clear = el('div', 'rapid-clear');
    clear.append(el('strong', '', 'No Issues'), el('span', '', '異常は検出されていません'));
    root.append(clear);
    return issues;
  }
  for (const item of issues.slice(0, 2)) {
    const href = safeHref(item.url);
    const row = el(href ? 'a' : 'article', 'rapid-issue-row ' + (item.tone || 'warning'));
    if (href) {
      row.href = href;
      row.target = '_blank';
      row.rel = 'noreferrer';
    }
    row.append(el('strong', '', item.title || '確認が必要です'));
    const detail = [item.detail, item.since ? relative(item.since) : null].filter(Boolean).join(' · ');
    if (detail) row.append(el('span', '', detail));
    root.append(row);
  }
  if (issues.length > 2) root.append(el('p', 'rapid-more-note', 'ほか ' + (issues.length - 2) + '件'));
  return issues;
}

function collectRecent(state) {
  const events = [];
  for (const item of state?.history?.publications || []) {
    events.push({
      key: 'pub:' + item.commit + ':' + (item.publishedAt || item.observedAt),
      at: item.publishedAt || item.observedAt,
      label: 'DEV公開',
      detail: item.commit ? String(item.commit).slice(0, 8) : '公開版',
      url: item.url || null,
    });
  }
  for (const pr of state?.pullRequests?.normal || []) {
    if (pr.state !== 'Merged') continue;
    events.push({
      key: 'merge:' + pr.number,
      at: pr.updatedAt,
      label: 'develop merge',
      detail: '#' + pr.number + ' ' + (pr.title || ''),
      url: pr.url || null,
    });
  }
  for (const item of state?.controlTower?.timeline || []) {
    events.push({
      key: 'timeline:' + item.at + ':' + (item.headline || item.status),
      at: item.at,
      label: item.headline || '状態更新',
      detail: item.cause || 'PULSE更新',
      url: null,
    });
  }
  const seen = new Set();
  return events
    .filter(item => parsedAt(item.at))
    .sort((a, b) => parsedAt(b.at) - parsedAt(a.at))
    .filter(item => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    })
    .slice(0, 3);
}
const sessionStepView=state=>({
  done:['完了','ok'],running:['進行','progress'],problem:['問題','danger'],waiting:['待ち','warning'],skipped:['対象外','muted']
})[state]||['確認','muted'];

function renderSession(session) {
  const row=el('article','rapid-session-row '+(session.status||'active'));
  const head=el('div','rapid-session-head');
  const prHref=safeHref(session.pr?.url);
  const title=el(prHref?'a':'strong','rapid-session-title','#'+(session.pr?.number||'?')+' '+(session.title||'開発セッション'));
  if(prHref){title.href=prHref;title.target='_blank';title.rel='noreferrer';}
  const target=(session.targets||[]).map(item=>item.label).join(' / ')||'対象確認中';
  head.append(title,el('time','',relative(session.updatedAt)));
  const meta=el('div','rapid-session-meta');
  meta.append(el('span','',target));
  if(session.validatedExactHead)meta.append(el('code','',String(session.validatedExactHead).slice(0,8)));
  if(session.repairAttempts)meta.append(el('span','rapid-session-repair','repair '+session.repairAttempts));
  const flow=el('div','rapid-session-flow');
  for(const phase of session.steps||[]){
    const view=sessionStepView(phase.state),href=safeHref(phase.url);
    const node=el(href?'a':'span','rapid-session-step '+view[1]);
    if(href){node.href=href;node.target='_blank';node.rel='noreferrer';}
    node.title=phase.label+': '+view[0];
    node.append(el('i',''),el('b','',phase.label));
    flow.append(node);
  }
  row.append(head,meta,flow);
  return row;
}

function renderRecent(state) {
  const root = $('#rapid-recent-list');
  const count = $('#rapid-recent-count');
  if (!root || !count) return;
  const sessions=(state?.developmentSessions||[]).slice(0,3);
  root.replaceChildren();
  if(sessions.length){
    count.textContent='最新'+sessions.length+'件';
    sessions.forEach(session=>root.append(renderSession(session)));
    return;
  }
  const events = collectRecent(state);
  count.textContent = events.length ? '最新' + events.length + '件' : '0件';
  if (!events.length) {
    root.append(el('p', 'rapid-empty', '直近イベントはまだありません'));
    return;
  }
  for (const item of events) {
    const href = safeHref(item.url);
    const row = el(href ? 'a' : 'div', 'rapid-recent-row');
    if (href) {
      row.href = href;
      row.target = '_blank';
      row.rel = 'noreferrer';
    }
    row.append(el('time', '', clock(item.at)));
    const copy = el('span', 'rapid-recent-copy');
    copy.append(el('strong', '', item.label), el('span', '', item.detail));
    row.append(copy);
    root.append(row);
  }
}
function renderHealth(state, issues) {
  const root = $('#rapid-health');
  const title = $('#rapid-health-title');
  const meta = $('#rapid-health-meta');
  if (!root || !title || !meta) return;
  const appRows = managedApps(state);
  const healthy = appRows.filter(app => primaryTarget(app)?.state === 'success').length;
  const active = activePulls(state).length;
  const issueCount = issues.length;
  const danger = issues.some(item => item.tone === 'danger');
  const tone = issueCount ? (danger ? 'danger' : 'warning') : state?.syncStatus === 'degraded' ? 'warning' : 'ok';
  root.className = 'rapid-health ' + tone;
  title.textContent = appRows.length ? healthy + ' Apps Healthy' : 'Apps 確認中';
  meta.textContent = active + ' Task' + (active === 1 ? '' : 's') + ' Running · ' + (issueCount ? issueCount + ' Issues' : 'No Issues');
}
function render(state, error) {
  if (!state) {
    if (error) {
      $('#rapid-health').className = 'rapid-health warning';
      $('#rapid-health-title').textContent = '再同期中';
      $('#rapid-health-meta').textContent = '直近の確定情報を復元しています';
    }
    return;
  }
  renderActive(state);
  renderApps(state);
  const issues = renderIssues(state, error);
  renderRecent(state);
  renderHealth(state, issues);
}

subscribe(render);
