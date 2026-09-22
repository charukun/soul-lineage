import './character-workshop-ux.css';
import { installWorkshopLoadingIndicator } from './character-workshop-loading-indicator.js';

const byId = id => document.getElementById(id);
const qs = selector => document.querySelector(selector);

const INTENTS = Object.freeze({
  build: { label: '作る', tab: 'parts', subtabs: ['parts', 'colors'] },
  move: { label: '動かす', tab: 'qa', subtabs: ['qa', 'motion'] },
  compare: { label: '比べる', tab: 'compare', subtabs: [] }
});

const SUBTAB_LABELS = Object.freeze({
  parts: '見た目',
  colors: '色・年齢',
  qa: '演舞',
  motion: '通常動作'
});

let coreInstalled = false;
let motionSimplified = false;
let comparisonSimplified = false;
let liveCompareNormalized = false;

function intentForTab(tab) {
  if (tab === 'compare') return 'compare';
  if (tab === 'qa' || tab === 'motion') return 'move';
  return 'build';
}

function setIntent(intent, { activate = true, focus = false } = {}) {
  const app = qs('.review-app');
  const subnav = byId('workshop-secondary-tabs');
  if (!app || !subnav || !INTENTS[intent]) return;
  app.dataset.workshopIntent = intent;

  for (const button of document.querySelectorAll('[data-workshop-intent]')) {
    const selected = button.dataset.workshopIntent === intent;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
  }

  const allowed = new Set(INTENTS[intent].subtabs);
  for (const button of subnav.querySelectorAll('[data-tab]')) {
    button.hidden = !allowed.has(button.dataset.tab);
  }
  subnav.hidden = allowed.size === 0;

  if (activate) {
    const current = subnav.querySelector('[data-tab][aria-selected="true"]');
    const target = current && allowed.has(current.dataset.tab)
      ? current
      : subnav.querySelector(`[data-tab="${INTENTS[intent].tab}"]`) || byId('tab-compare');
    target?.click();
  }
}

function buildIntentNavigation() {
  const nav = qs('.mode-tabs');
  const controls = qs('.review-controls');
  if (!nav || !controls || byId('workshop-secondary-tabs')) return false;

  const legacyTabs = [...nav.querySelectorAll('[data-tab]')];
  const compareTab = legacyTabs.find(button => button.dataset.tab === 'compare');
  const subnav = document.createElement('nav');
  subnav.id = 'workshop-secondary-tabs';
  subnav.className = 'workshop-secondary-tabs';
  subnav.setAttribute('aria-label', '選択中の操作');

  for (const button of legacyTabs) {
    const tab = button.dataset.tab;
    button.addEventListener('click', () => setIntent(intentForTab(tab), { activate: false }));
    if (tab === 'compare') {
      button.hidden = true;
      button.setAttribute('aria-hidden', 'true');
      controls.append(button);
      continue;
    }
    button.removeAttribute('role');
    button.removeAttribute('aria-controls');
    button.textContent = SUBTAB_LABELS[tab] || button.textContent;
    subnav.append(button);
  }
  controls.prepend(subnav);

  nav.replaceChildren();
  for (const [intent, spec] of Object.entries(INTENTS)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'tab';
    button.dataset.workshopIntent = intent;
    button.textContent = spec.label;
    button.setAttribute('aria-selected', String(intent === 'build'));
    button.tabIndex = intent === 'build' ? 0 : -1;
    button.addEventListener('click', () => setIntent(intent));
    nav.append(button);
  }

  nav.addEventListener('keydown', event => {
    if (!event.target.matches('[data-workshop-intent]')) return;
    event.stopImmediatePropagation();
    const keys = Object.keys(INTENTS);
    let index = keys.indexOf(event.target.dataset.workshopIntent);
    if (event.key === 'ArrowRight') index = (index + 1) % keys.length;
    else if (event.key === 'ArrowLeft') index = (index + keys.length - 1) % keys.length;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = keys.length - 1;
    else return;
    event.preventDefault();
    setIntent(keys[index], { focus: true });
  }, true);

  compareTab?.addEventListener('click', () => setIntent('compare', { activate: false }));
  return true;
}

function compactStageActions() {
  const actions = qs('.stage-actions');
  if (!actions || byId('camera-cycle')) return;
  const presets = ['front', 'side', 'back'];
  const labels = { front: '正面', side: '横', back: '背面' };
  let index = 0;
  const cycle = document.createElement('button');
  cycle.id = 'camera-cycle';
  cycle.type = 'button';
  cycle.textContent = `向き · ${labels[presets[index]]}`;
  cycle.setAttribute('aria-label', 'カメラの向きを切り替える');
  cycle.addEventListener('click', () => {
    index = (index + 1) % presets.length;
    actions.querySelector(`[data-camera="${presets[index]}"]`)?.click();
    cycle.textContent = `向き · ${labels[presets[index]]}`;
  });
  actions.prepend(cycle);

  for (const button of actions.querySelectorAll('[data-camera="front"],[data-camera="side"],[data-camera="back"],#pause,[data-camera="overview"]')) {
    button.hidden = true;
    button.setAttribute('aria-hidden', 'true');
  }
}

function moveIntoDetails(details, node) {
  if (node && node !== details && !details.contains(node)) details.append(node);
}

function simplifyMotionReview() {
  const root = byId('motion-qa');
  if (!root || !byId('qa-live-toggle') || byId('workshop-qa-details')) return false;

  const heading = root.querySelector('h2');
  if (heading && heading.textContent !== '演舞レビュー') heading.textContent = '演舞レビュー';
  const start = byId('qa-start');
  if (start && start.textContent !== '▶ 30秒演舞') start.textContent = '▶ 30秒演舞';

  const details = document.createElement('details');
  details.id = 'workshop-qa-details';
  details.className = 'workshop-qa-details';
  const summary = document.createElement('summary');
  summary.textContent = '詳細レビュー';
  details.append(summary);

  const tools = document.createElement('div');
  tools.className = 'workshop-qa-tools';
  details.append(tools);

  const live = byId('qa-live-toggle');
  if (!liveCompareNormalized && live.getAttribute('aria-pressed') === 'true') {
    live.click();
    liveCompareNormalized = true;
  }
  if (live.getAttribute('aria-pressed') === 'false') live.textContent = '左右比較 OFF';
  tools.append(live);

  let debugEnabled = false;
  document.documentElement.dataset.motionDebug = 'off';
  const debug = document.createElement('button');
  debug.id = 'qa-debug-toggle';
  debug.type = 'button';
  debug.textContent = '診断表示 OFF';
  debug.setAttribute('aria-pressed', 'false');
  debug.addEventListener('click', () => {
    debugEnabled = !debugEnabled;
    document.documentElement.dataset.motionDebug = debugEnabled ? 'on' : 'off';
    debug.textContent = `診断表示 ${debugEnabled ? 'ON' : 'OFF'}`;
    debug.setAttribute('aria-pressed', String(debugEnabled));
  });
  tools.append(debug);

  const motionLabel = byId('qa-motion')?.closest('label');
  const playback = byId('qa-speed')?.closest('.qa-playback');
  const stepbar = byId('qa-prev')?.parentElement;
  const cameraTitle = root.querySelector('.qa-section-title');
  const cameras = byId('qa-cameras');
  const more = root.querySelector('.qa-more');
  const diagnostics = root.querySelector('.qa-diagnostics-panel') || root.querySelector('details:not(.qa-more)');

  moveIntoDetails(details, motionLabel);
  moveIntoDetails(details, playback);
  moveIntoDetails(details, stepbar);
  moveIntoDetails(details, cameraTitle);
  moveIntoDetails(details, cameras);
  moveIntoDetails(details, more);
  moveIntoDetails(details, diagnostics);

  const trailingHint = [...root.querySelectorAll(':scope > .hint')].at(-1);
  moveIntoDetails(details, trailingHint);
  root.append(details);
  return true;
}

function simplifyComparison() {
  const panel = byId('panel-compare');
  if (!panel || byId('workshop-compare-details')) return false;
  const controls = panel.querySelector('.quality-controls');
  const baseline = byId('quality-baseline');
  const camera = byId('quality-camera');
  const heading = panel.querySelector('h2');
  if (heading && heading.textContent !== '比べる') heading.textContent = '比べる';

  const quick = document.createElement('div');
  quick.className = 'workshop-compare-quick';
  if (baseline) quick.append(baseline);
  if (camera) quick.append(camera);
  heading?.after(quick);

  const details = document.createElement('details');
  details.id = 'workshop-compare-details';
  details.className = 'workshop-compare-details';
  const summary = document.createElement('summary');
  summary.textContent = '個体・seed・世代を詳しく比較';
  details.append(summary);

  const keep = new Set([heading, quick]);
  for (const node of [...panel.children]) {
    if (!keep.has(node)) details.append(node);
  }
  panel.append(details);
  if (controls && controls.children.length === 0) controls.remove();
  return true;
}

function normalizeMotionLabels() {
  const tab = byId('tab-qa');
  if (tab && tab.textContent !== '演舞') tab.textContent = '演舞';
  const heading = qs('#motion-qa > h2');
  if (heading && heading.textContent !== '演舞レビュー') heading.textContent = '演舞レビュー';
  const start = byId('qa-start');
  if (start && start.textContent !== '▶ 30秒演舞') start.textContent = '▶ 30秒演舞';
  const live = byId('qa-live-toggle');
  if (live && live.getAttribute('aria-pressed') === 'false' && live.textContent !== '左右比較 OFF') live.textContent = '左右比較 OFF';
}

function installCore() {
  if (coreInstalled) return true;
  if (!window.characterStudio || !qs('.mode-tabs') || !qs('.review-controls')) return false;
  buildIntentNavigation();
  compactStageActions();
  setIntent('build', { activate: false });
  document.body.classList.add('workshop-ux-ready');
  coreInstalled = true;
  return true;
}

function installOptionalTools() {
  if (!motionSimplified && simplifyMotionReview()) motionSimplified = true;
  if (!comparisonSimplified && simplifyComparison()) comparisonSimplified = true;
  normalizeMotionLabels();
}

function install() {
  installWorkshopLoadingIndicator();
  const core = installCore();
  if (core) installOptionalTools();
  return core;
}

let frames = 0;
function boot() {
  if (install()) return;
  if (frames++ < 180) requestAnimationFrame(boot);
}

const observer = new MutationObserver(() => {
  installWorkshopLoadingIndicator();
  if (!coreInstalled) installCore();
  if (coreInstalled) installOptionalTools();
  const live = byId('qa-live-toggle');
  if (live && !liveCompareNormalized && live.getAttribute('aria-pressed') === 'true') {
    live.click();
    liveCompareNormalized = true;
  }
});
observer.observe(document.body, { childList: true, subtree: true, characterData: true });
requestAnimationFrame(boot);
