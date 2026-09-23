import {createRinneWeapon} from '@soul/assets/equipment/three';
import * as THREE from 'three';
import { PoseSchedule } from '@soul/characters';
import { attentionLoadPriority, shouldPromoteAttention } from '@soul/rendering/attention-priority';
import { applyStylizedShading } from '@soul/rendering/stylized-shading';
import { createCoopActors } from './coop-actors.js';
import { createKaykitCharacterPools } from './kaykit-character-pool.js';
import { createProtagonistCharacterPool } from './protagonist-character-pool.js';
import { NEWBORN_CARRY, applyCarrierCradlePose, applyNewbornCradlePose, hideCarrierCombatProps, newbornCarryTransform, positionNewbornForCradle, sanitizeCarrierCarryVisual, solveCarrierCradleContacts } from './newborn-carry-presentation.js';
import { resolveRinneCharacterRuntime } from './character-runtime-adapter.js';
import { applyTidebreakPose } from './tidebreak-pose.js';
import { applyChildWeaponPose, childWeaponSwingScale, rinneWeaponPresentation } from './weapon-presentation.js';
import {
  createRinneEnemyCharacter,
  createRinneHeroCharacter,
  createRinneMotherCharacter,
  createRinneRuntimeCharacter,
  resolveRinneRuntimeCharacter,
  rinneRuntimeAgeMs
} from './character-presentation.js';

const armorDye=Object.freeze({cloth:[1,1,1],light:[.72,.84,.78],heavy:[.68,.73,.82]});

// Integrate phase instead of multiplying absolute time by a changing speed.
// Weak ownership follows the pooled skeleton; combat/peer poses keep their contract.
const locomotionGaits=new WeakMap();
function locomotionStride(bones,time,moving,speed){
  let gait=locomotionGaits.get(bones);
  if(!gait||time<gait.time||time-gait.time>.5){gait={time,phase:0,amplitude:0};locomotionGaits.set(bones,gait);}
  const dt=Math.max(0,Math.min(.05,time-gait.time)),target=moving?.42*Math.min(1,Math.max(.18,speed/3)):0;
  gait.time=time;gait.phase=(gait.phase+dt*Math.min(12,6.4+Math.max(0,speed)*.85))%(Math.PI*2);
  gait.amplitude+=(target-gait.amplitude)*(1-Math.exp(-18*dt));
  return Math.sin(gait.phase)*gait.amplitude;
}

function poseHumanoid(bones,{moving=false,speed=0,combat=false,flash=0,carrier=false,carriedChild=false,tidebreak=null,smoothGait=false,weapon='fist',ageYears=12}={},time=0){
  const cadence=Math.min(12,6.4+Math.max(0,speed)*.85),stride=smoothGait?locomotionStride(bones,time,moving,speed):(moving?Math.sin(time*cadence)*.42:0),weaponPresentation=!carrier?rinneWeaponPresentation(weapon,ageYears):null;
  if(bones.leftUpperLeg)bones.leftUpperLeg.rotation.x+=stride;
  if(bones.rightUpperLeg)bones.rightUpperLeg.rotation.x-=stride;
  if(bones.leftLowerLeg)bones.leftLowerLeg.rotation.x+=Math.max(0,-stride)*.28;
  if(bones.rightLowerLeg)bones.rightLowerLeg.rotation.x+=Math.max(0,stride)*.28;
  if(!carrier&&bones.leftUpperArm)bones.leftUpperArm.rotation.x-=stride*.42*childWeaponSwingScale(weaponPresentation,'left');
  if(!carrier&&bones.rightUpperArm)bones.rightUpperArm.rotation.x+=stride*.42*childWeaponSwingScale(weaponPresentation,'right');
  if(!carrier&&weaponPresentation?.motion)applyChildWeaponPose(bones,weaponPresentation,{moving,combat,attacking:Boolean(tidebreak?.attack)},time);
  if(combat&&bones.spine)bones.spine.rotation.x-=.06;
  if(carrier)applyCarrierCradlePose(bones,time,{moving});
  if(carriedChild)applyNewbornCradlePose(bones,time);
  if(flash&&bones.spine)bones.spine.rotation.z+=Math.sin(time*32)*.12*flash;
  if(tidebreak)applyTidebreakPose(bones,tidebreak);
}

function syncRuntimeState(actor,input){
  const runtime=resolveRinneCharacterRuntime(input);
  actor.root.userData.characterRuntimeState=runtime.state;
  actor.root.userData.characterRuntimeMotion=runtime.motion.resolvedState;
  return runtime;
}

function promoteObservedModel(characterPool,slot,life,target,distance){
  if(!slot?.descriptor?.modelId||!slot.actor?.root||!target)return;
  const dx=(Number(target.x)||0)-(Number(life.position?.x)||0),dz=(Number(target.z)||0)-(Number(life.position?.z)||0),length=Math.max(.001,distance||Math.hypot(dx,dz));
  const yaw=Number(life.yaw)||0,forwardX=Math.sin(yaw),forwardZ=Math.cos(yaw),alignment=Math.max(0,(forwardX*dx+forwardZ*dz)/length),coverage=Math.min(1,2.4/(length+1));
  const priority=attentionLoadPriority({visible:!target.dead,combat:Boolean(target.attacking||target.hit||target.flash),screenAlignment:alignment,screenCoverage:coverage,distance:length});
  slot.actor.root.userData.manifestationAttention=priority;
  slot.actor.root.userData.manifestationAttentionAlignment=alignment;
  if(shouldPromoteAttention(priority))characterPool.focusModel(slot.descriptor.modelId,priority);
}

function createActorRoster({scene,frontRoot,characterPool,heroPool}){
  const heroActor=heroPool.spawn('rinne-runtime-hero'),motherActor=characterPool.spawn('rinne-runtime-mother');
  const enemyActors=new Map(),guardActors=new Map(),state={lifeKey:'',front:null,skirmish:null,enemyRosterKey:'',guardRosterKey:'',heroDescriptor:null,motherDescriptor:null};
  heroActor.root.name='Player';motherActor.root.name='Mother';hideCarrierCombatProps(motherActor.root);scene.add(heroActor.root,heroActor.attachments,motherActor.root,motherActor.attachments);applyStylizedShading(heroActor.root,'hero');applyStylizedShading(motherActor.root,'npc');
  function bindLife(life){const key=`${life.id}:${life.seed}:${life.birthVillageId}`;if(key===state.lifeKey)return;state.lifeKey=key;state.heroDescriptor=createRinneHeroCharacter(life);state.motherDescriptor=createRinneMotherCharacter(life);}
  function removeEnemy(id){const slot=enemyActors.get(id);if(!slot)return;characterPool.despawn(slot.poolId);enemyActors.delete(id);}
  function removeGuard(id){const slot=guardActors.get(id);if(!slot)return;characterPool.despawn(slot.poolId);guardActors.delete(id);}
  function updateFront(front){state.front=front;for(const enemy of front?.enemies||[]){const slot=enemyActors.get(enemy.id);if(!slot)continue;slot.actor.root.position.set(enemy.x,0,enemy.z);slot.actor.root.rotation.y=Number.isFinite(enemy.yaw)?enemy.yaw:0;slot.actor.setVisible(!enemy.dead);}}
  function syncFront(front){
    state.front=front;const enemies=front?.enemies||[],rosterKey=`${front?.stage??'none'}:${enemies.map(e=>e.id).join('|')}`;
    if(rosterKey!==state.enemyRosterKey){state.enemyRosterKey=rosterKey;const liveIds=new Set(enemies.map(e=>e.id));for(const id of [...enemyActors.keys()])if(!liveIds.has(id))removeEnemy(id);enemies.forEach((enemy,index)=>{if(enemyActors.has(enemy.id))return;const descriptor=createRinneEnemyCharacter(enemy,{lifeSeed:(front?.stage??0)+1,stage:front?.stage??0,index}),poolId=`rinne-runtime-${descriptor.character.id}`,actor=characterPool.spawn(poolId,descriptor.modelId);actor.root.name=`Enemy:${enemy.id}`;frontRoot.add(actor.root,actor.attachments);applyStylizedShading(actor.root,'enemy');enemyActors.set(enemy.id,{actor,descriptor,poolId,schedule:new PoseSchedule()});});}updateFront(front);
  }
  function updateSkirmish(skirmish){state.skirmish=skirmish;for(const guard of skirmish?.guards||[]){const slot=guardActors.get(guard.id);if(!slot)continue;slot.actor.root.position.set(guard.x,0,guard.z);slot.actor.root.rotation.y=Number.isFinite(guard.yaw)?guard.yaw:0;}}
  function syncSkirmish(skirmish){
    state.skirmish=skirmish;const guards=skirmish?.guards||[],rosterKey=guards.map(row=>row.id).join('|');if(rosterKey!==state.guardRosterKey){state.guardRosterKey=rosterKey;const ids=new Set(guards.map(row=>row.id));for(const id of [...guardActors.keys()])if(!ids.has(id))removeGuard(id);guards.forEach((guard,index)=>{if(guardActors.has(guard.id))return;const descriptor=createRinneRuntimeCharacter({kind:'hero',id:guard.id,seed:(skirmish?.seed||1)+index,ageSeconds:(28+index*7)*60,role:'guard'}),poolId=`rinne-runtime-${descriptor.character.id}`,actor=characterPool.spawn(poolId);actor.root.name=`Guard:${guard.id}`;scene.add(actor.root,actor.attachments);applyStylizedShading(actor.root,'npc');guardActors.set(guard.id,{actor,descriptor,poolId,schedule:new PoseSchedule()});});}updateSkirmish(skirmish);
  }
  function dispose(){for(const id of [...enemyActors.keys()])removeEnemy(id);for(const id of [...guardActors.keys()])removeGuard(id);heroActor.root.removeFromParent();heroActor.attachments.removeFromParent();motherActor.root.removeFromParent();motherActor.attachments.removeFromParent();}
  return{heroActor,motherActor,enemyActors,guardActors,state,bindLife,syncFront,updateFront,syncSkirmish,updateSkirmish,dispose};
}

function createEquipmentController({heroActor,weaponVisual,mat,disposeObject}){
  let weaponKey=null,shield=null;
  function syncEquipment(equipment,ageYears=12){
    const weapon=equipment?.weapon||'fist',presentation=rinneWeaponPresentation(weapon,ageYears),nextKey=presentation?weapon+':'+presentation.band:weapon;
    if(nextKey!==weaponKey){const old=heroActor.detachWeapon('weapon');if(old)disposeObject(old);weaponKey=nextKey;if(weapon!=='fist'){const object=weaponVisual(weapon);object.position.fromArray(presentation.objectPosition);object.rotation.z=presentation.objectRotationZ;object.userData.rinneWeaponPresentation={band:presentation.band,scale:presentation.scale};heroActor.attachWeapon('weapon',object,{bone:'rightHand',position:presentation.socketPosition,quaternion:presentation.socketQuaternion,scale:presentation.scale});}}
    if(equipment?.shield!==shield){const old=heroActor.detachWeapon('shield');if(old)disposeObject(old);shield=equipment?.shield;if(equipment?.shield){const object=createRinneWeapon(THREE,'shield');heroActor.attachWeapon('shield',object,{bone:'leftHand',position:[0,.03,0],quaternion:[0,0,0,1],scale:.8});}}
  }
  function dispose(){for(const id of ['weapon','shield']){const old=heroActor.detachWeapon(id);if(old)disposeObject(old);}}return{syncEquipment,dispose};
}

function sampleSlot(actor,schedule,presentation,dt,pose){
  actor.setVisible(presentation.render.visible!==false);
  const tick=schedule.advance(Math.max(0,dt||0),presentation.render.animationHz);
  if(tick===null)return false;
  actor.sample(presentation.appearance,tick===0?0:performance.now()/1000,pose);
  return true;
}

function syncPresentationScale(root,sampled,factor=1){
  const previous=Number(root.userData?.rinnePresentationScaleFactor)||1;
  if(sampled)root.userData.rinnePresentationScaleFactor=1;
  else if(previous!==1)root.scale.divideScalar(previous);
  if(factor!==1)root.scale.multiplyScalar(factor);
  root.userData.rinnePresentationScaleFactor=factor;
}

function renderActors({roster,heroSchedule,motherSchedule,motherMotion,characterPool},life,dt){
  const {heroActor,motherActor,enemyActors,guardActors,state}=roster,birth=life.phase==='birth',village=life.zone==='village',carried=birth&&village,villageOutside=village&&!life.interior;
  state.heroDescriptor.character.ageMs=rinneRuntimeAgeMs(life.ageSeconds);state.heroDescriptor.character.lifeState='alive';
  const carrierMoving=motherMotion.active&&motherMotion.moving,carry=newbornCarryTransform(life.position,life.yaw,{time:performance.now()/1000,moving:carrierMoving});
  heroActor.root.rotation.set(0,carried?carry.yaw:life.yaw,0);motherActor.root.rotation.set(0,life.yaw,0);heroActor.attachments.visible=!carried;
  if(carried){motherActor.setVisible(true);motherActor.root.position.set(life.position.x,0,life.position.z);heroActor.root.position.set(life.position.x,0,life.position.z);}else{motherActor.setVisible(false);heroActor.root.position.set(life.position.x,0,life.position.z);}
  const heroPresentation=resolveRinneRuntimeCharacter({...state.heroDescriptor,distance:0,visible:true,important:true});heroPresentation.appearance.dye=[...(armorDye[life.equipment.armor]||armorDye.cloth)];const heroTide=carried?null:life.combat?.tidebreakPose||null;
  const observedSpeed=heroActor.root.userData.locomotionSpeed,heroSpeed=Number.isFinite(observedSpeed)?observedSpeed:(life.moving?4.1:0);
  heroActor.root.userData.tidebreakPose=heroTide;syncRuntimeState(heroActor,{dead:Boolean(life.dead)||life.phase==='dead',hit:(Number(life.flash)||0)>0,attacking:Boolean(heroTide?.attack||life.attacking),resting:Boolean(life.resting),dashing:Boolean(life.dashing),moving:carried?false:Boolean(life.moving),speed:carried?0:heroSpeed,combat:carried?false:Boolean(life.combat),runThreshold:3});
  const heroSampled=sampleSlot(heroActor,heroSchedule,heroPresentation,dt,(bones,time)=>poseHumanoid(bones,{moving:carried?false:life.moving,speed:carried?0:heroSpeed,combat:carried?false:Boolean(life.combat),carriedChild:carried,tidebreak:heroTide,smoothGait:true,weapon:life.equipment.weapon,ageYears:life.ageYears},time));
  syncPresentationScale(heroActor.root,heroSampled,carried?NEWBORN_CARRY.visualScale:1);
  const motherPresentation=resolveRinneRuntimeCharacter({...state.motherDescriptor,distance:.3,visible:carried,important:true});syncRuntimeState(motherActor,{moving:carrierMoving,speed:motherMotion.speed,runThreshold:3});
  sampleSlot(motherActor,motherSchedule,motherPresentation,dt,(bones,time)=>poseHumanoid(bones,{moving:carrierMoving,speed:motherMotion.speed,carrier:carried,smoothGait:true},time));
  sanitizeCarrierCarryVisual(motherActor.root,{attachments:motherActor.attachments,active:carried});
  if(carried){
    const carryTime=performance.now()/1000;
    positionNewbornForCradle({carrierRoot:motherActor.root,carrierBones:motherActor.bones,childRoot:heroActor.root,childBones:heroActor.bones,time:carryTime,moving:carrierMoving});
    solveCarrierCradleContacts(motherActor.bones,heroActor.bones);
    motherActor.root.updateMatrixWorld(true);heroActor.root.updateMatrixWorld(true);
    const contact=solveCarrierCradleContacts(motherActor.bones,heroActor.bones);
    motherActor.root.userData.cradleContact=contact;
  }else delete motherActor.root.userData.cradleContact;
  for(const enemy of state.front?.enemies||[]){const slot=enemyActors.get(enemy.id);if(!slot)continue;const distance=Math.hypot(enemy.x-life.position.x,enemy.z-life.position.z),presentation=resolveRinneRuntimeCharacter({...slot.descriptor,distance,visible:!enemy.dead,important:(state.front?.stage??0)>=5});promoteObservedModel(characterPool,slot,life,enemy,distance);slot.actor.root.userData.tidebreakPose=enemy.tidebreakPose||null;syncRuntimeState(slot.actor,{dead:Boolean(enemy.dead),hit:(Number(enemy.flash)||0)>0,attacking:Boolean(enemy.tidebreakPose?.attack||enemy.attacking),dashing:Boolean(enemy.dashing),moving:Boolean(enemy.moving),speed:enemy.moving?3.6:0,combat:true,runThreshold:3});sampleSlot(slot.actor,slot.schedule,presentation,dt,(bones,time)=>poseHumanoid(bones,{moving:Boolean(enemy.moving),speed:enemy.moving?3.6:0,combat:true,flash:enemy.flash||0,tidebreak:enemy.tidebreakPose||null},time));slot.actor.root.position.set(enemy.x,enemy.downed?.28:0,enemy.z);slot.actor.root.rotation.y=Number.isFinite(enemy.yaw)?enemy.yaw:0;slot.actor.root.rotation.z=enemy.downed?-Math.PI*.46:0;}
  for(const guard of state.skirmish?.guards||[]){const slot=guardActors.get(guard.id);if(!slot)continue;const distance=Math.hypot(guard.x-life.position.x,guard.z-life.position.z),presentation=resolveRinneRuntimeCharacter({...slot.descriptor,distance,visible:villageOutside&&!guard.dead,important:true});if(villageOutside)promoteObservedModel(characterPool,slot,life,guard,distance);syncRuntimeState(slot.actor,{dead:Boolean(guard.dead),hit:(Number(guard.flash)||0)>0,attacking:Boolean(guard.attacking),dashing:Boolean(guard.dashing),moving:Boolean(guard.moving),speed:guard.moving?3.3:0,combat:true,runThreshold:3});sampleSlot(slot.actor,slot.schedule,presentation,dt,(bones,time)=>poseHumanoid(bones,{moving:Boolean(guard.moving),speed:guard.moving?3.3:0,combat:true,flash:guard.flash||0},time));slot.actor.root.position.set(guard.x,0,guard.z);slot.actor.root.rotation.y=Number.isFinite(guard.yaw)?guard.yaw:0;}
  heroActor.updateAttachments();motherActor.updateAttachments();for(const slot of enemyActors.values())slot.actor.updateAttachments();for(const slot of guardActors.values())slot.actor.updateAttachments();
}

export async function createRinneCharacterStage({renderer,scene,frontRoot,weaponVisual,mat,disposeObject}){
  const [runtime,protagonist]=await Promise.all([createKaykitCharacterPools(renderer),createProtagonistCharacterPool(renderer)]),roster=createActorRoster({scene,frontRoot,characterPool:runtime.pool,heroPool:protagonist.pool});const equipment=createEquipmentController({heroActor:roster.heroActor,weaponVisual,mat,disposeObject});const peers=createCoopActors({pool:runtime.peerPool,motherPool:runtime.motherPool,scene,sampleSlot,poseHumanoid,armorDye,createEquipment:heroActor=>createEquipmentController({heroActor,weaponVisual,mat,disposeObject})});const animation={roster,characterPool:runtime.pool,heroSchedule:new PoseSchedule(),motherSchedule:new PoseSchedule(),motherMotion:{active:false,moving:false,speed:0}};
  function render(life,dt=0){roster.bindLife(life);equipment.syncEquipment(life.equipment,life.ageYears);renderActors(animation,life,dt);peers.render(life,dt);}function setCarrierMotion({active=false,moving=false,speed=0}={}){animation.motherMotion={active:Boolean(active),moving:Boolean(moving),speed:Math.max(0,Number(speed)||0)};}function dispose(){peers.dispose();roster.dispose();protagonist.dispose();runtime.dispose();}return{render,syncPeers:peers.sync,syncEquipment:equipment.syncEquipment,syncFront:roster.syncFront,updateFront:roster.updateFront,syncSkirmish:roster.syncSkirmish,updateSkirmish:roster.updateSkirmish,setCarrierMotion,dispose};
}
