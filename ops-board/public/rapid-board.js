import { subscribe } from './view-state.js';
import { ageLabel, FAILED_CONCLUSIONS } from './health.mjs';
import { eventDrivenAlerts } from './freshness.mjs';
import { buildIssueRepairPrompt } from './issue-repair-prompt.js';
import { renderProgressMini, tickProgressDurations } from './progress-mini.js';
import { renderIterationSummary } from './iteration-summary.js';

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
  return new Intl.DateTimeFormat('ja-JP', { timeZone:'Asia/Tokyo', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }).format(ms) + ' JST';
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
const executionView=execution=>execution&&execution.label
  ? [execution.label,execution.tone||'muted',execution.detail||'']
  : ['UNKNOWN','muted','実行状態未記録'];

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
function activeSessions(state) {
  const rank=status=>({problem:0,running:1,active:2,publishing:3,complete:4})[status]??5;
  return (state?.developmentSessions || [])
    .filter(session => session.state === 'Draft' || session.state === 'Ready')
    .sort((a,b)=>rank(a.status)-rank(b.status)||parsedAt(b.updatedAt)-parsedAt(a.updatedAt));
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

async function copyText(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const area=el('textarea','rapid-copy-fallback');
    area.value=text;
    area.setAttribute('aria-hidden','true');
    document.body.append(area);
    area.focus();
    area.select();
    const copied=Boolean(document.execCommand?.('copy'));
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

const shortSha=value=>value?String(value).slice(0,8):'未記録';
const activityAgeTone=value=>{
  const ms=parsedAt(value);
  if(!ms)return 'stale';
  const age=Math.max(0,Date.now()-ms);
  if(age<=5*60*1000)return 'fresh';
  if(age<=15*60*1000)return 'blue';
  if(age<=30*60*1000)return 'yellow';
  return 'stale';
};
const sessionWorkflowView=session=>{
  const validation=(session.steps||[]).find(step=>step.id==='validation');
  if(validation?.state==='problem'||session.lastFailure)return ['FAILED','danger'];
  if(validation?.state==='running'||session.execution?.state==='validating')return ['VALIDATING','progress'];
  if(session.execution?.state==='running')return ['WORKFLOW RUNNING','progress'];
  if(validation?.state==='done')return ['SUCCESS','ok'];
  if(session.execution?.state==='merging')return ['MERGE WAIT','warning'];
  return [session.execution?.label||'IDLE',session.execution?.tone||'muted'];
};
const sessionNextWait=session=>{
  if(session.execution?.state==='needs-user')return '次: 人の判断・権限対応待ち';
  if(session.execution?.state==='repair'||session.lastFailure)return '次: 自動修復・再検証待ち';
  if(['validating','running'].includes(session.execution?.state))return '次: workflow完了待ち';
  if(session.state==='Ready')return '次: merge待ち';
  const waiting=(session.steps||[]).find(step=>step.state==='waiting');
  if(waiting)return '次: '+waiting.label+'待ち';
  return '次: 実装更新 / Ready化待ち';
};
const sessionTimeline=session=>{
  const events=[];
  if(session.headSha&&session.updatedAt)events.push({at:session.updatedAt,label:'commit',detail:shortSha(session.headSha),tone:'info'});
  for(const step of session.steps||[]){
    if(!step.runId)continue;
    if(step.startedAt)events.push({at:step.startedAt,label:'workflow start',detail:step.label,tone:'progress'});
    if(step.completedAt&&step.state==='done')events.push({at:step.completedAt,label:'workflow success',detail:step.label,tone:'ok'});
    if(step.completedAt&&step.state==='problem')events.push({at:step.completedAt,label:'workflow failed',detail:step.label,tone:'danger'});
  }
  if(session.state==='Ready'&&session.updatedAt)events.push({at:session.updatedAt,label:'Ready',detail:'#'+(session.pr?.number||'?'),tone:'warning'});
  if(session.state==='Merged'&&session.mergedAt)events.push({at:session.mergedAt,label:'merge',detail:'develop',tone:'ok'});
  const seen=new Set();
  return events.filter(item=>parsedAt(item.at)).sort((a,b)=>parsedAt(b.at)-parsedAt(a.at)).filter(item=>{
    const key=item.label+':'+item.at+':'+item.detail;
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  }).slice(0,4);
};
function renderActiveCard(session){
  const lastActivity=session.execution?.lastActivityAt||session.updatedAt;
  const ageTone=activityAgeTone(lastActivity);
  const running=['running','validating'].includes(session.execution?.state);
  const card=el('article','rapid-active-card age-'+ageTone+(running?' is-running':''));
  const head=el('div','rapid-active-card-head');
  head.append(externalLink('#'+(session.pr?.number||'?')+' · '+(session.title||'開発セッション'),session.pr?.url,'rapid-active-title'));
  const badges=el('div','rapid-active-badges');
  badges.append(el('span','rapid-active-badge '+(session.state==='Ready'?'warning':'muted'),String(session.state||'Draft').toUpperCase()));
  const workflow=sessionWorkflowView(session);
  badges.append(el('span','rapid-active-badge '+workflow[1],workflow[0]));
  head.append(badges);
  card.append(head);
  const facts=el('div','rapid-active-facts');
  const activity=el('div','rapid-active-fact');
  activity.append(el('span','','最終活動'),el('time','',clock(lastActivity)),el('small','',relative(lastActivity)));
  const sha=el('div','rapid-active-fact');
  sha.append(el('span','','HEAD'),el('code','',shortSha(session.headSha)));
  facts.append(activity,sha);
  card.append(facts);
  const timeline=el('ol','rapid-active-timeline');
  for(const item of sessionTimeline(session)){
    const row=el('li','rapid-active-event '+item.tone);
    row.append(el('i',''),el('time','',clock(item.at)),el('span','',item.label),el('small','',item.detail));
    timeline.append(row);
  }
  if(!timeline.childElementCount)timeline.append(el('li','rapid-active-event muted','GitHub活動はまだ記録されていません'));
  card.append(timeline,el('p','rapid-active-next',sessionNextWait(session)));
  return card;
}
function renderActive(state) {
  const root = $('#rapid-active-list'),count = $('#rapid-active-count');
  if (!root || !count) return;
  const sessions = activeSessions(state);
  count.textContent = sessions.length ? String(sessions.length) + '件' : '0件';
  root.replaceChildren();
  if (!sessions.length) {
    root.append(el('p', 'rapid-empty rapid-empty-ok', '現在の作業中タスクはありません'));
    return;
  }
  sessions.forEach(session=>root.append(renderActiveCard(session)));
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
    const row = el('article', 'rapid-issue-row ' + (item.tone || 'warning'));
    const title = href ? externalLink(item.title || '確認が必要です', href, 'rapid-issue-title') : el('strong', 'rapid-issue-title', item.title || '確認が必要です');
    row.append(title);
    const detail = [item.detail, item.since ? relative(item.since) : null].filter(Boolean).join(' · ');
    if (detail) row.append(el('span', 'rapid-issue-detail', detail));
    const actions=el('div','rapid-issue-actions');
    if(href)actions.append(externalLink('詳細 ↗',href,'rapid-issue-open'));
    const copy=el('button','rapid-repair-copy','修復プロンプトをコピー');
    copy.type='button';
    copy.setAttribute('aria-label',(item.title||'異常')+'の修復プロンプトをコピー');
    const status=el('span','rapid-repair-copy-status','');
    status.setAttribute('role','status');
    copy.addEventListener('click',async()=>{
      const prompt=buildIssueRepairPrompt(item,state);
      const copied=await copyText(prompt);
      status.textContent=copied?'コピー済み':'コピーできません';
      copy.textContent=copied?'コピー済み':'再試行';
      setTimeout(()=>{copy.textContent='修復プロンプトをコピー';status.textContent='';},1600);
    });
    actions.append(copy,status);
    row.append(actions);
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

const iterationGameLabel=game=>({kuumetsu:'喰滅廻遊',rinne:'百年転生',village:'村づくり'})[game]||'対象未記録';
const autonomousGameIds=new Set(['kuumetsu','rinne','village']);
const iterationGameId=session=>session?.autonomous?.game||session?.game||'';
const iterationDisplayTitle=(session,gameLabel)=>{
  const raw=String(session?.title||'自律改善').trim();
  const prefixes=[gameLabel+'：',gameLabel+':'];
  for(const prefix of prefixes)if(raw.startsWith(prefix))return raw.slice(prefix.length).trim();
  return raw;
};
const iterationRank=status=>({problem:0,running:1,active:1,publishing:2,complete:3})[status]??4;
const iterationIdentity=session=>session.id||(
  session.runKey&&session.iteration ? session.runKey+':'+session.iteration
    : session.pr?.number ? 'pr:'+session.pr.number : null
);
const iterationHref=session=>{
  const id=iterationIdentity(session);
  return id?'./iterations.html#iteration='+encodeURIComponent(id):'./iterations.html';
};
const phaseDuration=(phase,now=Date.now())=>{
  const raw=phase?.durationMs,explicit=Number(raw);
  if(raw!==null&&raw!==undefined&&raw!==''&&Number.isFinite(explicit)&&explicit>=0)return explicit;
  const start=Date.parse(phase?.startedAt||''),end=Date.parse(phase?.completedAt||'');
  if(Number.isFinite(start)&&Number.isFinite(end))return Math.max(0,end-start);
  if(phase?.state==='running'&&Number.isFinite(start))return Math.max(0,now-start);
  return null;
};
const durationLabel=ms=>{
  if(!Number.isFinite(ms))return '';
  const seconds=ms/1000;
  if(seconds<10)return seconds.toFixed(1)+'s';
  if(seconds<120)return Math.round(seconds)+'s';
  const minutes=Math.floor(seconds/60),rest=Math.round(seconds%60);
  return minutes+'m '+rest+'s';
};
const iterationCurrentPhase=(session,phases=[])=>phases.find(phase=>phase.id===session.currentStep)
  ||phases.find(phase=>phase.state==='problem')
  ||phases.find(phase=>phase.state==='running')
  ||phases.find(phase=>phase.state==='waiting'||phase.state==='pending')
  ||null;

function renderSession(session,{iteration=false,graph=false}={}) {
  const row=el(iteration?'a':'article','rapid-session-row '+(session.status||'active')+(iteration?' rapid-iteration-row':'')+(graph?' rapid-session-card':''));
  if(iteration){
    row.href=iterationHref(session);
    row.dataset.viewKey='iteration:'+iterationIdentity(session);
    row.setAttribute('aria-label',(session.title||'自律改善')+'の詳細を開く');
  }
  const allPhases=iteration?(session.iterationSteps||session.steps||[]):(session.steps||[]);
  const summaryIds=new Set(['observation','implementation','astraValidation','afterObservation','merge','devPublish']);
  const phases=iteration?allPhases.filter(phase=>summaryIds.has(phase.id)):allPhases;
  const current=iterationCurrentPhase(session,allPhases);
  const execution=executionView(session.execution);
  const live=el('div','rapid-execution-line');
  live.append(el('span','rapid-execution-state '+execution[1],execution[0]));
  const activity=[execution[2],session.execution?.lastActivityAt?relative(session.execution.lastActivityAt):null].filter(Boolean).join(' · ');
  live.append(el('span','rapid-execution-detail',activity||'活動時刻未記録'));
  row.append(live);
  const head=el('div','rapid-session-head');
  const prHref=iteration?null:safeHref(session.pr?.url);
  const iterationGame=iterationGameId(session),iterationNumber=session.autonomous?.number||session.iteration;
  const gameLabel=iterationGameLabel(iterationGame);
  const titlePrefix=iteration?(iterationNumber?'Iteration '+iterationNumber:'自律改善'):'#'+(session.pr?.number||'?');
  const sessionTitle=iteration?iterationDisplayTitle(session,gameLabel):(session.title||'開発セッション');
  const title=el(prHref?'a':'strong','rapid-session-title',titlePrefix+' · '+sessionTitle);
  if(prHref){title.href=prHref;title.target='_blank';title.rel='noreferrer';}
  head.append(title);
  row.append(head);

  const meta=el('div','rapid-session-meta');
  const target=iteration
    ? gameLabel
    : ((session.targets||[]).map(item=>item.label).join(' / ')||'対象未記録');
  meta.append(el('span','rapid-session-target',target),el('time','',relative(session.updatedAt)));
  const validated=session.validatedExactHead||session.validatedHead;
  if(validated)meta.append(el('code','',String(validated).slice(0,8)));
  if(session.repairAttempts)meta.append(el('span','rapid-session-repair','再検証 '+session.repairAttempts+'回'));
  row.append(meta);

  if(graph){
    const mini=renderProgressMini(phases,{
      ariaLabel:(iteration?'自律iteration':'作業中タスク')+'の工程時間',
      className:iteration?'iteration':'active',
    });
    if(mini)row.append(mini);
  }else{
    const flow=el('div','rapid-session-flow'+(iteration?' rapid-iteration-flow':''));
    for(const phase of phases){
      const view=sessionStepView(phase.state),href=!iteration?safeHref(phase.url):null;
      const node=el(href?'a':'span','rapid-session-step '+view[1]);
      if(href){node.href=href;node.target='_blank';node.rel='noreferrer';}
      node.title=phase.label+': '+view[0];
      node.append(el('i',''),el('b','',phase.label));
      flow.append(node);
    }
    row.append(flow);
  }
  return row;
}

function renderIterations(state){
  renderIterationSummary(state);
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
  const active = activeSessions(state);
  const running = active.filter(session=>['running','validating','merging'].includes(session.execution?.state)).length;
  const idle = active.filter(session=>session.execution?.state==='idle').length;
  const issueCount = issues.length;
  const danger = issues.some(item => item.tone === 'danger');
  const tone = issueCount ? (danger ? 'danger' : 'warning') : state?.syncStatus === 'degraded' ? 'warning' : 'ok';
  root.className = 'rapid-health ' + tone;
  title.textContent = appRows.length ? healthy + ' Apps Healthy' : 'Apps 確認中';
  meta.textContent = running + ' Running' + (idle ? ' · ' + idle + ' Idle' : '') + ' · ' + (issueCount ? issueCount + ' Issues' : 'No Issues');
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
  renderIterations(state);
  renderApps(state);
  const issues = renderIssues(state, error);
  renderRecent(state);
  renderHealth(state, issues);
}

async function loadPulseVersion(){
  const node=$('#pulse-version');
  if(!node)return;
  try{
    const response=await fetch('/version.json',{cache:'no-store',signal:AbortSignal.timeout(5000)});
    if(!response.ok)return;
    const version=await response.json();
    const commit=String(version?.commit||version?.sourceSha||version?.source_sha||'').trim();
    if(commit)node.textContent='v2 · '+commit.slice(0,7);
  }catch{}
}

subscribe(render);
loadPulseVersion();
setInterval(()=>{if(!document.hidden)tickProgressDurations(document,Date.now());},1000);