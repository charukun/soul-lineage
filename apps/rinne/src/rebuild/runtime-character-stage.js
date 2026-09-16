import * as THREE from 'three';
import { PoseSchedule } from '@soul/characters';
import { applyStylizedShading } from '@soul/rendering/stylized-shading';
import { createCoopActors } from './coop-actors.js';
import { createKaykitCharacterPools } from './kaykit-character-pool.js';
import { hideCarrierCombatProps, newbornCarryTransform } from './newborn-carry-presentation.js';
import {
  createRinneEnemyCharacter,
  createRinneHeroCharacter,
  createRinneMotherCharacter,
  createRinneRuntimeCharacter,
  resolveRinneRuntimeCharacter,
  rinneRuntimeAgeMs
} from './character-presentation.js';

const armorDye=Object.freeze({cloth:[1,1,1],light:[.72,.84,.78],heavy:[.68,.73,.82]});

function poseHumanoid(bones,{moving=false,speed=0,combat=false,flash=0,carrier=false}={},time=0){
  const cadence=Math.min(12,6.4+Math.max(0,speed)*.85),stride=moving?Math.sin(time*cadence)*.42:0;
  if(bones.leftUpperLeg)bones.leftUpperLeg.rotation.x+=stride;
  if(bones.rightUpperLeg)bones.rightUpperLeg.rotation.x-=stride;
  if(bones.leftLowerLeg)bones.leftLowerLeg.rotation.x+=Math.max(0,-stride)*.28;
  if(bones.rightLowerLeg)bones.rightLowerLeg.rotation.x+=Math.max(0,stride)*.28;
  if(bones.leftUpperArm)bones.leftUpperArm.rotation.x-=stride*.42;
  if(bones.rightUpperArm)bones.rightUpperArm.rotation.x+=stride*.42;
  if(combat&&bones.spine)bones.spine.rotation.x-=.06;
  if(carrier){
    if(bones.spine)bones.spine.rotation.x-=.035;
    if(bones.leftUpperArm){bones.leftUpperArm.rotation.x-=.48;bones.leftUpperArm.rotation.z-=.34;}
    if(bones.rightUpperArm){bones.rightUpperArm.rotation.x-=.48;bones.rightUpperArm.rotation.z+=.34;}
    if(bones.leftLowerArm){bones.leftLowerArm.rotation.x-=.58;bones.leftLowerArm.rotation.y-=.18;}
    if(bones.rightLowerArm){bones.rightLowerArm.rotation.x-=.58;bones.rightLowerArm.rotation.y+=.18;}
  }
  if(flash&&bones.spine)bones.spine.rotation.z+=Math.sin(time*32)*.12*flash;
}

function createActorRoster({scene,frontRoot,characterPool}){
  const heroActor=characterPool.spawn('rinne-runtime-hero'),motherActor=characterPool.spawn('rinne-runtime-mother');
  const enemyActors=new Map(),guardActors=new Map(),state={lifeKey:'',front:null,skirmish:null,enemyRosterKey:'',guardRosterKey:'',heroDescriptor:null,motherDescriptor:null};
  heroActor.root.name='Player';motherActor.root.name='Mother';
  hideCarrierCombatProps(motherActor.root);
  scene.add(heroActor.root,heroActor.attachments,motherActor.root,motherActor.attachments);
  applyStylizedShading(heroActor.root,'hero');applyStylizedShading(motherActor.root,'npc');

  function bindLife(life){
    const key=`${life.id}:${life.seed}:${life.birthVillageId}`;if(key===state.lifeKey)return;
    state.lifeKey=key;state.heroDescriptor=createRinneHeroCharacter(life);state.motherDescriptor=createRinneMotherCharacter(life);
  }
  function removeEnemy(id){const slot=enemyActors.get(id);if(!slot)return;characterPool.despawn(slot.poolId);enemyActors.delete(id);}
  function removeGuard(id){const slot=guardActors.get(id);if(!slot)return;characterPool.despawn(slot.poolId);guardActors.delete(id);}
  function updateFront(front){
    state.front=front;
    for(const enemy of front?.enemies||[]){const slot=enemyActors.get(enemy.id);if(!slot)continue;slot.actor.root.position.set(enemy.x,0,enemy.z);slot.actor.root.rotation.y=Number.isFinite(enemy.yaw)?enemy.yaw:0;slot.actor.setVisible(!enemy.dead);}
  }
  function syncFront(front){
    state.front=front;const enemies=front?.enemies||[],rosterKey=`${front?.stage??'none'}:${enemies.map(e=>e.id).join('|')}`;
    if(rosterKey!==state.enemyRosterKey){
      state.enemyRosterKey=rosterKey;const liveIds=new Set(enemies.map(e=>e.id));
      for(const id of [...enemyActors.keys()])if(!liveIds.has(id))removeEnemy(id);
      enemies.forEach((enemy,index)=>{
        if(enemyActors.has(enemy.id))return;
        const descriptor=createRinneEnemyCharacter(enemy,{lifeSeed:(front?.stage??0)+1,stage:front?.stage??0,index});
        const poolId=`rinne-runtime-${descriptor.character.id}`,actor=characterPool.spawn(poolId,descriptor.modelId);
        actor.root.name=`Enemy:${enemy.id}`;frontRoot.add(actor.root,actor.attachments);applyStylizedShading(actor.root,'enemy');
        enemyActors.set(enemy.id,{actor,descriptor,poolId,schedule:new PoseSchedule()});
      });
    }
    updateFront(front);
  }
  function updateSkirmish(skirmish){
    state.skirmish=skirmish;
    for(const guard of skirmish?.guards||[]){const slot=guardActors.get(guard.id);if(!slot)continue;slot.actor.root.position.set(guard.x,0,guard.z);slot.actor.root.rotation.y=Number.isFinite(guard.yaw)?guard.yaw:0;slot.actor.setVisible(!guard.dead);}
  }
  function syncSkirmish(skirmish){
    state.skirmish=skirmish;const guards=skirmish?.guards||[],rosterKey=guards.map(row=>row.id).join('|');
    if(rosterKey!==state.guardRosterKey){
      state.guardRosterKey=rosterKey;const ids=new Set(guards.map(row=>row.id));for(const id of [...guardActors.keys()])if(!ids.has(id))removeGuard(id);
      guards.forEach((guard,index)=>{
        if(guardActors.has(guard.id))return;
        const descriptor=createRinneRuntimeCharacter({kind:'hero',id:guard.id,seed:(skirmish?.seed||1)+index,ageSeconds:(28+index*7)*60,role:'guard'}),poolId=`rinne-runtime-${descriptor.character.id}`,actor=characterPool.spawn(poolId,descriptor.modelId);
        actor.root.name=`Guard:${guard.id}`;scene.add(actor.root,actor.attachments);applyStylizedShading(actor.root,'npc');guardActors.set(guard.id,{actor,descriptor,poolId,schedule:new PoseSchedule()});
      });
    }
    updateSkirmish(skirmish);
  }
  function dispose(){for(const id of [...enemyActors.keys()])removeEnemy(id);for(const id of [...guardActors.keys()])removeGuard(id);heroActor.root.removeFromParent();heroActor.attachments.removeFromParent();motherActor.root.removeFromParent();motherActor.attachments.removeFromParent();}
  return{heroActor,motherActor,enemyActors,guardActors,state,bindLife,syncFront,updateFront,syncSkirmish,updateSkirmish,dispose};
}

function createEquipmentController({heroActor,weaponVisual,mat,disposeObject}){
  let weapon=null,shield=null;
  function syncEquipment(equipment){
    if(equipment.weapon!==weapon){
      const old=heroActor.detachWeapon('weapon');if(old)disposeObject(old);weapon=equipment.weapon;
      if(equipment.weapon!=='fist'){
        const object=weaponVisual(equipment.weapon);object.rotation.z=-Math.PI/2;
        heroActor.attachWeapon('weapon',object,{bone:'rightHand',position:[0,.02,0],quaternion:[0,0,0,1],scale:.72});
      }
    }
    if(equipment.shield!==shield){
      const old=heroActor.detachWeapon('shield');if(old)disposeObject(old);shield=equipment.shield;
      if(equipment.shield){
        const object=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.07,18),mat(0x78919c,{metalness:.35,roughness:.48}));object.rotation.x=Math.PI/2;
        heroActor.attachWeapon('shield',object,{bone:'leftHand',position:[0,.03,0],quaternion:[0,0,0,1],scale:.8});
      }
    }
  }
  function dispose(){for(const id of ['weapon','shield']){const old=heroActor.detachWeapon(id);if(old)disposeObject(old);}}
  return{syncEquipment,dispose};
}

function sampleSlot(actor,schedule,presentation,dt,pose){
  actor.setVisible(presentation.render.visible!==false);
  const tick=schedule.advance(Math.max(0,dt||0),presentation.render.animationHz);
  if(tick!==null)actor.sample(presentation.appearance,tick===0?0:performance.now()/1000,pose);
}

function renderActors({roster,heroSchedule,motherSchedule,motherMotion},life,dt){
  const {heroActor,motherActor,enemyActors,guardActors,state}=roster,birth=life.phase==='birth',village=life.zone==='village',carried=birth&&village,villageOutside=village&&!life.interior;
  state.heroDescriptor.character.ageMs=rinneRuntimeAgeMs(life.ageSeconds);state.heroDescriptor.character.lifeState='alive';
  heroActor.root.rotation.y=life.yaw;heroActor.root.rotation.z=0;motherActor.root.rotation.y=life.yaw;heroActor.attachments.visible=true;
  if(carried){
    const carry=newbornCarryTransform(life.position,life.yaw);
    motherActor.setVisible(true);motherActor.root.position.set(life.position.x,0,life.position.z);
    heroActor.root.position.set(carry.x,carry.y,carry.z);heroActor.root.rotation.y=carry.yaw;heroActor.root.rotation.z=carry.roll;heroActor.attachments.visible=false;
  }else{motherActor.setVisible(false);heroActor.root.position.set(life.position.x,0,life.position.z);}
  const heroPresentation=resolveRinneRuntimeCharacter({...state.heroDescriptor,distance:0,visible:true,important:true});
  heroPresentation.appearance.dye=[...(armorDye[life.equipment.armor]||armorDye.cloth)];
  sampleSlot(heroActor,heroSchedule,heroPresentation,dt,(bones,time)=>poseHumanoid(bones,{moving:carried?false:life.moving,speed:carried?0:(life.moving?4.1:0),combat:carried?false:Boolean(life.combat)},time));
  const motherPresentation=resolveRinneRuntimeCharacter({...state.motherDescriptor,distance:.3,visible:carried,important:true});
  sampleSlot(motherActor,motherSchedule,motherPresentation,dt,(bones,time)=>poseHumanoid(bones,{moving:motherMotion.active&&motherMotion.moving,speed:motherMotion.speed,carrier:carried},time));
  for(const enemy of state.front?.enemies||[]){
    const slot=enemyActors.get(enemy.id);if(!slot)continue;
    const distance=Math.hypot(enemy.x-life.position.x,enemy.z-life.position.z),presentation=resolveRinneRuntimeCharacter({...slot.descriptor,distance,visible:!enemy.dead,important:(state.front?.stage??0)>=5});
    sampleSlot(slot.actor,slot.schedule,presentation,dt,(bones,time)=>poseHumanoid(bones,{moving:Boolean(enemy.moving),speed:enemy.moving?3.6:0,combat:true,flash:enemy.flash||0},time));
    slot.actor.root.position.set(enemy.x,0,enemy.z);slot.actor.root.rotation.y=Number.isFinite(enemy.yaw)?enemy.yaw:0;
  }
  for(const guard of state.skirmish?.guards||[]){
    const slot=guardActors.get(guard.id);if(!slot)continue;const distance=Math.hypot(guard.x-life.position.x,guard.z-life.position.z),presentation=resolveRinneRuntimeCharacter({...slot.descriptor,distance,visible:villageOutside&&!guard.dead,important:true});
    sampleSlot(slot.actor,slot.schedule,presentation,dt,(bones,time)=>poseHumanoid(bones,{moving:Boolean(guard.moving),speed:guard.moving?3.3:0,combat:true,flash:guard.flash||0},time));slot.actor.root.position.set(guard.x,0,guard.z);slot.actor.root.rotation.y=Number.isFinite(guard.yaw)?guard.yaw:0;
  }
  heroActor.updateAttachments();motherActor.updateAttachments();for(const slot of enemyActors.values())slot.actor.updateAttachments();for(const slot of guardActors.values())slot.actor.updateAttachments();
}

export async function createRinneCharacterStage({renderer,scene,frontRoot,weaponVisual,mat,disposeObject}){
  const runtime=await createKaykitCharacterPools(renderer),roster=createActorRoster({scene,frontRoot,characterPool:runtime.pool});
  const equipment=createEquipmentController({heroActor:roster.heroActor,weaponVisual,mat,disposeObject});
  const peers=createCoopActors({pool:runtime.peerPool,motherPool:runtime.motherPool,scene,sampleSlot,poseHumanoid,armorDye,createEquipment:heroActor=>createEquipmentController({heroActor,weaponVisual,mat,disposeObject})});
  const animation={roster,heroSchedule:new PoseSchedule(),motherSchedule:new PoseSchedule(),motherMotion:{active:false,moving:false,speed:0}};
  function render(life,dt=0){roster.bindLife(life);equipment.syncEquipment(life.equipment);renderActors(animation,life,dt);peers.render(life,dt);}
  function setCarrierMotion({active=false,moving=false,speed=0}={}){animation.motherMotion={active:Boolean(active),moving:Boolean(moving),speed:Math.max(0,Number(speed)||0)};}
  function dispose(){peers.dispose();roster.dispose();runtime.dispose();}
  return{render,syncPeers:peers.sync,syncEquipment:equipment.syncEquipment,syncFront:roster.syncFront,updateFront:roster.updateFront,syncSkirmish:roster.syncSkirmish,updateSkirmish:roster.updateSkirmish,setCarrierMotion,dispose};
}
