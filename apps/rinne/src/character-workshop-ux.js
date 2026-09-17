import './character-workshop-ux.css';

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
let loadingIndicatorInstalled = false;
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

function loadPhase(value, failed) {
  if (failed) return ['読み込みに失敗', '再試行できます'];
  if (value >= 1) return ['表示できました', ''];
  if (value < .3) return ['モデル本体', '最優先で3Dモデルを取得・確認中'];
  if (value < .65) return ['骨格・動き', '表示に必要な骨格と共通モーションを準備中'];
  if (value < .9) return ['表示データ', '選択中の表示に必要なデータを準備中'];
  return ['GPU準備', '描画準備が終われば操作できます'];
}

function installLoadingIndicator() {
  if (loadingIndicatorInstalled) return true;
  const wrap = qs('.canvas-wrap');
  const progress = byId('progress');
  const status = byId('status');
  if (!wrap || !progress || !status) return false;

  const root = document.createElement('div');
  root.id = 'load-indicator';
  root.className = 'load-indicator';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-atomic', 'true');

  const head = document.createElement('div');
  head.className = 'load-indicator-head';
  const label = document.createElement('strong');
  label.id = 'load-label';
  const percent = document.createElement('output');
  percent.id = 'load-percent';
  head.append(label, percent);

  const track = document.createElement('div');
  track.className = 'load-indicator-track';
  track.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('i');
  fill.id = 'load-fill';
  track.append(fill);

  const detail = document.createElement('span');
  detail.id = 'load-detail';
  root.append(head, track, detail);
  wrap.append(root);

  let startedAt = performance.now();
  let ticker = null;
  let hideTimer = null;

  const sync = () => {
    const value = Math.max(0, Math.min(1, Number(progress.value) || 0));
    const failed = status.dataset.error === 'true';
    const [phase, fallback] = loadPhase(value, failed);
    const elapsed = Math.max(0, performance.now() - startedAt) / 1000;
    root.dataset.state = failed ? 'error' : value >= 1 ? 'ready' : 'loading';
    root.hidden = false;
    label.textContent = phase;
    percent.value = failed ? '!' : `${Math.round(value * 100)}%`;
    fill.style.width = `${Math.max(4, Math.round(value * 100))}%`;
    detail.textContent = failed ? status.textContent : `${status.textContent || fallback}${value < 1 ? ` · ${elapsed.toFixed(1)}秒` : ''}`;

    clearTimeout(hideTimer);
    if (value >= 1 && !failed) hideTimer = setTimeout(() => { root.hidden = true; }, 850);
    if (value < 1 && !failed && ticker === null) ticker = window.setInterval(sync, 250);
    if ((value >= 1 || failed) && ticker !== null) { clearInterval(ticker); ticker = null; }
  };

  const observer = new MutationObserver(sync);
  observer.observe(progress, { attributes: true, attributeFilter: ['value'] });
  observer.observe(status, { attributes: true, attributeFilter: ['data-error'], childList: true, characterData: true, subtree: true });
  byId('retry')?.addEventListener('click', () => { startedAt = performance.now(); clearTimeout(hideTimer); sync(); });
  sync();
  loadingIndicatorInstalled = true;
  return true;
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
  installLoadingIndicator();
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
  installLoadingIndicator();
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
