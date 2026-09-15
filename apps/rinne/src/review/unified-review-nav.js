import './unified-review-nav.css';

const q = selector => document.querySelector(selector);
const NAV_ITEMS = [
  ['model', 'モデル'],
  ['posture', '姿勢'],
  ['motion', 'モーション'],
  ['skill', '技構成'],
  ['performance', '演舞']
];

let currentSection = 'skill';
let previousSection = 'skill';
let installed = false;
let libraryActive = false;

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

function ensureLibraryFrame() {
  let frame = q('#motion-library-stage');
  if (frame) return frame;
  const viewport = q('.viewport');
  if (!viewport) return null;
  frame = document.createElement('iframe');
  frame.id = 'motion-library-stage';
  frame.className = 'motion-library-stage';
  frame.title = 'モーションライブラリ';
  frame.dataset.src = './motion-library.html?embed=1';
  frame.hidden = true;
  viewport.append(frame);
  return frame;
}

function dock() { return q('#review-controls-dock'); }
function dockOpen() { return dock()?.dataset.open === 'true'; }
function openDock() {
  if (!dockOpen()) q('#review-controls-toggle')?.click();
}
function closeDock() {
  if (dockOpen()) q('.review-controls-close')?.click();
}

function setURL(section) {
  const url = new URL(location.href);
  if (section === 'motion') {
    url.searchParams.set('tab', 'motion');
    url.searchParams.delete('performance');
  } else if (section === 'performance') {
    url.searchParams.set('tab', 'performance');
  } else if (section === 'posture') {
    url.searchParams.set('tab', 'posture');
    url.searchParams.delete('performance');
  } else {
    url.searchParams.delete('tab');
    url.searchParams.delete('performance');
  }
  history.replaceState(null, '', url);
}

function syncNav() {
  document.querySelectorAll('[data-review-nav]').forEach(button => {
    const on = button.dataset.reviewNav === currentSection;
    button.classList.toggle('active', on);
    button.setAttribute('aria-pressed', String(on));
  });
}

function setLibraryActive(on) {
  const frame = ensureLibraryFrame();
  if (!frame) return;
  libraryActive = on;
  document.body.classList.toggle('motion-library-active', on);
  frame.hidden = !on;
  if (on) {
    if (!frame.getAttribute('src')) frame.src = frame.dataset.src;
    q('[data-review-tab="skill"]')?.click();
    q('#review-canvas').hidden = true;
    closeDock();
  } else if (!document.body.classList.contains('performance-review-active')) {
    q('#review-canvas').hidden = false;
  }
  const feedback = q('.review-feedback-toggle');
  if (feedback) feedback.hidden = on;
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
  setLibraryActive(false);
  closeDock();
  previousSection = currentSection === 'model' ? previousSection : currentSection;
  currentSection = 'model';
  syncNav();
  q('.model-select-trigger')?.click();
}

function selectSection(section, {toggle = false, fromURL = false} = {}) {
  if (!NAV_ITEMS.some(([id]) => id === section)) section = 'skill';
  if (section === 'model') return openModelPicker();

  if (section === 'motion') {
    currentSection = 'motion';
    hidePostureArea();
    setLibraryActive(true);
    syncNav();
    if (!fromURL) setURL('motion');
    return;
  }

  if (libraryActive) setLibraryActive(false);
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
  syncNav();
  if (!fromURL) setURL(section);
}

function watchModelPicker() {
  const picker = q('.model-picker-backdrop');
  if (!picker || picker.dataset.unifiedNavBound) return;
  picker.dataset.unifiedNavBound = 'true';
  const sync = () => {
    if (!picker.hidden) return;
    if (currentSection !== 'model') return;
    const restore = previousSection || 'skill';
    currentSection = restore;
    if (restore === 'motion') setLibraryActive(true);
    else {
      setLibraryActive(false);
      if (restore === 'posture') { preparePostureArea(); q('[data-review-tab="posture"]')?.click(); }
      else { hidePostureArea(); q(restore === 'performance' ? '[data-review-tab="演舞"]' : '[data-review-tab="skill"]')?.click(); }
    }
    syncNav();
  };
  new MutationObserver(sync).observe(picker, {attributes: true, attributeFilter: ['hidden']});
}

function install() {
  if (installed || !q('#review-controls-dock') || !q('.model-select-trigger')) return false;
  installed = true;
  document.body.classList.add('unified-review-navigation');
  createBottomNav();
  ensureLibraryFrame();
  watchModelPicker();

  q('.review-primary-switch')?.setAttribute('hidden', '');
  q('.review-motion-link')?.addEventListener('click', event => {
    event.preventDefault();
    selectSection('motion');
  });

  const requested = new URLSearchParams(location.search).get('tab');
  if (requested === 'motion') selectSection('motion', {fromURL: true});
  else if (requested === 'performance') selectSection('performance', {fromURL: true});
  else if (requested === 'posture') selectSection('posture', {fromURL: true});
  else {
    hidePostureArea();
    currentSection = 'skill';
    syncNav();
    closeDock();
  }
  return true;
}

const observer = new MutationObserver(() => {
  if (install()) observer.disconnect();
});
observer.observe(document.documentElement, {childList: true, subtree: true});
queueMicrotask(install);
