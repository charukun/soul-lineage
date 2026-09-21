import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {REVIEW_SKELETON_EQUIPMENT} from '@soul/assets';

const MAIN_WEAPON_IDS=Object.freeze([
  'skeleton-blade',
  'skeleton-axe',
  'skeleton-staff',
  'skeleton-crossbow'
]);

const HAND_GRIPS=Object.freeze({
  '1H_Sword':Object.freeze({position:[0,0,0],quaternion:[0,1,0,0],scale:.8876}),
  '1H_Axe':Object.freeze({position:[0,0,0],quaternion:[0,1,0,0],scale:.622211}),
  '2H_Staff':Object.freeze({position:[0,0,0],quaternion:[0,1,0,0],scale:1.0773}),
  '2H_Crossbow':Object.freeze({position:[0,0,0],quaternion:[0,Math.SQRT1_2,0,Math.SQRT1_2],scale:.7204})
});
const FLOOR_BOX=new THREE.Box3(),FLOOR_A=new THREE.Vector3(),FLOOR_B=new THREE.Vector3();

const byId=new Map(REVIEW_SKELETON_EQUIPMENT.map(row=>[row.id,row]));
const labelById=Object.freeze({
  'skeleton-blade':'剣',
  'skeleton-axe':'斧',
  'skeleton-staff':'杖',
  'skeleton-crossbow':'クロスボウ'
});

export const MOTION_REVIEW_WEAPON_OPTIONS=Object.freeze([
  Object.freeze({id:'none',label:'なし',spec:null}),
  ...MAIN_WEAPON_IDS.map(id=>Object.freeze({id,label:labelById[id],spec:byId.get(id)}))
]);

export function motionReviewWeaponOption(id='none'){
  return MOTION_REVIEW_WEAPON_OPTIONS.find(row=>row.id===id)||MOTION_REVIEW_WEAPON_OPTIONS[0];
}

function flattenScene(scene){
  if(scene.children.length!==1)return scene;
  const child=scene.children[0],holder=new THREE.Group();
  holder.scale.copy(child.scale);
  child.scale.set(1,1,1);child.position.set(0,0,0);child.rotation.set(0,0,0);
  scene.remove(child);holder.add(child);
  return holder;
}

export function applyMotionReviewWeaponGrip(root,spec){
  if(!root?.isObject3D||!spec)throw new Error('Motion review weapon root/spec required');
  const grip=HAND_GRIPS[spec.family];
  if(!grip)throw new Error('Unsupported motion review weapon family: '+spec.family);
  root.position.fromArray(grip.position);
  root.quaternion.fromArray(grip.quaternion).normalize();
  root.scale.setScalar(grip.scale);
  root.userData.motionReviewGripPosition=grip.position.slice();
  return root;
}

export function keepMotionReviewWeaponAboveFloor(root,floorY=.015){
  if(!root?.isObject3D||!root.parent)return 0;
  const grip=root.userData.motionReviewGripPosition;
  if(Array.isArray(grip)&&grip.length===3)root.position.fromArray(grip);
  root.updateWorldMatrix(true,true);FLOOR_BOX.setFromObject(root);
  const lift=floorY-FLOOR_BOX.min.y;
  if(!Number.isFinite(lift)||lift<=0)return 0;
  FLOOR_A.set(0,0,0);FLOOR_B.set(0,lift,0);
  root.parent.worldToLocal(FLOOR_A);root.parent.worldToLocal(FLOOR_B);
  root.position.add(FLOOR_B.sub(FLOOR_A));root.updateWorldMatrix(true,true);
  return lift;
}

export async function loadMotionReviewWeapon(id,{loader=new GLTFLoader()}={}){
  const option=motionReviewWeaponOption(id);
  if(!option.spec)return Object.freeze({option,root:null});
  if(!option.spec.slots.includes('main'))throw new Error('Motion review weapon cannot be equipped in main hand: '+id);
  const gltf=await loader.loadAsync(option.spec.runtime.url);
  const root=flattenScene(gltf.scene);
  root.name='MotionReviewWeapon:'+option.id;
  root.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;}});
  applyMotionReviewWeaponGrip(root,option.spec);
  return Object.freeze({option,root});
}
