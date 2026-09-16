import { subscribe } from './view-state.js';
import { appHealth, boardAlerts, devPublicationProgress } from './health.mjs';

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

function renderAttention(state, error) {
  const alerts = boardAlerts(state, Date.now(), error);
  const danger = alerts.filter(item => item.tone === 'danger').length;
  const tone = danger ? 'danger' : alerts.length ? 'warning' : 'ok';
  setCard('overview-alert', alerts.length ? `${alerts.length}件` : '0件', alerts.length ? (danger ? `重大 ${danger}` : '確認あり') : '問題なし', tone);
}

function renderDevelopment(state) {
  const pulls = state?.pullRequests?.normal || [];
  const draft = pulls.filter(item => item.state === 'Draft').length;
  const ready = pulls.filter(item => item.state === 'Ready').length;
  const active = draft + ready;
  const rescue = state?.integrationRescue;
  const rescueActive = rescue?.available ? Number(rescue.counts?.active || 0) : 0;
  const stalled = Boolean(state?.integration?.stalled);
  const tone = stalled ? 'danger' : ready ? 'warning' : draft || rescueActive ? 'progress' : 'ok';
  const value = stalled ? '要確認' : active ? `${active}件進行` : rescueActive ? `Rescue ${rescueActive}` : '待ちなし';
  const detail = `作業 ${draft} / 統合待ち ${ready}${rescueActive ? ` / Rescue ${rescueActive}` : ''}`;
  setCard('overview-task', value, detail, tone);
  const summary = $('#task-summary');
  if (summary) summary.textContent = detail;
}

function renderApplications(state) {
  const dev = (state?.environments || []).find(env => env.id === 'dev');
  const publication = devPublicationProgress(state, Date.now());
  if (publication) {
    setCard(
      'overview-app',
      publicationHeadline(publication),
      publication.currentVersionAvailable ? '現在のDEVは今すぐ開けます' : '現在のDEV公開は未確認です',
      publication.tone,
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
  const tone = counts.danger ? 'danger' : counts.warning ? 'warning' : counts.progress ? 'progress' : 'info';
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
