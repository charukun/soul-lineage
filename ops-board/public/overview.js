import { subscribe } from './view-state.js';
import { appHealth, devPublicationProgress } from './health.mjs';
import { eventDrivenAlerts } from './freshness.mjs';
import { developmentOutcomeSummary } from './development-outcome.mjs';

const $ = selector => document.querySelector(selector);
const toneNames = ['ok', 'progress', 'warning', 'danger', 'info'];

function setCard(id, value, detail, tone = 'info') {
  const card = $(`#${id}-card`);
  const valueNode = $(`#${id}-value`);
  const detailNode = $(`#${id}-detail`);
  if (!card || !valueNode || !detailNode) return;
  toneNames.forEach(name => card.classList.remove(name));
  card.classList.add(toneNames.includes(tone) ? tone : 'info');
  valueNode.textContent = value;
  detailNode.textContent = detail;
}

function setPublicationRows(current, next, eta) {
  const currentNode = $('#overview-app-now');
  const nextNode = $('#overview-app-next');
  const etaNode = $('#overview-app-eta');
  if (currentNode) currentNode.textContent = current;
  if (nextNode) nextNode.textContent = next;
  if (etaNode) etaNode.textContent = eta;
}

function publicationHeadline(progress) {
  return ({
    queued: 'DEV更新を準備中',
    coalescing: 'DEV更新を準備中',
    waiting: 'DEV更新を準備中',
    publishing: 'DEVを更新中',
    reflecting: 'もうすぐ確認できます',
    recovering: 'DEV更新を復旧中',
    failed: 'DEV更新で問題発生',
    stalled: 'DEV更新が遅れています',
  })[progress?.state] || progress?.value || 'DEV状態を確認中';
}

function needsHumanAction(state, impact) {
  return (state?.controlTower?.incidents || []).some(item => item.userActionRequired === true && (!impact || item.impact === impact));
}

function renderAttention(state, error) {
  const alerts = eventDrivenAlerts(state, Date.now(), error);
  const danger = alerts.filter(item => item.tone === 'danger' || item.userActionRequired).length;
  const tone = alerts.length ? 'danger' : 'ok';
  setCard('overview-alert', alerts.length ? `${alerts.length}件` : '0件', alerts.length ? (danger ? `確認が必要 ${danger}` : '確認あり') : '問題なし', tone);
}

function renderDevelopment(state) {
  const outcome = developmentOutcomeSummary(state);
  setCard('overview-task', outcome.headline, outcome.detail, outcome.tone);
  const summary = $('#task-summary');
  if (summary) summary.textContent = outcome.detail;
}

function renderApplications(state) {
  const dev = (state?.environments || []).find(env => env.id === 'dev');
  const publication = devPublicationProgress(state, Date.now());
  if (publication) {
    const human = needsHumanAction(state, 'dev-publication');
    const tone = publication.tone === 'danger' && !human ? 'progress' : publication.tone;
    setCard(
      'overview-app',
      publicationHeadline(publication),
      publication.currentVersionAvailable ? '現在のDEVは今すぐ開けます' : '現在のDEV公開は未確認です',
      tone,
    );
    setPublicationRows(publication.current, publication.next, publication.eta);
    return;
  }

  const exactPublished = Boolean(dev?.branchCommit && dev?.deployedCommit === dev.branchCommit && dev?.exactCommit !== false);
  if (exactPublished) {
    setCard('overview-app', 'DEVは最新です', '今すぐ確認できます', 'ok');
    setPublicationRows('最新のdevelopが公開済みです', '待つ必要はありません', '今すぐ確認できます');
    return;
  }

  if (!dev) {
    setCard('overview-app', 'DEV状態を確認中', '公開情報を取得しています', 'info');
    setPublicationRows('公開状態を取得しています', 'developとの一致を確認します', '確認中');
    return;
  }

  const apps = state?.applications || [];
  const counts = { ok: 0, progress: 0, warning: 0, danger: 0, info: 0 };
  for (const app of apps) {
    const [, tone] = appHealth(app);
    counts[tone] = (counts[tone] || 0) + 1;
  }
  const human = needsHumanAction(state, 'dev-publication');
  const tone = human ? 'danger' : counts.warning ? 'warning' : counts.progress || counts.danger ? 'progress' : 'info';
  setCard('overview-app', 'DEV状態を確認中', dev.deployedCommit ? '現在のDEVは開けます' : '公開版を確認できていません', tone);
  setPublicationRows('公開版と最新developを照合しています', '一致状態を確認します', '確認中');
}

function render(state, error) {
  renderAttention(state, error);
  if (!state) {
    setCard('overview-task', '未確認', '開発状態なし', 'info');
    setCard('overview-app', 'DEV状態を確認中', '公開情報を取得しています', 'info');
    setPublicationRows('公開状態を取得しています', 'developとの一致を確認します', '確認中');
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
