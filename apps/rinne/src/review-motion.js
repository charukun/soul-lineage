import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { KAYKIT_MODELS } from '@soul/characters';
import { buildMotionReviewCatalog, classifyReviewMotion, filterMotionReviewCatalog, REVIEW_MOTION_CATEGORY_LABELS } from './review-motion-catalog.js';
import { loadMotionManifest, motionCountLabel } from './review-motion-manifest.js';
import { captureReviewRig, createReviewMotionBridge, inspectReviewRig } from './review-motion-retarget.js';
import './review-motion-library.css';

const el = id => document.getElementById(id), canvas = el('motion-stage');
const status = message => { el('motion-status').textContent = message; };
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.setPixelRatio(Math.min(Number(globalThis.devicePixelRatio) || 1, 1.5));
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1110); scene.fog = new THREE.Fog(0x0b1110, 9, 22);
const camera = new THREE.PerspectiveCamera(38, 1, .04, 60), controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = .08; controls.minDistance = .7; controls.maxDistance = 12;
scene.add(new THREE.HemisphereLight(0xe3ece8, 0x27312d, 2.4));
const key = new THREE.DirectionalLight(0xffe7bc, 3.1); key.position.set(-4, 7, 5); scene.add(key);
const rim = new THREE.DirectionalLight(0x9ac8d5, 1.35); rim.position.set(5, 4, -4); scene.add(rim);
const ground = new THREE.Mesh(new THREE.CircleGeometry(3.5, 64), new THREE.MeshStandardMaterial({ color: 0x1a2420, roughness: .96, metalness: .01 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -.005; scene.add(ground);
const stage = new THREE.Group(); scene.add(stage);
const loader = new GLTFLoader(), cache = new Map(), errors = [];
let manifest, catalog = [], subject, target, current, selected, selectedModel = KAYKIT_MODELS[0];
let filter = 'recommended', playing = true, speed = 1, loop = true, last = performance.now(), loadSerial = 0, selectionSerial = 0, modelHeight = 1.8, alive = true, frameId = 0, tour = null;
const categoryOrder = ['recommended', 'life', 'move', 'combat', 'reaction', 'other', 'all'];
const categoryLabel = id => REVIEW_MOTION_CATEGORY_LABELS[id] || id;
const formatName = value => String(value).replaceAll('_', ' ').replace(/\s+/g, ' ').trim();
const fail = error => { errors.push(String(error?.message || error)); if (errors.length > 30) errors.shift(); status('読込失敗: ' + errors.at(-1)); canvas.dataset.motionState = 'error'; el('motion-load').value = 0; };
const count = document.createElement('output'); count.id = 'motion-count'; count.setAttribute('aria-label', '重複を除いた実モーション数'); count.textContent = 'MOTION CLIPS …';
el('motion-selected').parentElement.prepend(count);
const legacy = document.createElement('details'), legacyTitle = document.createElement('summary'), legacySelect = document.createElement('select');
legacyTitle.textContent = '既存の埋め込みクリップ（派生・静止姿勢を含む）'; legacySelect.id = 'motion-legacy'; legacySelect.setAttribute('aria-label', '既存クリップ。実モーション数には重複加算しません');
legacy.append(legacyTitle, legacySelect); el('motion-meta').parentElement.before(legacy);
const licenseLink = document.createElement('a'); licenseLink.href = './simulator/licenses/MOTION_LIBRARY_SOURCES.txt'; licenseLink.textContent = '素材の出典・ライセンス'; el('motion-meta').after(licenseLink);

async function asset(key, url, family) {
  if (!cache.has(key)) cache.set(key, loader.loadAsync(url).then(gltf => ({ gltf, rig: captureReviewRig(gltf.scene, family) })).catch(error => { cache.delete(key); throw error; }));
  return cache.get(key);
}
function stopAction() {
  if (current) { current.mixer.stopAllAction(); current.mixer.uncacheRoot(current.source.gltf.scene); current.source.rig.reset(); }
  current = null;
}
function setCameraPreset(id) {
  const h = Math.max(.6, modelHeight), y = h * .52, d = Math.max(2.15, h * 1.72);
  const positions = { front: [0, y, d], 'three-quarter': [d * .72, y, d * .72], side: [d, y, 0], back: [0, y, -d], face: [0, h * .81, d * .78] };
  camera.position.set(...(positions[id] || positions.front)); controls.target.set(0, id === 'face' ? h * .79 : y, 0); controls.update();
  for (const button of document.querySelectorAll('[data-motion-camera]')) button.setAttribute('aria-pressed', String(button.dataset.motionCamera === id));
}
function syncPlaybackUI() {
  const duration = current?.clip.duration || 0, time = Math.min(duration, Math.max(0, current?.action.time || 0));
  el('motion-play').textContent = playing ? '一時停止' : '▶ 再生'; el('motion-play').setAttribute('aria-pressed', String(playing));
  el('motion-loop').checked = loop; el('motion-time').max = String(Math.max(duration, .0001));
  if (document.activeElement !== el('motion-time')) el('motion-time').value = String(time);
  el('motion-time-label').value = time.toFixed(2) + ' / ' + duration.toFixed(2) + '秒';
}
function renderModelGrid() {
  el('motion-model-grid').replaceChildren(...KAYKIT_MODELS.map(model => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = model.label; button.dataset.motionModel = model.id;
    button.setAttribute('aria-pressed', String(model.id === selectedModel.id));
    button.addEventListener('click', () => { if (model.id !== selectedModel.id) void loadModel(model); }); return button;
  }));
}
function renderFilters() {
  el('motion-filters').replaceChildren(...categoryOrder.map(id => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = categoryLabel(id); button.dataset.motionFilter = id;
    button.setAttribute('aria-pressed', String(id === filter));
    button.addEventListener('click', () => { filter = id; renderFilters(); renderMotionGrid(); }); return button;
  }));
}
function renderMotionGrid() {
  const rows = filterMotionReviewCatalog(catalog, filter), root = el('motion-grid'); root.replaceChildren();
  if (!rows.length) { const text = document.createElement('p'); text.className = 'motion-empty'; text.textContent = 'この分類のモーションはありません。'; root.append(text); return; }
  for (const record of rows) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.motionIndex = String(record.index); button.dataset.motionId = record.id;
    button.dataset.recommended = String(record.recommended); button.setAttribute('aria-pressed', String(selected?.id === record.id));
    const name = document.createElement('span'); name.textContent = formatName(record.name);
    const meta = document.createElement('small'); meta.className = 'motion-category'; meta.textContent = categoryLabel(record.category) + ' · ' + record.duration.toFixed(2) + 's';
    button.append(name, meta); button.addEventListener('click', () => { void selectMotion(record); }); root.append(button);
  }
}
async function selectMotion(record, { keepTour = false } = {}) {
  if (!record || !target) return false;
  if (!keepTour) tour = null;
  const serial = ++selectionSerial, modelSerial = loadSerial, chosenTarget = target;
  stopAction(); playing = false; canvas.dataset.motionState = 'loading'; status(formatName(record.name) + ' を読み込んでいます。'); el('motion-load').removeAttribute('value');
  try {
    const sourceSpec = manifest.sources.find(row => row.id === record.sourceId);
    const source = record.baseline || record.legacy ? chosenTarget : await asset('source:' + record.sourceId, record.url, sourceSpec.family);
    if (!alive || serial !== selectionSerial || modelSerial !== loadSerial || chosenTarget !== target) return false;
    source.rig.reset(); chosenTarget.rig.reset();
    const clip = record.baseline || record.legacy ? source.gltf.animations.find(row => row.name === record.name) : source.gltf.animations[record.source.clipIndex];
    if (!clip || clip.name !== record.name || !clip.tracks.length || Math.abs(clip.duration - record.duration) > .01) throw new Error('元クリップと登録情報が一致しません: ' + record.name);
    const mixer = new THREE.AnimationMixer(source.gltf.scene), action = mixer.clipAction(clip), bridge = createReviewMotionBridge(source.rig, chosenTarget.rig);
    current = { source, clip, mixer, action, bridge }; selected = record;
    action.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1); action.clampWhenFinished = !loop; action.play();
    mixer.addEventListener('finished', () => { if (current?.action === action) { playing = false; syncPlaybackUI(); } });
    mixer.update(0); bridge.apply(); playing = true;
    el('motion-selected').textContent = formatName(record.name);
    const provenance = record.source || manifest.sources.find(row => row.url === selectedModel.runtime.url);
    el('motion-source').textContent = (record.legacy ? '既存クリップ · 重複加算なし' : sourceSpec?.label || 'KayKit') + ' · ' + provenance.license;
    el('motion-meta').textContent = `${provenance.author || 'Kay Lousberg'} / ${provenance.repository} @ ${provenance.revision} / ${provenance.path} / clip ${record.source?.clipIndex ?? record.index}: ${record.name} / Git blob ${provenance.gitBlobSha} / SHA256 ${provenance.sha256 || '固定Git blobで検証'} / ${provenance.license}。表示数は元モーションの重複除外後の件数です。`;
    Object.assign(canvas.dataset, { motionState: 'ready', motionSource: record.sourceId || 'kaykit-embedded', motionName: record.name,
      motionId: record.id, motionCategory: record.category || classifyReviewMotion(record.name), motionModel: selectedModel.id, motionCount: String(catalog.length) });
    el('motion-load').value = 1; status(formatName(record.name) + ' · ' + selectedModel.label); renderMotionGrid(); syncPlaybackUI();
    return true;
  } catch (error) { if (serial === selectionSerial && modelSerial === loadSerial) fail(error); return false; }
}
async function loadModel(model) {
  const serial = ++loadSerial, previous = selected;
  ++selectionSerial; stopAction(); tour = null; selectedModel = model; renderModelGrid();
  subject?.removeFromParent(); subject = null; target = null; canvas.dataset.motionState = 'loading'; status(model.label + ' を読み込んでいます。');
  try {
    const loaded = await asset('model:' + model.id, model.runtime.url, 'kaykit');
    if (!alive || serial !== loadSerial) return;
    // A cached model still belongs to its previous, detached stage wrapper.
    // Measure its rest bounds without inheriting that old floor/centering offset.
    loaded.gltf.scene.removeFromParent(); loaded.rig.reset(); target = loaded;
    const box = new THREE.Box3().setFromObject(loaded.gltf.scene), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    modelHeight = Math.max(.4, size.y); subject = new THREE.Group(); subject.name = 'MotionReview:' + model.id;
    subject.add(loaded.gltf.scene); subject.position.set(-center.x, -box.min.y, -center.z); stage.add(subject);
    setCameraPreset('three-quarter');
    await selectMotion(previous?.legacy ? previous : catalog.find(row => row.id === previous?.id) || catalog.find(row => row.recommended && row.category === 'life') || catalog[0]);
  } catch (error) { if (serial === loadSerial) fail(error); }
}
function seek(time) {
  if (!current) return;
  current.action.time = Math.min(current.clip.duration, Math.max(0, time)); current.mixer.update(0); current.bridge.apply(); syncPlaybackUI();
}
function restart() {
  if (!current) return;
  current.action.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1).play(); current.action.clampWhenFinished = !loop;
  playing = true; seek(0);
}
function startTour() {
  const records = filterMotionReviewCatalog(catalog, 'recommended');
  const playlist = ['life', 'move', 'combat', 'reaction'].flatMap(category => records.filter(row => row.category === category).slice(0, 2));
  if (!playlist.length) return;
  loop = true; tour = { playlist, index: 0, time: 0, segment: 0 }; void selectMotion(playlist[0], { keepTour: true });
}
for (const button of document.querySelectorAll('[data-motion-camera]')) button.addEventListener('click', () => setCameraPreset(button.dataset.motionCamera));
el('motion-play').addEventListener('click', () => { if (!current) return; if (!playing && current.action.time >= current.clip.duration) restart(); else playing = !playing; syncPlaybackUI(); });
el('motion-restart').addEventListener('click', restart);
el('motion-speed').addEventListener('change', event => { speed = Math.max(.1, Math.min(2, Number(event.target.value) || 1)); });
el('motion-loop').addEventListener('change', event => { tour = null; loop = event.target.checked; if (current) { current.action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1); current.action.clampWhenFinished = !loop; } syncPlaybackUI(); });
el('motion-time').addEventListener('input', event => { playing = false; tour = null; seek(Number(event.target.value)); });
el('motion-prev-frame').addEventListener('click', () => { playing = false; tour = null; seek((current?.action.time || 0) - 1 / 60); });
el('motion-next-frame').addEventListener('click', () => { playing = false; tour = null; seek((current?.action.time || 0) + 1 / 60); });
legacySelect.addEventListener('change', () => { if (legacySelect.value === '') return; const row = manifest.legacy.find(row => row.index === Number(legacySelect.value)); if (row) void selectMotion({ ...row, id: 'legacy:' + row.index, legacy: true, baseline: true }); });
const embedded = new URL(location.href).searchParams.has('embedded');
if (embedded) {
  const button = document.createElement('button'); button.type = 'button'; button.id = 'motion-tour'; button.textContent = '▶ 30秒演舞'; button.addEventListener('click', startTour); el('motion-restart').after(button);
} else {
  const link = document.createElement('a'); link.href = './characters.html?review=motion'; link.textContent = '演舞レビューへ戻る'; el('motion-model-grid').before(link);
}
let width = 0, height = 0;
function resize() {
  const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight); if (w === width && h === height) return;
  width = w; height = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
const observer = new ResizeObserver(resize); observer.observe(canvas);
function frame(now) {
  if (!alive) return;
  resize(); const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
  if (current && playing) { current.mixer.update(dt * speed); current.bridge.apply();
    if (tour) { tour.time += dt; tour.segment += dt;
      if (tour.time >= 30) { tour = null; playing = false; status('30秒演舞が終了しました。'); }
      else if (tour.segment >= 30 / tour.playlist.length) { tour.segment = 0; tour.index = (tour.index + 1) % tour.playlist.length; void selectMotion(tour.playlist[tour.index], { keepTour: true }); }
    }
  }
  controls.update(); renderer.render(scene, camera); syncPlaybackUI(); frameId = requestAnimationFrame(frame);
}
function geometryBounds() {
  if (!subject) return null;
  subject.updateWorldMatrix(true, true); const box = new THREE.Box3();
  subject.traverse(node => {
    if (!node.isMesh) return;
    if (node.isSkinnedMesh) { node.computeBoundingBox(); box.union(node.boundingBox.clone().applyMatrix4(node.matrixWorld)); }
    else { node.geometry.computeBoundingBox(); box.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld)); }
  });
  return { min: box.min.toArray(), max: box.max.toArray() };
}
window.__MOTION_REVIEW__ = { get records() { return catalog; }, get ready() { return Boolean(target && current && manifest); },
  inspect() { return { id: selected?.id, model: selectedModel.id, count: catalog.length, errors: [...errors], time: current?.action.time,
    duration: current?.clip.duration, playing, speed, loop, rig: target ? inspectReviewRig(target.rig) : null,
    lift: current?.bridge.lastLift, bounds: geometryBounds(), loadedSources: [...cache.keys()].filter(key => key.startsWith('source:')) }; } };
renderFilters(); renderModelGrid(); setCameraPreset('three-quarter'); frameId = requestAnimationFrame(frame);
void loadMotionManifest().then(async value => {
  manifest = value; catalog = buildMotionReviewCatalog(manifest.records); count.textContent = motionCountLabel(catalog);
  legacySelect.replaceChildren(new Option('既存クリップを選ぶ', ''), ...manifest.legacy.map(row => new Option(formatName(row.name), String(row.index))));
  renderMotionGrid(); await loadModel(selectedModel);
}).catch(fail);
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  alive = false; ++loadSerial; ++selectionSerial; cancelAnimationFrame(frameId); observer.disconnect(); stopAction();
  for (const promise of cache.values()) void promise.then(({ gltf }) => {
    const resources = new Set(); gltf.scene.traverse(node => { if (node.geometry) resources.add(node.geometry); if (node.skeleton) resources.add(node.skeleton);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) if (material) { resources.add(material); for (const item of Object.values(material)) if (item?.isTexture) resources.add(item); }
    }); resources.forEach(resource => resource.dispose());
  }).catch(() => {});
  cache.clear(); ground.geometry.dispose(); ground.material.dispose(); controls.dispose(); renderer.dispose();
}, { once: true });
