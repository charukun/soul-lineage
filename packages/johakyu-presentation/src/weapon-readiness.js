export const SHEATHABLE_WEAPONS=Object.freeze(new Set(['sword','dagger','great']));
export function createWeaponReadiness({THREE,weaponMesh,armRig,scabbardFrame,beginWeaponStow,lockWeaponInScabbard,ensureScabbard,bladeAxisForSheath,alignedWeaponQuaternion,homeWeaponWorldPose,weaponWorldPoseAtHilt,setWeaponWorldPose,solveArmToTarget,restoreStowedWeapon,moveBladeToSheath,clamp}){
 function moveBladeFromSheath(a,row,dt){
   if(!a.sheathed&&!a.drawMotion)return;const weaponId=row.equipment?.weapon,name=weaponMesh[weaponId],weapon=name?a.root.getObjectByName(name):null,right=armRig(a,'r'),frame=scabbardFrame(a,weaponId);
   if(!weapon?.visible||!right?.socket||!frame){a.sheathed=false;a.drawMotion=null;return;}
   let held=a.weaponStow;if(!held){held=beginWeaponStow(a,weapon);if(!held)return;lockWeaponInScabbard(a,weaponId,frame);}
   ensureScabbard(a,weaponId,frame,held);const combatReady=Boolean(row.combatReady);
   if(!a.drawMotion){
     if(!combatReady){if(weapon.parent!==a.scabbard?.group)lockWeaponInScabbard(a,weaponId,frame);return;}
     if(weapon.parent!==a.root)a.root.attach(weapon);weapon.updateWorldMatrix(true,true);const axis=bladeAxisForSheath(a,weapon);a.drawMotion={key:row.action?.id||('ready:'+String(row.id||a.canonicalId||'')),elapsed:0,duration:.5,startHilt:axis?.hilt.clone()||frame.mouthWorld.clone()};a.sheathed=false;
   }
   const motion=a.drawMotion,smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};motion.elapsed+=Math.max(0,dt);let progress=clamp(motion.elapsed/motion.duration,0,1);
   if(row.action){const contact=Math.max(.18,Number(row.action.motion?.contactProgress)||.5),forced=clamp((Number(row.action.progress)||0)/(contact*.64),0,1);progress=Math.max(progress,forced);}
   const {mouthWorld,directionWorld,leftWorld,forwardWorld,profile}=frame,aligned=alignedWeaponQuaternion(held,directionWorld),home=homeWeaponWorldPose(held),entry=mouthWorld.clone().addScaledVector(directionWorld,-held.length*profile.insert),clearance=entry.clone().addScaledVector(leftWorld,a.height*profile.stagingSide).addScaledVector(forwardWorld,a.height*profile.stagingForward).add(new THREE.Vector3(0,a.height*profile.stagingUp,0));
   let hilt,quaternion;if(progress<.5){const t=smooth(progress/.5);hilt=mouthWorld.clone().lerp(entry,t);quaternion=aligned;}
   else if(progress<.78){const t=smooth((progress-.5)/.28);hilt=entry.clone().lerp(clearance,t);quaternion=aligned.clone().slerp(home.quaternion,.36*t);}
   else{const t=smooth((progress-.78)/.22);hilt=clearance.clone().lerp(home.hilt,t);quaternion=aligned.clone().slerp(home.quaternion,.36+.64*t);}
   const scale=held.worldScale.clone().lerp(home.scale,smooth(clamp((progress-.72)/.28,0,1)));setWeaponWorldPose(weapon,weaponWorldPoseAtHilt(held,hilt,quaternion,scale));const actual=bladeAxisForSheath(a,weapon),handTarget=actual?.hilt||hilt;
   solveArmToTarget(a,right,()=>right.socket.getWorldPosition(new THREE.Vector3()),handTarget,.9);const left=armRig(a,'l');if(left&&!row.equipment?.shield){const hold=mouthWorld.clone().addScaledVector(directionWorld,.075).addScaledVector(leftWorld,.02),leftWeight=1-smooth(clamp((progress-.42)/.34,0,1));solveArmToTarget(a,left,()=>left.socket.getWorldPosition(new THREE.Vector3()),hold,leftWeight*.75);}
   if(progress>=.995)restoreStowedWeapon(a);
 }
 function updateCombatReadyWeapon(a,row,dt){
   const sheathable=SHEATHABLE_WEAPONS.has(row.equipment?.weapon);
   if(!sheathable)return;
   const ready=Boolean(row.combatReady);
   if(ready){
     if(a.autoSheath){a.autoSheath=null;if(a.weaponStow)a.sheathed=true;}
     if(a.sheathed||a.drawMotion)moveBladeFromSheath(a,row,dt);
     return;
   }
   if(a.drawMotion){a.drawMotion=null;if(a.weaponStow)a.sheathed=true;}
   if(a.sheathed){moveBladeFromSheath(a,row,0);return;}
   const key='range:'+String(row.id||a.canonicalId||'');
   if(a.autoSheath?.key!==key)a.autoSheath={key,elapsed:0,duration:.62};
   a.autoSheath.elapsed+=Math.max(0,dt);
   const progress=clamp(a.autoSheath.elapsed/a.autoSheath.duration,0,1);moveBladeToSheath(a,progress,key);
   if(progress>=1){a.autoSheath=null;if(a.weaponStow)a.sheathed=true;a.sheathMotion=null;}
 }

 return {moveBladeFromSheath,updateCombatReadyWeapon};
}
