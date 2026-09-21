import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {createReviewCameraPresetController,createReviewRenderer,disposeReviewObject} from '@soul/rendering';
import {createReviewSvgThumbnail} from '@soul/shared-ui/review-thumbnail';
import {setReviewStatus} from '@soul/shared-ui/review-status';
import {mountRinneReviewShell} from './review-lab-shell.js';
import {createReviewStageLifecycle} from '@soul/shared-ui/review-shell';
import {
  REVIEW_SKELETON_SOURCE,
  REVIEW_SKELETON_EQUIPMENT,
  reviewSkeletonEquipmentForSlot,
} from '@soul/assets';
import { PROTAGONIST_VILLAGER_MODEL } from '@soul/characters';
import {applyReviewCombatMotion} from './review-battle-hero-motion.js';
import './review-asset-library.css';
mountRinneReviewShell('equipment');

const q = selector => document.querySelector(selector);
const createStaticThumbnail=(url,label='')=>createReviewSvgThumbnail(url,{label});
const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const loader = new GLTFLoader();
const reviewEquipmentUrl = spec => spec.runtime.url;
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
let stageBusyCount = 0, weaponLibraryBusy = true;
const selection = {model: PROTAGONIST_VILLAGER_MODEL.id, weaponType:'none', main:null, off:null, back:null};
let activeAssetSlot='main',activeViewDirection='front',activeViewFocus='full';

const WEAPON_TYPES = Object.freeze([
  {id:'none',label:'素手',equipment:null,thumbnail:'./review/catalog-thumbnails.svg#equipment-none'},
  {id:'sword',label:'剣',equipment:'skeleton-blade'},
  {id:'axe',label:'斧',equipment:'skeleton-axe'},
  {id:'staff',label:'杖',equipment:'skeleton-staff'},
  {id:'crossbow',label:'クロスボウ',equipment:'skeleton-crossbow'},
]);
const equipmentSpec = id => REVIEW_SKELETON_EQUIPMENT.find(row=>row.id===id);
const weaponTypeForEquipment = equipmentId => WEAPON_TYPES.find(row=>row.equipment===equipmentId)?.id || 'none';

const HAND_GRIPS = Object.freeze({
  '1H_Sword':{r:{position:[0,.555174,0],quaternion:[0,1,0,0],scale:.8876},l:{position:[0,.555174,0],quaternion:[0,0,0,1],scale:.8876}},
  '1H_Axe':{r:{position:[.231697,.382471,0],quaternion:[0,1,0,0],scale:.622211},l:{position:[-.231697,.382471,0],quaternion:[0,0,0,1],scale:.622211}},
  '2H_Staff':{r:{position:[-.0427,.1769,0],quaternion:[0,1,0,0],scale:1.0773}},
  '2H_Crossbow':{r:{position:[.3381,.058,0],quaternion:[0,Math.SQRT1_2,0,Math.SQRT1_2],scale:.7204}},
  Round_Shield:{l:{position:[0,.017,.1771],quaternion:[0,0,0,1],scale:.4413}},
  Rectangle_Shield:{l:{position:[0,.017,.1617],quaternion:[0,0,0,1],scale:.5964}},
});
const BACK_GRIPS = Object.freeze({
  '1H_Sword':{position:[.16,.14,-.27],rotation:[.1,0,Math.PI*.72]},
  '1H_Axe':{position:[.16,.14,-.27],rotation:[.1,0,Math.PI*.72]},
  '2H_Staff':{position:[.12,0,-.30],rotation:[.1,0,Math.PI*.78]},
  '2H_Crossbow':{position:[0,.10,-.32],rotation:[0,Math.PI/2,Math.PI]},
  Round_Shield:{position:[0,.24,-.32],rotation:[0,Math.PI,0]},
  Rectangle_Shield:{position:[0,.20,-.32],rotation:[0,Math.PI,0]},
  Quiver:{position:[-.17,-.02,-.28],rotation:[.08,0,-.32]},
});
const ACCESSORY_NODES = Object.freeze({
  '1H_Sword':{r:'1H_Sword',l:'1H_Sword_Offhand'}, '1H_Axe':{r:'1H_Axe',l:'1H_Axe'},
  '2H_Staff':{r:'2H_Staff'}, '2H_Crossbow':{r:'2H_Crossbow'},
  Round_Shield:{l:'Round_Shield'}, Rectangle_Shield:{l:'Rectangle_Shield'},
});

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
  const names=new Set(Object.values(ACCESSORY_NODES).flatMap(row=>Object.values(row)));
  for(const name of names){const node=findNode(root,name);if(node)node.visible=false;}
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
function equipmentCacheKey(slot,id){return `${slot}:${id}`;}
async function prepareEquipment(slot,spec){
  const key=equipmentCacheKey(slot,spec.id);
  if(equipmentCache.has(key))return equipmentCache.get(key);
  if(equipmentLoads.has(key))return equipmentLoads.get(key);
  const request=loader.loadAsync(reviewEquipmentUrl(spec)).then(gltf=>{
    const payload=flattenScene(gltf.scene);payload.name=`ReviewEquipment:${spec.id}:${slot}`;
    payload.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;}});
    equipmentCache.set(key,payload);
    return payload;
  }).finally(()=>equipmentLoads.delete(key));
  equipmentLoads.set(key,request);
  return request;
}
function dedicatedHandSlot(anchor,slot){
  if(slot==='back'||!anchor)return false;
  return normalize(anchor.name)===normalize(slot==='off'?'handslot.l':'handslot.r');
}
function applyTransform(payload,spec,slot,anchor,characterHeight) {
  const side=slot==='off'?'l':'r';
  payload.position.set(0,0,0);payload.quaternion.identity();payload.scale.set(1,1,1);
  if(slot==='back'){
    const row=BACK_GRIPS[spec.family];
    if(row){payload.position.set(...row.position);payload.rotation.set(...row.rotation);fitObject(payload,spec.targetFraction,characterHeight);return;}
    payload.position.set(0,0,-characterHeight*.11);fitObject(payload,spec.targetFraction,characterHeight);return;
  }
  if(dedicatedHandSlot(anchor,slot)){
    fitObject(payload,spec.targetFraction,characterHeight);
    return;
  }
  const nativeName=ACCESSORY_NODES[spec.family]?.[side],native=nativeName?findNode(modelRoot,nativeName):null;
  if(native){payload.position.copy(native.position);payload.quaternion.copy(native.quaternion);payload.scale.copy(native.scale);return;}
  const grip=HAND_GRIPS[spec.family]?.[side]||HAND_GRIPS[spec.family]?.r;
  if(grip){payload.position.set(...grip.position);payload.quaternion.set(...grip.quaternion);payload.scale.setScalar(grip.scale);return;}
  payload.rotation.set(0,0,slot==='off'?Math.PI/2:-Math.PI/2);fitObject(payload,spec.targetFraction,characterHeight);
}
async function setEquipment(slot,id) {
  const previous=mounted.get(slot); if(previous){previous.removeFromParent();mounted.delete(slot);}
  selection[slot]=id||null;
  if(!id)return;
  const spec=REVIEW_SKELETON_EQUIPMENT.find(row=>row.id===id); if(!spec||!spec.slots.includes(slot))throw new Error(`装備できない組み合わせ: ${slot}/${id}`);
  const anchor=slotAnchor(slot); if(!anchor)throw new Error(`${slot} 装備用の骨/slotが見つかりません`);
  const characterHeight=modelHeight();
  const payload=await prepareEquipment(slot,spec);payload.removeFromParent();anchor.add(payload);
  applyTransform(payload,spec,slot,anchor,characterHeight);mounted.set(slot,payload);
}
async function reapplyEquipment() {
  const wanted={main:selection.main,off:selection.off,back:selection.back};
  for(const slot of ['main','off','back']){selection[slot]=null;await setEquipment(slot,wanted[slot]);}
}
async function prepareWeaponLibrary(){
  const specs=WEAPON_TYPES.map(type=>type.equipment&&equipmentSpec(type.equipment)).filter(Boolean);
  const payloads=await Promise.all(specs.map(spec=>prepareEquipment('main',spec)));
  const warmup=new THREE.Group();warmup.name='ReviewEquipmentWarmup';warmup.position.y=-1000;
  for(const payload of payloads){payload.removeFromParent();warmup.add(payload);}
  scene.add(warmup);
  try{
    if(typeof renderer.compileAsync==='function')await renderer.compileAsync(scene,camera);
    else renderer.compile(scene,camera);
  }finally{
    for(const payload of payloads)payload.removeFromParent();
    warmup.removeFromParent();
  }
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
function equipmentLabel(id){return equipmentSpec(id)?.label||'空き';}
function modelLabel(){return '主人公';}
function renderEquipmentInspector(){
  const labels={main:'右手',off:'左手',back:'背中'};
  for(const slot of ['main','off','back']){
    const current=q(`#asset-current-${slot}`);if(current)current.textContent=equipmentLabel(selection[slot]);
  }
  const summary=q('#asset-combination');
  if(summary)summary.textContent=selection.main?equipmentLabel(selection.main):'素手';
  const stageSlotLabel=q('#asset-stage-slot-label');if(stageSlotLabel)stageSlotLabel.textContent='右手';
}
function renderWeaponTypes(){
  const list=q('#asset-weapon-types'); if(!list)return;
  list.replaceChildren(...WEAPON_TYPES.map(type=>{
    const button=document.createElement('button');
    button.type='button';button.classList.add('review-choice-card');button.dataset.weaponType=type.id;
    button.disabled=Boolean(type.equipment&&weaponLibraryBusy);
    button.setAttribute('role','option');button.setAttribute('aria-selected',String(type.id===selection.weaponType));
    const text=document.createElement('span');text.textContent=type.label;
    const spec=type.equipment?REVIEW_SKELETON_EQUIPMENT.find(row=>row.id===type.equipment):null;
    button.append(createStaticThumbnail(type.thumbnail||spec?.thumbnailUrl||'./review/catalog-thumbnails.svg#equipment-none',type.label),text);
    button.addEventListener('click',()=>selectWeaponType(type.id).catch(error=>status(error.message,true)));
    return button;
  }));
}
async function selectWeaponType(typeId){
  const type=WEAPON_TYPES.find(row=>row.id===typeId); if(!type)throw new Error(`Unknown weapon type: ${typeId}`);
  const select=q('#slot-main');if(select)select.value=type.equipment||'';
  const missing=Boolean(type.equipment&&!equipmentCache.has(equipmentCacheKey('main',type.equipment)));
  const equip=()=>setEquipment('main',type.equipment);
  if(missing)await withStageBusy(equip,'武器を読み込み中…');else await equip();
  selection.weaponType=type.id;
  renderSelection({syncWeaponType:false});
  status(type.id==='none'?'素手を表示しています':`${type.label}を装備しました`);
}
function renderSelection({syncWeaponType=true}={}){
  if(syncWeaponType)selection.weaponType=weaponTypeForEquipment(selection.main);
  renderWeaponTypes();
  renderEquipmentInspector();
}
function populate() {
  const count=q('#asset-model-count');if(count)count.textContent='主人公';
  for(const slot of ['main','off','back']){
    const select=q(`#slot-${slot}`);select.append(new Option('なし',''));for(const item of reviewSkeletonEquipmentForSlot(slot))select.append(new Option(item.label,item.id));select.addEventListener('change',()=>setEquipment(slot,select.value||null).then(()=>status('装備を表示しています')).catch(error=>status(error.message,true)));
  }
  for(const button of document.querySelectorAll('[data-asset-focus]'))button.addEventListener('click',()=>setFocusPreset(button.dataset.assetFocus));
  for(const slot of ['main','off','back'])q(`#slot-${slot}`)?.addEventListener('change',renderSelection);
  controls.addEventListener('start',()=>{assetCameraPresets.clear();q('.asset-stage-hint')?.classList.add('is-dismissed');});
  q('#asset-reset').addEventListener('click',()=>{
    for(const slot of ['main','off','back']){q(`#slot-${slot}`).value='';void setEquipment(slot,null);}
    selection.weaponType='none';activeAssetSlot='main';frameModel();queueMicrotask(()=>renderSelection({syncWeaponType:false}));
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
  weaponLibraryBusy=false;renderWeaponTypes();
}
initialize().catch(error=>status(error.message,true));
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frameId);stageLifecycle.destroy();assetCameraPresets.destroy();controls.dispose();for(const root of equipmentCache.values())disposeRoot(root);equipmentCache.clear();mounted.clear();disposeRoot(modelRoot);ground.geometry.dispose();ground.material.dispose();renderer.dispose();},{once:true});
