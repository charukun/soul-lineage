import './unified-review-nav.css';

const q = selector => document.querySelector(selector);
const NAV_ITEMS = [
  ['model', 'モデル'],
  ['skill', '技'],
  ['performance', '演舞'],
  ['battle', '戦闘'],
  ['other', 'その他'],
];
const TOOL_ITEMS = [
  ['posture', '姿勢', '抜刀・納刀と戦闘態勢'],
  ['reaction', '被弾', 'ヒット反応だけを確認'],
  ['stance', '構え', '戦闘姿勢を比較'],
  ['parry', 'パリィ', '防御・受け流しを比較'],
  ['axis', '心技体', '心・技・体の候補を確認'],
  ['move', '移動', '歩行・ダッシュを確認'],
  ['playback', '再生・視点', '速度・位相・カメラ'],
  ['advanced', '詳細調整', '武器・素材・表示設定'],
];
const DRAWER_LABELS = {
  model: 'モデル', skill: '技構成', performance: '演舞', battle: '自動戦闘', other: 'その他',
};
const TOOL_LABELS = Object.fromEntries(TOOL_ITEMS.map(([id, label]) => [id, label]));
const EYEBROWS = {
  model: 'MODEL REVIEW', skill: 'SKILL REVIEW', performance: 'PERFORMANCE REVIEW',
  battle: 'TIDEBREAK AUTO BATTLE', other: 'REVIEW TOOLS',
};

let currentSection = 'skill';
let previousSection = 'skill';
let currentTool = '';
let installed = false;

function createBottomNav() {
  let nav = q('#review-bottom-nav');
  if (nav) return nav;
  nav = document.createElement('nav');
  nav.id = 'review-bottom-nav';
  nav.className = 'review-bottom-nav';
  nav.setAttribute('aria-label', 'レビュー');
  for (const [id, label] of NAV_ITEMS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.reviewNav = id;
    const mark = document.createElement('span');
    mark.className = 'review-nav-mark';
    mark.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.className = 'review-nav-label';
    text.textContent = label;
    button.append(mark, text);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => selectSection(id, {toggle: true}));
    nav.append(button);
  }
  document.body.append(nav);
  return nav;
}

function dock() { return q('#review-controls-dock'); }
function dockOpen() { return dock()?.dataset.open === 'true'; }
function openDock() { if (!dockOpen()) q('#review-controls-toggle')?.click(); }
function closeDock() { if (dockOpen()) q('.review-controls-close')?.click(); }
function secondary() { return q('.review-secondary-disclosure'); }
function advancedDetails() { return q('.review-advanced-disclosure'); }

function setURL(section, tool = '') {
  const url = new URL(location.href);
  url.searchParams.delete('performance');
  url.searchParams.delete('tool');
  if (section === 'performance') {
    url.searchParams.set('tab', 'performance');
  } else if (section === 'battle') {
    url.searchParams.set('tab', 'battle');
  } else if (section === 'other') {
    url.searchParams.set('tab', 'tools');
    if (tool) url.searchParams.set('tool', tool);
  } else {
    url.searchParams.delete('tab');
  }
  history.replaceState(null, '', url);
}

function syncContext() {
  document.body.dataset.reviewSection = currentSection;
  document.body.dataset.reviewTool = currentTool || '';
  document.querySelectorAll('[data-review-nav]').forEach(button => {
    const on = button.dataset.reviewNav === currentSection;
    button.classList.toggle('active', on);
    button.setAttribute('aria-pressed', String(on));
  });
  const drawerTitle = q('.review-drawer-head strong');
  if (drawerTitle) drawerTitle.textContent = currentTool ? TOOL_LABELS[currentTool] : (DRAWER_LABELS[currentSection] || '確認');
  const eyebrow = q('.stage-header .eyebrow');
  if (eyebrow) eyebrow.textContent = EYEBROWS[currentSection] || 'MOTION REVIEW';
}

function ensureToolHub() {
  const target = secondary();
  if (!target || target.querySelector('.review-tool-hub')) return;
  const tabs = target.querySelector('.review-tabs');
  const hub = document.createElement('section');
  hub.className = 'review-tool-hub';
  hub.innerHTML = '<header><strong>確認ツール</strong><small>目的を選ぶと、その機能だけの画面を開きます</small></header>';
  const grid = document.createElement('div');
  grid.className = 'review-tool-grid';
  for (const [id, label, description] of TOOL_ITEMS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.reviewToolLaunch = id;
    const title = document.createElement('strong');
    title.textContent = label;
    const detail = document.createElement('small');
    detail.textContent = description;
    button.append(title, detail);
    button.addEventListener('click', () => openTool(id));
    grid.append(button);
  }
  hub.append(grid);
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'review-tool-back';
  back.textContent = '‹ その他へ戻る';
  back.addEventListener('click', showToolHub);
  target.insertBefore(hub, tabs || target.firstChild?.nextSibling || null);
  target.insertBefore(back, tabs || null);

  const details = advancedDetails();
  if (details && !details.querySelector('.review-advanced-back')) {
    const advancedBack = document.createElement('button');
    advancedBack.type = 'button';
    advancedBack.className = 'review-advanced-back';
    advancedBack.textContent = '‹ その他へ戻る';
    advancedBack.addEventListener('click', showToolHub);
    const summary = details.querySelector(':scope>summary');
    if (summary) summary.after(advancedBack);
    else details.prepend(advancedBack);
  }
}

function hideToolAreas() {
  const target = secondary();
  const details = advancedDetails();
  if (target) target.hidden = true;
  if (details) details.hidden = true;
}

function showToolHub() {
  ensureToolHub();
  const target = secondary();
  const details = advancedDetails();
  currentTool = '';
  if (details) {
    details.open = false;
    details.hidden = true;
    delete details.dataset.toolMode;
  }
  if (target) {
    target.hidden = false;
    target.open = true;
    delete target.dataset.tool;
  }
  syncContext();
  setURL('other');
}

function openTool(id, {fromURL = false} = {}) {
  ensureToolHub();
  currentSection = 'other';
  currentTool = id;
  const target = secondary();
  const details = advancedDetails();
  if (id === 'playback' || id === 'advanced') {
    if (target) target.hidden = true;
    if (details) {
      details.hidden = false;
      details.open = true;
      details.dataset.toolMode = id;
      const summary = details.querySelector(':scope>summary');
      if (summary) summary.textContent = id === 'playback' ? '再生・視点' : '詳細調整';
    }
  } else {
    if (details) {
      details.open = false;
      details.hidden = true;
      delete details.dataset.toolMode;
    }
    if (target) {
      target.hidden = false;
      target.open = true;
      target.dataset.tool = id;
    }
    q(`[data-review-tab="${id}"]`)?.click();
  }
  openDock();
  syncContext();
  if (!fromURL) setURL('other', id);
}

function openModelPicker() {
  closeDock();
  previousSection = currentSection === 'model' ? previousSection : currentSection;
  currentSection = 'model';
  currentTool = '';
  hideToolAreas();
  syncContext();
  q('.model-select-trigger')?.click();
}

function selectSection(section, {toggle = false, fromURL = false} = {}) {
  if (!NAV_ITEMS.some(([id]) => id === section)) section = 'skill';
  if (section === 'model') return openModelPicker();

  const sameOpen = section === currentSection && dockOpen();
  currentSection = section;
  currentTool = '';
  hideToolAreas();
  if (section === 'battle') {
    q('[data-review-tab="battle"]')?.click();
  } else if (section === 'performance') {
    q('[data-review-tab="演舞"]')?.click();
  } else if (section === 'other') {
    showToolHub();
  } else {
    q('[data-review-tab="skill"]')?.click();
  }

  if (toggle && sameOpen) closeDock();
  else openDock();
  syncContext();
  if (!fromURL && section !== 'other') setURL(section);
}

function watchModelPicker() {
  const picker = q('.model-picker-backdrop');
  if (!picker || picker.dataset.unifiedNavBound) return;
  picker.dataset.unifiedNavBound = 'true';
  const sync = () => {
    if (!picker.hidden || currentSection !== 'model') return;
    const restore = previousSection && previousSection !== 'model' ? previousSection : 'skill';
    currentSection = restore;
    currentTool = '';
    hideToolAreas();
    if (restore === 'battle') q('[data-review-tab="battle"]')?.click();
    else if (restore === 'performance') q('[data-review-tab="演舞"]')?.click();
    else if (restore === 'other') showToolHub();
    else q('[data-review-tab="skill"]')?.click();
    syncContext();
  };
  new MutationObserver(sync).observe(picker, {attributes: true, attributeFilter: ['hidden']});
}

function installContextPlayback() {
  document.addEventListener('change', event => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement) || !['move-select', 'dash-select'].includes(select.id) || !select.value) return;
    const master = q('#clip');
    if (!master || master.value === select.value) return;
    master.value = select.value;
    master.dispatchEvent(new Event('change', {bubbles: true}));
  }, true);
}

function install() {
  if (installed || !q('#review-controls-dock') || !q('.model-select-trigger') || !q('[data-review-tab="battle"]')) return false;
  installed = true;
  document.body.classList.add('unified-review-navigation');
  createBottomNav();
  ensureToolHub();
  watchModelPicker();
  installContextPlayback();
  q('.review-primary-switch')?.setAttribute('hidden', '');
  hideToolAreas();

  const params = new URLSearchParams(location.search);
  const requested = params.get('tab');
  const requestedTool = params.get('tool');
  if (requested === 'battle') selectSection('battle', {fromURL: true});
  else if (requested === 'performance') selectSection('performance', {fromURL: true});
  else if (requested === 'tools') {
    if (requestedTool && TOOL_LABELS[requestedTool]) openTool(requestedTool, {fromURL: true});
    else selectSection('other', {fromURL: true});
  } else if (requested === 'posture') {
    openTool('posture', {fromURL: true});
  } else {
    currentSection = 'skill';
    currentTool = '';
    q('[data-review-tab="skill"]')?.click();
    syncContext();
    closeDock();
    if (requested === 'motion') setURL('skill');
  }
  return true;
}

const observer = new MutationObserver(() => {
  if (install()) observer.disconnect();
});
observer.observe(document.documentElement, {childList: true, subtree: true});
queueMicrotask(install);
