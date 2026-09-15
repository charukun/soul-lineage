import './battle-shell.css';
import { createBattleAudio } from './battle-audio.js';

const q = selector => document.querySelector(selector);
const viewport = q('.viewport');
const canvas = q('#review-canvas');
const performanceFrame = q('#performance-stage');
const notebook = q('.notebook-scroll');
const performanceTab = q('[data-review-tab="演舞"]');
const mainPlay = q('#play-toggle');
const telemetry = q('.topbar .telemetry');
const shellAudio = createBattleAudio();

const frame = document.createElement('iframe');
frame.id = 'battle-stage';
frame.className = 'battle-stage';
frame.title = 'Tidebreak自動戦闘';
frame.dataset.src = './battle-review.html?embed=1&audio=off';
frame.allow = 'autoplay';
frame.hidden = true;
performanceFrame?.after(frame);

const battleTab = document.createElement('button');
battleTab.type = 'button';
battleTab.className = 'tab battle-tab';
battleTab.dataset.reviewTab = 'battle';
battleTab.textContent = '戦闘';
battleTab.setAttribute('aria-selected', 'false');
performanceTab?.after(battleTab);

const quickLink = document.createElement('button');
quickLink.type = 'button';
quickLink.className = 'battle-quick-link';
quickLink.textContent = '戦闘';
quickLink.setAttribute('aria-label', 'Tidebreak自動戦闘を開く');
quickLink.setAttribute('aria-pressed', 'false');
if (telemetry && !q('.battle-quick-link')) telemetry.prepend(quickLink);

const page = document.createElement('section');
page.className = 'review-page battle-page';
page.dataset.reviewPage = 'battle';
page.innerHTML = `
  <div class="section-heading">Tidebreak 自動戦闘 <small>実戦観戦</small></div>
  <p class="sequence-help">RaidHostと同じTidebreak自動戦闘を、手入力なしで決着まで再生します。HP・位置・攻撃進行は実戦ロジック、表示はLabの実モデルへ同期します。</p>
  <div class="battle-summary">
    <div class="battle-side"><strong>魔物側</strong><span id="battle-hero-hp">230 / 230</span><small id="battle-hero-action">モデル読込中</small></div>
    <div class="battle-side"><strong>人間側</strong><span id="battle-enemy-hp">180 / 180</span><small id="battle-enemy-action">モデル読込中</small></div>
  </div>
  <div class="battle-transport">
    <button class="btn primary" id="battle-shell-play" type="button" disabled>再生</button>
    <button class="btn" id="battle-shell-restart" type="button" disabled>再戦</button>
    <select id="battle-shell-speed" aria-label="戦闘速度" disabled><option value="0.25">1/4</option><option value="0.5">1/2</option><option value="1" selected>通常</option><option value="2">2倍</option></select>
    <button class="btn sound" id="battle-shell-sound" type="button" aria-pressed="true">音 ON</button>
    <label class="toggle"><input id="battle-shell-repeat" type="checkbox" checked/>自動再戦</label>
  </div>
  <div class="battle-views" role="group" aria-label="戦闘視点">
    <button class="btn tiny active" type="button" data-battle-shell-view="three">斜め</button>
    <button class="btn tiny" type="button" data-battle-shell-view="front">正面</button>
    <button class="btn tiny" type="button" data-battle-shell-view="side">横</button>
  </div>
  <div class="battle-page-meta">
    <span class="source-pill" id="battle-shell-source">Tidebreak</span>
    <a class="battle-popout" href="./battle-review.html">全画面で開く</a>
  </div>
  <p class="battle-hint" id="battle-shell-status">実モデルを読み込んでいます。</p>`;
const advanced = q('[data-review-page="advanced"]');
if (advanced?.parentElement === notebook) notebook.insertBefore(page, advanced);
else notebook?.append(page);

let active = false;
let ready = false;
let frameReady = false;
let mainWasPlaying = false;
let previousStage = null;
let previousModelStates = [];
let latest = { speed: 1, repeat: true, view: 'three' };
let soundSnapshot = { heroHp: null, enemyHp: null, heroAction: '', enemyAction: '', finished: false };

function send(command, value) {
  if (!frameReady || !frame.contentWindow) return;
  frame.contentWindow.postMessage({ type: 'visual-review-battle-control', command, value }, location.origin);
}

function ensureFrame() {
  if (!frame.getAttribute('src')) frame.src = frame.dataset.src;
}

function syncSoundButton() {
  const button = q('#battle-shell-sound');
  if (!button) return;
  button.disabled = !shellAudio.supported;
  button.setAttribute('aria-pressed', String(shellAudio.enabled));
  button.textContent = shellAudio.supported ? (shellAudio.enabled ? '音 ON' : '音 OFF') : '音非対応';
}

function unlockShellAudio() {
  if (!shellAudio.enabled) return;
  void shellAudio.unlock().finally(syncSoundButton);
}

function combatSoundKind(label = '', side = '') {
  if (/防御|パリィ|受け流/.test(label)) return 'guard';
  if (/被弾|接敵|間合い|モデル読込中|戦闘不能/.test(label) || !label) return '';
  if (side === 'hero' || /拳|寸勁|腹打|双拳|突き上げ/.test(label)) return 'jab';
  return 'slash';
}

function updateShellAudio(state) {
  const next = {
    heroHp: Number(state.heroHp), enemyHp: Number(state.enemyHp),
    heroAction: state.heroAction || '', enemyAction: state.enemyAction || '',
    finished: Boolean(state.finished),
  };
  if (Number.isFinite(soundSnapshot.heroHp) && Number.isFinite(next.heroHp) && next.heroHp < soundSnapshot.heroHp - 0.01) shellAudio.hit(soundSnapshot.heroHp - next.heroHp > 20);
  if (Number.isFinite(soundSnapshot.enemyHp) && Number.isFinite(next.enemyHp) && next.enemyHp < soundSnapshot.enemyHp - 0.01) shellAudio.hit(soundSnapshot.enemyHp - next.enemyHp > 20);
  for (const side of ['hero', 'enemy']) {
    const key = `${side}Action`;
    if (next[key] && next[key] !== soundSnapshot[key]) {
      const kind = combatSoundKind(next[key], side);
      if (kind === 'guard') shellAudio.guard();
      else if (kind) shellAudio.attack(kind);
    }
  }
  if (next.finished && !soundSnapshot.finished) shellAudio.knockout();
  soundSnapshot = next;
}

function setModelsLocked(on) {
  const controls = [...document.querySelectorAll('.model-chip,.model-select-trigger')];
  if (on) {
    previousModelStates = controls.map(control => [control, control.disabled]);
    controls.forEach(control => { control.disabled = true; });
  } else {
    for (const [control, disabled] of previousModelStates) control.disabled = disabled;
    previousModelStates = [];
  }
}

function writeURL() {
  const url = new URL(location.href);
  if (active) {
    url.searchParams.set('tab', 'battle');
    url.searchParams.set('battleSpeed', String(latest.speed || 1));
  } else if (url.searchParams.get('tab') === 'battle') {
    url.searchParams.delete('tab');
    url.searchParams.delete('battleSpeed');
  }
  history.replaceState(null, '', url);
}

function syncPrimary() {
  const buttons = [...document.querySelectorAll('[data-primary-review]')];
  const battleButton = buttons.find(button => button.dataset.primaryReview === 'battle');
  for (const button of buttons) {
    if (!active && button.dataset.primaryReview === 'battle') {
      button.classList.remove('active');
      button.setAttribute('aria-pressed', 'false');
      continue;
    }
    if (!active) continue;
    const on = button === battleButton;
    button.classList.toggle('active', on);
    button.setAttribute('aria-pressed', String(on));
  }
  quickLink.classList.toggle('active', active);
  quickLink.setAttribute('aria-pressed', String(active));
}

function setActive(next) {
  if (active === next) return;
  active = next;
  document.body.classList.toggle('battle-review-active', active);
  viewport?.classList.toggle('battle-active', active);
  frame.hidden = !active;
  if (active) {
    if (performanceFrame) performanceFrame.hidden = true;
    if (canvas) canvas.hidden = true;
    setModelsLocked(true);
    previousStage = {
      name: q('#motion-name')?.textContent || '',
      meta: q('#motion-meta')?.textContent || '',
      status: q('#review-status')?.textContent || '',
      statusKind: q('#review-status')?.dataset.kind || '',
    };
    mainWasPlaying = mainPlay?.textContent === '一時停止';
    if (mainWasPlaying) mainPlay.click();
    ensureFrame();
    q('#motion-name').textContent = 'Tidebreak 自動戦闘';
    q('#motion-meta').textContent = '実モデルを準備しています';
    q('#review-status').textContent = 'Tidebreakを準備しています';
    q('#review-status').dataset.kind = '';
    send('state');
  } else {
    send('pause');
    setModelsLocked(false);
    const performanceActive = performanceTab?.classList.contains('active');
    if (canvas) canvas.hidden = Boolean(performanceActive);
    if (previousStage && !performanceActive) {
      q('#motion-name').textContent = previousStage.name;
      q('#motion-meta').textContent = previousStage.meta;
      q('#review-status').textContent = previousStage.status;
      q('#review-status').dataset.kind = previousStage.statusKind;
    }
    if (mainWasPlaying && !performanceActive && mainPlay?.textContent !== '一時停止') mainPlay.click();
    mainWasPlaying = false;
  }
  writeURL();
  syncPrimary();
}

function activateBattleTab() {
  unlockShellAudio();
  document.querySelectorAll('[data-review-tab]').forEach(tab => {
    tab.classList.toggle('active', tab === battleTab);
    tab.setAttribute('aria-selected', String(tab === battleTab));
  });
  document.querySelectorAll('[data-review-page]').forEach(item => item.classList.toggle('active', item === page));
  setActive(true);
  queueMicrotask(() => queueMicrotask(syncPrimary));
}

battleTab.addEventListener('click', activateBattleTab);
quickLink.addEventListener('click', () => battleTab.click());
document.querySelectorAll('[data-review-tab]').forEach(tab => {
  if (tab !== battleTab) tab.addEventListener('click', () => queueMicrotask(() => setActive(false)));
});

function installPrimaryButton() {
  const switcher = q('.review-primary-switch');
  if (!switcher) return false;
  switcher.classList.add('has-battle');
  const secondary = q('.review-secondary-disclosure');
  if (secondary?.contains(page)) notebook.insertBefore(page, secondary);
  let button = switcher.querySelector('[data-primary-review="battle"]');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.primaryReview = 'battle';
    button.textContent = '戦闘';
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => battleTab.click());
    switcher.append(button);
  }
  syncPrimary();
  return Boolean(secondary && !secondary.contains(page));
}

const primaryObserver = new MutationObserver(() => {
  if (installPrimaryButton()) primaryObserver.disconnect();
});
primaryObserver.observe(document.body, { childList: true, subtree: true });
queueMicrotask(installPrimaryButton);

function update(state) {
  updateShellAudio(state);
  latest = { ...latest, ...state };
  ready = Boolean(latest.ready && latest.modelReady !== false);
  q('#battle-shell-play').disabled = !ready;
  q('#battle-shell-restart').disabled = !ready;
  q('#battle-shell-speed').disabled = !ready;
  q('#battle-shell-play').textContent = latest.playing ? '一時停止' : '再生';
  q('#battle-shell-speed').value = String(latest.speed || 1);
  q('#battle-shell-repeat').checked = Boolean(latest.repeat);
  q('#battle-hero-hp').textContent = `${Math.max(0, Math.round(latest.heroHp || 0))} / ${Math.round(latest.heroMaxHp || 0)}`;
  q('#battle-enemy-hp').textContent = `${Math.max(0, Math.round(latest.enemyHp || 0))} / ${Math.round(latest.enemyMaxHp || 0)}`;
  q('#battle-hero-action').textContent = latest.heroAction || (ready ? '接敵' : 'モデル読込中');
  q('#battle-enemy-action').textContent = latest.enemyAction || (ready ? '接敵' : 'モデル読込中');
  q('#battle-shell-source').textContent = latest.sourceVersion || 'Tidebreak';
  const statusText = latest.status || (ready ? '自動戦闘を観戦できます。' : '実モデルを読み込んでいます。');
  q('#battle-shell-status').textContent = statusText;
  q('#battle-shell-status').dataset.kind = latest.error ? 'error' : '';
  document.querySelectorAll('[data-battle-shell-view]').forEach(button => button.classList.toggle('active', button.dataset.battleShellView === latest.view));
  syncSoundButton();
  if (active) {
    q('#motion-name').textContent = latest.finished ? `${latest.winner === 'demon' ? '魔物側' : '人間側'} 勝利` : 'Tidebreak 自動戦闘';
    q('#motion-meta').textContent = ready
      ? `${Number(latest.time || 0).toFixed(1)}秒 / ${latest.heroAction || '接敵'} × ${latest.enemyAction || '接敵'}`
      : '実モデルを準備しています';
    q('#review-status').textContent = statusText;
    q('#review-status').dataset.kind = latest.error ? 'error' : '';
    writeURL();
    syncPrimary();
  }
}

frame.addEventListener('load', () => {
  frameReady = true;
  const requested = Number(new URLSearchParams(location.search).get('battleSpeed'));
  if ([0.25, 0.5, 1, 2].includes(requested)) send('speed', requested);
  send('repeat', q('#battle-shell-repeat').checked);
  send('state');
});

window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.type !== 'visual-review-battle-state') return;
  update(event.data.state || {});
});

q('#battle-shell-play').addEventListener('click', () => { unlockShellAudio(); send('play-toggle'); });
q('#battle-shell-restart').addEventListener('click', () => { unlockShellAudio(); send('restart'); });
q('#battle-shell-speed').addEventListener('change', event => { unlockShellAudio(); send('speed', Number(event.target.value)); });
q('#battle-shell-repeat').addEventListener('change', event => send('repeat', event.target.checked));
q('#battle-shell-sound').addEventListener('click', () => {
  shellAudio.setEnabled(!shellAudio.enabled);
  if (shellAudio.enabled) unlockShellAudio();
  syncSoundButton();
});
document.querySelectorAll('[data-battle-shell-view]').forEach(button => button.addEventListener('click', () => { unlockShellAudio(); send('view', button.dataset.battleShellView); }));

syncSoundButton();
const initial = new URLSearchParams(location.search);
if (initial.get('tab') === 'battle') queueMicrotask(() => battleTab.click());
