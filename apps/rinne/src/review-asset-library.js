import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {createReviewCameraPresetController,createReviewRenderer,disposeReviewObject} from '@soul/rendering';
import {createReviewSvgThumbnail} from '@soul/shared-ui/review-thumbnail';
import {setReviewStatus} from '@soul/shared-ui/review-status';
import {mountRinneReviewShell} from './review-lab-shell.js';
import {createReviewStageLifecycle} from '@soul/shared-ui/review-shell';
import { PROTAGONIST_VILLAGER_MODEL } from '@soul/characters';
import {applyReviewCombatMotion} from './review-battle-hero-motion.js';
import {
  RINNE_EQUIPMENT_REVIEW_CATALOG,
  REVIEW_EQUIPMENT_CATEGORY_LABELS,
  REVIEW_EQUIPMENT_CATEGORY_ORDER,
  equipmentReviewItem,
  filterEquipmentReviewCatalog,
} from './review-equipment-catalog.js';
import './review-asset-library.css';
mountRinneReviewShell('equipment');

const q = selector => document.querySelector(selector);
const createStaticThumbnail=(url,label='')=>createReviewSvgThumbnail(url,{label});
const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const loader = new GLTFLoader();
const protagonistModelUrl = PROTAGONIST_VILLAGER_MODEL.assetPath;
const canvas = q('#asset-stage');
const renderer = createReviewRenderer(canvas,{exposure:1.15});
const scene = new THREE.Scene(); scene.background = new THREE.Color('#111716');
const camera = new THREE.PerspectiveCamera(38, 1, .01, 80);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.minDistance = .3; controls.maxDistance = 18;
scene.add(new THREE.HemisphereLight('#fff2d5', '#4f6872', 2.6));
const key = new THREE.DirectionalLight('#ffe0b5', 3.2); key.position.set(-4,8,6); scene.add(key);
const fill = new THREE.DirectionalLight('#8dcbe1', 1.7); fill.position.set(5,4,-5); scene.add(fill);
const ground = new THREE.Mesh(new THREE.CircleGeometry(3.8,64), new THREE.MeshStandardMaterial({color:'#263431',roughness:1}));
ground.rotation.x = -Math.PI/2; ground.position.y = -.006; scene.add(ground);

let modelRoot = null, mixer = null, frameId = 0, loadSequence = 0;
const mounted = new Map();
const equipmentCache = new Map();
const equipmentLoads = new Map();
let stageBusyCount = 0;
const equipmentFailures=new Map();
const selection = {model: PROTAGONIST_VILLAGER_MODEL.id, main:null, off:null, back:null};
let activeAssetSlot='main',activeViewDirection='front',activeViewFocus='full',equipmentFilter='recommended';

function status(message,error=false) {
  setReviewStatus(q('#asset-status'),message,{error});
  const indicator=q('#asset-load-state');
  if(indicator){
    const loading=!error&&/読み込み中|モデルを読み込んで|準備中/.test(message);
    indicator.dataset.state=error?'error':loading?'loading':'ready';
    const label=indicator.querySelector('strong');
    if(label)label.textContent=error?'要確認':loading?'準備中':'表示中';
  }
}
function setStageBusy(active,label='武器を準備中…'){
  stageBusyCount=Math.max(0,stageBusyCount+(active?1:-1));
  const overlay=q('#asset-stage-loading'); if(!overlay)return;
  const visible=stageBusyCount>0;
  overlay.hidden=!visible; overlay.setAttribute('aria-hidden',String(!visible));
  const text=overlay.querySelector('strong'); if(text&&active)text.textContent=label;
}
async function withStageBusy(task,label){
  setStageBusy(true,label);
  try{return await task();}
  finally{setStageBusy(false,label);}
}
function findNode(root, wanted) {
  const target = normalize(wanted); let exact = null, suffix = null;
  root?.traverse(node => { const name=normalize(node.name); if(!exact && name===target) exact=node; else if(!suffix && name.endsWith(target)) suffix=node; });
  return exact || suffix;
}
function disposeRoot(root){disposeReviewObject(root);}
function hideNativeAccessories(root) {
  root?.traverse(node=>{
    if(node.isMesh&&/\b(?:arrow|axe|blade|bow|crossbow|dagger|mace|quiver|shield|spear|staff|sword|wand|weapon)\b/i.test(String(node.name).replace(/[_\-.]+/g,' ')))node.visible=false;
  });
}
function modelHeight() {
  if(!modelRoot)return 1.7; const box=new THREE.Box3().setFromObject(modelRoot); const height=box.max.y-box.min.y; return Number.isFinite(height)&&height>.05?height:1.7;
}
function fitObject(root, fraction, referenceHeight=modelHeight()) {
  root.scale.set(1,1,1);root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),longest=Math.max(size.x,size.y,size.z);
  if(!Number.isFinite(longest)||longest<1e-6)throw new Error('装備geometryが空です');
  root.scale.setScalar(referenceHeight*fraction/longest);
}
function flattenScene(src) {
  if(src.children.length!==1)return src; const child=src.children[0],holder=new THREE.Group(); holder.scale.copy(child.scale); child.scale.set(1,1,1); child.position.set(0,0,0); child.rotation.set(0,0,0); src.remove(child); holder.add(child); return holder;
}
function slotAnchor(slot) {
  if(!modelRoot)throw new Error('先にモデルを読み込んでください');
  if(slot==='main')return findNode(modelRoot,'handslot.r')||findNode(modelRoot,'righthand')||findNode(modelRoot,'hand.r')||findNode(modelRoot,'hand_r')||findNode(modelRoot,'righthandbone');
  if(slot==='off')return findNode(modelRoot,'handslot.l')||findNode(modelRoot,'lefthand')||findNode(modelRoot,'hand.l')||findNode(modelRoot,'hand_l')||findNode(modelRoot,'lefthandbone');
  return findNode(modelRoot,'chest')||findNode(modelRoot,'spine');
}
function equipmentCacheKey(item){return item.id;}
function runtimeWeapon(item){
  const root=new THREE.Group(),wood=new THREE.MeshStandardMaterial({color:0x735238,roughness:.9}),metal=new THREE.MeshStandardMaterial({color:0xc8cfcb,roughness:.28,metalness:.72});
  const mesh=(geometry,material,x=0,y=0,z=0)=>{const node=new THREE.Mesh(geometry,material);node.position.set(x,y,z);node.castShadow=node.receiveShadow=true;root.add(node);return node;};
  if(item.weapon==='spear'){
    mesh(new THREE.CylinderGeometry(.035,.042,2.0,8),wood,0,.45);
    mesh(new THREE.ConeGeometry(.11,.42,5),metal,0,1.61);
  }else if(item.weapon==='axe'){
    mesh(new THREE.CylinderGeometry(.04,.047,1.15,8),wood,0,.30);
    const head=mesh(new THREE.BoxGeometry(.42,.30,.075),metal,.16,.78);head.rotation.z=-.12;
  }else{
    mesh(new THREE.CylinderGeometry(.037,.043,.52,8),wood,0,-.02);
    mesh(new THREE.BoxGeometry(item.weapon==='great'?.18:.13,item.weapon==='great'?1.18:.82,.055),metal,0,item.weapon==='great'?.72:.52);
  }
  return root;
}
async function prepareEquipment(item){
  const key=equipmentCacheKey(item);
  if(equipmentCache.has(key))return equipmentCache.get(key);
  if(equipmentLoads.has(key))return equipmentLoads.get(key);
  const request=(async()=>{
    let payload;
    if(item.kind==='runtime')payload=runtimeWeapon(item);
    else{
      const gltf=await loader.loadAsync(new URL(item.url,location.href).href);
      payload=flattenScene(gltf.scene);
    }
    payload.name=`ReviewEquipment:${item.id}`;
    payload.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;}});
    equipmentCache.set(key,payload);return payload;
  })().catch(error=>{equipmentFailures.set(item.id,String(error?.message||error));throw error;}).finally(()=>equipmentLoads.delete(key));
  equipmentLoads.set(key,request);return request;
}
function dedicatedHandSlot(anchor,slot){
  if(slot==='back'||!anchor)return false;
  return normalize(anchor.name)===normalize(slot==='off'?'handslot.l':'handslot.r');
}
function applyTransform(payload,item,slot,anchor,characterHeight){
  payload.position.set(0,0,0);payload.quaternion.identity();payload.scale.set(1,1,1);
  fitObject(payload,item.targetFraction||.48,characterHeight);
  if(!dedicatedHandSlot(anchor,slot)&&item.fallbackRotation)payload.rotation.set(...item.fallbackRotation);
}
async function setEquipment(slot,id){
  const previous=mounted.get(slot);if(previous){previous.removeFromParent();mounted.delete(slot);}
  selection[slot]=id||null;
  if(!id)return;
  const item=equipmentReviewItem(id);if(!item||item.slot!==slot)throw new Error(`装備できない組み合わせ: ${slot}/${id}`);
  const anchor=slotAnchor(slot);if(!anchor)throw new Error(`${slot} 装備用の骨/slotが見つかりません`);
  const characterHeight=modelHeight(),payload=await prepareEquipment(item);payload.removeFromParent();anchor.add(payload);
  applyTransform(payload,item,slot,anchor,characterHeight);mounted.set(slot,payload);equipmentFailures.delete(item.id);
}
async function reapplyEquipment(){
  const wanted={main:selection.main,off:selection.off,back:selection.back};
  for(const slot of ['main','off','back']){selection[slot]=null;await setEquipment(slot,wanted[slot]);}
}
async function prepareWeaponLibrary(){
  const rows=RINNE_EQUIPMENT_REVIEW_CATALOG;
  const settled=await Promise.allSettled(rows.map(item=>prepareEquipment(item)));
  const payloads=settled.flatMap((result,index)=>result.status==='fulfilled'?[result.value]:[]);
  const warmup=new THREE.Group();warmup.name='ReviewEquipmentWarmup';warmup.position.y=-1000;
  for(const payload of payloads){payload.removeFromParent();warmup.add(payload);}scene.add(warmup);
  try{if(typeof renderer.compileAsync==='function')await renderer.compileAsync(scene,camera);else renderer.compile(scene,camera);}
  finally{for(const payload of payloads)payload.removeFromParent();warmup.removeFromParent();}
}
function cameraFrame() {
  if(!modelRoot)return null;
  modelRoot.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(modelRoot),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const height=Math.max(size.y,.5);
  return {box,center,size,height,target:new THREE.Vector3(center.x,box.min.y+height*.49,center.z)};
}
function fullViewDistance(frame,direction=activeViewDirection){
  const halfFov=THREE.MathUtils.degToRad(camera.fov*.5);
  const tanV=Math.max(.05,Math.tan(halfFov));
  const tanH=Math.max(.05,tanV*Math.max(.45,camera.aspect));
  const depthFacing=direction==='left'||direction==='right'||direction==='side';
  const width=depthFacing?frame.size.z:direction==='three-quarter'?Math.hypot(frame.size.x,frame.size.z)*.72:frame.size.x;
  const vertical=(frame.height*.5)/tanV;
  const horizontal=(Math.max(width,.35)*.5)/tanH;
  return Math.max(vertical,horizontal)*1.34;
}
function focusTarget(frame,focus) {
  if(focus==='full')return frame.target.clone();
  const anchor=slotAnchor(focus);
  if(!anchor)return frame.target.clone();
  return anchor.getWorldPosition(new THREE.Vector3());
}
function applyViewPreset() {
  const frame=cameraFrame(); if(!frame)return;
  const {center,height}=frame,target=focusTarget(frame,activeViewFocus);
  const distance=activeViewFocus==='full'?fullViewDistance(frame):Math.max(height*.58,.78);
  const eyeY=activeViewFocus==='full'?target.y+height*.025:target.y+height*.04;
  controls.target.copy(target);
  if(activeViewDirection==='left')camera.position.set(target.x-distance,eyeY,target.z);
  else if(activeViewDirection==='right'||activeViewDirection==='side')camera.position.set(target.x+distance,eyeY,target.z);
  else if(activeViewDirection==='three-quarter')camera.position.set(target.x+distance*.72,eyeY,target.z+distance*.72);
  else if(activeViewDirection==='back')camera.position.set(target.x,eyeY,target.z-distance);
  else camera.position.set(target.x,eyeY,target.z+distance);
  if(activeViewFocus==='full'&&activeViewDirection==='left')camera.position.x=center.x-distance;
  if(activeViewFocus==='full'&&(activeViewDirection==='right'||activeViewDirection==='side'))camera.position.x=center.x+distance;
  controls.update();
  for(const button of document.querySelectorAll('[data-asset-focus]'))button.setAttribute('aria-pressed',String(button.dataset.assetFocus===activeViewFocus));
}
const assetCameraPresets=createReviewCameraPresetController({
  selector:'[data-asset-camera]',
  datasetKey:'assetCamera',
  initialPreset:'front',
  applyPreset:preset=>{activeViewDirection=preset;applyViewPreset();},
});
function setCameraPreset(preset='front'){assetCameraPresets.set(preset);}
function setFocusPreset(focus='full'){activeViewFocus=focus;applyViewPreset();}
function frameModel(){activeViewFocus='full';applyViewPreset();}
function presentationBones(root){
  return {
    hips:findNode(root,'hips'),spine:findNode(root,'spine'),chest:findNode(root,'chest'),head:findNode(root,'head'),
    leftUpperArm:findNode(root,'upperarm.l')||findNode(root,'leftupperarm'),
    rightUpperArm:findNode(root,'upperarm.r')||findNode(root,'rightupperarm'),
    leftLowerArm:findNode(root,'lowerarm.l')||findNode(root,'leftlowerarm'),
    rightLowerArm:findNode(root,'lowerarm.r')||findNode(root,'rightlowerarm'),
    leftUpperLeg:findNode(root,'upperleg.l')||findNode(root,'leftupperleg'),
    rightUpperLeg:findNode(root,'upperleg.r')||findNode(root,'rightupperleg'),
    leftLowerLeg:findNode(root,'lowerleg.l')||findNode(root,'leftlowerleg'),
    rightLowerLeg:findNode(root,'lowerleg.r')||findNode(root,'rightlowerleg'),
  };
}
function applyPresentationPose(root){
  applyReviewCombatMotion(presentationBones(root),{attack:''},{stage:'idle'},0);
  root.updateMatrixWorld(true);
}
async function loadModel() {
  const sequence=++loadSequence; selection.model=PROTAGONIST_VILLAGER_MODEL.id; status('主人公モデルを読み込み中…');
  for(const root of mounted.values())root.removeFromParent();mounted.clear(); if(modelRoot)disposeRoot(modelRoot); modelRoot=null; mixer?.stopAllAction();mixer=null;
  const gltf=await loader.loadAsync(protagonistModelUrl); if(sequence!==loadSequence){disposeRoot(gltf.scene);return;}
  modelRoot=gltf.scene; modelRoot.name='ReviewModel:Protagonist'; modelRoot.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}}); scene.add(modelRoot); hideNativeAccessories(modelRoot);
  modelRoot.updateMatrixWorld(true); const box=new THREE.Box3().setFromObject(modelRoot),center=box.getCenter(new THREE.Vector3()); modelRoot.position.x-=center.x;modelRoot.position.z-=center.z;modelRoot.position.y-=box.min.y;modelRoot.updateMatrixWorld(true);
  const idleClip=gltf.animations?.find(clip=>/idle|stand|breath/i.test(clip.name||''));
  if(idleClip){mixer=new THREE.AnimationMixer(modelRoot);mixer.clipAction(idleClip).play();}else applyPresentationPose(modelRoot);
  await reapplyEquipment(); frameModel(); status('装備を表示しています'); renderSelection();
}
function equipmentLabel(id){return equipmentReviewItem(id)?.label||'空き';}
function activeEquipment(){return equipmentReviewItem(selection[activeAssetSlot]);}
function renderEquipmentInspector(){
  const labels={main:'右手',off:'左手',back:'背中'};
  for(const slot of ['main','off','back']){const current=q(`#asset-current-${slot}`);if(current)current.textContent=equipmentLabel(selection[slot]);}
  const active=activeEquipment(),summary=q('#asset-combination'),stageSlotLabel=q('#asset-stage-slot-label'),provenance=q('#asset-provenance');
  if(summary)summary.textContent=active?.label||(activeAssetSlot==='main'?'素手':'空き');
  if(stageSlotLabel)stageSlotLabel.textContent=labels[activeAssetSlot];
  if(provenance)provenance.textContent=active?`${active.source}\n${active.provenance?.repository||''}${active.provenance?.revision?' @ '+active.provenance.revision:''}\n${active.provenance?.license||''}`:'装備を選ぶと出典を表示します。';
}
function visibleEquipment(){return filterEquipmentReviewCatalog(equipmentFilter);}
function renderEquipmentFilters(){
  const root=q('#asset-filters');if(!root)return;
  root.replaceChildren(...REVIEW_EQUIPMENT_CATEGORY_ORDER.map(id=>{
    const button=document.createElement('button');button.type='button';button.textContent=REVIEW_EQUIPMENT_CATEGORY_LABELS[id];button.dataset.equipmentFilter=id;
    button.setAttribute('aria-pressed',String(id===equipmentFilter));button.addEventListener('click',()=>{equipmentFilter=id;renderEquipmentFilters();renderEquipmentGrid();});return button;
  }));
}
function renderEquipmentGrid(){
  const list=q('#asset-weapon-types');if(!list)return;
  const rows=visibleEquipment();
  q('#asset-grid-summary').textContent=`${REVIEW_EQUIPMENT_CATEGORY_LABELS[equipmentFilter]} · ${rows.length}点`;
  list.replaceChildren(...rows.map(item=>{
    const button=document.createElement('button');button.type='button';button.classList.add('review-choice-card');button.dataset.equipmentId=item.id;
    button.setAttribute('aria-pressed',String(selection[item.slot]===item.id));button.dataset.previewState=equipmentFailures.has(item.id)?'error':'available';
    const text=document.createElement('span');text.textContent=item.label;
    button.append(createStaticThumbnail(item.thumbnailUrl||'./review/catalog-thumbnails.svg#equipment-none',item.label),text);
    button.addEventListener('click',()=>selectEquipment(item.id).catch(error=>status(error.message,true)));return button;
  }));
}
async function selectEquipment(id){
  const item=equipmentReviewItem(id);if(!item)throw new Error(`Unknown review equipment: ${id}`);
  activeAssetSlot=item.slot;const missing=!equipmentCache.has(equipmentCacheKey(item));
  const equip=()=>setEquipment(item.slot,item.id);
  if(missing)await withStageBusy(equip,'装備を読み込み中…');else await equip();
  renderSelection();status(`${item.label}を装備しました`);
}
function renderSelection(){renderEquipmentFilters();renderEquipmentGrid();renderEquipmentInspector();}
function populate() {
  const count=q('#asset-item-count');if(count)count.textContent=String(RINNE_EQUIPMENT_REVIEW_CATALOG.length);
  for(const button of document.querySelectorAll('[data-asset-focus]'))button.addEventListener('click',()=>setFocusPreset(button.dataset.assetFocus));
  controls.addEventListener('start',()=>{assetCameraPresets.clear();q('.asset-stage-hint')?.classList.add('is-dismissed');});
  q('#asset-reset').addEventListener('click',()=>{
    for(const slot of ['main','off','back'])void setEquipment(slot,null);
    activeAssetSlot='main';queueMicrotask(renderSelection);
  });
  canvas.addEventListener('pointerdown',()=>q('.asset-stage-hint')?.classList.add('is-dismissed'),{once:true,passive:true});
  renderSelection();applyViewPreset();
}
const stageLifecycle=createReviewStageLifecycle({canvas,stage:canvas.closest('.review-surface__stage'),onResize:({width,height,aspect})=>{renderer.setSize(width,height,false);camera.aspect=aspect;camera.updateProjectionMatrix();},render:()=>renderer.render(scene,camera)});
let last=performance.now();function frame(now){const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;controls.update();mixer?.update(dt);renderer.render(scene,camera);frameId=requestAnimationFrame(frame);}frameId=requestAnimationFrame(frame);
async function initialize(){
  populate();
  const modelTask=loadModel();
  const preloadTask=withStageBusy(prepareWeaponLibrary(),'武器を準備中…').catch(error=>status(`武器の事前準備に失敗しました: ${error.message}`,true));
  await Promise.allSettled([modelTask,preloadTask]);
  renderEquipmentGrid();
}
initialize().catch(error=>status(error.message,true));
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frameId);stageLifecycle.destroy();assetCameraPresets.destroy();controls.dispose();for(const root of equipmentCache.values())disposeRoot(root);equipmentCache.clear();mounted.clear();disposeRoot(modelRoot);ground.geometry.dispose();ground.material.dispose();renderer.dispose();},{once:true});
