import { subscribe, preserveView, disclosure } from './view-state.js';
import { ageLabel } from './health.mjs';
import { buildWorkResumePrompt, draftWorkItems } from './work-resume-prompt.js';
const $ = selector => document.querySelector(selector);
const fmt = new Intl.DateTimeFormat('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
};
const stateLabel = state => ({ Draft: '作業中', Ready: '統合待ち', Merged: '統合済み', Closed: '終了' })[state] || state;
const badgeTone = state => ({ Draft: 'progress', Ready: 'warning', Merged: 'ok', Closed: 'info' })[state] || 'info';
const filterOptions = [['all', 'すべて', 'info'], ['Draft', '作業中', 'progress'], ['Ready', '統合待ち', 'warning'], ['Merged', '統合済み', 'ok'], ['Closed', '終了', 'info']];
let selectedFilter = 'all';
try { const saved = sessionStorage.getItem('rinne-ops:filter'); if (filterOptions.some(([id]) => id === saved)) selectedFilter = saved; } catch { /* storage optional */ }
let currentPullData = {};
let promptReturnFocus = null;

const promptDialog = el('dialog', 'app-dialog work-prompt-dialog');
promptDialog.id = 'work-resume-prompt-dialog';
promptDialog.setAttribute('aria-labelledby', 'work-resume-prompt-title');
const promptHead = el('div', 'app-dialog-head');
const promptTitle = el('h2', '', '作業中を確認・進めるAIプロンプト');
promptTitle.id = 'work-resume-prompt-title';
const promptClose = el('button', 'app-dialog-close', '閉じる');
promptClose.type = 'button';
const promptLead = el('p', 'work-prompt-lead', '表示中のDraftを手掛かりに、GitHubで全件を再確認して停止作業を既存PRから再開するためのプロンプトです。');
const promptText = el('textarea', 'work-prompt-text');
promptText.readOnly = true;
promptText.spellcheck = false;
promptText.setAttribute('aria-label', 'AIへ渡す作業再開プロンプト');
const promptActions = el('div', 'work-prompt-dialog-actions');
const promptCopy = el('button', 'work-prompt-copy', 'プロンプトをコピー');
promptCopy.type = 'button';
const promptStatus = el('p', 'work-prompt-status', '');
promptStatus.setAttribute('role', 'status');
promptActions.append(promptCopy, promptStatus);
promptHead.append(promptTitle, promptClose);
promptDialog.append(promptHead, promptLead, promptText, promptActions);
document.body.append(promptDialog);
promptClose.addEventListener('click', () => promptDialog.close());
promptDialog.addEventListener('click', event => {
  if (event.target !== promptDialog) return;
  const rect = promptDialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) promptDialog.close();
});
promptDialog.addEventListener('close', () => {
  promptReturnFocus?.focus?.({ preventScroll: true });
  promptReturnFocus = null;
});
promptCopy.addEventListener('click', async () => {
  const text = promptText.value;
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      promptText.focus();
      promptText.select();
      if (!document.execCommand?.('copy')) throw new Error('copy unavailable');
    }
    promptStatus.textContent = 'コピーしました';
  } catch {
    promptText.focus();
    promptText.select();
    promptStatus.textContent = '自動コピーできません。選択中の全文をコピーしてください。';
  }
});

function renderTargetChips(root, pr) {
  const targets = Array.isArray(pr.targets) ? pr.targets : [];
  if (!targets.length) {
    const text = pr.targetsStatus === 'pending' ? '対象確認中' : pr.targetsComplete === true ? '対象なし' : '対象未取得';
    root.append(el('span', 'pull-target muted-target', text));
    return;
  }
  targets.slice(0, 2).forEach(target => root.append(el('span', 'pull-target', target.label)));
  if (targets.length > 2) {
    const more = el('span', 'pull-target more-target', `+${targets.length - 2}`);
    more.title = targets.slice(2).map(target => target.label).join(' / ');
    root.append(more);
  }
  if (pr.targetsComplete !== true) root.append(el('span', 'pull-target muted-target', '一部取得'));
  root.title = targets.map(target => target.label).join(' / ');
}

function row(pr) {
  const link = el('a', `pull-row${pr.staleDraft && !pr.visualReview ? ' stale-draft' : ''}`);
  try { if (new URL(pr.url).protocol === 'https:') link.href = pr.url; } catch { /* no unsafe link */ }
  link.target = '_blank'; link.rel = 'noreferrer'; link.dataset.viewKey = `pr:${pr.number}`;
  const top = el('div', 'pull-row-top');
  const title = el('strong', 'pull-title', pr.title || `PR #${pr.number}`);
  title.title = pr.title || '';
  const status = el('span', `badge ${badgeTone(pr.state)}`, stateLabel(pr.state));
  status.title = pr.state;
  top.append(title, status);
  const bottom = el('div', 'pull-row-bottom');
  const detail = el('span', 'pull-detail', pr.detail || '詳細未記載');
  detail.title = pr.detail || '';
  bottom.append(detail);
  const meta = el('span', 'pull-meta');
  const targets = el('span', 'pull-targets');
  renderTargetChips(targets, pr);
  const date = Date.parse(pr.updatedAt || '');
  const updated = Number.isFinite(date) ? fmt.format(date) : '未記録';
  const time = el('time', '', `更新 ${updated}`);
  if (Number.isFinite(date)) { time.dateTime = new Date(date).toISOString(); time.title = ageLabel(Math.max(0, Date.now() - date)); }
  meta.append(targets, el('span', 'pull-number', `#${pr.number}`), time);
  if (pr.monitoringOwner === 'Integration') meta.append(el('span', 'pull-target', 'CI監視: Integration'));
  if (pr.staleDraft && !pr.visualReview) meta.append(el('span', 'stale-note', 'しばらく更新なし'));
  bottom.append(meta); link.append(top, bottom);
  return link;
}
function rows(items, emptyText) {
  const node = el('div', 'pull-list');
  if (!items.length) node.append(el('p', 'empty', emptyText));
  else items.forEach(item => node.append(row(item)));
  return node;
}
function filterBar(items) {
  const root = el('div', 'pull-filters');
  root.setAttribute('aria-label', '開発タスクの状態フィルタ');
  for (const [state, label, tone] of filterOptions) {
    const count = state === 'all' ? items.length : items.filter(item => item.state === state).length;
    const button = el('button', `pull-filter ${tone}${selectedFilter === state ? ' active' : ''}`, `${label} ${count}`);
    button.type = 'button'; button.dataset.state = state; button.dataset.viewKey = `filter:${state}`;
    button.setAttribute('aria-pressed', String(selectedFilter === state));
    button.addEventListener('click', () => {
      if (selectedFilter === state) return;
      selectedFilter = state;
      try { sessionStorage.setItem('rinne-ops:filter', state); } catch { /* storage optional */ }
      preserveView(() => render(currentPullData));
    });
    root.append(button);
  }
  return root;
}
function resumePromptAction(data) {
  const drafts = draftWorkItems(data);
  const root = el('div', 'work-resume-action');
  const copy = el('div', 'work-resume-copy');
  copy.append(
    el('strong', '', '作業中が本当に動いているかAIで全件確認'),
    el('span', '', drafts.length ? `${drafts.length}件のDraftを手掛かりに、停止・待機・稼働中を再判定します。` : '現在の通常Draftはありません。'),
  );
  if (data?.truncated) copy.append(el('span', 'work-resume-warning', '表示外があるため、プロンプトはGitHub側の全Draft列挙を必須にします。'));
  const button = el('button', 'work-resume-button', drafts.length ? `AI再開プロンプト ${drafts.length}件` : 'AI再開プロンプト');
  button.type = 'button';
  button.disabled = drafts.length === 0;
  button.dataset.viewKey = 'work-resume-prompt';
  button.setAttribute('aria-haspopup', 'dialog');
  button.addEventListener('click', () => {
    promptReturnFocus = button;
    promptText.value = buildWorkResumePrompt(currentPullData);
    promptStatus.textContent = '';
    promptText.scrollTop = 0;
    promptDialog.showModal();
  });
  root.append(copy, button);
  return root;
}
function render(data = {}) {
  currentPullData = data;
  const items = data.normal || [];
  const active = items.filter(item => ['Draft', 'Ready'].includes(item.state));
  const completed = items.filter(item => ['Merged', 'Closed'].includes(item.state));
  const root = $('#pulls');
  root.replaceChildren(resumePromptAction(data), filterBar(items));
  if (selectedFilter === 'all') {
    root.append(rows(active, '現在、作業中・統合待ちのPRはありません'),
      disclosure('completed-pulls', `完了・終了 ${completed.length}件`, rows(completed, '完了PRなし'), 'completed-pulls'));
  } else root.append(rows(items.filter(item => item.state === selectedFilter), `${stateLabel(selectedFilter)}のPRはありません`));
  if (data.truncated) root.append(el('p', 'empty', `取得できた${data.total || items.length}件を表示しています。未取得の履歴があります。`));
  if (data.targetLookup?.pending || data.targetLookup?.unavailable) root.append(el('p', 'empty targets-notice', '対象アプリはサーバーで順次確認しています。未取得のPRは取得でき次第更新されます。'));
  const visual = data.visualReview || [];
  $('#visual-review-pulls').replaceChildren(rows(visual, 'Visual Review Lab PRなし'));
  $('#visual-review-section').hidden = visual.length === 0;
}
subscribe((state, error) => {
  if (state && !error) render(state.pullRequests || {});
  else if (!state) $('#pulls').replaceChildren(el('p', 'empty', 'PR一覧を取得できません。上部の取得状態を確認してください。'));
});
