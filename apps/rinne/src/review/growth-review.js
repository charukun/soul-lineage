import { THREE, GLTFLoader, OrbitControls } from '@soul/rendering';
import { SHINO_REVIEW, REVIEW_ASSET_REVISION } from '@soul/assets/review-catalog';
import { LIFE_RULES, appearanceForAge } from '../../public/simulator/src/life-clock.js';
import './style.css';
import './growth-review.css';

const q = selector => document.querySelector(selector);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const PROBES = Object.freeze([4, 12, 22, 50, 75]);
const VIEW_OFFSETS = Object.freeze({
  front: [0, .12, 1],
  three: [.72, .26, .72],
  side: [1, .12, 0],
  back: [0, .12, -1],
});

function formatWorldSeconds(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(s / 60);
  return `${String(minutes).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

async function humanoidBones(gltf) {
  const json = gltf.parser?.json;
  const vrm1 = json?.extensions?.VRMC_vrm?.humanoid?.humanBones;
  if (vrm1) {
    return Object.fromEntries(await Promise.all(Object.entries(vrm1).map(async ([name, row]) => [name, await gltf.parser.getDependency('node', row.node)])));
  }
  const vrm0 = json?.extensions?.VRM?.humanoid?.humanBones;
  if (Array.isArray(vrm0)) {
    return Object.fromEntries(await Promise.all(vrm0.filter(row => row?.bone && Number.isInteger(row.node)).map(async row => [row.bone, await gltf.parser.getDependency('node', row.node)])));
  }
  return {};
}

function snapshotMaterials(root) {
  const rows = [];
  const seen = new Set();
  root.traverse(node => {
    for (const material of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) {
      if (seen.has(material) || !material.color) continue;
      seen.add(material);
      const name = `${material.name || ''} ${node.name || ''}`;
      rows.push({
        material,
        color: material.color.clone(),
        hair: /hair|髪/i.test(name),
        skin: /face.*skin|skin.*face|skin|肌/i.test(name),
      });
    }
  });
  return rows;
}

function percent(value, max = 1) {
  return `${Math.round(clamp(value / max, 0, 1) * 100)}%`;
}

function installBackButton() {
  q('#growth-back')?.addEventListener('click', () => {
    if (document.referrer && new URL(document.referrer).origin === location.origin) history.back();
    else location.href = './';
  });
}

async function start() {
  installBackButton();
  q('#growth-build-label').textContent = `GROWTH / ${REVIEW_ASSET_REVISION}`;

  const canvas = q('#growth-canvas');
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#101217');
  const camera = new THREE.PerspectiveCamera(36, 1, .01, 200);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.minDistance = .25;
  controls.maxDistance = 20;

  scene.add(new THREE.HemisphereLight('#dfe8ff', '#312b24', 1.7));
  const key = new THREE.DirectionalLight('#fff4da', 3.2);
  key.position.set(4, 7, 4);
  key.castShadow = true;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#8aa7ff', 1.2);
  rim.position.set(-5, 3, -4);
  scene.add(rim);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({color: '#22262c', roughness: .95}));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  scene.add(new THREE.GridHelper(30, 60, '#65707c', '#343b43'));

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  q('#growth-status').textContent = 'SHINO実VRMを読み込み中';
  const gltf = await new GLTFLoader().loadAsync(new URL(SHINO_REVIEW.publicPath, location.href).href);
  const root = gltf.scene;
  root.traverse(node => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = false;
    }
  });
  scene.add(root);

  const bones = await humanoidBones(gltf);
  const materialState = snapshotMaterials(root);
  const base = {
    rootScale: root.scale.clone(),
    rootPosition: root.position.clone(),
    headScale: bones.head?.scale.clone(),
    spineQ: bones.spine?.quaternion.clone(),
    chestQ: bones.chest?.quaternion.clone(),
    headQ: bones.head?.quaternion.clone(),
  };
  const grayTarget = new THREE.Color('#b9bab6');
  const skinTarget = new THREE.Color('#d1b8a6');
  let currentView = 'three';
  let adultFrame = null;

  function bounds() {
    root.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(root);
  }

  function groundModel() {
    root.position.copy(base.rootPosition);
    root.updateMatrixWorld(true);
    const box = bounds();
    if (Number.isFinite(box.min.y)) root.position.y += -box.min.y;
    root.updateMatrixWorld(true);
  }

  function frame(view = currentView, lockAdult = false) {
    currentView = view;
    root.updateMatrixWorld(true);
    const box = lockAdult && adultFrame ? adultFrame.clone() : bounds();
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) return;
    if (view === 'face' && bones.head) {
      const head = bones.head.getWorldPosition(new THREE.Vector3());
      const d = Math.max(.46, sphere.radius * .58);
      camera.position.set(head.x + d * .56, head.y + d * .08, head.z + d);
      controls.target.copy(head);
    } else {
      const dir = VIEW_OFFSETS[view] || VIEW_OFFSETS.three;
      const d = Math.max(sphere.radius * 3.15, 1.4);
      const center = sphere.center;
      camera.position.set(center.x + dir[0] * d, center.y + dir[1] * d, center.z + dir[2] * d);
      controls.target.copy(center);
    }
    camera.near = .01;
    camera.far = 100;
    camera.updateProjectionMatrix();
    controls.update();
    document.querySelectorAll('[data-growth-view]').forEach(button => button.classList.toggle('active', button.dataset.growthView === view));
  }

  function resetAgeParts() {
    if (bones.head && base.headScale) bones.head.scale.copy(base.headScale);
    if (bones.spine && base.spineQ) bones.spine.quaternion.copy(base.spineQ);
    if (bones.chest && base.chestQ) bones.chest.quaternion.copy(base.chestQ);
    if (bones.head && base.headQ) bones.head.quaternion.copy(base.headQ);
    for (const row of materialState) row.material.color.copy(row.color);
  }

  function applyAppearance(age) {
    const appearance = appearanceForAge(age);
    resetAgeParts();
    root.scale.copy(base.rootScale).multiplyScalar(appearance.scale);
    if (bones.head && base.headScale) bones.head.scale.copy(base.headScale).multiplyScalar(appearance.headScale);
    const stoop = appearance.stoop;
    if (stoop > 0) {
      const axis = new THREE.Vector3(1, 0, 0);
      if (bones.spine) bones.spine.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, stoop * .62));
      if (bones.chest) bones.chest.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, stoop * .38));
      if (bones.head) bones.head.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, -stoop * .38));
    }
    for (const row of materialState) {
      row.material.color.copy(row.color);
      if (row.hair && appearance.gray > 0) row.material.color.lerp(grayTarget, appearance.gray * .72);
      if (row.skin && appearance.skinAge > 0) row.material.color.lerp(skinTarget, appearance.skinAge * .08).multiplyScalar(1 - .045 * appearance.skinAge);
    }
    groundModel();
    return appearance;
  }

  function metric(id, value, bar, barValue) {
    q(id).textContent = value;
    q(bar).style.width = percent(barValue);
  }

  function renderAge(seconds, {initial = false} = {}) {
    const age = clamp(seconds / LIFE_RULES.secondsPerYear, 0, LIFE_RULES.lifespanYears);
    const appearance = applyAppearance(age);
    q('#growth-age').textContent = age.toFixed(1);
    q('#growth-period').textContent = appearance.stage;
    q('#growth-stage-name').textContent = `${age.toFixed(1)}歳 / ${appearance.stage}`;
    q('#growth-stage-meta').textContent = `世界時間 ${formatWorldSeconds(seconds)} ・ 60秒で1年`;
    q('#growth-world-time').textContent = `${formatWorldSeconds(seconds)} / ${formatWorldSeconds(LIFE_RULES.lifespanYears * LIFE_RULES.secondsPerYear)}`;
    metric('#metric-scale', `${Math.round(appearance.scale * 100)}%`, '#bar-scale', appearance.scale);
    metric('#metric-head', `${Math.round(appearance.headScale * 100)}%`, '#bar-head', (appearance.headScale - 1) / .22);
    metric('#metric-gray', `${Math.round(appearance.gray * 100)}%`, '#bar-gray', appearance.gray);
    metric('#metric-stoop', `${Math.round(appearance.stoop / .25 * 100)}%`, '#bar-stoop', appearance.stoop / .25);
    metric('#metric-skin', `${Math.round(appearance.skinAge * 100)}%`, '#bar-skin', appearance.skinAge);
    document.querySelectorAll('[data-age]').forEach(button => button.classList.toggle('active', Math.abs(Number(button.dataset.age) - age) < .12));
    if (currentView === 'face' && !initial) frame('face');
    return appearance;
  }

  const seek = q('#growth-seek');
  seek.max = String(LIFE_RULES.lifespanYears * LIFE_RULES.secondsPerYear);
  seek.value = String(22 * LIFE_RULES.secondsPerYear);
  renderAge(Number(seek.value), {initial: true});
  adultFrame = bounds().clone();
  frame('three', true);

  seek.addEventListener('input', () => renderAge(Number(seek.value)));
  document.querySelectorAll('[data-age]').forEach(button => button.addEventListener('click', () => {
    seek.value = String(Number(button.dataset.age) * LIFE_RULES.secondsPerYear);
    renderAge(Number(seek.value));
  }));
  document.querySelectorAll('[data-growth-view]').forEach(button => button.addEventListener('click', () => frame(button.dataset.growthView)));

  q('#growth-source').textContent = 'Sendagaya Shino / 実VRM';
  q('#growth-status').textContent = '世界時間を動かして成長を確認';

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
}

start().catch(error => {
  console.error(error);
  const status = q('#growth-status');
  if (status) {
    status.textContent = error.message;
    status.classList.add('growth-error');
  }
});
