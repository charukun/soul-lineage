import { THREE } from '@soul/rendering';
import { installReviewExtensions } from './review-adapter.js';
import { createBattleAudio } from './battle-audio.js';
import { AUTO_BATTLE_STEP, createTidebreakBattleSession } from './tidebreak-battle-session.js';

const q = selector => document.querySelector(selector);
const embedded = new URLSearchParams(location.search).get('embed') === '1';
if (embedded) document.body.classList.add('embedded-battle');

const TECHNIQUES = Object.freeze({
  slash: '流し斬り', back: '斬り返し', thrust: '刺し貫く', heavy: '叩き斬る',
  dash: '駆け抜け斬り', spin: '旋回斬り', leap: '飛び込み斬り', retreat: '退いて構える',
  uppercut: '斬り上げる', sweep: '足元を薙ぐ', diagonal: '袈裟に断つ', crosscut: '十字に斬り結ぶ',
  round: '一回転の大薙ぎ', pierce: '渾身の貫き', jab: '左の牽制拳', straight: '右の正拳',
  hook: '回し拳', bodyblow: '腹打ち', risingfist: '突き上げ拳', oneinch: '寸勁', barrage: '連環双拳',
  rushfist: '崩山・突進拳', katanaDraw: '居合い抜き', katanaKesa: '袈裟の一太刀',
  katanaReturn: '逆袈裟の返し', katanaThrust: '切っ先で貫く', spearwheel: '風車の連旋',
  guard: '堅く防ぐ', parry: '刃を弾く', counter: '受け流して反撃',
});
const WORLD_SCALE = 0.78;
const VIEW_OFFSETS = Object.freeze({
  three: new THREE.Vector3(6.8, 4.3, 6.8),
  front: new THREE.Vector3(0, 3.45, 8.4),
  side: new THREE.Vector3(8.4, 3.45, 0),
});

const canvas = q('#battle-canvas');
const flash = q('#battle-flash');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.35));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#10151b');
scene.fog = new THREE.Fog('#10151b', 12, 27);
const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 80);
scene.add(new THREE.HemisphereLight('#dce9ff', '#272117', 1.55));
const key = new THREE.DirectionalLight('#fff0cf', 3.05);
key.position.set(4, 8, 4); key.castShadow = true; scene.add(key);
const rim = new THREE.DirectionalLight('#86a9ff', 1.05);
rim.position.set(-5, 4, -3); scene.add(rim);
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(10, 72),
  new THREE.MeshStandardMaterial({ color: '#20262c', roughness: 0.96, metalness: 0.02 }),
);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const ring = new THREE.Mesh(
  new THREE.RingGeometry(3.5, 3.56, 72),
  new THREE.MeshBasicMaterial({ color: '#78838e', transparent: true, opacity: 0.42, side: THREE.DoubleSide }),
);
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.006; scene.add(ring);

function makePlaceholder({ weapon = false } = {}) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: '#6e7b88', roughness: 0.82, transparent: true, opacity: 0.28, wireframe: true });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.82, 5, 10), material);
  body.position.y = 0.92; group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 9), material);
  head.position.y = 1.68; group.add(head);
  if (weapon) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.1, 0.06), material);
    blade.position.set(0.42, 1.05, 0.05); blade.rotation.z = -0.46; group.add(blade);
  }
  return group;
}

function makeActor(placeholderOptions) {
  const anchor = new THREE.Group();
  const placeholder = makePlaceholder(placeholderOptions);
  anchor.add(placeholder); scene.add(anchor);
  return { anchor, placeholder, body: null, mixer: null, action: null, clipName: '', weaponId: 'fist' };
}
const heroActor = makeActor({ weapon: true });
const enemyActor = makeActor({ weapon: true });

const audio = createBattleAudio();
let session = createTidebreakBattleSession();
let battle = session.state();
let playing = false;
let repeat = true;
let speed = 1;
let view = 'three';
let ready = false;
let modelError = '';
let extensionsPromise = null;
let modelLoadController = null;
let accumulator = 0;
let finishedFor = 0;
let lastTime = performance.now();
let lastPublish = 0;
let previousHP = { hero: battle.hero.hp, enemy: battle.enemy.hp };
let previousCombat = {
  hero: { attack: null, progress: 0, guarding: false },
  enemy: { attack: null, progress: 0, guarding: false },
};
let cameraKick = 0;
let flashAmount = 0;
let resumeAfterVisibility = false;
const impacts = [];

function status(text, error = false) {
  const node = q('#battle-status');
  node.textContent = text;
  node.dataset.kind = error ? 'error' : '';
}

function resize() {
  const width = canvas.clientWidth || innerWidth;
  const height = canvas.clientHeight || innerHeight;
  const dpr = Math.min(devicePixelRatio || 1, 1.35);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
  }
  camera.aspect = Math.max(0.1, width / Math.max(1, height));
  camera.updateProjectionMatrix();
}

function findClip(body, actor) {
  const names = body?.clipNames || [];
  if (actor.dead) return names.find(name => /Death|Dead|Down|倒|死亡/i.test(name)) || names.find(name => /Hit Reaction|被弾/i.test(name)) || null;
  if (actor.stun > 0) return names.find(name => /Hit Reaction|被弾|Damage|Hurt/i.test(name)) || null;
  if (actor.attack) {
    const technique = TECHNIQUES[actor.attack];
    if (technique) {
      const exact = names.find(name => name.includes(technique));
      if (exact) return exact;
    }
    return names.find(name => /Tidebreak\s*\/\s*Attack|Attack|Slash|Punch|Kick|Strike|攻撃|技\s*\//i.test(name)) || null;
  }
  if (actor.guarding) return names.find(name => name === '技 / 堅く防ぐ') || names.find(name => /Guard|Parry|Block|防御|パリィ/i.test(name)) || null;
  return names.find(name => name === '構え / 自然体') || names.find(name => name === 'Tidebreak / Idle') || names.find(name => /Idle|Ready|Stance|構え|待機/i.test(name)) || names[0] || null;
}

function sampleActor(target, actor, elapsed) {
  target.anchor.position.set(actor.x * WORLD_SCALE, 0, actor.z * WORLD_SCALE);
  target.anchor.rotation.y = -actor.yaw;
  if (!target.body || !target.mixer) return;
  const clipName = findClip(target.body, actor);
  if (!clipName) return;
  if (target.clipName !== clipName) {
    target.mixer.stopAllAction();
    const clip = target.body.getClip?.(clipName, { inPlace: true });
    if (!clip) return;
    target.clipName = clipName;
    target.action = target.mixer.clipAction(clip);
    target.action.reset();
    target.action.setLoop(actor.attack ? THREE.LoopOnce : THREE.LoopRepeat, actor.attack ? 1 : Infinity);
    target.action.clampWhenFinished = true;
    target.action.play();
  }
  const action = target.action;
  const duration = action?.getClip?.().duration || 1;
  if (!action) return;
  action.enabled = true;
  action.paused = false;
  action.time = actor.attack
    ? Math.max(0, Math.min(0.999, actor.progress || 0)) * duration
    : elapsed % duration;
  target.mixer.update(0);
  target.body.afterSample?.(action.time, clipName, {
    mode: 'combat', inPlace: true, weaponEnabled: target.weaponId !== 'fist', weaponId: target.weaponId,
  });
  target.body.root?.updateMatrixWorld?.(true);
}

function addImpact(actor, strong = false) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.24, strong ? 0.38 : 0.33, 28),
    new THREE.MeshBasicMaterial({ color: strong ? '#fff2a8' : '#ffb2a0', transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(actor.x * WORLD_SCALE, 0.035, actor.z * WORLD_SCALE);
  const light = new THREE.PointLight(strong ? '#ffd57b' : '#ff8f75', strong ? 16 : 9, strong ? 4.8 : 3.6, 2);
  light.position.set(actor.x * WORLD_SCALE, 1.0, actor.z * WORLD_SCALE);
  scene.add(mesh, light);
  impacts.push({ mesh, light, age: 0, strong });
  cameraKick = Math.max(cameraKick, strong ? 0.22 : 0.11);
  flashAmount = Math.max(flashAmount, strong ? 0.72 : 0.4);
  audio.hit(strong);
  if (navigator.vibrate) navigator.vibrate(strong ? [18, 10, 22] : 10);
}

function animateImpacts(dt) {
  for (let i = impacts.length - 1; i >= 0; i--) {
    const item = impacts[i];
    item.age += dt;
    const t = Math.min(1, item.age / (item.strong ? 0.5 : 0.38));
    item.mesh.scale.setScalar(1 + t * (item.strong ? 3.5 : 2.7));
    item.mesh.material.opacity = 0.95 * (1 - t);
    item.light.intensity = (item.strong ? 16 : 9) * (1 - t);
    if (t >= 1) {
      item.mesh.removeFromParent();
      item.light.removeFromParent();
      item.mesh.geometry.dispose();
      item.mesh.material.dispose();
      item.light.dispose?.();
      impacts.splice(i, 1);
    }
  }
  flashAmount = Math.max(0, flashAmount - dt * 4.8);
  flash.style.opacity = String(flashAmount);
  cameraKick *= Math.exp(-dt * 11.5);
}

function actorAction(actor) {
  if (!ready) return 'モデル読込中';
  if (actor.dead) return '戦闘不能';
  if (actor.stun > 0) return '被弾';
  if (actor.attack) return TECHNIQUES[actor.attack] || actor.skill || actor.attack;
  if (actor.guarding) return '防御';
  return actor.combatReady ? '間合い' : '接敵';
}

function syncHUD() {
  const hero = battle.hero;
  const enemy = battle.enemy;
  q('#hero-name').textContent = hero.name || '魔物側';
  q('#enemy-name').textContent = enemy.name || '人間側';
  q('#hero-hp').textContent = `${Math.max(0, Math.round(hero.hp))} / ${Math.round(hero.maxhp)}`;
  q('#enemy-hp').textContent = `${Math.max(0, Math.round(enemy.hp))} / ${Math.round(enemy.maxhp)}`;
  q('#hero-hp-fill').style.width = `${Math.max(0, Math.min(100, hero.hp / Math.max(1, hero.maxhp) * 100))}%`;
  q('#enemy-hp-fill').style.width = `${Math.max(0, Math.min(100, enemy.hp / Math.max(1, enemy.maxhp) * 100))}%`;
  q('#hero-action').textContent = actorAction(hero);
  q('#enemy-action').textContent = actorAction(enemy);
  q('#battle-clock').textContent = `${battle.time.toFixed(1)} 秒`;
  q('#battle-source').textContent = battle.sourceVersion;
  const result = q('#battle-result');
  result.hidden = !battle.finished;
  result.textContent = battle.finished ? `${battle.winner === 'demon' ? '魔物側' : '人間側'} 勝利` : '';
  q('#battle-play').disabled = !ready;
  q('#battle-restart').disabled = !ready;
  q('#battle-speed').disabled = !ready;
  q('#battle-play').textContent = playing ? '一時停止' : '再生';
  q('#battle-speed').value = String(speed);
  q('#battle-retry').hidden = !modelError;
  document.querySelectorAll('[data-battle-view]').forEach(button => button.classList.toggle('active', button.dataset.battleView === view));

  const sound = q('#battle-sound');
  sound.disabled = !audio.supported;
  sound.setAttribute('aria-pressed', String(audio.enabled));
  sound.textContent = !audio.supported ? '音非対応' : audio.enabled ? '音 ON' : audio.wanted ? '音をON' : '音 OFF';
}

function publicState() {
  return {
    ready,
    modelReady: ready,
    error: modelError || null,
    playing,
    repeat,
    speed,
    view,
    time: battle.time,
    finished: battle.finished,
    winner: battle.winner,
    heroHp: battle.hero.hp,
    heroMaxHp: battle.hero.maxhp,
    enemyHp: battle.enemy.hp,
    enemyMaxHp: battle.enemy.maxhp,
    heroAction: actorAction(battle.hero),
    enemyAction: actorAction(battle.enemy),
    sourceVersion: battle.sourceVersion,
    audioEnabled: audio.enabled,
    status: q('#battle-status').textContent,
  };
}

function publish(force = false, now = performance.now()) {
  if (parent === window) return;
  if (!force && now - lastPublish < 100) return;
  lastPublish = now;
  parent.postMessage({ type: 'visual-review-battle-state', state: publicState() }, location.origin);
}

function resetCombatTracking() {
  previousCombat = {
    hero: { attack: null, progress: 0, guarding: false },
    enemy: { attack: null, progress: 0, guarding: false },
  };
}

function resetBattle() {
  session = createTidebreakBattleSession();
  battle = session.state();
  accumulator = 0;
  finishedFor = 0;
  previousHP = { hero: battle.hero.hp, enemy: battle.enemy.hp };
  resetCombatTracking();
  playing = ready;
  if (ready) status('');
  syncHUD();
  publish(true);
}

function clearBody(target) {
  target.mixer?.stopAllAction();
  target.body?.dispose?.();
  target.body?.root?.removeFromParent?.();
  target.body = null;
  target.mixer = null;
  target.action = null;
  target.clipName = '';
  target.weaponId = 'fist';
  target.placeholder.visible = true;
}

async function loadBody(target, presetId, weaponId, extensions, signal) {
  const body = await extensions.loadPreset({
    presetId,
    signal,
    onProgress: message => status(message),
  });
  if (signal.aborted) throw signal.reason || new DOMException('Model load aborted', 'AbortError');
  body.root.position.set(0, 0, 0);
  body.root.rotation.set(0, 0, 0);
  body.root.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = false;
  });
  target.anchor.add(body.root);
  target.placeholder.visible = false;
  target.body = body;
  target.mixer = new THREE.AnimationMixer(body.root);
  target.weaponId = weaponId;
  if (body.setWeapon) {
    try {
      await body.setWeapon({ enabled: weaponId !== 'fist', id: weaponId, scale: 0.5, x: 0, y: 0, z: -90 });
    } catch (error) {
      console.warn(`Battle weapon unavailable: ${weaponId}`, error);
    }
  }
}

async function loadModels() {
  modelLoadController?.abort();
  modelLoadController = new AbortController();
  const { signal } = modelLoadController;
  ready = false;
  playing = false;
  modelError = '';
  clearBody(heroActor);
  clearBody(enemyActor);
  status('実モデルを準備しています');
  syncHUD();
  publish(true);

  try {
    extensionsPromise ||= installReviewExtensions({ scene });
    const extensions = await extensionsPromise;
    if (signal.aborted) return;
    status('SHINOを読み込んでいます');
    await loadBody(heroActor, 'model.SHINO', 'sword', extensions, signal);
    status('Aを読み込んでいます');
    await loadBody(enemyActor, 'model.A', 'sword', extensions, signal);
    if (signal.aborted) return;
    ready = true;
    modelError = '';
    status('');
    resetBattle();
  } catch (error) {
    if (signal.aborted || error?.name === 'AbortError') return;
    console.error(error);
    ready = false;
    playing = false;
    modelError = error?.message || String(error);
    status(`実モデルの読込に失敗しました: ${modelError}`, true);
    syncHUD();
    publish(true);
  }
}

function cameraTrack(dt) {
  const a = heroActor.anchor.position;
  const b = enemyActor.anchor.position;
  const center = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  center.y = 1.1;
  const offset = VIEW_OFFSETS[view] || VIEW_OFFSETS.three;
  camera.position.copy(center).add(offset);
  if (cameraKick > 0.001) {
    camera.position.x += (Math.random() - 0.5) * cameraKick;
    camera.position.y += (Math.random() - 0.5) * cameraKick * 0.55;
    camera.position.z += (Math.random() - 0.5) * cameraKick;
  }
  camera.lookAt(center);
}

function attackStarted(current, previous) {
  if (!current.attack) return false;
  if (!previous.attack || current.attack !== previous.attack) return true;
  return current.progress + 0.28 < previous.progress;
}

function detectCombatFeedback(next) {
  for (const side of ['hero', 'enemy']) {
    const current = next[side];
    const previous = previousCombat[side];
    if (attackStarted(current, previous)) audio.attack(current.attack);
    if (current.guarding && !previous.guarding) audio.guard();
    previousCombat[side] = {
      attack: current.attack,
      progress: current.progress,
      guarding: current.guarding,
    };
  }
}

function stepBattle(dt) {
  if (battle.finished) return;
  const next = session.step(dt);
  detectCombatFeedback(next);
  const heroDamage = previousHP.hero - next.hero.hp;
  const enemyDamage = previousHP.enemy - next.enemy.hp;
  if (heroDamage > 0.01) addImpact(next.hero, heroDamage > 20);
  if (enemyDamage > 0.01) addImpact(next.enemy, enemyDamage > 20);
  previousHP = { hero: next.hero.hp, enemy: next.enemy.hp };
  const justFinished = !battle.finished && next.finished;
  battle = next;
  if (justFinished) {
    audio.knockout();
    status(`${battle.winner === 'demon' ? '魔物側' : '人間側'}が勝利`);
    if (!repeat) playing = false;
  }
}

function frame(now) {
  const wallDt = Math.min(0.08, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  resize();
  if (playing && ready) {
    if (battle.finished) {
      if (repeat) {
        finishedFor += wallDt * speed;
        if (finishedFor >= 1.25) resetBattle();
      }
    } else {
      accumulator += wallDt * speed;
      let guard = 0;
      while (accumulator >= AUTO_BATTLE_STEP && guard++ < 8) {
        stepBattle(AUTO_BATTLE_STEP);
        accumulator -= AUTO_BATTLE_STEP;
      }
    }
  }
  sampleActor(heroActor, battle.hero, battle.time);
  sampleActor(enemyActor, battle.enemy, battle.time);
  animateImpacts(wallDt);
  cameraTrack(wallDt);
  syncHUD();
  renderer.render(scene, camera);
  publish(false, now);
  requestAnimationFrame(frame);
}

async function wakeSound() {
  if (!audio.supported || !audio.wanted) return false;
  const unlocked = await audio.unlock();
  syncHUD();
  publish(true);
  return unlocked;
}

q('#battle-play').addEventListener('click', async () => {
  await wakeSound();
  if (!ready) return;
  playing = !playing;
  syncHUD();
  publish(true);
});
q('#battle-restart').addEventListener('click', async () => {
  await wakeSound();
  if (ready) resetBattle();
});
q('#battle-speed').addEventListener('change', async event => {
  await wakeSound();
  speed = Number(event.target.value) || 1;
  publish(true);
});
document.querySelectorAll('[data-battle-view]').forEach(button => button.addEventListener('click', async () => {
  await wakeSound();
  view = button.dataset.battleView;
  syncHUD();
  publish(true);
}));
q('#battle-sound').addEventListener('click', async () => {
  if (!audio.supported) return;
  if (audio.enabled) audio.setEnabled(false);
  else {
    audio.setEnabled(true);
    await audio.unlock();
  }
  syncHUD();
  publish(true);
});
q('#battle-retry').addEventListener('click', loadModels);
canvas.addEventListener('pointerdown', wakeSound, { once: true });

window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'visual-review-battle-control') return;
  const { command, value } = event.data;
  if (command === 'play-toggle' && ready) playing = !playing;
  if (command === 'pause') playing = false;
  if (command === 'restart' && ready) resetBattle();
  if (command === 'speed' && [0.25, 0.5, 1, 2].includes(Number(value))) speed = Number(value);
  if (command === 'repeat') repeat = Boolean(value);
  if (command === 'view' && VIEW_OFFSETS[value]) view = value;
  syncHUD();
  publish(true);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    resumeAfterVisibility = playing;
    playing = false;
  } else if (resumeAfterVisibility && ready) {
    resumeAfterVisibility = false;
    playing = true;
    lastTime = performance.now();
  }
  syncHUD();
  publish(true);
});
window.addEventListener('pagehide', () => modelLoadController?.abort(), { once: true });

syncHUD();
publish(true);
loadModels();
requestAnimationFrame(frame);
