import './unified-review-nav.css';

const q = selector => document.querySelector(selector);
const NAV_ITEMS = [
  ['model', 'モデル'],
  ['posture', '姿勢'],
  ['skill', '技構成'],
  ['performance', '演舞']
];
const DRAWER_LABELS = {model:'モデル', posture:'姿勢', skill:'技構成', performance:'演舞'};
const EYEBROWS = {model:'MODEL REVIEW', posture:'POSTURE REVIEW', skill:'SKILL REVIEW', performance:'PERFORMANCE REVIEW'};

let currentSection = 'skill';
let previousSection = 'skill';
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
    button.textContent = label;
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

function setURL(section) {
  const url = new URL(location.href);
  if (section === 'performance') url.searchParams.set('tab', 'performance');
  else if (section === 'posture') url.searchParams.set('tab', 'posture');
  else url.searchParams.delete('tab');
  if (section !== 'performance') url.searchParams.delete('performance');
  history.replaceState(null, '', url);
}

function syncContext() {
  document.querySelectorAll('[data-review-nav]').forEach(button => {
    const on = button.dataset.reviewNav === currentSection;
    button.classList.toggle('active', on);
    button.setAttribute('aria-pressed', String(on));
  });
  const drawerTitle = q('.review-drawer-head strong');
  if (drawerTitle) drawerTitle.textContent = DRAWER_LABELS[currentSection] || '確認';
  const eyebrow = q('.stage-header .eyebrow');
  if (eyebrow) eyebrow.textContent = EYEBROWS[currentSection] || 'MOTION REVIEW';
}

function preparePostureArea() {
  const secondary = q('.review-secondary-disclosure');
  if (!secondary) return;
  secondary.hidden = false;
  secondary.open = true;
}
function hidePostureArea() {
  const secondary = q('.review-secondary-disclosure');
  if (secondary) secondary.hidden = true;
}

function openModelPicker() {
  closeDock();
  previousSection = currentSection === 'model' ? previousSection : currentSection;
  currentSection = 'model';
  syncContext();
  q('.model-select-trigger')?.click();
}

function selectSection(section, {toggle = false, fromURL = false} = {}) {
  if (!NAV_ITEMS.some(([id]) => id === section)) section = 'skill';
  if (section === 'model') return openModelPicker();

  const sameOpen = section === currentSection && dockOpen();
  currentSection = section;
  if (section === 'posture') {
    preparePostureArea();
    q('[data-review-tab="posture"]')?.click();
  } else {
    hidePostureArea();
    q(section === 'performance' ? '[data-review-tab="演舞"]' : '[data-review-tab="skill"]')?.click();
  }

  if (toggle && sameOpen) closeDock();
  else openDock();
  syncContext();
  if (!fromURL) setURL(section);
}

function watchModelPicker() {
  const picker = q('.model-picker-backdrop');
  if (!picker || picker.dataset.unifiedNavBound) return;
  picker.dataset.unifiedNavBound = 'true';
  const sync = () => {
    if (!picker.hidden || currentSection !== 'model') return;
    const restore = previousSection || 'skill';
    currentSection = restore;
    if (restore === 'posture') {
      preparePostureArea();
      q('[data-review-tab="posture"]')?.click();
    } else {
      hidePostureArea();
      q(restore === 'performance' ? '[data-review-tab="演舞"]' : '[data-review-tab="skill"]')?.click();
    }
    syncContext();
  };
  new MutationObserver(sync).observe(picker, {attributes: true, attributeFilter: ['hidden']});
}

function installContextPlayback() {
  document.addEventListener('change', event => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement) || !['move-select','dash-select'].includes(select.id) || !select.value) return;
    const master = q('#clip');
    if (!master || master.value === select.value) return;
    master.value = select.value;
    master.dispatchEvent(new Event('change', {bubbles:true}));
  }, true);
}

function install() {
  if (installed || !q('#review-controls-dock') || !q('.model-select-trigger')) return false;
  installed = true;
  document.body.classList.add('unified-review-navigation');
  createBottomNav();
  watchModelPicker();
  installContextPlayback();
  q('.review-primary-switch')?.setAttribute('hidden', '');

  const requested = new URLSearchParams(location.search).get('tab');
  if (requested === 'performance') selectSection('performance', {fromURL: true});
  else if (requested === 'posture') selectSection('posture', {fromURL: true});
  else {
    hidePostureArea();
    currentSection = 'skill';
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
