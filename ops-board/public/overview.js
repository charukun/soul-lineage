import { subscribe } from './view-state.js';
import { appHealth, devPublicationProgress } from './health.mjs';
import { eventDrivenAlerts } from './freshness.mjs';

const $ = selector => document.querySelector(selector);
const toneNames = ['ok', 'progress', 'warning', 'danger', 'info'];

function setCard(id, value, detail, tone = 'info') {
  const card = `#${id}-card`;
  const root = $(card);
  const valueNode = `#${id}-value`;
  const detailNode = `#${id}-detail`;
  const valueEl = $(valueNode);
  const detailEl = $(detailNode);
  if (!root || !valueEl || !detailEl) return;
  toneNames.forEach(name => root.classList.remove(name));
  root.classList.add(toneNames.includes(tone) ? tone : 'info');
  valueEl.textContent = value;
  detailEl.textContent = detail;
}

function setPublicationExpanded(expanded) {
  $('#overview-app-card')?.classList.toggle('is-expanded', Boolean(expanded));
}
function setPublicationRows(current, next, eta) {
  const currentNode = $('#overview-app-now');
  const nextNode = $('#overview-app-next');
  const etaNode = $('#overview-app-eta');
  if (currentNode) currentNode.textContent = current;
  if (nextNode) nextNode.textContent = next;
  if (etaNode) etaNode.textContent = eta;
}

function needsHumanAction(state, impact) {
  return (state?.controlTower?.incidents || []).some(item => item.userActionRequired === true && (!impact || item.impact === impact));
}

function renderAttention(state, error) {
  if (!state && error) {
    setCard('overview-alert', '未確認', '状態取得は自動再試行中', 'info');
    return;
  }
  const alerts = eventDrivenAlerts(state, Date.now(), error).filter(item => item.userActionRequired === true);
  if (!alerts.length) {
    setCard('overview-alert', '操作不要', '人の確認 0件', 'ok');
    return;
  }
  setCard('overview-alert', `${alerts.length}件確認`, alerts[0]?.title || '確認が必要です', 'danger');
}

function renderDevelopment(state) {
  const pulls = state?.pullRequests?.normal || [];
  const draft = pulls.filter(item => item.state === 'Draft').length;
  const ready = pulls.filter(item => item.state === 'Ready').length;
  const rescue = state?.integrationRescue;
  const rescueActive = rescue?.available ? Number(rescue.counts?.active || 0) : 0;
  const active = draft + ready + rescueActive;
  const stalled = Boolean(state?.integration?.stalled);
  const human = needsHumanAction(state, 'integration');
  const tone = human ? 'danger' : stalled || active ? 'progress' : 'ok';
  const value = human ? '要確認' : active ? `${active}件` : '待ちなし';
  const detail = `作業 ${draft} / Ready ${ready}${rescueActive ? ` / 修復 ${rescueActive}` : ''}`;
  setCard('overview-task', value, detail, tone);
  const summary = $('#task-summary');
  if (summary) summary.textContent = detail;
}

function publicationValue(progress) {
  return ({
    queued:'準備中',
    coalescing:'準備中',
    waiting:'開始待ち',
    publishing:'更新中',
    reflecting:'反映確認',
    recovering:'復旧中',
    failed:'問題あり',
    stalled:'遅延',
  })[progress?.state] || '更新中';
}

function renderApplications(state) {
  const dev = (state?.environments || []).find(env => env.id === 'dev');
  const publication = devPublicationProgress(state, Date.now());
  if (publication) {
    const human = needsHumanAction(state, 'dev-publication');
    const tone = human ? 'danger' : publication.tone === 'danger' ? 'progress' : publication.tone;
    setCard('overview-app', publicationValue(publication), publication.currentVersionAvailable ? '現在版は開けます' : '公開版を確認中', tone);
    setPublicationRows(publication.current, publication.next, publication.eta);
    setPublicationExpanded(true);
    return;
  }

  const exactPublished = Boolean(dev?.branchCommit && dev?.deployedCommit === dev.branchCommit && dev?.exactCommit !== false);
  if (exactPublished) {
    setCard('overview-app', '最新', '今すぐ確認できます', 'ok');
    setPublicationRows('最新developを公開済み', '待つ必要なし', '今すぐ');
    setPublicationExpanded(false);
    return;
  }

  if (!dev) {
    setCard('overview-app', '未確認', '公開情報を自動取得中', 'info');
    setPublicationRows('公開状態を取得中', 'developとの一致を確認', '確認中');
    setPublicationExpanded(false);
    return;
  }

  const apps = state?.applications || [];
  const counts = { ok:0, progress:0, warning:0, danger:0, info:0 };
  for (const app of apps) {
    const [, tone] = appHealth(app);
    counts[tone] = (counts[tone] || 0) + 1;
  }
  const human = needsHumanAction(state, 'dev-publication');
  const tone = human ? 'danger' : counts.warning ? 'warning' : counts.progress || counts.danger ? 'progress' : 'info';
  setCard('overview-app', dev.deployedCommit ? '照合中' : '未確認', dev.deployedCommit ? '現在版は開けます' : '公開版を確認中', tone);
  setPublicationRows('公開版とdevelopを照合中', '一致状態を確認', '確認中');
  setPublicationExpanded(false);
}

function render(state, error) {
  renderAttention(state, error);
  if (!state) {
    setCard('overview-task', '未確認', '開発状態を自動取得中', 'info');
    setCard('overview-app', '未確認', '公開状態を自動取得中', 'info');
    setPublicationRows('公開状態を取得中', 'developとの一致を確認', '確認中');
    setPublicationExpanded(false);
    return;
  }
  renderDevelopment(state);
  renderApplications(state);
}

subscribe(render);

document.addEventListener('click', event => {
  const trigger = event.target.closest?.('[data-open-disclosure]');
  if (!trigger) return;
  const id = trigger.dataset.openDisclosure;
  const target = id ? document.getElementById(id) : null;
  if (target?.matches('details')) target.open = true;
});
