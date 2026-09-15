import { THREE, GLTFLoader } from '@soul/rendering';
import { profiles } from '../../public/simulator/src/rig-profiles.js';
import {
  EQUIPMENT_BY_ID,
  KAYKIT_ACCESSORY_NODE,
  KAYKIT_BACK_GRIPS,
  KAYKIT_HAND_GRIPS,
} from './equipment-catalog.js';

export const EQUIPMENT_SLOTS = Object.freeze(['main','off','back']);

const normalizeName = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g,'');
const finiteVec = value => value?.toArray?.().every(Number.isFinite);

function findNode(root, wanted) {
  const key = normalizeName(wanted);
  let exact = null, suffix = null;
  root?.traverse(node => {
    const name = normalizeName(node?.name);
    if (!exact && name === key) exact = node;
    else if (!suffix && name.endsWith(key)) suffix = node;
  });
  return exact || suffix;
}

function disposeObject(root) {
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root?.traverse(node=>{
    if(node.geometry)geometries.add(node.geometry);
    for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){
      materials.add(material);
      Object.values(material).forEach(value=>{if(value?.isTexture)textures.add(value);});
    }
  });
  root?.removeFromParent();
  geometries.forEach(value=>value.dispose?.());
  materials.forEach(value=>value.dispose?.());
  textures.forEach(value=>value.dispose?.());
}

function flattenEquipmentScene(src) {
  if (src.children.length !== 1) return src;
  const holder = new THREE.Group(), child = src.children[0];
  holder.name = `EquipmentPayload:${src.name || child.name || 'asset'}`;
  holder.scale.copy(child.scale);
  child.scale.set(1,1,1);
  child.position.set(0,0,0);
  child.rotation.set(0,0,0);
  src.remove(child);
  holder.add(child);
  return holder;
}

function palmBasis(longitudinal, across) {
  const x=longitudinal.clone();
  if(x.lengthSq()<1e-12)x.set(1,0,0);
  x.normalize();
  let y=across.clone().addScaledVector(x,-across.dot(x));
  if(y.lengthSq()<1e-10){
    y=Math.abs(x.y)<.85?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);
    y.addScaledVector(x,-y.dot(x));
  }
  y.normalize();
  const z=x.clone().cross(y).normalize();
  y.copy(z).cross(x).normalize();
  return {z,rotation:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z))};
}

function profileFor(model) {
  const id=String(model?.id || '').toUpperCase();
  if(id.includes('SHINO'))return profiles.SHINO;
  if(id.includes('TSUKU'))return profiles.TSUKU;
  for(const key of ['A','B','C'])if(id===key||id.endsWith(`.${key}`))return profiles[key];
  return profiles.A;
}

function vrmHandSocket(root,bones,model,side) {
  const hand=bones?.[`${side}Hand`];
  if(!hand)throw new Error(`装備slotに必要な${side}Handがありません`);
  root.updateMatrixWorld(true);
  const p=profileFor(model),hp=hand.getWorldPosition(new THREE.Vector3());
  const point=name=>bones?.[`${side}${name}`]?.getWorldPosition(new THREE.Vector3());
  const middle=point('MiddleProximal')||point('IndexProximal');
  const index=point('IndexProximal'),little=point('LittleProximal');
  const long=middle?.clone().sub(hp)||new THREE.Vector3(side==='right'?-1:1,0,0).multiplyScalar(.075);
  const across=index&&little?index.clone().sub(little):new THREE.Vector3(0,.058,0);
  const {z,rotation}=palmBasis(long,across),palmWidth=across.length();
  const inset=Math.max(p.palmInset,palmWidth*.34);
  const center=hp.clone().addScaledVector(long,p.palmAlong+.60).addScaledVector(z,side==='right'?-inset:inset);
  const localP=hand.worldToLocal(center.clone());
  const localQ=hand.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation).normalize();
  const socket=new THREE.Group();
  socket.name=`GrowthEquipmentSocket:${side}`;
  socket.position.copy(localP);socket.quaternion.copy(localQ);hand.add(socket);
  return socket;
}

function kaykitHandSocket(root,side) {
  const node=findNode(root,side==='right'?'handslot.r':'handslot.l');
  if(!node)throw new Error(`KayKit ${side} handslotが見つかりません`);
  return node;
}

function backAnchor(root,bones,kind) {
  const node=kind==='kaykit'?findNode(root,'chest'):(bones?.chest||bones?.spine);
  if(!node)throw new Error('背中装備に必要なchest/spineがありません');
  return node;
}

function nativeAccessory(root,family,side) {
  const name=KAYKIT_ACCESSORY_NODE[family]?.[side];
  return name?findNode(root,name):null;
}

function hideNativeAccessories(root) {
  const seen=new Set();
  for(const row of Object.values(KAYKIT_ACCESSORY_NODE))for(const name of Object.values(row)){
    if(seen.has(name))continue;seen.add(name);
    const node=findNode(root,name);if(node)node.visible=false;
  }
}

function characterHeight(root) {
  root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(root),height=box.max.y-box.min.y;
  return Number.isFinite(height)&&height>.01?height:1.7;
}

function fitPayload(payload,spec,height,maxScale=4) {
  payload.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(payload),size=box.getSize(new THREE.Vector3());
  const longest=Math.max(size.x,size.y,size.z);
  if(!Number.isFinite(longest)||longest<1e-6)throw new Error(`装備geometryが空です: ${spec.id}`);
  const wanted=Math.max(.04,height*spec.targetFraction);
  const scale=Math.min(maxScale,wanted/longest);
  payload.scale.multiplyScalar(scale);
  return scale;
}

function mirrorBackGrip(row,side) {
  if(side!=='l')return row;
  const position=[-row.position[0],row.position[1],row.position[2]];
  const q=new THREE.Quaternion(...row.quaternion),euler=new THREE.Euler().setFromQuaternion(q,'XYZ');
  return {position,quaternion:new THREE.Quaternion().setFromEuler(new THREE.Euler(euler.x,-euler.y,-euler.z,'XYZ')).toArray()};
}

async function loadEquipment(spec) {
  const response=await fetch(new URL(spec.url,location.href),{cache:'force-cache'});
  if(!response.ok)throw new Error(`装備HTTP ${response.status}: ${spec.label}`);
  const bytes=await response.arrayBuffer();
  if(!bytes.byteLength)throw new Error(`装備データが空です: ${spec.label}`);
  const gltf=await new GLTFLoader().parseAsync(bytes,new URL('./asset-review/equipment/',location.href).href);
  gltf.scene.name=`GrowthEquipment:${spec.id}`;
  gltf.scene.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;}});
  return gltf.scene;
}

function applyKayKitHand(payload,root,spec,side) {
  const ref=nativeAccessory(root,spec.family,side);
  if(ref){payload.position.copy(ref.position);payload.quaternion.copy(ref.quaternion);payload.scale.copy(ref.scale);return 'native-accessory';}
  const grips=KAYKIT_HAND_GRIPS[spec.family],grip=side==='l'?(grips?.l||grips?.r):grips?.r;
  if(!grip)return null;
  payload.position.set(...grip.position);payload.quaternion.set(...grip.quaternion);payload.scale.setScalar(grip.scale);return 'verified-fallback';
}

function applyVrmHand(payload,spec,side,height) {
  const grips=KAYKIT_HAND_GRIPS[spec.family],grip=side==='l'?(grips?.l||grips?.r):grips?.r;
  payload.position.set(0,0,0);
  if(grip)payload.quaternion.set(...grip.quaternion);else payload.quaternion.identity();
  payload.scale.set(1,1,1);fitPayload(payload,spec,height);
  return grip?'anatomical-socket+authored-orientation':'anatomical-socket+bounded-fit';
}

function applyBack(payload,root,spec,side,height,kind) {
  const row=KAYKIT_BACK_GRIPS[spec.family];
  if(row){
    const transformed=mirrorBackGrip(row,side);
    payload.position.set(...transformed.position);payload.quaternion.set(...transformed.quaternion);
    if(kind==='kaykit'){
      const hand=KAYKIT_HAND_GRIPS[spec.family],scale=(side==='l'?(hand?.l||hand?.r):hand?.r)?.scale;
      if(scale)payload.scale.setScalar(scale);else{payload.scale.set(1,1,1);fitPayload(payload,spec,height);}
    }else{payload.scale.set(1,1,1);fitPayload(payload,spec,height);payload.position.multiplyScalar(height/2);}
    return 'chest-carry';
  }
  payload.position.set(0,0,-height*.11);payload.quaternion.identity();payload.scale.set(1,1,1);fitPayload(payload,spec,height);
  return 'bounded-back-fit';
}

export function createGrowthEquipmentController({root,bones,model}) {
  if(!root||!model)throw new Error('Equipment controller requires model root');
  const kind=model.kind==='kaykit'?'kaykit':'vrm',height=characterHeight(root),mounted=new Map();
  if(kind==='kaykit')hideNativeAccessories(root);
  const anchors={
    main:kind==='kaykit'?kaykitHandSocket(root,'right'):vrmHandSocket(root,bones,model,'right'),
    off:kind==='kaykit'?kaykitHandSocket(root,'left'):vrmHandSocket(root,bones,model,'left'),
    back:backAnchor(root,bones,kind),
  };
  const state={main:null,off:null,back:null};

  function clear(slot){
    const row=mounted.get(slot);if(row){disposeObject(row);mounted.delete(slot);}state[slot]=null;
  }

  async function set(slot,id){
    if(!EQUIPMENT_SLOTS.includes(slot))throw new Error(`Unknown equipment slot: ${slot}`);
    clear(slot);
    if(!id)return null;
    const spec=EQUIPMENT_BY_ID.get(id);
    if(!spec||!spec.slots.includes(slot))throw new Error(`装備できない組み合わせです: ${slot}/${id}`);
    const source=await loadEquipment(spec),payload=flattenEquipmentScene(source),side=slot==='off'?'l':'r',anchor=anchors[slot];
    anchor.add(payload);
    let method;
    if(slot==='back')method=applyBack(payload,root,spec,side,height,kind);
    else if(kind==='kaykit'){
      method=applyKayKitHand(payload,root,spec,side);
      if(!method){payload.position.set(0,0,0);payload.quaternion.identity();payload.scale.set(1,1,1);fitPayload(payload,spec,height);method='native-slot+bounded-fit';}
    }else method=applyVrmHand(payload,spec,side,height);
    payload.updateMatrixWorld(true);
    if(!finiteVec(payload.getWorldPosition(new THREE.Vector3()))||!payload.quaternion.toArray().every(Number.isFinite)||!payload.scale.toArray().every(Number.isFinite)){
      disposeObject(payload);throw new Error(`装備transformが不正です: ${spec.label}`);
    }
    mounted.set(slot,payload);state[slot]=id;
    return {slot,id,method,label:spec.label};
  }

  async function applyState(next={}){
    const results=[];
    for(const slot of EQUIPMENT_SLOTS){
      const id=next[slot]||null;
      try{const result=await set(slot,id);if(result)results.push(result);}catch(error){clear(slot);results.push({slot,id,error:String(error?.message||error)});}
    }
    return results;
  }
  function clearAll(){for(const slot of EQUIPMENT_SLOTS)clear(slot);}
  function snapshot(){return Object.freeze({...state});}
  function dispose(){clearAll();for(const value of Object.values(anchors))if(value?.name?.startsWith('GrowthEquipmentSocket:'))value.removeFromParent();}
  function diagnostics(){return {kind,height,state:{...state},anchors:Object.fromEntries(Object.entries(anchors).map(([slot,node])=>[slot,node.name||node.type]))};}
  return Object.freeze({set,applyState,clearAll,snapshot,dispose,diagnostics});
}
