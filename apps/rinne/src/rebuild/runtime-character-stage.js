import * as THREE from 'three';
import { PoseSchedule } from '@soul/characters';
import { GLTFLoader } from '@soul/rendering';
import { createMasterCharacterPool, shinoHumanoidFromGLTF } from '@soul/rendering/master-character';
import { applyStylizedShading } from '@soul/rendering/stylized-shading';
import { createCoopActors } from './coop-actors.js';
import {
  RINNE_RUNTIME_CHARACTER_ASSET,
  createRinneEnemyCharacter,
  createRinneHeroCharacter,
  createRinneMotherCharacter,
  resolveRinneRuntimeCharacter,
  rinneRuntimeAgeMs
} from './character-presentation.js';

const armorDye=Object.freeze({cloth:[1,1,1],light:[.72,.84,.78],heavy:[.68,.73,.82]});

async function createRuntimeCharacterPool(renderer){
  const loader=new GLTFLoader();
  loader.useCompressedTextures?.(renderer,{transcoderPath:'./basis/'});
  const gltf=await loader.loadAsync(RINNE_RUNTIME_CHARACTER_ASSET.url);
  const humanoid=await shinoHumanoidFromGLTF(gltf);
  return{loader,pool:createMasterCharacterPool({template:gltf.scene,humanoid,capacity:8}),peerPool:createMasterCharacterPool({template:gltf.scene,humanoid,capacity:30}),motherPool:createMasterCharacterPool({template:gltf.scene,humanoid,capacity:30})};
}

function poseHumanoid(bones,{moving=false,speed=0,combat=false,flash=0,carrier=false}={},time=0){
  const cadence=Math.min(12,6.4+Math.max(0,speed)*.85),stride=moving?Math.sin(time*cadence)*.42:0;
  if(bones.leftUpperLeg)bones.leftUpperLeg.rotation.x+=stride;
  if(bones.rightUpperLeg)bones.rightUpperLeg.rotation.x-=stride;
  if(bones.leftLowerLeg)bones.leftLowerLeg.rotation.x+=Math.max(0,-stride)*.28;
  if(bones.rightLowerLeg)bones.rightLowerLeg.rotation.x+=Math.max(0,stride)*.28;
  if(bones.leftUpperArm)bones.leftUpperArm.rotation.x-=stride*.42;
  if(bones.rightUpperArm)bones.rightUpperArm.rotation.x+=stride*.42;
  if(combat&&bones.spine)bones.spine.rotation.x-=.06;
  if(carrier&&bones.leftUpperArm&&bones.rightUpperArm){bones.leftUpperArm.rotation.z-=.18;bones.rightUpperArm.rotation.z+=.18;}
  if(flash&&bones.spine)bones.spine.rotation.z+=Math.sin(time*32)*.12*flash;
}

function createActorRoster({scene,frontRoot,characterPool}){
  const heroActor=characterPool.spawn('rinne-runtime-hero'),motherActor=characterPool.spawn('rinne-runtime-mother');
  const enemyActors=new Map(),state={lifeKey:'',front:null,enemyRosterKey:'',heroDescriptor:null,motherDescriptor:null};
  heroActor.root.name='Player';motherActor.root.name='Mother';
  scene.add(heroActor.root,heroActor.attachments,motherActor.root,motherActor.attachments);
  applyStylizedShading(heroActor.root,'hero');applyStylizedShading(motherActor.root,'npc');

  function bindLife(life){
    const key=`${life.id}:${life.seed}:${life.birthVillageId}`;if(key===state.lifeKey)return;
    state.lifeKey=key;state.heroDescriptor=createRinneHeroCharacter(life);state.motherDescriptor=createRinneMotherCharacter(life);
  }
  function removeEnemy(id){const slot=enemyActors.get(id);if(!slot)return;characterPool.despawn(slot.poolId);enemyActors.delete(id);}
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
        const poolId=`rinne-runtime-${descriptor.character.id}`,actor=characterPool.spawn(poolId);
        actor.root.name=`Enemy:${enemy.id}`;frontRoot.add(actor.root,actor.attachments);applyStylizedShading(actor.root,'enemy');
        enemyActors.set(enemy.id,{actor,descriptor,poolId,schedule:new PoseSchedule()});
      });
    }
    updateFront(front);
  }
  function dispose(){for(const id of [...enemyActors.keys()])removeEnemy(id);heroActor.root.removeFromParent();heroActor.attachments.removeFromParent();motherActor.root.removeFromParent();motherActor.attachments.removeFromParent();}
  return{heroActor,motherActor,enemyActors,state,bindLife,syncFront,updateFront,dispose};
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
  const {heroActor,motherActor,enemyActors,state}=roster,birth=life.phase==='birth',village=life.zone==='village';
  state.heroDescriptor.character.ageMs=rinneRuntimeAgeMs(life.ageSeconds);state.heroDescriptor.character.lifeState='alive';
  heroActor.root.rotation.y=life.yaw;motherActor.root.rotation.y=life.yaw;
  if(birth&&village){motherActor.setVisible(true);motherActor.root.position.set(life.position.x,0,life.position.z);heroActor.root.position.set(life.position.x+Math.sin(life.yaw)*.24,1.02,life.position.z+Math.cos(life.yaw)*.24);}
  else{motherActor.setVisible(false);heroActor.root.position.set(life.position.x,0,life.position.z);}
  const heroPresentation=resolveRinneRuntimeCharacter({...state.heroDescriptor,distance:0,visible:true,important:true});
  heroPresentation.appearance.dye=[...(armorDye[life.equipment.armor]||armorDye.cloth)];
  sampleSlot(heroActor,heroSchedule,heroPresentation,dt,(bones,time)=>poseHumanoid(bones,{moving:life.moving,speed:life.moving?4.1:0,combat:Boolean(life.combat)},time));
  const motherPresentation=resolveRinneRuntimeCharacter({...state.motherDescriptor,distance:.3,visible:birth&&village,important:true});
  sampleSlot(motherActor,motherSchedule,motherPresentation,dt,(bones,time)=>poseHumanoid(bones,{moving:motherMotion.active&&motherMotion.moving,speed:motherMotion.speed,carrier:true},time));
  for(const enemy of state.front?.enemies||[]){
    const slot=enemyActors.get(enemy.id);if(!slot)continue;
    const distance=Math.hypot(enemy.x-life.position.x,enemy.z-life.position.z),presentation=resolveRinneRuntimeCharacter({...slot.descriptor,distance,visible:!enemy.dead,important:(state.front?.stage??0)>=5});
    sampleSlot(slot.actor,slot.schedule,presentation,dt,(bones,time)=>poseHumanoid(bones,{moving:Boolean(enemy.moving),speed:enemy.moving?3.6:0,combat:true,flash:enemy.flash||0},time));
    slot.actor.root.position.set(enemy.x,0,enemy.z);slot.actor.root.rotation.y=Number.isFinite(enemy.yaw)?enemy.yaw:0;
  }
  heroActor.updateAttachments();motherActor.updateAttachments();for(const slot of enemyActors.values())slot.actor.updateAttachments();
}

export async function createRinneCharacterStage({renderer,scene,frontRoot,weaponVisual,mat,disposeObject}){
  const runtime=await createRuntimeCharacterPool(renderer),roster=createActorRoster({scene,frontRoot,characterPool:runtime.pool});
  const equipment=createEquipmentController({heroActor:roster.heroActor,weaponVisual,mat,disposeObject});
  const peers=createCoopActors({pool:runtime.peerPool,motherPool:runtime.motherPool,scene,sampleSlot,poseHumanoid,armorDye,createEquipment:heroActor=>createEquipmentController({heroActor,weaponVisual,mat,disposeObject})});
  const animation={roster,heroSchedule:new PoseSchedule(),motherSchedule:new PoseSchedule(),motherMotion:{active:false,moving:false,speed:0}};
  function render(life,dt=0){roster.bindLife(life);equipment.syncEquipment(life.equipment);renderActors(animation,life,dt);peers.render(life,dt);}
  function setCarrierMotion({active=false,moving=false,speed=0}={}){animation.motherMotion={active:Boolean(active),moving:Boolean(moving),speed:Math.max(0,Number(speed)||0)};}
  function dispose(){peers.dispose();roster.dispose();runtime.pool.dispose();runtime.peerPool.dispose();runtime.motherPool.dispose();runtime.loader.disposeCompressedTextures?.();}
  return{render,syncPeers:peers.sync,syncEquipment:equipment.syncEquipment,syncFront:roster.syncFront,updateFront:roster.updateFront,setCarrierMotion,dispose};
}
