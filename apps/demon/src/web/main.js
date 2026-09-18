import {activeCharacter, CHARACTER_SELECTION_ENABLED} from '../characters.js';
import {openCharacterSelection} from './character-selection.js';
import {huntUiState} from './hunt-ui-state.js';
import {sharedEmblemUrl} from '@soul/assets';
import noticesUrl from '@soul/night-assets/notices';
import {createExclusiveProfileStorage} from './profile-storage.js';
import {NightView} from './view.js';
import {NightAudio} from './audio.js';
import {HuntProfileStore as ProfileStore, HuntSession as RaidSession} from '../hunt/runtime.js';
import {chooseHunt} from '../hunt/balance.js';
import {HuntFlowUi} from './hunt-flow-ui.js';
import {PREY, FORMS, offerVillages} from '@soul/raid/world';
import {SwipeInput} from '@soul/input';
import {renderLineage} from './lineage.js';
import {huntPresentationSnapshot} from './presentation-snapshot.js';
import {renderExplanationCards} from './explanation-ui.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
let view, game, store, profile, flow, error = null, mode = 'title', paused = false, sheetKind = '', entering = false;
let toastUntil = 0, last = 0, acc = 0, returnMode = false, lastHud = 0, disposeCharacterSelection = null;
const swipe = new SwipeInput(), audio = new NightAudio();
function safe(fn) { try { return fn(); } catch (e) { console.error(e); showError(e.message || String(e)); } }
function pauseInput() { game?.resetIdle(); swipe.cancel(); $('move-pad').hidden = true; $('dash-stop').hidden = true; }
function sheet(title, kicker, html, kind) {
  pauseInput();
  const panel = $('sheet');
  panel.dataset.kind = kind || 'generic';
  panel.lang = document.documentElement.lang || 'ja';
  $('sheet-title').textContent = title; $('sheet-kicker').textContent = kicker;
  $('sheet-body').innerHTML = html; panel.hidden = false; sheetKind = kind;
}
function showError(text) { sheet('確認が必要です', '保存と再開', `<p class="error">${esc(text)}</p><p class="muted">保存データは削除していません。</p>`, 'error'); }
function closeSheet() {
  disposeCharacterSelection?.(); disposeCharacterSelection = null; pauseInput();
  $('sheet').hidden = true; $('sheet').dataset.kind = 'generic'; sheetKind = '';
}
function dismissSheet() {
  if (sheetKind === 'error' && error) return;
  if (mode === 'result') { mode = 'title'; $('title').hidden = false; $('hud').hidden = true; }
  paused = false; closeSheet(); refresh();
}
function characters() {
  if (!CHARACTER_SELECTION_ENABLED) return;
  disposeCharacterSelection?.();
  disposeCharacterSelection = openCharacterSelection({store, view, sheet, onSaved: refresh, onClose: dismissSheet});
}
function refresh() { profile = store.read(); game?.refreshProfile(profile); $('title-character').textContent = '狩る姿 · ' + activeCharacter(profile).name; flow?.refreshHub(profile); }
function toast(text, duration = 2.2) { toastUntil = performance.now() + duration * 1000; $('toast').textContent = text; $('toast').style.opacity = '1'; }
function event(e) {
  view?.event(e); audio.event(e);
  if (e.type === 'consume') {
    const gain = e.reward;
    toast(gain.memoryNew ? `${PREY[e.role].power}を獲得 · 戦利品 +${gain.lootGain}` : `生命 +${Math.ceil(gain.healed)} · 戦利品 +${gain.lootGain}`);
    if (game.goalReady()) returnMode = true;
  }
  if (e.type === 'ward') toast('結界。別の道を探そう');
  if (e.type === 'gate') toast('封鎖を砕いた');
  if (e.type === 'disengage') toast('戦闘を離れた');
  if (e.type === 'finish') { mode = 'result'; pauseInput(); showResult(e); }
}
function newSession(v) {
  refresh();
  game = new RaidSession(v, profile, {
    event,
    consume(role, options) { const first = store.consume(role, options); refresh(); return first; },
    battle(role) { store.recordBattle(role); refresh(); },
    learn(role, move) { const first = store.learn(role, move); refresh(); return first; },
    finish(status, n) { store.finish(v.id, status, n, game.huntReceipt); refresh(); }
  });
  view.build(game.village); view.snapCamera(game.player);
}
async function claimAndEnter(v) {
  if (entering) return;
  entering = true; $('begin').disabled = true;
  try {
    pauseInput(); await view.prepareCharacter(activeCharacter(store.read()).id);
    store.claim(v); closeSheet(); newSession(v); mode = 'hunt'; paused = false; returnMode = false;
    $('title').hidden = true; $('hud').hidden = false; audio.start(); last = 0; acc = 0; toastUntil = 0;
  } catch (e) { showError(e.message || String(e)); }
  finally { entering = false; $('begin').disabled = false; }
}
async function randomHunt(route = 'mission') {
  if (entering) return;
  try { refresh(); const v = chooseHunt(offerVillages(store), profile, route); await claimAndEnter(v); }
  catch (e) { showError(e.message || String(e)); }
}
function lineage() { refresh(); sheet('転生史', '身体に残ったもの', renderLineage(profile), 'lineage'); }
function help() {
  const cards = [
    {mark:'歩', title:'移動する', body:'指を滑らせて移動。敵に近づくと戦闘は自動で始まります。', note:'危険なら敵と逆へ距離を取り、間合いを切る。'},
    {mark:'喰', title:'捕食する', body:'倒れた獲物のそばで止まると捕食が始まります。', note:'動くと中断。安全を確かめて止まる。'},
    {mark:'帰', title:'帰還する', body:'帰還口の輪の中で止まると、戦利品を確保して戻れます。', note:'持ち帰った戦利品で肉体を強化できる。'},
    {mark:'失', title:'倒れたとき', body:'死亡すると、その夜にまだ確保していない戦利品を失います。', note:'覚えた特能と恒久強化は次の生にも残る。'}
  ];
  sheet('狩りかた', '遊びながら覚える', renderExplanationCards(cards, {locale: document.documentElement.lang}), 'help');
}
function settings() {
  let html = '<button class="inline-action" id="movement-help">狩りかた</button><button class="inline-action" id="sound-toggle">環境音・効果音：' + (audio.enabled ? '入' : '切') + '</button><button class="inline-action" id="visit-log">喰痕</button><button class="inline-action" id="credits">素材と接続状況</button><button class="inline-action" id="music-library">音楽室・BGM音量</button><button class="inline-action" id="settings-memory">転生史</button>';
  if (mode === 'hunt') html += '<button class="inline-action" id="give-up">この狩りを中断する<small>未確保の戦利品を失う</small></button>';
  sheet('ひと息つく', '狩りは停止中', html, 'settings');
  $('movement-help').onclick = help; $('sound-toggle').onclick = () => { audio.start(); audio.toggle(); settings(); };
  $('visit-log').onclick = visits; $('credits').onclick = credits; $('settings-memory').onclick = lineage;
  $('music-library').hidden = !window.__SOUL_MUSIC__; $('music-library').onclick = () => window.__SOUL_MUSIC__?.open();
  $('give-up')?.addEventListener('click', () => {
    sheet('戦利品を捨てて戻る？', '狩りの中断', `<p>未確保の戦利品 ${game.carried} を失います。</p><button class="primary" id="confirm-leave">中断する</button><button class="inline-action" id="keep-hunting">狩りを続ける</button>`, 'leave');
    $('confirm-leave').onclick = () => safe(() => game.finish('abandoned')); $('keep-hunting').onclick = dismissSheet;
  });
}
function visits() {
  refresh(); const rows = Object.values(profile.visits).reverse();
  sheet('喰痕', '訪れた夜', rows.length ? rows.map(v => `<div class="visit-row">${esc(v.name)}<span>${({entered:'夜の中', escaped:'帰還', defeated:'死亡', abandoned:'中断', completed:'帰還'})[v.status]}</span></div>`).join('') : '<p>まだ喰痕はない。</p>', 'visits');
}
function credits() {
  sheet('素材と接続状況', '尽喰廻遊', `<p>戦闘は共通Tidebreakの序破急・間合い・接触判定を使用しています。</p><div class="credits">KayKit Dungeon Remastered / Kay Lousberg / CC0<br>floor_tile_small.obj：石畳<br>banner_blue.obj：村門・礼拝所の布<br>家屋：共通ハウジングモデル<br>人間：輪廻転焦共通 production villager model<br>怪物：尽喰廻遊の夜魔モデル<br>描画：Three.js / MIT<br>音：合成音</div><p>この狩りはオフラインの単独プレイです。戦利品と転生史は、このブラウザに保存します。</p><div class="provenance">${esc(__BUILD_INFO__.environment.toUpperCase())} / ${esc(__BUILD_INFO__.commit.slice(0, 12))}<br><a href="${esc(noticesUrl)}" target="_blank" rel="noopener">利用素材とライセンス</a></div>`, 'credits');
}
function showResult(e) { flow.result(e, game); }
function toggleReturn() { if (mode !== 'hunt' || game.eaten < 1 || game.devour) return; pauseInput(); returnMode = !returnMode; }
function hud(now) {
  if (!game) return;
  const p = game.player, ui = huntUiState(game, {returning: returnMode}), count = ui.fight ? game.combatantCount?.() || 1 : 0;
  $('life-fill').style.width = Math.max(0, p.hp) / p.maxhp * 100 + '%'; $('life-text').textContent = `${Math.ceil(Math.max(0, p.hp))} / ${p.maxhp}`;
  $('form-name').textContent = FORMS[profile.form].name; $('village-name').textContent = game.village.name;
  $('night-label').textContent = `LIFE ${profile.currentLife?.number || 1} · NIGHT ${profile.hunts + 1}`;
  $('battle').style.opacity = ui.fight ? '1' : '0'; $('enemy-name').textContent = ui.fight ? game.fight.npc.name + (count > 1 ? ' ×' + count : '') : '';
  $('skill-name').textContent = game.fight?.retreat > 0 ? '戦闘を離れる…' : p.skill || '間合いを測る';
  document.querySelectorAll('[data-phase]').forEach(el => el.classList.toggle('active', el.dataset.phase === p.slot));
  $('enemy-health').style.width = ui.fight ? Math.max(0, Math.min(100, game.fight.npc.hp / game.fight.npc.maxhp * 100)) + '%' : '0';
  $('scent').disabled = ui.scentDisabled; $('memory').disabled = ui.memoryDisabled; $('return').disabled = ui.returnDisabled;
  $('return').classList.toggle('locked', ui.returnLocked); $('return-label').textContent = ui.returnLocked ? '捕食後' : '帰路';
  $('scent').querySelector('span').textContent = game.scentCooldown > 0 ? Math.ceil(game.scentCooldown) + '秒' : '嗅覚';
  $('dash-stop').hidden = !swipe.dash; $('swipe-hint').style.opacity = '0';
  $('eaten-label').textContent = `捕食 ${game.eaten} · 技速 ${game.huntStats().techniqueSpeed}%`;
  $('toast').style.opacity = now < toastUntil && mode === 'hunt' && $('sheet').hidden ? '1' : '0';
  flow.update(game, {returning: returnMode, overlay: !$('sheet').hidden || paused || mode !== 'hunt'});
}
function installInput() {
  const el = $('game'); el.oncontextmenu = e => e.preventDefault();
  el.addEventListener('pointerdown', e => {
    if (mode !== 'hunt' || !$('sheet').hidden || paused || e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); if (!swipe.down(e.pointerId, e.clientX, e.clientY, performance.now())) return;
    game.resetIdle(); el.setPointerCapture(e.pointerId); $('move-pad').hidden = false;
    $('move-pad').style.left = e.clientX + 'px'; $('move-pad').style.top = e.clientY + 'px'; $('move-nub').style.transform = '';
  });
  el.addEventListener('pointermove', e => {
    if (!swipe.move(e.pointerId, e.clientX, e.clientY, performance.now())) return;
    e.preventDefault(); const d = Math.hypot(swipe.dx, swipe.dy) || 1, k = Math.min(1, 34 / d);
    $('move-nub').style.transform = `translate(${swipe.dx * k}px,${swipe.dy * k}px)`;
  });
  el.addEventListener('pointerup', e => {
    if (swipe.id !== e.pointerId) return;
    e.preventDefault(); const flick = swipe.up(e.pointerId, e.clientX, e.clientY, performance.now()); $('move-pad').hidden = true;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); if (flick) game.shadowStep(swipe.vector(.33));
  });
  el.addEventListener('pointercancel', pauseInput); el.addEventListener('lostpointercapture', () => { if (swipe.id !== null) pauseInput(); });
  function suspend() { pauseInput(); if (mode === 'hunt' && $('sheet').hidden) { paused = true; sheet('狩りを止めています', '一時停止', '<p>閉じると再開します。</p>', 'paused'); } }
  window.addEventListener('blur', suspend);
  document.addEventListener('visibilitychange', () => { pauseInput(); audio.pause(document.hidden); if (document.hidden) suspend(); });
}
function frame(now) {
  if (error) return; requestAnimationFrame(frame);
  try {
    if (!view || !game) return;
    const dt = Math.max(0, Math.min(.07, (now - (last || now)) / 1000)); last = now;
    const running = mode === 'hunt' && $('sheet').hidden && !paused && !document.hidden;
    if (running) {
      if (game.scentCooldown <= 0 && !game.player.autoRoam) game.sense();
      acc = Math.min(.10, acc + dt); let steps = 0;
      while (acc >= 1 / 60 && steps++ < 6) {
        const v = swipe.vector(.33); v.dash = swipe.dash; v.active = swipe.id !== null; game.tick(1 / 60, v); acc -= 1 / 60;
        if (game.fight && swipe.dash) pauseInput(); if (game.finished) break;
      }
      audio.feed(game.player.devourProgress); audio.tick(dt, game.player.speed > .15 && !game.fight);
    } else { audio.feed(null); acc = 0; }
    view.feastTarget = running ? flow.target(game, returnMode) : null;
    view.update(game, dt, mode === 'title'); if (now - lastHud > 80) { hud(now); lastHud = now; }
  } catch (e) {
    error = e; pauseInput(); console.error(e); $('boot').hidden = false; $('boot-message').textContent = '狩場を再開できません';
    $('boot-detail').textContent = e.message; $('boot-retry').hidden = false; $('game').dataset.renderer = 'error';
  }
}
export async function boot() {
  const storage = await createExclusiveProfileStorage(__BUILD_INFO__.environment);
  view = new NightView($('game')); store = new ProfileStore(storage, () => crypto.randomUUID(), () => Date.now());
  profile = store.read(); store.abandonInterrupted(); profile = store.read();
  const preview = {id:'title-only-not-entered', name:'森の向こうの灯', seed:67002, target:'arcanist', level:1, weather:'fog', source:'generated'};
  game = new RaidSession(preview, profile, {}); view.build(game.village); await view.prepareCharacter(activeCharacter(profile).id);
  game.player.x = 1; game.player.z = 20; game.player.yaw = .5; view.camera.position.set(5, 3.6, 27); view.cameraLook.set(1, .95, 18); view.update(game, 0, true);
  flow = new HuntFlowUi({sheet, start: randomHunt, profile: () => profile, species: () => game.monsterSpecies, toggleReturn,
    upgrade: key => safe(() => { const changed = store.upgrade(key); refresh(); return changed; })});
  $('game').dataset.renderer = 'ready'; Object.assign($('game').dataset, {app:'demon', commit:__BUILD_INFO__.commit, environment:__BUILD_INFO__.environment, platform:'web', world:'night-hunt.v5', asset:'kaykit.floor_tile_small'});
  $('emblem').src = sharedEmblemUrl; $('boot').hidden = true; $('title').hidden = false;
  $('title-character').hidden = !CHARACTER_SELECTION_ENABLED; if (CHARACTER_SELECTION_ENABLED) $('title-character').onclick = () => safe(characters); refresh();
  $('begin').onclick = () => void randomHunt(); $('title-memory').onclick = () => safe(lineage); $('title-settings').onclick = () => safe(settings); $('connection').onclick = credits;
  $('game').addEventListener('webglcontextlost', e => {
    e.preventDefault(); error = Error('描画が中断されました。再試行でタイトルへ戻ります。保存済みの強化と喰痕は保持します。');
    pauseInput(); $('boot').hidden = false; $('boot-message').textContent = '描画が中断されました'; $('boot-detail').textContent = error.message;
    $('boot-retry').hidden = false; $('game').dataset.renderer = 'lost';
  });
  $('pause').onclick = () => safe(settings); $('memory').onclick = () => safe(lineage); $('scent').onclick = () => { game.resetIdle(); audio.start(); game.sense(); };
  $('objective-help').onclick = () => safe(help); $('swipe-hint').onclick = () => safe(help);
  $('return').onclick = toggleReturn; $('dash-stop').onclick = pauseInput; $('sheet-close').onclick = () => safe(dismissSheet);
  window.addEventListener('resize', () => view.resize()); installInput(); requestAnimationFrame(frame);
  window.__NIGHT_HUNT__ = {
    snapshot: () => ({mode, paused: !$('sheet').hidden || paused, source: game.village.source, village: game.village.id, visited: Object.keys(store.read().visits), profile: store.read(),
      player: JSON.parse(JSON.stringify(game.player)), npcs: game.village.npcs.map(n => ({id:n.id, kind:n.kind, adult:n.adult, role:n.role, hp:n.hp, dead:n.dead, eaten:n.eaten, x:n.x, z:n.z, marked:n.marked, state:n.state})),
      devouring: !!game.devour, combat: game.fight ? {...game.fight.core.state(), retreat:game.fight.retreat, count:game.combatantCount?.() || 1} : null,
      eaten:game.eaten, time:game.time, finished:game.finished, hunt:{plan:game.huntPlan, carried:game.carried, ready:game.goalReady(), stats:game.huntStats()}, metrics:view.metrics(),
      input:{id:swipe.id, dx:swipe.dx, dy:swipe.dy, amount:swipe.amount, dash:swipe.dash}}),
    presentationSnapshot: () => huntPresentationSnapshot({mode, paused: !$('sheet').hidden || paused, game, profile}), enterRandomHunt: randomHunt
  };
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('review')) window.__NIGHT_REVIEW__ = {
    enter: async () => { await claimAndEnter(chooseHunt(offerVillages(store), store.read())); },
    nearHuman(i = 0) { const n = game.village.npcs[i]; game.player.x = n.x; game.player.z = n.z + 2.5; game.player.yaw = Math.PI; },
    setPosition(x, z) { game.clearCombat?.(); game.devour = null; game.player.x = x; game.player.z = z; game.player.pose = null; },
    step(n = 1) { for (let i = 0; i < Math.min(n, 36000) && !game.finished; i++) game.tick(1 / 60, {x:0, z:0, amount:0}); },
    unlock(k) { store.unlock(k); refresh(); }, finish(s = 'escaped') { game.finish(s); }, retry(id) { return store.claim({id, name:'再訪テスト'}); },
    read: () => store.read(), screenshot() { view.update(game, 1 / 60, false); hud(performance.now()); }, ready: () => !!game
  };
}
