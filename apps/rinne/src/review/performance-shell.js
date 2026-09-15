import './performance-shell.css';
import './battle-shell.js';
import './battle-performance-entry.js';

const q = selector => document.querySelector(selector);
const frame = q('#performance-stage');
const viewport = q('.viewport');
const canvas = q('#review-canvas');
const performanceTab = q('[data-review-tab="演舞"]');
const skillTab = q('[data-review-tab="skill"]');
const mainPlay = q('#play-toggle');
const modeLabels = {
  posture: '構え・移動',
  sequence: '30秒演舞',
  combination: '7連撃',
  baseline: '技ごと比較'
};
let active = false;
let frameReady = false;
let mainWasPlaying = false;
let previousStage = null;
const previousModelStates = new Map();
let latestState = {mode: 'sequence', model: 'compact'};

function targetOrigin() {
  return location.origin;
}

function send(command, value) {
  if (!frameReady || !frame.contentWindow) return;
  frame.contentWindow.postMessage({type: 'visual-review-performance-control', command, value}, targetOrigin());
}

function ensureFrame() {
  if (frame.getAttribute('src')) return;
  const url=new URL(frame.dataset.src,location.href),params=new URLSearchParams(location.search);
  const weapon=params.get('performanceWeapon'),model=params.get('performanceModel');
  if(weapon)url.searchParams.set('weapon',weapon);
  url.searchParams.set('model',model==='shino'?'shino':'compact');
  frame.src=url.href;
}

function writeURL() {
  const url = new URL(location.href);
  if (active) {
    url.searchParams.set('tab', 'performance');
    url.searchParams.set('performance', latestState.mode || 'sequence');
    url.searchParams.set('performanceModel',latestState.model==='shino'?'shino':'compact');
    if(latestState.weapon)url.searchParams.set('performanceWeapon',latestState.weapon);
  } else {
    url.searchParams.delete('tab');
    url.searchParams.delete('performance');
    url.searchParams.delete('performanceModel');
    url.searchParams.delete('performanceWeapon');
  }
  history.replaceState(null, '', url);
}

function performanceChipId() {
  return latestState.model === 'shino' ? 'SHINO' : 'motion-library.knight';
}

function setPerformanceModelState(on) {
  const chips = [...document.querySelectorAll('.model-chip')];
  if (on) {
    for (const chip of chips) {
      if (!previousModelStates.has(chip)) previousModelStates.set(chip,{active:chip.classList.contains('active'),disabled:chip.disabled});
      const selected=chip.dataset.model===performanceChipId();
      chip.classList.toggle('active',selected);
      chip.disabled=!selected;
    }
  } else {
    for (const [chip,state] of previousModelStates) {
      if(!chip.isConnected)continue;
      chip.classList.toggle('active',state.active);
      chip.disabled=state.disabled;
    }
    previousModelStates.clear();
  }
}

function installPerformanceModelControl() {
  const page=q('[data-review-page="演舞"]'),weapon=q('#performance-weapon');
  if(!page||!weapon)return false;
  const help=page.querySelector('.sequence-help');
  if(help)help.textContent='30秒演舞は既存のデフォルメKnightを主表示し、SHINOを比較用に残します。抜刀→序破急→納刀は同じ30秒スコアです。';
  if(q('#performance-model'))return true;
  const label=document.createElement('label');label.className='performance-field';label.textContent='演舞のキャラ';
  const select=document.createElement('select');select.id='performance-model';select.disabled=true;
  select.append(new Option('2頭身候補 / Knight','compact'),new Option('SHINO / 比較','shino'));
  select.value=latestState.model||'compact';select.addEventListener('change',event=>{
    latestState.model=event.target.value==='shino'?'shino':'compact';
    setPerformanceModelState(active);writeURL();send('model',latestState.model);
  });
  label.append(select);weapon.closest('label')?.before(label);return true;
}

function setActive(next) {
  if (active === next) return;
  active = next;
  document.body.classList.toggle('performance-review-active', active);
  viewport.classList.toggle('performance-active', active);
  frame.hidden = !active;
  canvas.hidden = active;
  installPerformanceModelControl();
  setPerformanceModelState(active);
  if (active) {
    previousStage = {
      name: q('#motion-name').textContent,
      meta: q('#motion-meta').textContent,
      status: q('#review-status').textContent,
      statusKind: q('#review-status').dataset.kind || ''
    };
    mainWasPlaying = mainPlay?.textContent === '一時停止';
    if (mainWasPlaying) mainPlay.click();
    ensureFrame();
    q('#motion-name').textContent = modeLabels[latestState.mode] || '演舞';
    q('#motion-meta').textContent = '演舞モードを準備しています';
    q('#review-status').textContent = '演舞を読み込んでいます';
    q('#review-status').dataset.kind = '';
    send('state');
  } else {
    send('pause');
    if (previousStage) {
      q('#motion-name').textContent = previousStage.name;
      q('#motion-meta').textContent = previousStage.meta;
      q('#review-status').textContent = previousStage.status;
      q('#review-status').dataset.kind = previousStage.statusKind;
    }
    if (mainWasPlaying && mainPlay?.textContent !== '一時停止') mainPlay.click();
    mainWasPlaying = false;
  }
  writeURL();
  syncPrimarySwitch();
}

function syncFromTabs() {
  setActive(performanceTab?.classList.contains('active'));
}

document.querySelectorAll('[data-review-tab]').forEach(button => {
  button.addEventListener('click', () => queueMicrotask(syncFromTabs));
});

function syncPrimarySwitch() {
  document.querySelectorAll('[data-primary-review]').forEach(button => {
    const on = button.dataset.primaryReview === (active ? 'performance' : 'skill');
    button.classList.toggle('active', on);
    button.setAttribute('aria-pressed', String(on));
  });
}

function installPrimarySwitch() {
  const notebook = q('.notebook-scroll');
  const skillPage = q('[data-review-page="skill"]');
  const performancePage = q('[data-review-page="演舞"]');
  if (!notebook || !skillPage || !performancePage) return false;
  installPerformanceModelControl();
  const secondary = q('.review-secondary-disclosure');
  if (secondary?.contains(performancePage)) notebook.insertBefore(performancePage, secondary);
  if (performanceTab) performanceTab.hidden = true;
  if (q('.review-primary-switch')) {
    syncPrimarySwitch();
    return Boolean(secondary && !secondary.contains(performancePage));
  }
  const switcher = document.createElement('nav');
  switcher.className = 'review-primary-switch';
  switcher.setAttribute('aria-label', '主要な確認モード');
  const skill = document.createElement('button');
  skill.type = 'button'; skill.dataset.primaryReview = 'skill'; skill.textContent = '技構成';
  skill.addEventListener('click', () => skillTab?.click());
  const performance = document.createElement('button');
  performance.type = 'button'; performance.dataset.primaryReview = 'performance'; performance.textContent = '演舞';
  performance.addEventListener('click', () => performanceTab?.click());
  switcher.append(skill, performance);
  notebook.insertBefore(switcher, skillPage);
  syncPrimarySwitch();
  return Boolean(secondary && !secondary.contains(performancePage));
}

const primaryObserver = new MutationObserver(() => {
  if (installPrimarySwitch()) primaryObserver.disconnect();
});
primaryObserver.observe(document.body, {childList:true, subtree:true});
queueMicrotask(installPrimarySwitch);

frame.addEventListener('load', () => {
  frameReady = true;
  const params=new URLSearchParams(location.search),requested=params.get('performance'),model=params.get('performanceModel');
  if (requested && modeLabels[requested]) send('mode', requested);
  send('model',model==='shino'?'shino':'compact');
  send('state');
});

function updateControls(state) {
  latestState = {...latestState, ...state};
  document.querySelectorAll('[data-performance-mode]').forEach(button => {
    const on = button.dataset.performanceMode === latestState.mode;
    button.classList.toggle('active', on);
    button.setAttribute('aria-pressed', String(on));
  });
  document.querySelectorAll('[data-performance-view]').forEach(button => {
    const on = button.dataset.performanceView === latestState.view;
    button.classList.toggle('active', on);
    button.setAttribute('aria-pressed', String(on));
  });
  installPerformanceModelControl();
  const ready = Boolean(latestState.ready);
  for (const id of ['#performance-play','#performance-restart','#performance-prev','#performance-next','#performance-seek','#performance-weapon','#performance-detail','#performance-model']) q(id).disabled = !ready;
  q('#performance-play').textContent = latestState.playing ? '一時停止' : '再生';
  q('#performance-speed').value = String(latestState.speed || 1);
  q('#performance-repeat').checked = Boolean(latestState.repeat);
  q('#performance-compare').checked = Boolean(latestState.compare);
  q('#performance-compare').disabled = !latestState.canCompare;
  q('#performance-weapon').value=latestState.weapon||'sword';
  q('#performance-model').value=latestState.model==='shino'?'shino':'compact';
  q('#performance-detail').checked=Boolean(latestState.handDetail);
  q('#performance-trail').checked = Boolean(latestState.trail);
  q('#performance-seek').max = String(latestState.duration || 1);
  q('#performance-seek').value = String(latestState.time || 0);
  q('#performance-phase').textContent = latestState.label || modeLabels[latestState.mode] || '演舞';
  q('#performance-time').textContent = latestState.timeLabel || `${Number(latestState.time || 0).toFixed(1)} / ${Number(latestState.duration || 0).toFixed(1)} 秒`;
  q('#performance-status').textContent = latestState.status || (ready ? '演舞を確認できます。' : '演舞を読み込んでいます。');
  if (active) {
    setPerformanceModelState(true);
    q('#motion-name').textContent = latestState.label || modeLabels[latestState.mode] || '演舞';
    q('#motion-meta').textContent = `${latestState.model==='shino'?'SHINO':'Knight'} / ${modeLabels[latestState.mode] || '演舞'} / ${q('#performance-time').textContent}`;
    q('#review-status').textContent = latestState.status || '演舞を確認できます';
    q('#review-status').dataset.kind = latestState.error ? 'error' : '';
  }
  if (active) writeURL();
}

window.addEventListener('message', event => {
  if (event.origin !== targetOrigin() || event.source !== frame.contentWindow) return;
  if (event.data?.type !== 'visual-review-performance-state') return;
  updateControls(event.data.state || {});
});

document.querySelectorAll('[data-performance-mode]').forEach(button => button.addEventListener('click', () => {
  const mode = button.dataset.performanceMode;
  latestState.mode = mode;
  updateControls(latestState);
  send('mode', mode);
}));
q('#performance-weapon').addEventListener('change',event=>send('weapon',event.target.value));
q('#performance-detail').addEventListener('change',event=>send('hand-detail',event.target.checked));
q('#performance-play').addEventListener('click', () => send('play-toggle'));
q('#performance-restart').addEventListener('click', () => send('restart'));
q('#performance-speed').addEventListener('change', event => send('speed', Number(event.target.value)));
q('#performance-repeat').addEventListener('change', event => send('repeat', event.target.checked));
q('#performance-compare').addEventListener('change', event => send('compare', event.target.checked));
q('#performance-trail').addEventListener('change', event => send('trail', event.target.checked));
q('#performance-seek').addEventListener('input', event => send('seek', Number(event.target.value)));
q('#performance-prev').addEventListener('click', () => send('step', -1));
q('#performance-next').addEventListener('click', () => send('step', 1));
document.querySelectorAll('[data-performance-view]').forEach(button => button.addEventListener('click', () => send('view', button.dataset.performanceView)));

const initial = new URLSearchParams(location.search);
latestState.model=initial.get('performanceModel')==='shino'?'shino':'compact';
if (initial.get('tab') === 'performance') {
  const mode = initial.get('performance');
  if (modeLabels[mode]) latestState.mode = mode;
  queueMicrotask(() => performanceTab?.click());
} else {
  syncFromTabs();
}