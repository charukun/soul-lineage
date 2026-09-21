import {Matrix4,Vector3} from 'three';
import {createMotionQualityAdapter} from './motion-quality.js';

const FOOT_RE=/walk|run|jump|land|crouch|sneak|crawl|slide/i;
const CONTACT_RE=/sword|melee|bow|holding|chop|hammer|pickaxe|saw|fish|shield|attack|block/i;
const WEAPON_RE=/sword|melee|bow|holding|chop|hammer|pickaxe|saw|shield/i;

export function classifyHumanoidPreviewConstraints(name=''){
  return Object.freeze({footLock:FOOT_RE.test(name),bodyClearance:CONTACT_RE.test(name),weaponContact:WEAPON_RE.test(name)});
}

export function createHumanoidPreviewConstraints({root,bones,profile,groundY=0}={}){
  if(!root||!bones||!profile)throw new Error('Humanoid preview constraints require root, bones and profile');
  const armKeys=['leftUpperArm','leftLowerArm','leftHand','rightUpperArm','rightLowerArm','rightHand'];
  let quality=null;
  if(bones.hips&&bones.spine&&armKeys.every(key=>bones[key])){
    try{quality=createMotionQualityAdapter({root,bones},{height:profile.height});}catch{}
  }
  function moveHipsWorld(delta){
    if(!bones.hips||!Number.isFinite(delta)||Math.abs(delta)<1e-6)return 0;
    const limit=Math.max(.02,profile.height*.22),clamped=Math.max(-limit,Math.min(limit,delta));
    const parent=bones.hips.parent,parentWorld=parent?.matrixWorld||new Matrix4(),inverse=new Matrix4().copy(parentWorld).invert();
    const a=new Vector3(0,0,0).applyMatrix4(inverse),b=new Vector3(0,clamped,0).applyMatrix4(inverse);
    bones.hips.position.add(b.sub(a));root.updateWorldMatrix(true,true);return clamped;
  }
  function lockFeet(){
    root.updateWorldMatrix(true,true);
    const feet=['leftFoot','rightFoot'].map(key=>bones[key]).filter(Boolean);
    if(!feet.length)return {applied:false,reason:'foot-bones-missing'};
    const minY=Math.min(...feet.map(foot=>foot.getWorldPosition(new Vector3()).y));
    const delta=moveHipsWorld(groundY-minY);
    return {applied:Math.abs(delta)>1e-6,delta};
  }
  function apply({clipName='',mode='raw',weaponObject=null,weaponProfile=null,weaponSocket=null}={}){
    const preset=classifyHumanoidPreviewConstraints(clipName),corrections=[],reasons=[];
    if(mode!=='assisted')return {mode:'raw',preset,corrections,reasons};
    if(preset.footLock){const foot=lockFeet();if(foot.applied)corrections.push({kind:'foot-ground',delta:foot.delta});else if(foot.reason)reasons.push(foot.reason);}
    if(preset.bodyClearance&&quality){
      try{const report=quality.correct();if(report?.corrections?.length)corrections.push(...report.corrections.map(row=>({kind:'body-clearance',...row})));}catch(error){reasons.push('body-clearance:'+String(error?.message||error));}
    }else if(preset.bodyClearance)reasons.push('body-clearance-unavailable');
    if(preset.weaponContact){
      if(quality&&weaponObject&&weaponProfile&&weaponSocket){
        try{quality.calibrateWeapon(weaponObject,weaponProfile,weaponSocket);corrections.push({kind:'weapon-contact'});}catch(error){reasons.push('weapon-contact:'+String(error?.message||error));}
      }else reasons.push('weapon-contact-unbound');
    }
    root.updateWorldMatrix(true,true);
    return {mode:'assisted',preset,corrections,reasons};
  }
  return Object.freeze({apply,classify:name=>classifyHumanoidPreviewConstraints(name)});
}
