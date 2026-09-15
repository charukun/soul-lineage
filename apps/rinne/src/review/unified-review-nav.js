import './unified-review-nav.css';
import './unified-review-nav-v2.css';

const q = selector => document.querySelector(selector);
const NAV_ITEMS = [
  ['model', 'モデル'],
  ['skill', '技'],
  ['performance', '演舞'],
  ['battle', '戦闘'],
  ['other', 'その他'],
];
const TOOL_ITEMS = [
  ['axis', '心技体', '心・技・体の候補を確認'],
  ['playback', '再生・視点', '速度・位相・カメラ'],
  ['advanced', '詳細調整', '武器・素材・表示設定'],
];
const BATTLE_MOTION_ITEMS = [
  ['stance-select', '構え', '戦闘の起点'],
  ['parry-select', 'パリィ', '防御・受け流し'],
  ['reaction-select', '被弾', 'ヒット反応'],
  ['posture-draw', '抜刀', '戦闘開始'],
  ['posture-sheathe', '納刀', '戦闘終了'],
  ['move-select', '移動', '間合い調整'],
  ['dash-select', 'ダッシュ', '接敵・離脱'],
];
const DRAWER_LABELS = {
  model: 'モデル', skill: '技', performance: '演舞', battle: '戦闘モーション', other: 'その他',
};
const TOOL_LABELS = Object.fromEntries(TOOL_ITEMS.map(([id, label]) => [id, label]));
const EYEBROWS = {
  model: 'MODEL REVIEW', skill: 'SKILL REVIEW', performance: 'PERFORMANCE REVIEW',
  battle: 'BATTLE MOTION REVIEW', other: 'REVIEW TOOLS',
};
const SKILL_EXCLUDE = /Idle|Ready|Stance|Pose|待機|構え/i;

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
function closeDock() {
  if (!dockOpen()) return;
  q('.review-controls-close')?.click();
  queueMicrotask(() => q(`[data-review-nav="${currentSection}"]`)?.focus());
}
function secondary() { return q('.review-secondary-disclosure'); }
function advancedDetails() { return q('.review-advanced-disclosure'); }
function categoryHub() { return q('.review-category-hub'); }

function setURL(section, tool = '') {
  const url = new URL(location.href);
  url.searchParams.delete('performance');
  url.searchParams.delete('tool');
  if (section === 'performance') {
    url.searchParams.set('tab', 'performance-menu');
  } else if (section === 'battle') {
    url.searchParams.set('tab', 'battle-motion');
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

function ensureCategoryHub() {
  let hub = categoryHub();
  if (hub) return hub;
  const target = secondary();
  const notebook = q('.notebook-scroll');
  if (!notebook) return null;
  hub = document.createElement('section');
  hub.className = 'review-category-hub';
  hub.hidden = true;
  hub.innerHTML = '<header><strong></strong><small></small></header><div class="review-category-grid"></div>';
  if (target?.parentElement === notebook) notebook.insertBefore(hub, target);
  else notebook.prepend(hub);
  return hub;
}

function hideCategoryHub() {
  const hub = categoryHub();
  if (hub) hub.hidden = true;
  document.body.classList.remove('review-category-menu-open');
}

function categoryTile(label, detail, onClick, {disabled = false, selected = false} = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'review-category-choice';
  button.disabled = disabled;
  button.classList.toggle('active', selected);
  const title = document.createElement('strong');
  title.textContent = label;
  const meta = document.createElement('small');
  meta.textContent = detail || '';
  button.append(title, meta);
  button.addEventListener('click', onClick);
  return button;
}

function setCategoryCopy(title, detail) {
  const hub = ensureCategoryHub();
  if (!hub) return null;
  hub.querySelector('header strong').textContent = title;
  hub.querySelector('header small').textContent = detail;
  hub.hidden = false;
  document.body.classList.add('review-category-menu-open');
  return hub.querySelector('.review-category-grid');
}

function neutralCanvas() {
  const skillTab = q('[data-review-tab="skill"]');
  if (skillTab && !skillTab.classList.contains('active')) skillTab.click();
}

function playDirectMotion(value) {
  const master = q('#clip');
  if (!master || !value || ![...master.options].some(option => option.value === value)) return;
  master.value = value;
  master.dispatchEvent(new Event('change', {bubbles: true}));
  const loop = q('#loop-toggle');
  if (loop && !loop.checked) {
    loop.checked = true;
    loop.dispatchEvent(new Event('change', {bubbles: true}));
  }
}

function skillOptions() {
  const source = q('#stage-ha') || q('#stage-jo');
  if (!source) return [];
  return [...source.options].filter(option => option.value && !option.disabled && !SKILL_EXCLUDE.test(`${option.textContent} ${option.value}`));
}

function renderSkillHub() {
  const grid = setCategoryCopy('技を選ぶ', '単体モーションを5列から選択。選ぶとメニューを閉じて即確認します。');
  if (!grid) return;
  const rows = skillOptions();
  if (!rows.length) {
    grid.replaceChildren(categoryTile('読込中', '技モーションを準備しています', () => {}, {disabled: true}));
    return;
  }
  grid.replaceChildren(...rows.map(option => categoryTile(
    option.textContent,
    option.dataset.group || '技',
    () => {
      neutralCanvas();
      playDirectMotion(option.value);
      closeDock();
    },
    {selected: q('#clip')?.value === option.value},
  )));
}

function renderPerformanceHub() {
  const grid = setCategoryCopy('演舞を選ぶ', '演目だけを選びます。選択後はメニューを閉じ、同じ画面で演舞を確認します。');
  if (!grid) return;
  const rows = [...document.querySelectorAll('[data-performance-mode]')];
  grid.replaceChildren(...rows.map(source => categoryTile(
    source.querySelector('span')?.textContent || source.textContent.trim(),
    source.querySelector('small')?.textContent || '演舞',
    () => {
      q('[data-review-tab="演舞"]')?.click();
      source.click();
      closeDock();
    },
    {disabled: source.disabled, selected: source.classList.contains('active')},
  )));
}

function renderBattleHub() {
  const grid = setCategoryCopy('戦闘モーションを選ぶ', '戦闘シーンへは移動しません。確認したい動作種別を選び、その場でモーションを比較します。');
  if (!grid) return;
  grid.replaceChildren(...BATTLE_MOTION_ITEMS.map(([selectId, label, detail]) => {
    const trigger = q(`[data-picker-for="${selectId}"]`);
    return categoryTile(label, detail, () => {
      neutralCanvas();
      trigger?.click();
    }, {disabled: !trigger || trigger.disabled});
  }));
}

function renderCategoryHub(section) {
  hideToolAreas();
  if (section === 'skill') renderSkillHub();
  else if (section === 'performance') renderPerformanceHub();
  else if (section === 'battle') renderBattleHub();
}

function ensureToolHub() {
  const target = secondary();
  if (!target || target.querySelector('.review-tool-hub')) return;
  const tabs = target.querySelector('.review-tabs');
  const hub = document.createElement('section');
  hub.className = 'review-tool-hub';
  hub.innerHTML = '<header><strong>その他の確認</strong><small>補助設定だけをまとめています</small></header>';
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
  hideCategoryHub();
  const target = secondary();
  const details = advancedDetails();
  currentTool = '';
  neutralCanvas();
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
  hideCategoryHub();
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
  hideCategoryHub();
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
  hideCategoryHub();
  hideToolAreas();

  if (section === 'other') {
    showToolHub();
  } else {
    neutralCanvas();
    renderCategoryHub(section);
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
    hideCategoryHub();
    if (restore === 'performance') q('[data-review-tab="演舞"]')?.click();
    else if (restore === 'other') showToolHub();
    else neutralCanvas();
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
  if (installed || !q('#review-controls-dock') || !q('.model-select-trigger') || !q('[data-review-tab="skill"]')) return false;
  installed = true;
  document.body.classList.add('unified-review-navigation');
  createBottomNav();
  ensureCategoryHub();
  ensureToolHub();
  watchModelPicker();
  installContextPlayback();
  q('.review-primary-switch')?.setAttribute('hidden', '');
  hideCategoryHub();
  hideToolAreas();

  const params = new URLSearchParams(location.search);
  const requested = params.get('tab');
  const requestedTool = params.get('tool');
  if (requested === 'battle' || requested === 'battle-motion') selectSection('battle', {fromURL: true});
  else if (requested === 'performance-menu') selectSection('performance', {fromURL: true});
  else if (requested === 'performance') {
    currentSection = 'performance';
    currentTool = '';
    syncContext();
    closeDock();
  } else if (requested === 'tools') {
    if (requestedTool && TOOL_LABELS[requestedTool]) openTool(requestedTool, {fromURL: true});
    else selectSection('other', {fromURL: true});
  } else if (requested === 'posture') {
    currentSection = 'battle';
    selectSection('battle', {fromURL: true});
  } else {
    currentSection = 'skill';
    currentTool = '';
    neutralCanvas();
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
