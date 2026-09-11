import { THREE, GLTFLoader, OrbitControls } from '@soul/rendering';
import { reviewPresets, installReviewExtensions } from './review-adapter.js';
import './style.css';

const q = selector => document.querySelector(selector);
const canvas = q('#review-canvas');
const status = q('#review-status');
const modelUrlInput = q('#model-url');
const modelFileInput = q('#model-file');
const presetSelect = q('#preset');
const clipSelect = q('#clip');
const timeline = q('#timeline');
const currentTimeLabel = q('#current-time');
const durationLabel = q('#duration');
const playButton = q('#play-toggle');
const loopToggle = q('#loop-toggle');
const skeletonToggle = q('#skeleton-toggle');
const boundsToggle = q('#bounds-toggle');
const wireframeToggle = q('#wireframe-toggle');
const gridToggle = q('#grid-toggle');
const overlayTimeInput = q('#overlay-time');
const noteInput = q('#review-note');
const sourceLabel = q('#source-label');
const clipLabel = q('#clip-label');
const fpsLabel = q('#fps');
const params = new URLSearchParams(location.search);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color('#101217');
const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 300);
camera.position.set(3.2, 2.2, 5.2);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 1, 0);
controls.minDistance = 0.6;
controls.maxDistance = 25;

scene.add(new THREE.HemisphereLight('#dfe8ff', '#312b24', 1.7));
const key = new THREE.DirectionalLight('#fff4da', 3.2);
key.position.set(4, 7, 4);
key.castShadow = true;
scene.add(key);
const rim = new THREE.DirectionalLight('#8aa7ff', 1.2);
rim.position.set(-5, 3, -4);
scene.add(rim);

const groundMaterial = new THREE.MeshStandardMaterial({ color: '#22262c', roughness: 0.95, metalness: 0 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(30, 60, '#65707c', '#343b43');
grid.position.y = 0.002;
scene.add(grid);

const reviewRoot = new THREE.Group();
scene.add(reviewRoot);
const overlayRoot = new THREE.Group();
scene.add(overlayRoot);

const loader = new GLTFLoader();
let mixer = null;
let model = null;
let clips = [];
let action = null;
let activeClip = null;
let skeletonHelper = null;
let boundsHelper = null;
let modelObjectUrl = null;
let playing = true;
let draggingTimeline = false;
let lastTime = performance.now();
let lastOverlayCycle = -1;
let extension = null;
let fpsSamples = [];

function setStatus(message, kind = '') {
  status.textContent = message;
  status.dataset.kind = kind;
}

function disposeObject(object) {
  object.traverse(child => {
    if (child.geometry?.dispose) child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    for (const material of materials) {
      for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
      material.dispose?.();
    }
  });
}

function clearModel() {
  mixer?.stopAllAction();
  mixer = null;
  action = null;
  activeClip = null;
  clips = [];
  skeletonHelper?.removeFromParent();
  boundsHelper?.removeFromParent();
  skeletonHelper = null;
  boundsHelper = null;
  if (model) {
    model.removeFromParent();
    disposeObject(model);
    model = null;
  }
  if (modelObjectUrl) {
    URL.revokeObjectURL(modelObjectUrl);
    modelObjectUrl = null;
  }
  overlayRoot.clear();
}

function frameModel(object) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, 0.25);
  controls.target.copy(sphere.center);
  camera.near = Math.max(radius / 100, 0.01);
  camera.far = Math.max(radius * 100, 100);
  camera.position.copy(sphere.center).add(new THREE.Vector3(radius * 1.8, radius * 0.85, radius * 3.0));
  camera.updateProjectionMatrix();
  controls.update();
}

function refreshHelpers() {
  skeletonHelper?.removeFromParent();
  boundsHelper?.removeFromParent();
  skeletonHelper = null;
  boundsHelper = null;
  if (!model) return;
  if (skeletonToggle.checked) {
    const skinned = model.getObjectByProperty('isSkinnedMesh', true);
    if (skinned || model.getObjectByProperty('isBone', true)) {
      skeletonHelper = new THREE.SkeletonHelper(model);
      scene.add(skeletonHelper);
    }
  }
  if (boundsToggle.checked) {
    const box = new THREE.Box3().setFromObject(model);
    boundsHelper = new THREE.Box3Helper(box, '#ffcc66');
    scene.add(boundsHelper);
  }
}

function setWireframe(enabled) {
  model?.traverse(child => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) if (material && 'wireframe' in material) material.wireframe = enabled;
  });
}

function setClips(nextClips) {
  clips = nextClips || [];
  clipSelect.replaceChildren();
  if (!clips.length) {
    clipSelect.add(new Option('Animation clipなし', ''));
    clipLabel.textContent = 'No clip';
    timeline.max = '1';
    timeline.value = '0';
    durationLabel.textContent = '0.000s';
    return;
  }
  clips.forEach((clip, index) => clipSelect.add(new Option(`${clip.name || `Clip ${index + 1}`} · ${clip.duration.toFixed(3)}s`, String(index))));
  playClip(0);
}

function playClip(index) {
  if (!mixer || !clips[index]) return;
  mixer.stopAllAction();
  activeClip = clips[index];
  mixer.setTime(0);
  action = mixer.clipAction(activeClip);
  action.setLoop(loopToggle.checked ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
  action.clampWhenFinished = !loopToggle.checked;
  action.reset().play();
  action.paused = !playing;
  timeline.min = '0';
  timeline.max = String(activeClip.duration || 1);
  timeline.step = '0.001';
  timeline.value = '0';
  durationLabel.textContent = `${(activeClip.duration || 0).toFixed(3)}s`;
  clipLabel.textContent = activeClip.name || `Clip ${index + 1}`;
  lastOverlayCycle = -1;
}

function seek(seconds) {
  if (!mixer || !activeClip) return;
  const duration = Math.max(activeClip.duration, 0.0001);
  const value = loopToggle.checked ? ((seconds % duration) + duration) % duration : THREE.MathUtils.clamp(seconds, 0, duration);
  action.paused = true;
  mixer.setTime(0);
  action.reset().play();
  action.paused = true;
  mixer.setTime(value);
  timeline.value = String(value);
  currentTimeLabel.textContent = `${value.toFixed(3)}s`;
}

function makeFallback() {
  const root = new THREE.Group();
  root.name = 'ReviewFallback';
  const material = new THREE.MeshStandardMaterial({ color: '#c8d0dc', roughness: 0.78 });
  const accent = new THREE.MeshStandardMaterial({ color: '#727f92', roughness: 0.65, metalness: 0.12 });
  const part = (geometry, parent, position, name, mat = material) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(...position);
    mesh.name = name;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const torso = new THREE.Group(); torso.name = 'Torso'; torso.position.y = 1.32; root.add(torso);
  part(new THREE.BoxGeometry(.52, .68, .3), torso, [0, 0, 0], 'Chest');
  part(new THREE.SphereGeometry(.22, 18, 12), root, [0, 1.93, 0], 'Head');
  const leftArm = new THREE.Group(); leftArm.name = 'LeftArm'; leftArm.position.set(-.36, 1.57, 0); root.add(leftArm);
  part(new THREE.CapsuleGeometry(.09, .55, 6, 10), leftArm, [0, -.28, 0], 'LeftArmMesh');
  const rightArm = new THREE.Group(); rightArm.name = 'RightArm'; rightArm.position.set(.36, 1.57, 0); root.add(rightArm);
  part(new THREE.CapsuleGeometry(.09, .55, 6, 10), rightArm, [0, -.28, 0], 'RightArmMesh');
  const leftLeg = new THREE.Group(); leftLeg.name = 'LeftLeg'; leftLeg.position.set(-.17, .95, 0); root.add(leftLeg);
  part(new THREE.CapsuleGeometry(.105, .72, 6, 10), leftLeg, [0, -.4, 0], 'LeftLegMesh', accent);
  const rightLeg = new THREE.Group(); rightLeg.name = 'RightLeg'; rightLeg.position.set(.17, .95, 0); root.add(rightLeg);
  part(new THREE.CapsuleGeometry(.105, .72, 6, 10), rightLeg, [0, -.4, 0], 'RightLegMesh', accent);
  const weapon = new THREE.Group(); weapon.name = 'Weapon'; weapon.position.set(.02, -.56, 0); rightArm.add(weapon);
  const blade = part(new THREE.BoxGeometry(.055, 1.25, .035), weapon, [0, -.58, 0], 'Blade', new THREE.MeshStandardMaterial({ color: '#dce5ec', metalness: .8, roughness: .25 }));
  blade.position.x = .02;
  part(new THREE.BoxGeometry(.32, .04, .05), weapon, [0, .02, 0], 'Guard', accent);
  root.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  const times = [0, .18, .42, .68, .95, 1.2];
  const slash = new THREE.AnimationClip('Fallback_Slash', 1.2, [
    new THREE.NumberKeyframeTrack('Torso.rotation[y]', times, [0, -.18, -.48, .42, .16, 0]),
    new THREE.NumberKeyframeTrack('RightArm.rotation[x]', times, [-.25, -.6, -1.15, .55, -.1, -.25]),
    new THREE.NumberKeyframeTrack('RightArm.rotation[z]', times, [-.12, -.45, -.85, .65, .05, -.12]),
    new THREE.NumberKeyframeTrack('LeftArm.rotation[z]', times, [.12, .3, .5, -.28, -.02, .12]),
  ]);
  const idleTimes = [0, .7, 1.4];
  const idle = new THREE.AnimationClip('Fallback_Idle', 1.4, [
    new THREE.NumberKeyframeTrack('Torso.position[y]', idleTimes, [1.32, 1.335, 1.32]),
    new THREE.NumberKeyframeTrack('LeftArm.rotation[z]', idleTimes, [.08, .12, .08]),
    new THREE.NumberKeyframeTrack('RightArm.rotation[z]', idleTimes, [-.08, -.12, -.08]),
  ]);
  return { scene: root, animations: [slash, idle] };
}

function attachLoaded(sceneObject, animations, label) {
  clearModel();
  model = sceneObject;
  model.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  reviewRoot.add(model);
  mixer = new THREE.AnimationMixer(model);
  sourceLabel.textContent = label;
  setClips(animations);
  const requestedClip = params.get('clip');
  if (requestedClip) {
    const requestedIndex = clips.findIndex(clip => clip.name === requestedClip);
    if (requestedIndex >= 0) { clipSelect.value = String(requestedIndex); playClip(requestedIndex); }
  }
  const requestedTime = Number(params.get('t'));
  if (Number.isFinite(requestedTime) && requestedTime > 0) seek(requestedTime);
  setWireframe(wireframeToggle.checked);
  refreshHelpers();
  frameModel(model);
  setStatus(`Loaded: ${label}`);
}

function loadUrl(url, label = url) {
  if (!url) return;
  setStatus('モデルを読み込み中…');
  loader.load(url, gltf => attachLoaded(gltf.scene, gltf.animations, label), progress => {
    if (progress.total) setStatus(`モデルを読み込み中… ${Math.round(progress.loaded / progress.total * 100)}%`);
  }, error => {
    console.error(error);
    setStatus('モデルの読み込みに失敗しました。URL/CORS/GLBを確認してください。', 'error');
  });
}

function useFallback() {
  const fallback = makeFallback();
  attachLoaded(fallback.scene, fallback.animations, 'Fallback review rig');
}

function cameraPreset(name) {
  if (!model) return;
  const box = new THREE.Box3().setFromObject(model);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const d = Math.max(sphere.radius * 3.2, 1.5);
  const c = sphere.center;
  const offsets = {
    front: [0, .15 * d, d], back: [0, .15 * d, -d], left: [-d, .15 * d, 0], right: [d, .15 * d, 0],
    top: [0, d, .001], three: [d * .72, d * .3, d * .72],
  };
  const v = offsets[name] || offsets.three;
  controls.target.copy(c);
  camera.position.set(c.x + v[0], c.y + v[1], c.z + v[2]);
  controls.update();
}

function pulseOverlay() {
  if (!model) return;
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  center.y = THREE.MathUtils.lerp(box.min.y, box.max.y, .56);
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(Math.max(box.getSize(new THREE.Vector3()).x * .35, .18), .018, 8, 48),
    new THREE.MeshBasicMaterial({ color: '#ffd36a', transparent: true, opacity: .95, depthWrite: false })
  );
  ring.rotation.x = Math.PI / 2;
  group.position.copy(center);
  group.add(ring);
  overlayRoot.add(group);
  const born = performance.now();
  const animate = now => {
    const t = Math.min((now - born) / 280, 1);
    group.scale.setScalar(1 + t * 1.9);
    ring.material.opacity = 1 - t;
    if (t < 1) requestAnimationFrame(animate);
    else { ring.geometry.dispose(); ring.material.dispose(); group.removeFromParent(); }
  };
  requestAnimationFrame(animate);
}

function maybeTriggerOverlay(previous, current) {
  if (!activeClip || !q('#overlay-toggle').checked) return;
  const marker = Number(overlayTimeInput.value || 0);
  const duration = activeClip.duration || 0;
  if (marker < 0 || marker > duration) return;
  const cycle = duration ? Math.floor((mixer?.time || 0) / duration) : 0;
  const crossed = current >= previous ? previous < marker && current >= marker : current >= marker || previous < marker;
  if (crossed && (cycle !== lastOverlayCycle || current < previous)) {
    lastOverlayCycle = cycle;
    pulseOverlay();
    extension?.onMarker?.({ time: marker, clip: activeClip, model, scene });
  }
}

function stateText() {
  const current = Number(timeline.value || 0);
  return [
    '輪廻転焦 Visual Review Lab',
    `Source: ${sourceLabel.textContent}`,
    `Clip: ${activeClip?.name || 'none'}`,
    `Time: ${current.toFixed(3)}s / ${(activeClip?.duration || 0).toFixed(3)}s`,
    `Speed: ${q('#speed').value}x`,
    `Loop: ${loopToggle.checked ? 'on' : 'off'}`,
    `Skeleton: ${skeletonToggle.checked ? 'on' : 'off'} / Bounds: ${boundsToggle.checked ? 'on' : 'off'} / Wireframe: ${wireframeToggle.checked ? 'on' : 'off'}`,
    `Review marker: ${Number(overlayTimeInput.value || 0).toFixed(3)}s`,
    `Note: ${noteInput.value.trim() || '(none)'}`,
    `Build: ${__BUILD_INFO__.commit} / ${__BUILD_INFO__.branch}`,
  ].join('\n');
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
  setStatus('レビュー情報をコピーしました');
}

function updateUrlState() {
  const url = new URL(location.href);
  if (modelUrlInput.value.trim()) url.searchParams.set('model', modelUrlInput.value.trim()); else url.searchParams.delete('model');
  if (activeClip) url.searchParams.set('clip', activeClip.name); else url.searchParams.delete('clip');
  url.searchParams.set('t', Number(timeline.value || 0).toFixed(3));
  url.searchParams.set('speed', q('#speed').value);
  url.searchParams.set('marker', Number(overlayTimeInput.value || 0).toFixed(3));
  history.replaceState(null, '', url);
  return url.href;
}

function resize() {
  const width = Math.max(canvas.clientWidth, 1);
  const height = Math.max(canvas.clientHeight, 1);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
resize();

q('#load-url').addEventListener('click', () => loadUrl(modelUrlInput.value.trim()));
modelFileInput.addEventListener('change', () => {
  const file = modelFileInput.files?.[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.glb')) {
    setStatus('ローカル読込は単一ファイルの .glb を推奨します。', 'error');
    return;
  }
  modelObjectUrl = URL.createObjectURL(file);
  loadUrl(modelObjectUrl, file.name);
});
q('#fallback').addEventListener('click', useFallback);
clipSelect.addEventListener('change', () => playClip(Number(clipSelect.value)));
playButton.addEventListener('click', () => {
  playing = !playing;
  if (action) action.paused = !playing;
  playButton.textContent = playing ? '一時停止' : '再生';
});
loopToggle.addEventListener('change', () => {
  if (action) {
    action.setLoop(loopToggle.checked ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loopToggle.checked;
  }
});
timeline.addEventListener('pointerdown', () => { draggingTimeline = true; });
window.addEventListener('pointerup', () => { draggingTimeline = false; });
timeline.addEventListener('input', () => seek(Number(timeline.value)));
q('#step-back').addEventListener('click', () => seek(Number(timeline.value) - 1 / 60));
q('#step-forward').addEventListener('click', () => seek(Number(timeline.value) + 1 / 60));
q('#restart').addEventListener('click', () => seek(0));
q('#speed').addEventListener('change', () => { if (mixer) mixer.timeScale = Number(q('#speed').value); });
skeletonToggle.addEventListener('change', refreshHelpers);
boundsToggle.addEventListener('change', refreshHelpers);
wireframeToggle.addEventListener('change', () => setWireframe(wireframeToggle.checked));
gridToggle.addEventListener('change', () => { grid.visible = gridToggle.checked; ground.visible = gridToggle.checked; });
q('#trigger-overlay').addEventListener('click', pulseOverlay);
q('#copy-review').addEventListener('click', () => copyText(stateText()));
q('#copy-link').addEventListener('click', () => copyText(updateUrlState()));
q('#capture').addEventListener('click', async () => {
  renderer.render(scene, camera);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    setStatus('スクリーンショットをクリップボードへコピーしました');
  } catch {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rinne-review-${Date.now()}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    setStatus('スクリーンショットを保存しました');
  }
});
document.querySelectorAll('[data-camera]').forEach(button => button.addEventListener('click', () => cameraPreset(button.dataset.camera)));

for (const preset of reviewPresets) presetSelect.add(new Option(preset.label || preset.id, preset.id));
presetSelect.addEventListener('change', () => {
  const preset = reviewPresets.find(item => item.id === presetSelect.value);
  if (!preset) return;
  modelUrlInput.value = preset.modelUrl || '';
  if (preset.modelUrl) loadUrl(preset.modelUrl, preset.label || preset.id);
});

modelUrlInput.value = params.get('model') || '';
q('#speed').value = params.get('speed') || '1';
overlayTimeInput.value = params.get('marker') || '0.420';

extension = await installReviewExtensions({ THREE, scene, camera, controls, renderer, reviewRoot, overlayRoot, get model() { return model; }, get mixer() { return mixer; } });
if (params.get('model')) loadUrl(params.get('model'));
else if (reviewPresets[0]?.modelUrl) {
  presetSelect.value = reviewPresets[0].id;
  modelUrlInput.value = reviewPresets[0].modelUrl;
  loadUrl(reviewPresets[0].modelUrl, reviewPresets[0].label || reviewPresets[0].id);
} else useFallback();

function tick(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  controls.update();
  const speed = Number(q('#speed').value || 1);
  if (mixer) mixer.timeScale = speed;
  const previous = Number(timeline.value || 0);
  if (mixer && playing && !draggingTimeline) {
    mixer.update(dt);
    if (activeClip) {
      const duration = Math.max(activeClip.duration, .0001);
      const current = loopToggle.checked ? mixer.time % duration : Math.min(mixer.time, duration);
      maybeTriggerOverlay(previous, current);
      timeline.value = String(current);
      currentTimeLabel.textContent = `${current.toFixed(3)}s`;
    }
  }
  if (boundsHelper && model) boundsHelper.box.setFromObject(model);
  extension?.update?.(dt, { model, mixer, clip: activeClip, time: Number(timeline.value || 0) });
  renderer.render(scene, camera);
  fpsSamples.push(dt);
  if (fpsSamples.length > 30) fpsSamples.shift();
  const avg = fpsSamples.reduce((sum, value) => sum + value, 0) / Math.max(fpsSamples.length, 1);
  fpsLabel.textContent = avg ? `${Math.round(1 / avg)} FPS` : '— FPS';
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
