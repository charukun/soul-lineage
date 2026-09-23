import { WEAPONS } from './domain.js';
import { tidebreakMindVectorFor } from './combat-tactics.js';
import { lineBlocked, terrainMovementScale, ensureCombatTerrain } from './combat-world-contact.js';
import { prepareCombatInspiration, recordCombatAnswers, observeTechnique, ensureInspiration } from './inspiration-state.js';

const near=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const inArena=p=>p.x>=-6.75&&p.x<=6.75&&p.z>=-5.85&&p.z<=5.65;
export function inspirationCombatContext(state,front){
  const enemies=(front?.enemies||[]).filter(e=>!e.dead),ordered=enemies.map(enemy=>({enemy,distance:near(state.position,enemy)})).sort((a,b)=>a.distance-b.distance);
  const selected=ordered.find(r=>r.enemy.id===state.combat?.targetId)||ordered[0],target=selected?.enemy,d=selected?.distance??Infinity;
  const base=WEAPONS[state.equipment?.weapon]||WEAPONS.fist,questions=[];
  if(d<Math.max(.9,base.reach*.8))questions.push('close');
  if(d>base.reach&&d<=3.25)questions.push('reach');
  if(enemies.filter(e=>near(state.position,e)<3.1).length>1)questions.push('crowd');
  if(target?.tidebreakPose?.guarding)questions.push('guard');
  if(target?.attacking||target?.attackWindow>0)questions.push('opening');
  if(state.stamina/Math.max(1,state.staminaCap)<.45)questions.push('fatigue');
  if(state.combat?.phase==='kyu')questions.push('recovery');
  const yaw=target?Math.atan2(target.x-state.position.x,target.z-state.position.z):state.yaw||0;
  const step=(direction,side=0)=>({x:state.position.x+Math.sin(yaw)*direction+Math.cos(yaw)*side,z:state.position.z+Math.cos(yaw)*direction-Math.sin(yaw)*side});
  const canStep=p=>inArena(p)&&terrainMovementScale(front,state.position,p,.32)===1;
  const retreatBlocked=!canStep(step(-.85)),sideBlocked=!canStep(step(0,.85))||!canStep(step(0,-.85));
  const terrain=ensureCombatTerrain(front),cover=terrain.obstacles.some(o=>near(state.position,o)<2.6)||retreatBlocked||sideBlocked;
  return{window:'combat',targetId:d<=3.25?target?.id:null,questions,mind:tidebreakMindVectorFor(state),zone:state.zone,place:`第${(front?.stage||0)+1}前線`,terrain:cover?'cover':'open',encounter:front?.stage>=5?'boss':enemies.length>1?'group':'duel',distanceBand:d<1.15?'inside':d<2.1?'contact':'outside',retreatBlocked,sideBlocked};
}
export function prepareInspirationCombat(state,front,dt){
  if(state.zone!=='frontier'||!front||state.ended||state.down)return null;
  const context=inspirationCombatContext(state,front);prepareCombatInspiration(state,context,dt);return context;
}
export function settleInspirationCombat(state,front,events,context){
  if(!context)return events;
  const discoveries=recordCombatAnswers(state,context,events);events.push(...discoveries);return events;
}
export function observePeerInspiration(states,front,eventMap){
  for(const actor of states){
    const records=Object.values(ensureInspiration(actor).records);
    for(const event of eventMap.get(actor.id)||[]){
      if(event.type!=='player-hit'||!(event.damage>0)||!['tidebreak','johakyu'].includes(event.engine))continue;
      const record=records.find(r=>r.name===event.skill);if(!record)continue;
      for(const viewer of states){
        if(viewer.id===actor.id||viewer.ended||viewer.down||near(viewer.position,actor.position)>6||lineBlocked(front,viewer.position,actor.position))continue;
        observeTechnique(viewer,{actorId:actor.id,actorName:actor.name,techniqueId:record.answerId,visible:true,relation:'observer',context:{zone:viewer.zone,terrain:'open',encounter:'witness',place:'前線での共闘'}});
      }
    }
  }
}

