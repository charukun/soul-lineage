import { PoseSchedule } from '@soul/characters';
import { createRinneHeroCharacter, createRinneMotherCharacter, resolveRinneRuntimeRoster, rinneRuntimeAgeMs } from './character-presentation.js';

/** Reuse the current imported character pool; never introduce a procedural remote-player fallback. */
export function createCoopActors({pool,motherPool,scene,sampleSlot,poseHumanoid,createEquipment,armorDye}){
  const slots=new Map();let peers=[];
  function remove(id){const slot=slots.get(id);if(!slot)return;slot.equipment.dispose();pool.despawn(slot.poolId);if(slot.mother)motherPool.despawn(`${slot.poolId}:mother`);slots.delete(id);}
  function sync(rows=[]){
    peers=rows;const ids=new Set(rows.map(row=>row.id));for(const id of slots.keys())if(!ids.has(id))remove(id);
    for(const peer of rows){if(slots.has(peer.id))continue;const poolId=`rinne-peer:${peer.id}`,actor=pool.spawn(poolId);
      actor.root.name=`Friend:${peer.name}`;scene.add(actor.root,actor.attachments);
      slots.set(peer.id,{poolId,actor,descriptor:createRinneHeroCharacter(peer),schedule:new PoseSchedule(),equipment:createEquipment(actor),mother:null});
    }
  }
  function render(life,dt){
    const descriptions=peers.map(peer=>{const slot=slots.get(peer.id);slot.descriptor.character.ageMs=rinneRuntimeAgeMs(peer.ageSeconds);return{...slot.descriptor,distance:Math.hypot(peer.position.x-life.position.x,peer.position.z-life.position.z),visible:!peer.ended};});
    const presentations=resolveRinneRuntimeRoster(descriptions,{lod:{maxFull:4,nearDistance:8,farDistance:25}});
    peers.forEach((peer,index)=>{
      const slot=slots.get(peer.id),birth=peer.phase==='birth'&&peer.zone==='village';presentations[index].appearance.dye=[...(armorDye[peer.equipment.armor]||armorDye.cloth)];slot.equipment.syncEquipment(peer.equipment);
      slot.actor.root.position.set(peer.position.x,birth?1.02:0,peer.position.z);slot.actor.root.rotation.y=peer.yaw;
      sampleSlot(slot.actor,slot.schedule,presentations[index],dt,(bones,time)=>poseHumanoid(bones,{moving:!birth&&peer.moving,combat:peer.combat},time));slot.actor.updateAttachments();
      if(birth&&!slot.mother){slot.mother=motherPool.spawn(`${slot.poolId}:mother`);slot.motherDescriptor=createRinneMotherCharacter(peer);slot.motherSchedule=new PoseSchedule();scene.add(slot.mother.root,slot.mother.attachments);}
      if(slot.mother){slot.mother.setVisible(birth);if(birth){const [presentation]=resolveRinneRuntimeRoster([{...slot.motherDescriptor,distance:descriptions[index].distance}],{lod:{maxFull:0,nearDistance:0,farDistance:25}});
        slot.mother.root.position.set(peer.position.x,0,peer.position.z);slot.mother.root.rotation.y=peer.yaw;sampleSlot(slot.mother,slot.motherSchedule,presentation,dt,(bones,time)=>poseHumanoid(bones,{carrier:true,moving:peer.moving},time));slot.mother.updateAttachments();}}
    });
  }
  function dispose(){for(const id of [...slots.keys()])remove(id);peers=[];}
  return{sync,render,dispose};
}
