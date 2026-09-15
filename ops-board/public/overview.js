import { subscribe } from './view-state.js';
import { appHealth, boardAlerts } from './health.mjs';

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
  const apps = state?.applications || [];
  if (!apps.length) {
    setCard('overview-app', '未確認', '公開情報なし', 'info');
    return;
  }
  const counts = { ok: 0, progress: 0, warning: 0, danger: 0, info: 0 };
  for (const app of apps) {
    const [, tone] = appHealth(app);
    counts[tone] = (counts[tone] || 0) + 1;
  }
  const tone = counts.danger ? 'danger' : counts.warning ? 'warning' : counts.progress ? 'progress' : counts.ok === apps.length ? 'ok' : 'info';
  const value = counts.danger ? `要対応 ${counts.danger}` : counts.warning ? `公開待ち ${counts.warning}` : counts.progress ? `更新中 ${counts.progress}` : `${counts.ok}/${apps.length} 正常`;
  const detail = counts.info ? `未確認 ${counts.info} / 全${apps.length}` : `全${apps.length}アプリ`;
  setCard('overview-app', value, detail, tone);
}

function render(state, error) {
  renderAttention(state, error);
  if (!state) {
    setCard('overview-task', '未確認', '開発状態なし', 'info');
    setCard('overview-app', '未確認', '公開状態なし', 'info');
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
