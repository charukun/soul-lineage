import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {mountRinneReviewShell} from './review-lab-shell.js';
import {createReviewStageLifecycle} from '@soul/shared-ui/review-shell';
import {
  REVIEW_SKELETON_SOURCE,
  REVIEW_SKELETON_EQUIPMENT,
  reviewSkeletonEquipmentForSlot,
} from '@soul/assets';
import { PROTAGONIST_VILLAGER_MODEL } from '@soul/characters';
import './review-asset-library.css';
mountRinneReviewShell('equipment');

const q = selector => document.querySelector(selector);
function createStaticThumbnail(url,label=''){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('review-static-thumbnail');svg.setAttribute('viewBox','0 0 160 160');svg.setAttribute('aria-label',label);svg.setAttribute('role','img');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href',url);svg.append(use);return svg;}
const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const loader = new GLTFLoader();
const reviewEquipmentUrl = spec => spec.runtime.url;
const protagonistModelUrl = PROTAGONIST_VILLAGER_MODEL.assetPath;
const canvas = q('#asset-stage');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
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
  q('#asset-status').textContent=message;
  q('#asset-status').dataset.error=String(error);
  const indicator=q('#asset-load-state');
  if(indicator){
    const loading=!error&&/読み込み中|モデルを読み込んで/.test(message);
    indicator.dataset.state=error?'error':loading?'loading':'ready';
    const label=indicator.querySelector('strong');
    if(label)label.textContent=error?'要確認':loading?'準備中':'表示中';
  }
}
function findNode(root, wanted) {
  const target = normalize(wanted); let exact = null, suffix = null;
  root?.traverse(node => { const name=normalize(node.name); if(!exact && name===target) exact=node; else if(!suffix && name.endsWith(target)) suffix=node; });
  return exact || suffix;
}
function disposeRoot(root) {
  if (!root) return;
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
  root.removeFromParent(); geometries.forEach(v=>v.dispose?.()); materials.forEach(v=>v.dispose?.()); textures.forEach(v=>v.dispose?.());
}
function hideNativeAccessories(root) {
  const names=new Set(Object.values(ACCESSORY_NODES).flatMap(row=>Object.values(row)));
  for(const name of names){const node=findNode(root,name);if(node)node.visible=false;}
}
function modelHeight() {
  if(!modelRoot)return 1.7; const box=new THREE.Box3().setFromObject(modelRoot); const height=box.max.y-box.min.y; return Number.isFinite(height)&&height>.05?height:1.7;
}
function fitObject(root, fraction) {
  root.updateMatrixWorld(true); const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),longest=Math.max(size.x,size.y,size.z);
  if(!Number.isFinite(longest)||longest<1e-6)throw new Error('装備geometryが空です'); root.scale.multiplyScalar(modelHeight()*fraction/longest);
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
function applyTransform(payload,spec,slot) {
  const side=slot==='off'?'l':'r';
  if(slot==='back'){
    const row=BACK_GRIPS[spec.family];
    if(row){payload.position.set(...row.position);payload.rotation.set(...row.rotation);fitObject(payload,spec.targetFraction);return;}
    payload.position.set(0,0,-modelHeight()*.11);payload.rotation.set(0,0,0);fitObject(payload,spec.targetFraction);return;
  }
  const nativeName=ACCESSORY_NODES[spec.family]?.[side],native=nativeName?findNode(modelRoot,nativeName):null;
  if(native){payload.position.copy(native.position);payload.quaternion.copy(native.quaternion);payload.scale.copy(native.scale);return;}
  const grip=HAND_GRIPS[spec.family]?.[side]||HAND_GRIPS[spec.family]?.r;
  if(grip){payload.position.set(...grip.position);payload.quaternion.set(...grip.quaternion);payload.scale.setScalar(grip.scale);return;}
  payload.position.set(0,0,0);payload.rotation.set(0,0,slot==='off'?Math.PI/2:-Math.PI/2);fitObject(payload,spec.targetFraction);
}
async function setEquipment(slot,id) {
  const previous=mounted.get(slot); if(previous){disposeRoot(previous);mounted.delete(slot);} selection[slot]=id||null;
  if(!id)return;
  const spec=REVIEW_SKELETON_EQUIPMENT.find(row=>row.id===id); if(!spec||!spec.slots.includes(slot))throw new Error(`装備できない組み合わせ: ${slot}/${id}`);
  const anchor=slotAnchor(slot); if(!anchor)throw new Error(`${slot} 装備用の骨/slotが見つかりません`);
  const gltf=await loader.loadAsync(reviewEquipmentUrl(spec)),payload=flattenScene(gltf.scene); payload.name=`ReviewEquipment:${spec.id}`;
  payload.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}}); anchor.add(payload); applyTransform(payload,spec,slot); mounted.set(slot,payload);
}
async function reapplyEquipment() {
  const wanted={main:selection.main,off:selection.off,back:selection.back};
  for(const slot of ['main','off','back']){selection[slot]=null;await setEquipment(slot,wanted[slot]);}
}
function cameraFrame() {
  if(!modelRoot)return null;
  modelRoot.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(modelRoot),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const height=Math.max(size.y,.5),radius=Math.max(size.x,size.y,size.z,.5);
  return {box,center,height,radius,target:new THREE.Vector3(center.x,box.min.y+height*.5,center.z)};
}
function focusTarget(frame,focus) {
  if(focus==='full')return frame.target.clone();
  const anchor=slotAnchor(focus);
  if(!anchor)return frame.target.clone();
  return anchor.getWorldPosition(new THREE.Vector3());
}
function applyViewPreset() {
  const frame=cameraFrame(); if(!frame)return;
  const {center,height,radius}=frame,target=focusTarget(frame,activeViewFocus);
  const distance=activeViewFocus==='full'?Math.max(radius*1.48,height*.74):Math.max(height*.50,.66);
  const eyeY=activeViewFocus==='full'?target.y+height*.08:target.y+height*.04;
  controls.target.copy(target);
  if(activeViewDirection==='left')camera.position.set(target.x-distance,eyeY,target.z);
  else if(activeViewDirection==='right'||activeViewDirection==='side')camera.position.set(target.x+distance,eyeY,target.z);
  else if(activeViewDirection==='three-quarter')camera.position.set(target.x+distance*.72,eyeY,target.z+distance*.72);
  else if(activeViewDirection==='back')camera.position.set(target.x,eyeY,target.z-distance);
  else camera.position.set(target.x,eyeY,target.z+distance);
  if(activeViewFocus==='full'&&activeViewDirection==='left')camera.position.x=center.x-distance;
  if(activeViewFocus==='full'&&(activeViewDirection==='right'||activeViewDirection==='side'))camera.position.x=center.x+distance;
  controls.update();
  for(const button of document.querySelectorAll('[data-asset-camera]'))button.setAttribute('aria-pressed',String(button.dataset.assetCamera===activeViewDirection));
  for(const button of document.querySelectorAll('[data-asset-focus]'))button.setAttribute('aria-pressed',String(button.dataset.assetFocus===activeViewFocus));
}
function setCameraPreset(preset='front'){activeViewDirection=preset;applyViewPreset();}
function setFocusPreset(focus='full'){activeViewFocus=focus;applyViewPreset();}
function frameModel(){activeViewFocus='full';applyViewPreset();}
function applyPresentationPose(root){
  const rightUpper=findNode(root,'upperarmr')||findNode(root,'rightupperarm');
  const leftUpper=findNode(root,'upperarml')||findNode(root,'leftupperarm');
  const rightLower=findNode(root,'lowerarmr')||findNode(root,'rightlowerarm');
  const leftLower=findNode(root,'lowerarml')||findNode(root,'leftlowerarm');
  if(rightUpper)rightUpper.rotation.z-=Math.PI*.30;
  if(leftUpper)leftUpper.rotation.z+=Math.PI*.30;
  if(rightLower)rightLower.rotation.y+=.16;
  if(leftLower)leftLower.rotation.y-=.16;
}
async function loadModel() {
  const sequence=++loadSequence; selection.model=PROTAGONIST_VILLAGER_MODEL.id; status('主人公モデルを読み込み中…');
  for(const root of mounted.values())disposeRoot(root);mounted.clear(); if(modelRoot)disposeRoot(modelRoot); modelRoot=null; mixer?.stopAllAction();mixer=null;
  const gltf=await loader.loadAsync(protagonistModelUrl); if(sequence!==loadSequence){disposeRoot(gltf.scene);return;}
  modelRoot=gltf.scene; modelRoot.name='ReviewModel:Protagonist'; modelRoot.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}}); scene.add(modelRoot); hideNativeAccessories(modelRoot);
  modelRoot.updateMatrixWorld(true); const box=new THREE.Box3().setFromObject(modelRoot),center=box.getCenter(new THREE.Vector3()); modelRoot.position.x-=center.x;modelRoot.position.z-=center.z;modelRoot.position.y-=box.min.y;modelRoot.updateMatrixWorld(true);
  const idleClip=gltf.animations?.find(clip=>/idle|stand|breath/i.test(clip.name||''))||gltf.animations?.find(clip=>!/t[-_ ]?pose|bind|rest/i.test(clip.name||''));
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
  await setEquipment('main',type.equipment);
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
  for(const button of document.querySelectorAll('[data-asset-camera]'))button.addEventListener('click',()=>setCameraPreset(button.dataset.assetCamera));
  for(const button of document.querySelectorAll('[data-asset-focus]'))button.addEventListener('click',()=>setFocusPreset(button.dataset.assetFocus));
  for(const slot of ['main','off','back'])q(`#slot-${slot}`)?.addEventListener('change',renderSelection);
  controls.addEventListener('start',()=>{for(const button of document.querySelectorAll('[data-asset-camera]'))button.setAttribute('aria-pressed','false');q('.asset-stage-hint')?.classList.add('is-dismissed');});
  q('#asset-reset').addEventListener('click',()=>{
    for(const slot of ['main','off','back']){q(`#slot-${slot}`).value='';void setEquipment(slot,null);}
    selection.weaponType='none';activeAssetSlot='main';frameModel();queueMicrotask(()=>renderSelection({syncWeaponType:false}));
  });
  canvas.addEventListener('pointerdown',()=>q('.asset-stage-hint')?.classList.add('is-dismissed'),{once:true,passive:true});
  renderSelection();applyViewPreset();
}
const stageLifecycle=createReviewStageLifecycle({canvas,stage:canvas.closest('.review-surface__stage'),onResize:({width,height,aspect})=>{renderer.setSize(width,height,false);camera.aspect=aspect;camera.updateProjectionMatrix();},render:()=>renderer.render(scene,camera)});
let last=performance.now();function frame(now){const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;controls.update();mixer?.update(dt);renderer.render(scene,camera);frameId=requestAnimationFrame(frame);}frameId=requestAnimationFrame(frame);
populate();loadModel().catch(error=>status(error.message,true));
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frameId);stageLifecycle.destroy();controls.dispose();for(const root of mounted.values())disposeRoot(root);disposeRoot(modelRoot);ground.geometry.dispose();ground.material.dispose();renderer.dispose();},{once:true});
