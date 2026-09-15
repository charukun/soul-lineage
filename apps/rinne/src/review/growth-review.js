import { THREE, GLTFLoader, OrbitControls } from '@soul/rendering';
import { SHINO_REVIEW, REVIEW_ASSET_REVISION } from '@soul/assets/review-catalog';
import { LIFE_RULES, appearanceForAge } from '../../public/simulator/src/life-clock.js';
import { createKayKitAgeAdapter } from './kaykit-age-adapter.js';
import { EQUIPMENT_BY_ID, equipmentForSlot } from './equipment-catalog.js';
import { createGrowthEquipmentController, EQUIPMENT_SLOTS } from './growth-equipment.js';
import {
  MOTION_LIBRARY_MODELS,
  MOTION_LIBRARY_RAW_BASE,
  motionLibraryModelURL,
} from './motion-library-models.js';
import './style.css';
import './growth-review.css';

const q = selector => document.querySelector(selector);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const VIEW_OFFSETS = Object.freeze({
  front: [0, .12, 1],
  three: [.72, .26, .72],
  side: [1, .12, 0],
  back: [0, .12, -1],
});
const VIEW_IDS = new Set([...Object.keys(VIEW_OFFSETS),'face']);
const EQUIPMENT_QUERY = Object.freeze({main:'eqMain',off:'eqOff',back:'eqBack'});
const EQUIPMENT_SLOT_LABEL = Object.freeze({main:'右手',off:'左手',back:'背中'});
const SHINO_PATH = SHINO_REVIEW.publicPath;
const LOCAL_GROWTH_MODELS = [
  {id:'SHINO',label:'SHINO',name:'Sendagaya Shino',path:SHINO_PATH,portrait:'SHINO',appearanceScale:[1,1,1],kind:'vrm'},
  {id:'SHINO_SLENDER',label:'SHINO_SLENDER',name:'Shino / 細身',path:SHINO_PATH,portrait:'SHINO',appearanceScale:[.9,1.02,.92],kind:'vrm'},
  {id:'SHINO_STURDY',label:'SHINO_STURDY',name:'Shino / がっしり',path:SHINO_PATH,portrait:'SHINO',appearanceScale:[1.1,.98,1.08],kind:'vrm'},
  {id:'SHINO_COMPACT',label:'SHINO_COMPACT',name:'Shino / 小柄',path:SHINO_PATH,portrait:'SHINO',appearanceScale:[1.04,.94,1.03],kind:'vrm'},
  {id:'A',label:'A',name:'AvatarSample A',path:'./simulator/assets/A_review.vrm',portrait:'A',appearanceScale:[1,1,1],kind:'vrm'},
  {id:'B',label:'B',name:'AvatarSample B',path:'./simulator/assets/B_review.vrm',portrait:'B',appearanceScale:[1,1,1],kind:'vrm'},
  {id:'C',label:'C',name:'AvatarSample C',path:'./simulator/assets/C_review.vrm',portrait:'C',appearanceScale:[1,1,1],kind:'vrm'},
  {id:'TSUKU',label:'TSUKU',name:'Tsuku',path:'./simulator/assets/TSUKU_review.vrm',portrait:'TSUKU',appearanceScale:[1,1,1],kind:'vrm'},
];
const KAYKIT_GROWTH_MODELS = MOTION_LIBRARY_MODELS.map(row => ({
  id: row.presetId,
  label: `KAYKIT / ${row.label}`,
  name: `KayKit ${row.label}`,
  path: motionLibraryModelURL(row),
  appearanceScale: [1, 1, 1],
  kind: 'kaykit',
  sourceId: row.id,
}));
const GROWTH_MODELS = Object.freeze([...LOCAL_GROWTH_MODELS, ...KAYKIT_GROWTH_MODELS].map(Object.freeze));
const MODEL_BY_ID = new Map(GROWTH_MODELS.map(model => [model.id, model]));
const grayTarget = new THREE.Color('#b9bab6');
const skinTarget = new THREE.Color('#d1b8a6');

function thumbnailPath(model) {
  if (model.portrait) return `./simulator/assets/portrait_${model.portrait}.webp`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="18" fill="#11181c"/><path d="M18 70h60" stroke="#d6bd84" stroke-width="3" opacity=".45"/><text x="48" y="54" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="25" fill="#d6bd84">KK</text><text x="48" y="72" text-anchor="middle" font-family="system-ui,sans-serif" font-size="8" fill="#91a99d">${model.sourceId || 'MODEL'}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function formatWorldSeconds(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function percent(value, max = 1) { return `${Math.round(clamp(value / max, 0, 1) * 100)}%`; }
function disposeRoot(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root?.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) {
      materials.add(material);
      Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); });
    }
  });
  geometries.forEach(value => value.dispose?.());
  materials.forEach(value => value.dispose?.());
  textures.forEach(value => value.dispose?.());
  root?.removeFromParent();
}

async function humanoidBones(gltf) {
  const json = gltf.parser?.json, vrm1 = json?.extensions?.VRMC_vrm?.humanoid?.humanBones;
  if (vrm1) return Object.fromEntries(await Promise.all(Object.entries(vrm1).map(async ([name,row]) => [name, await gltf.parser.getDependency('node', row.node)])));
  const vrm0 = json?.extensions?.VRM?.humanoid?.humanBones;
  if (Array.isArray(vrm0)) return Object.fromEntries(await Promise.all(vrm0.filter(row => row?.bone && Number.isInteger(row.node)).map(async row => [row.bone, await gltf.parser.getDependency('node', row.node)])));
  return {};
}

function snapshotMaterials(root) {
  const rows = [], seen = new Set();
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

async function loadGrowthAsset(model) {
  const loader = new GLTFLoader();
  if (model.kind !== 'kaykit') return loader.loadAsync(new URL(model.path, location.href).href);
  const response = await fetch(model.path, {cache: 'force-cache'});
  if (!response.ok) throw new Error(`KayKit HTTP ${response.status}: ${model.name}`);
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength) throw new Error(`KayKit model is empty: ${model.name}`);
  return loader.parseAsync(bytes, `${MOTION_LIBRARY_RAW_BASE}/`);
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
  const params = new URLSearchParams(location.search);
  const seek = q('#growth-seek');
  seek.max = String(LIFE_RULES.lifespanYears * LIFE_RULES.secondsPerYear);
  const paramAge = params.has('age') ? Number(params.get('age')) : NaN;
  seek.value = String(Number.isFinite(paramAge) ? clamp(paramAge, 0, LIFE_RULES.lifespanYears) * LIFE_RULES.secondsPerYear : 22 * LIFE_RULES.secondsPerYear);
  let selectedModel = MODEL_BY_ID.get(params.get('model')) || GROWTH_MODELS[0];
  const equipmentState = Object.fromEntries(EQUIPMENT_SLOTS.map(slot => {
    const id=params.get(EQUIPMENT_QUERY[slot]);
    const spec=EQUIPMENT_BY_ID.get(id);
    return [slot,spec?.slots.includes(slot)?id:null];
  }));
  const requestedView = params.get('view');
  const initialView = VIEW_IDS.has(requestedView) ? requestedView : 'three';

  const canvas = q('#growth-canvas');
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, preserveDrawingBuffer:true, powerPreference:'high-performance'});
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
  key.position.set(4,7,4); key.castShadow = true; scene.add(key);
  const rim = new THREE.DirectionalLight('#8aa7ff', 1.2);
  rim.position.set(-5,3,-4); scene.add(rim);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30,30), new THREE.MeshStandardMaterial({color:'#22262c',roughness:.95}));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const grid = new THREE.GridHelper(30,60,'#65707c','#343b43'); grid.position.y = .002; scene.add(grid);
  const resize = () => {
    const rect = canvas.getBoundingClientRect(), width = Math.max(1, Math.floor(rect.width)), height = Math.max(1, Math.floor(rect.height));
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas); resize();

  let current = null, currentView = initialView, adultFrame = null, generation = 0, equipmentPickerSlot = 'main';

  function equipmentNodes(root) {
    const rows=[];
    root?.traverse(node=>{if(/^GrowthEquipment:|^EquipmentPayload:/.test(node.name||''))rows.push(node);});
    return rows;
  }
  function bodyBounds() {
    if (!current) return new THREE.Box3();
    const hidden=equipmentNodes(current.root).map(node=>[node,node.visible]);
    hidden.forEach(([node])=>{node.visible=false;});
    current.root.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(current.root);
    hidden.forEach(([node,visible])=>{node.visible=visible;});
    current.root.updateMatrixWorld(true);
    return box;
  }
  function bounds() { return bodyBounds(); }
  function groundModel() {
    if (!current) return;
    current.root.position.copy(current.base.rootPosition);
    current.root.updateMatrixWorld(true);
    const box = bodyBounds();
    if (Number.isFinite(box.min.y)) current.root.position.y += -box.min.y;
    current.root.updateMatrixWorld(true);
  }
  function resetAgeParts() {
    if (!current || current.ageAdapter) return;
    const {bones,base,materials} = current;
    if (bones.head && base.headScale) bones.head.scale.copy(base.headScale);
    if (bones.spine && base.spineQ) bones.spine.quaternion.copy(base.spineQ);
    if (bones.chest && base.chestQ) bones.chest.quaternion.copy(base.chestQ);
    if (bones.head && base.headQ) bones.head.quaternion.copy(base.headQ);
    for (const row of materials) row.material.color.copy(row.color);
  }
  function applyAppearance(age) {
    const appearance = appearanceForAge(age);
    if (!current) return appearance;
    if (current.ageAdapter) {
      current.ageDiagnostics = current.ageAdapter.apply(appearance, current.model.appearanceScale);
      groundModel();
      return appearance;
    }
    resetAgeParts();
    const {root,bones,base,materials,model,direction} = current;
    root.scale.copy(base.rootScale).multiply(new THREE.Vector3(...model.appearanceScale)).multiplyScalar(appearance.scale);
    if (bones.head && base.headScale) bones.head.scale.copy(base.headScale).multiplyScalar(appearance.headScale);
    if (appearance.stoop > 0) {
      const axis = new THREE.Vector3(1,0,0);
      if (bones.spine) bones.spine.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, direction * appearance.stoop * .62));
      if (bones.chest) bones.chest.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, direction * appearance.stoop * .38));
      if (bones.head) bones.head.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, -direction * appearance.stoop * .38));
    }
    for (const row of materials) {
      row.material.color.copy(row.color);
      if (row.hair && appearance.gray > 0) row.material.color.lerp(grayTarget, appearance.gray * .72);
      if (row.skin && appearance.skinAge > 0) row.material.color.lerp(skinTarget, appearance.skinAge * .08).multiplyScalar(1 - .045 * appearance.skinAge);
    }
    groundModel();
    return appearance;
  }
  function frame(view = currentView) {
    if (!current) return;
    currentView = VIEW_IDS.has(view) ? view : 'three';
    current.root.updateMatrixWorld(true);
    const box = adultFrame?.clone() || bodyBounds(), sphere = box.getBoundingSphere(new THREE.Sphere());
    if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) return;
    if (currentView === 'face' && current.bones.head) {
      const head = current.bones.head.getWorldPosition(new THREE.Vector3()), d = Math.max(.46, sphere.radius * .58);
      camera.position.set(head.x + d * .56, head.y + d * .08, head.z + d); controls.target.copy(head);
    } else {
      const dir = VIEW_OFFSETS[currentView] || VIEW_OFFSETS.three, d = Math.max(sphere.radius * 3.15, 1.4), center = sphere.center;
      camera.position.set(center.x + dir[0] * d, center.y + dir[1] * d, center.z + dir[2] * d); controls.target.copy(center);
    }
    camera.near = .01; camera.far = 100; camera.updateProjectionMatrix(); controls.update();
    document.querySelectorAll('[data-growth-view]').forEach(button => button.classList.toggle('active', button.dataset.growthView === currentView));
  }
  function metric(id,value,bar,barValue) { q(id).textContent = value; q(bar).style.width = percent(barValue); }
  function syncURL(age) {
    const url = new URL(location.href);
    url.searchParams.set('model', selectedModel.id);
    url.searchParams.set('age', age.toFixed(2).replace(/\.00$/, ''));
    url.searchParams.set('view', currentView);
    for(const slot of EQUIPMENT_SLOTS){
      const key=EQUIPMENT_QUERY[slot],id=equipmentState[slot];
      if(id)url.searchParams.set(key,id);else url.searchParams.delete(key);
    }
    history.replaceState(null, '', url);
  }
  function renderAge(seconds, {sync = true} = {}) {
    const age = clamp(seconds / LIFE_RULES.secondsPerYear, 0, LIFE_RULES.lifespanYears), appearance = applyAppearance(age);
    q('#growth-age').textContent = age.toFixed(1);
    q('#growth-period').textContent = appearance.stage;
    q('#growth-stage-name').textContent = `${age.toFixed(1)}歳 / ${appearance.stage}`;
    q('#growth-stage-meta').textContent = `${selectedModel.name} ・ 世界時間 ${formatWorldSeconds(seconds)} ・ 60秒で1年`;
    q('#growth-world-time').textContent = `${formatWorldSeconds(seconds)} / ${formatWorldSeconds(LIFE_RULES.lifespanYears * LIFE_RULES.secondsPerYear)}`;
    metric('#metric-scale', `${Math.round(appearance.scale * 100)}%`, '#bar-scale', appearance.scale);
    metric('#metric-head', `${Math.round(appearance.headScale * 100)}%`, '#bar-head', (appearance.headScale - 1) / .22);
    metric('#metric-gray', `${Math.round(appearance.gray * 100)}%`, '#bar-gray', appearance.gray);
    metric('#metric-stoop', `${Math.round(appearance.stoop / .25 * 100)}%`, '#bar-stoop', appearance.stoop / .25);
    metric('#metric-skin', `${Math.round(appearance.skinAge * 100)}%`, '#bar-skin', appearance.skinAge);
    document.querySelectorAll('[data-age]').forEach(button => button.classList.toggle('active', Math.abs(Number(button.dataset.age) - age) < .12));
    if (currentView === 'face') frame('face');
    if (sync) syncURL(age);
    return appearance;
  }

  const picker = q('#growth-model-picker'), list = q('#growth-model-list'), trigger = q('#growth-model-trigger');
  function syncModelCopy() {
    q('#growth-model-name').textContent = selectedModel.name;
    q('#growth-model-label').textContent = selectedModel.label;
    q('#growth-model-thumb').src = thumbnailPath(selectedModel);
    q('#growth-source').textContent = `${selectedModel.name} / ${selectedModel.kind === 'kaykit' ? 'KayKit CC0' : '実モデル'}`;
  }
  function renderModelPicker() {
    list.replaceChildren(...GROWTH_MODELS.map(model => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'growth-model-option' + (model.id === selectedModel.id ? ' active' : '');
      button.dataset.modelKind = model.kind;
      button.innerHTML = `<img src="${thumbnailPath(model)}" alt=""><span>${model.name}<small>${model.label}</small></span>`;
      button.addEventListener('click', async () => { picker.hidden = true; if (model.id === selectedModel.id) return; await loadModel(model); });
      return button;
    }));
  }
  trigger.addEventListener('click', () => { renderModelPicker(); picker.hidden = false; });
  q('#growth-model-close').addEventListener('click', () => picker.hidden = true);
  picker.addEventListener('click', event => { if (event.target === picker) picker.hidden = true; });

  const equipmentPicker=q('#growth-equipment-picker'),equipmentList=q('#growth-equipment-list');
  function syncEquipmentCopy(){
    for(const slot of EQUIPMENT_SLOTS){
      const spec=EQUIPMENT_BY_ID.get(equipmentState[slot]);
      const node=document.querySelector(`[data-equipment-label="${slot}"]`);
      if(node)node.textContent=spec?.label||'なし';
    }
  }
  function renderEquipmentPicker(slot){
    equipmentPickerSlot=slot;
    q('#growth-equipment-picker-title').textContent=`${EQUIPMENT_SLOT_LABEL[slot]}の装備`;
    const active=equipmentState[slot];
    const none=document.createElement('button');none.type='button';none.className='growth-equipment-option'+(!active?' active':'');none.dataset.none='true';none.innerHTML='<span>なし<small>このスロットを外す</small></span>';none.addEventListener('click',()=>chooseEquipment(slot,null));
    const rows=equipmentForSlot(slot).map(spec=>{const button=document.createElement('button');button.type='button';button.className='growth-equipment-option'+(spec.id===active?' active':'');button.innerHTML=`<span>${spec.label}<small>${spec.file}.gltf</small></span>`;button.addEventListener('click',()=>chooseEquipment(slot,spec.id));return button;});
    equipmentList.replaceChildren(none,...rows);
  }
  async function chooseEquipment(slot,id){
    equipmentPicker.hidden=true;
    equipmentState[slot]=id;
    syncEquipmentCopy();syncURL(Number(seek.value)/LIFE_RULES.secondsPerYear);
    if(!current?.equipment)return;
    q('#growth-status').classList.remove('growth-error');
    q('#growth-status').textContent=id?`${EQUIPMENT_BY_ID.get(id)?.label||id}を装備中`:`${EQUIPMENT_SLOT_LABEL[slot]}を解除中`;
    try{
      const result=await current.equipment.set(slot,id);
      q('#growth-status').textContent=result?`${result.label} / ${result.method}`:'装備を外しました';
    }catch(error){
      console.error(error);q('#growth-status').textContent=`装備失敗: ${error.message}`;q('#growth-status').classList.add('growth-error');
    }
  }
  document.querySelectorAll('[data-equipment-trigger]').forEach(button=>button.addEventListener('click',()=>{renderEquipmentPicker(button.dataset.equipmentTrigger);equipmentPicker.hidden=false;}));
  q('#growth-equipment-close').addEventListener('click',()=>equipmentPicker.hidden=true);
  equipmentPicker.addEventListener('click',event=>{if(event.target===equipmentPicker)equipmentPicker.hidden=true;});
  q('#growth-equipment-clear').addEventListener('click',()=>{
    for(const slot of EQUIPMENT_SLOTS)equipmentState[slot]=null;
    current?.equipment?.clearAll();syncEquipmentCopy();syncURL(Number(seek.value)/LIFE_RULES.secondsPerYear);q('#growth-status').textContent='装備を全解除しました';
  });

  async function loadModel(model) {
    const token = ++generation;
    q('#growth-status').textContent = `${model.name}を読み込み中`;
    q('#growth-status').classList.remove('growth-error');
    let gltf;
    try {
      gltf = await loadGrowthAsset(model);
      if (token !== generation) { disposeRoot(gltf.scene); return; }
      const root = gltf.scene;
      const isVRM0 = model.kind === 'vrm' && Boolean(gltf.parser?.json?.extensions?.VRM && !gltf.parser?.json?.extensions?.VRMC_vrm);
      if (isVRM0) root.rotation.y = Math.PI;
      root.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; node.frustumCulled = false; } });

      let bones, materials = [], ageAdapter = null, direction = isVRM0 ? -1 : 1;
      if (model.kind === 'kaykit') {
        ageAdapter = createKayKitAgeAdapter(root);
        bones = ageAdapter.bones;
        direction = 1;
      } else {
        bones = await humanoidBones(gltf);
        materials = snapshotMaterials(root);
      }
      if (token !== generation) { disposeRoot(root); return; }
      const base = {
        rootScale: root.scale.clone(),
        rootPosition: root.position.clone(),
        headScale: bones.head?.scale.clone(),
        spineQ: bones.spine?.quaternion.clone(),
        chestQ: bones.chest?.quaternion.clone(),
        headQ: bones.head?.quaternion.clone(),
      };
      const previous = current;
      current = {root, bones, materials, base, model, direction, ageAdapter, ageDiagnostics: null, equipment:null};
      selectedModel = model;
      scene.add(root);
      applyAppearance(22);
      adultFrame = bodyBounds().clone();
      renderAge(Number(seek.value), {sync:false});
      frame(currentView);
      const equipment=createGrowthEquipmentController({root,bones,model});
      current.equipment=equipment;
      const equipmentResults=await equipment.applyState(equipmentState);
      if(token!==generation){equipment.dispose();disposeRoot(root);return;}
      syncModelCopy();
      syncEquipmentCopy();
      renderModelPicker();
      syncURL(Number(seek.value) / LIFE_RULES.secondsPerYear);
      const equipmentErrors=equipmentResults.filter(row=>row.error);
      const diagnostics = current.ageDiagnostics;
      q('#growth-status').textContent = equipmentErrors.length
        ? `モデル表示 / 装備${equipmentErrors.length}件未対応`
        : diagnostics
          ? `KayKit aging / hair ${diagnostics.hairSurfaces}・skin ${diagnostics.skinSurfaces} / 装備ready`
          : '世界時間・装備を切り替えて確認';
      if(previous){previous.equipment?.dispose();disposeRoot(previous.root);}
    } catch (error) {
      if (gltf?.scene && token === generation) disposeRoot(gltf.scene);
      if (token === generation) {
        console.error(error);
        q('#growth-status').textContent = `モデル読込失敗: ${error.message}`;
        q('#growth-status').classList.add('growth-error');
      }
    }
  }

  seek.addEventListener('input', () => renderAge(Number(seek.value)));
  document.querySelectorAll('[data-age]').forEach(button => button.addEventListener('click', () => {
    seek.value = String(Number(button.dataset.age) * LIFE_RULES.secondsPerYear); renderAge(Number(seek.value));
  }));
  document.querySelectorAll('[data-growth-view]').forEach(button => button.addEventListener('click', () => {
    frame(button.dataset.growthView);syncURL(Number(seek.value)/LIFE_RULES.secondsPerYear);
  }));

  syncModelCopy();syncEquipmentCopy();
  renderAge(Number(seek.value), {sync:false});
  await loadModel(selectedModel);
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
}

start().catch(error => {
  console.error(error);
  const status = q('#growth-status');
  if (status) { status.textContent = error.message; status.classList.add('growth-error'); }
});
