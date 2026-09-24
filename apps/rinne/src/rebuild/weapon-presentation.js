import {RINNE_EQUIPMENT_PROFILES} from '@soul/assets/equipment/three';
import {MIN_WEAPON_AGE_YEARS} from '@soul/characters';

export const CHILD_WEAPON_MAX_AGE_YEARS=11;
const BASE_WEAPON_ROLL=-Math.PI/2;
const freeze3=value=>Object.freeze([...value]);
const freeze4=value=>Object.freeze([...value]);

const CHILD_WEAPON_TUNING=Object.freeze({
  dagger:Object.freeze({scale:.96,socketPosition:freeze3([0,.012,.003]),gripRoll:-.035,motion:Object.freeze({rightUpper:freeze3([-.18,.03,-.04]),rightLower:freeze3([-.26,0,.03]),rightSwing:.18,leftSwing:.85,sway:.035})}),
  sword:Object.freeze({scale:.92,socketPosition:freeze3([0,.014,.001]),gripRoll:-.02,motion:Object.freeze({rightUpper:freeze3([-.24,.05,-.06]),rightLower:freeze3([-.34,0,.04]),rightSwing:.14,leftSwing:.75,sway:.03})}),
  great:Object.freeze({scale:.84,socketPosition:freeze3([0,.01,-.006]),gripRoll:.06,motion:Object.freeze({rightUpper:freeze3([-.30,.08,-.09]),rightLower:freeze3([-.42,-.04,.05]),leftUpper:freeze3([-.24,-.10,.09]),leftLower:freeze3([-.38,.03,-.04]),rightSwing:.08,leftSwing:.08,sway:.018})}),
  spear:Object.freeze({scale:.86,socketPosition:freeze3([0,.008,-.008]),gripRoll:.015,motion:Object.freeze({rightUpper:freeze3([-.22,-.09,-.05]),rightLower:freeze3([-.36,.02,.02]),leftUpper:freeze3([-.20,.14,.07]),leftLower:freeze3([-.40,-.02,-.03]),rightSwing:.06,leftSwing:.06,sway:.014})}),
  axe:Object.freeze({scale:.90,socketPosition:freeze3([0,.012,-.003]),gripRoll:.04,motion:Object.freeze({rightUpper:freeze3([-.28,.05,-.08]),rightLower:freeze3([-.38,0,.04]),rightSwing:.12,leftSwing:.65,sway:.026})}),
  staff:Object.freeze({scale:.88,socketPosition:freeze3([0,.01,-.006]),gripRoll:.02,motion:Object.freeze({rightUpper:freeze3([-.24,-.04,-.05]),rightLower:freeze3([-.34,0,.03]),rightSwing:.12,leftSwing:.72,sway:.022})})
});

const rotateGripToOrigin=(grip,roll)=>{
  const x=Number(grip?.[0])||0,y=Number(grip?.[1])||0,z=Number(grip?.[2])||0,cs=Math.cos(roll),sn=Math.sin(roll);
  return freeze3([-(x*cs-y*sn),-(x*sn+y*cs),-z]);
};
const addRotation=(bone,delta,weight=1)=>{
  if(!bone||!delta)return;
  bone.rotation.x+=delta[0]*weight;bone.rotation.y+=delta[1]*weight;bone.rotation.z+=delta[2]*weight;
};

export function rinneWeaponPresentation(weapon,ageYears=12){
  if(!weapon||weapon==='fist')return null;
  const profile=RINNE_EQUIPMENT_PROFILES[weapon];
  if(!profile)throw new Error(`Unknown RINNE weapon presentation: ${weapon}`);
  const age=Number(ageYears),child=Number.isFinite(age)&&age>=MIN_WEAPON_AGE_YEARS&&age<=CHILD_WEAPON_MAX_AGE_YEARS,tuning=child?CHILD_WEAPON_TUNING[weapon]:null;
  const objectRotationZ=BASE_WEAPON_ROLL+(tuning?.gripRoll||0);
  return Object.freeze({
    weapon,
    band:!Number.isFinite(age)||age>=12?'adult':age<MIN_WEAPON_AGE_YEARS?'locked':'child',
    scale:profile.scale*(tuning?.scale||1),
    socketPosition:tuning?.socketPosition||freeze3([0,.02,0]),
    socketQuaternion:freeze4([0,0,0,1]),
    objectPosition:tuning?rotateGripToOrigin(profile.grip,objectRotationZ):freeze3([0,0,0]),
    objectRotationZ,
    twoHanded:Boolean(profile.twoHanded),
    motion:tuning?.motion||null
  });
}

export function childWeaponSwingScale(presentation,side){
  const motion=presentation?.motion;
  if(!motion)return 1;
  return side==='right'?motion.rightSwing:motion.leftSwing;
}

export function applyChildWeaponPose(bones,presentation,{moving=false,combat=false,attacking=false}={},time=0){
  const motion=presentation?.motion;
  if(!motion||!bones)return false;
  const weight=attacking ? .34 : combat ? .72 : 1,sway=moving?Math.sin((Number(time)||0)*7.2)*motion.sway:0;
  addRotation(bones.rightUpperArm,motion.rightUpper,weight);addRotation(bones.rightLowerArm,motion.rightLower,weight);
  if(bones.rightUpperArm)bones.rightUpperArm.rotation.z+=sway;
  if(motion.leftUpper)addRotation(bones.leftUpperArm,motion.leftUpper,weight);
  if(motion.leftLower)addRotation(bones.leftLowerArm,motion.leftLower,weight);
  if(motion.leftUpper&&bones.leftUpperArm)bones.leftUpperArm.rotation.z-=sway*.75;
  return true;
}
