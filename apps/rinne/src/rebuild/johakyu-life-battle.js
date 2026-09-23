import {johakyuEquippedTechniqueCapability} from '@soul/johakyu-combat/execution-capability';
import {createJohakyuBattleRuntime,resolveTechnique,PHASES} from '@soul/johakyu-battle';
import {ensureCombatLoadout,combatSkillForPhase,combatFinisherRuntime,selectCombatCombo,techniqueName,bodyRuntime} from '../combat-loadout.js';
import {beginCombatState} from './combat-loadout-runtime.js';
import {staminaMultiplierFor,skillEffects,endLifeEarly} from './domain.js';
import {tidebreakMindVectorFor} from './combat-tactics.js';
import {inspirationRecipe} from './inspiration-state.js';
import {lineBlocked} from './combat-world-contact.js';
import {combatBodyOutcome} from './combat-choreography.js';
const sessions=new WeakMap();
const hash=key=>{let h=2166136261;for(const c of String(key)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0)/4294967295;};
export function sharedEnemyWeapon(front,enemy){return front.stage>=5?'great':['sword','spear','axe','great'][Math.floor(hash(enemy.id+':weapon')*4)];}
export function resolveCapabilityTechniqueChoice(state,target=null){
 if(!state?.combat||!PHASES.includes(state.combat.phase))return null;
 const loadout=ensureCombatLoadout(state),phase=state.combat.phase,preferred=state.combat.comboId,attempts=[];
 for(const combo of [...loadout.technique.combos].sort((a,b)=>Number(b.id===preferred)-Number(a.id===preferred))){
   const id=combo.slots[phase],technique=resolveTechnique(id,{weapon:state.equipment.weapon});
   const capability=technique?johakyuEquippedTechniqueCapability(state,{weapon:state.equipment.weapon,phase,techniqueId:id,stages:technique.stages,staminaMultiplier:staminaMultiplierFor(state)}):{canStart:false,canContinue:false,reason:'technique'};
   attempts.push({comboId:combo.id,techniqueId:id,canContinue:capability.canContinue,reason:capability.reason,capability});
 }
 const chosen=attempts.find(a=>a.canContinue);
 return chosen?{ok:true,...chosen,adapted:chosen.comboId!==preferred,attempts}:{ok:false,comboId:null,techniqueId:null,adapted:false,reason:attempts[0]?.reason||'no-capable-technique',attempts};
}
export function lifeBattleLoadout(state,targetId){
 const loadout=ensureCombatLoadout(state),weapon=state.equipment.weapon;
 return Object.fromEntries(PHASES.map(phase=>{
   const selection=loadout.technique.phaseSelections[phase],combo=String(selection).startsWith('combo:')?loadout.technique.combos.find(c=>c.id===selection.slice(6)):null;
   const ids=combo?PHASES.map(p=>combo.slots[p]):[combatSkillForPhase(state,state.combat,phase)];
   const definitions=ids.map((id,index)=>{
     const trial=index===0?inspirationRecipe(state,id,phase,targetId):null;
     if(trial)return {...trial,source:state.inspiration?.pending?.id===trial.id?'trial':'learned'};
     const record=state.inspiration?.records?.[id],allowed=id===`basic.${weapon}`||state.knownSkills?.includes(id)&&!record?.archived;
     const definition=allowed?resolveTechnique(id,{weapon,name:techniqueName(id,state)}):null;
     if(!definition)throw new Error('Illegal equipped technique: '+id);
     return definition;
   });
   return[phase,definitions];
 }));
}
function lifeRow(state,front){
 const loadout=ensureCombatLoadout(state),candidates=front.enemies.filter(e=>!e.dead&&!e.downed).sort((a,b)=>Math.hypot(a.x-state.position.x,a.z-state.position.z)-Math.hypot(b.x-state.position.x,b.z-state.position.z));
 const target=candidates.find(e=>e.id===state.combat?.targetId)||candidates[0];
 if(!state.combat&&state.ageYears>=7&&target&&Math.hypot(target.x-state.position.x,target.z-state.position.z)<=3.25)state.combat=beginCombatState(state,target.id);
 const finisher=combatFinisherRuntime(state),effects=skillEffects(state);
 return{id:state.id,side:'party',self:true,kind:'hero',hp:state.hp,maxHp:state.maxHp,stamina:state.stamina,staminaCap:state.staminaCap,injuries:state.injuries,position:{...state.position},yaw:state.yaw,
   ageSeconds:state.ageSeconds,seed:state.seed,generation:state.generation,equipment:{...state.equipment},loadout:lifeBattleLoadout(state,target?.id),mind:tidebreakMindVectorFor(state),pursuit:loadout.heart.active.includes('skill.pursuer'),
   stance:state.combatLoadout.body.stance,zanshin:state.combatLoadout.body.zanshin,nonlethal:finisher.nonlethal,finisherProfile:finisher.finisher,staminaMultiplier:staminaMultiplierFor(state),damageScale:1+effects.damage,mitigation:(effects.mitigation||0)+bodyRuntime(state).guardBonus,recoverStamina:false,
   targetId:target?.id,canAttack:Boolean(state.combat&&!state.down&&!state.ended&&Number(state.ageYears)>=7),canFinish:finisher.execute,dead:Boolean(state.ended),downed:Boolean(state.down),scope:'life'};
}
function enemyRow(enemy,front){return{id:enemy.id,side:'enemy',kind:'enemy',boss:front.stage>=5,hp:enemy.hp,maxHp:enemy.maxHp,stamina:enemy.battleStamina??100,staminaCap:100,injuries:enemy.injuries,position:{x:enemy.x,z:enemy.z},yaw:enemy.yaw,equipment:{weapon:sharedEnemyWeapon(front,enemy),armor:'cloth',shield:Boolean(enemy.shield)},mind:'balanced',damageScale:front.stage>=5?.9:.65,loadout:{},dead:enemy.dead,downed:enemy.downed,staminaMultiplier:.35,recoverStamina:true,readyDelay:Math.max(0,enemy.cooldown??.25),targetId:enemy.attentionTargetId,canFinish:true};}
function pose(row){
 const a=row.action;if(!a)return {attack:null,progress:0,stun:row.stagger,guarding:false,targetId:row.exchange?.targetId||null,battleAction:null};
 return {attack:a.kind,progress:a.progress,slot:a.phase,skill:a.name,targetId:a.targetId,stun:row.stagger,guarding:['guard','brace','parry'].includes(a.kind),battleAction:a,
   execution:{attackId:a.id,techniqueId:a.techniqueId,recipeId:`rinne-${a.phase}-${a.techniqueId}`,weapon:a.weapon,kind:a.kind,phase:a.phase,stepIndex:a.stageIndex,stageIndex:a.stageIndex,footwork:a.footwork,charge:a.charge,progress:a.progress,motionDuration:a.duration},
   johakyu:{authority:'johakyu-battle',targetId:a.targetId,techniqueId:a.techniqueId,name:a.name,attackId:a.id,phase:a.phase,stepIndex:a.stageIndex,legal:true,status:a.scope==='trial'?'trial':'learned'}};
}
export function tickLifeBattle(states,front,dt,{fatalityChance=()=>.5}={}){
 if(!Number.isFinite(dt)||dt<0||dt>.25)throw new RangeError('Invalid combat real-time delta');
 const result=new Map(states.map(s=>[s.id,[]]));if(dt===0)return result;
 const eligible=states.filter(s=>s.zone==='frontier'&&!s.ended);if(!eligible.length)return result;
 for(const state of eligible){if(state.inspiration)state.inspiration.execution=null;if(state.down&&!state.down.executed){state.down.elapsed+=dt;if(state.down.elapsed>=40){state.down=null;state.zone='village';state.hp=Math.max(30,state.maxHp*.3);state.stamina=state.staminaCap*.6;state.combat=null;result.get(state.id).push({type:'rescued'});}}}
 const active=eligible.filter(s=>s.zone==='frontier');if(!active.length){sessions.delete(front);return result;}
 for(const state of active){if(!state.combat&&!state.down){const target=front.enemies.find(e=>!e.dead&&!e.downed&&Math.hypot(e.x-state.position.x,e.z-state.position.z)<=3.55);if(target&&state.ageYears>=7)state.combat=beginCombatState(state,target.id);}}
 // Recovery belongs to the encounter/life host. An all-downed nonlethal front still clears.
 if(active.every(s=>combatFinisherRuntime(s).nonlethal)&&front.enemies.some(e=>!e.dead&&!e.downed)){
   for(const enemy of front.enemies)if(enemy.downed&&!enemy.dead){enemy.downedElapsed=(enemy.downedElapsed||0)+dt;if(enemy.downedElapsed>=7.5){enemy.downed=false;enemy.downedElapsed=0;enemy.hp=Math.max(1,enemy.maxHp*.28);enemy.injuries=Object.fromEntries(Object.keys(enemy.injuries||{}).map(part=>[part,{severity:0,at:0}]));for(const state of active)result.get(state.id).push({type:'enemy-recovered',targetId:enemy.id,engine:'johakyu'});}}
 }
 const rows=[...active.map(s=>lifeRow(s,front)),...front.enemies.map(e=>enemyRow(e,front))];
  let runtime=sessions.get(front);if(!runtime){runtime=createJohakyuBattleRuntime({battleId:`life:${active.map(s=>s.id).sort().join('+')}:front:${front.stage}`,actors:rows,recoverStamina:false,blocked:(a,b)=>lineBlocked(front,a,b)});sessions.set(front,runtime);}else runtime.sync(rows);
  for(const state of active){
    const pending=state.inspiration?.pending,phase=state.combat?.phase;
    if(!pending||pending.started||pending.committed||!PHASES.includes(phase))continue;
    const recipe=inspirationRecipe(state,pending.id,phase,pending.targetId,null,{immediate:true});
    if(recipe&&!runtime.inspire(state.id,recipe,pending.targetId,phase))pending.armed=false;
  }
 for(const state of active){const queued=state.combat?.oneMotionQueued;if(queued){queued.ttl-=dt;const technique=state.knownSkills?.includes(queued.skill)?resolveTechnique(queued.skill,{weapon:state.equipment.weapon}):null;if(technique&&runtime.queueTechnique(state.id,technique)||queued.ttl<=0)state.combat.oneMotionQueued=null;}}
 const stepped=runtime.step(dt),byId=new Map(stepped.frame.actors.map(a=>[a.id,a]));
 for(const state of active){const row=byId.get(state.id),domain=runtime.actor(state.id);Object.assign(state,{hp:domain.hp,stamina:domain.stamina,staminaCap:domain.staminaCap,injuries:structuredClone(domain.injuries),position:{...row.position},yaw:row.yaw,moving:row.moving,attacking:Boolean(row.action?.motion.offense)});
   if(state.down){state.down.executionState=row.executionState;state.down.downedState=row.downedState;}
   if(state.combat){state.combat.executionState=row.executionState;state.combat.downedState=row.downedState;state.combat.executionSocket=row.executionSocket;state.combat.engine='johakyu';state.combat.battleTime=stepped.frame.time;state.combat.hitstop=stepped.frame.hitstop;state.combat.phaseCue=row.phaseCue;state.combat.phase=PHASES.includes(row.action?.phase)?row.action.phase:PHASES[row.cursor.phaseIndex];state.combat.tidebreakPose=pose(row);state.combat.johakyuAction=row.action;state.combat.exchange=stepped.frame.exchanges.find(e=>e.pair.includes(state.id));state.combat.threatIds=front.enemies.filter(e=>!e.dead&&!e.downed).map(e=>e.id);}
   if(state.inspiration&&row.action)state.inspiration.execution={...pose(row),techniqueId:row.action.techniqueId,paid:true};
 }
 for(const enemy of front.enemies){const row=byId.get(enemy.id),domain=runtime.actor(enemy.id);enemy.hp=domain.hp;enemy.injuries=structuredClone(domain.injuries);enemy.x=row.position.x;enemy.z=row.position.z;enemy.yaw=row.yaw;enemy.dead=row.dead;enemy.downed=row.downed;enemy.executionState=row.executionState;enemy.downedState=row.downedState;enemy.executionSocket=row.executionSocket;enemy.battleStamina=domain.stamina;enemy.moving=row.moving;enemy.attacking=Boolean(row.action?.motion.offense);enemy.tidebreakPose=pose(row);enemy.battleTime=stepped.frame.time;enemy.hitstop=stepped.frame.hitstop;enemy.attackWindow=enemy.attacking?.32:0;enemy.flash=Math.max(0,(enemy.flash||0)-dt*4);}
 front.battleClock={time:stepped.frame.time,hitstop:stepped.frame.hitstop};
 for(const event of stepped.events){
   const owner=active.find(s=>s.id===(event.sourceId||event.actorId)),victim=active.find(s=>s.id===event.targetId);
    const row={...event,engine:'johakyu'};
    if(owner)result.get(owner.id).push(row);if(victim&&victim!==owner)result.get(victim.id).push(row);
    if(event.type==='inspiration-start'&&owner){
      owner.combat.inspirationCue={name:event.skill,techniqueId:event.techniqueId,until:stepped.frame.time+(event.firstInspirationPresentation?.hudSeconds??1.8),attackId:event.attackId,
        presentation:event.firstInspirationPresentation};
      row.position={...owner.position};
      for(const peer of active)if(peer!==owner)result.get(peer.id).push({...row,scope:'witness'});
    }
   if(event.type==='actor-downed'&&owner){owner.defeats=(owner.defeats||0)+1;const xp=owner.experiences.combat||{count:0,score:0,last:0};owner.experiences.combat={count:xp.count+1,score:xp.score+1,last:owner.ageSeconds};result.get(owner.id).push({type:'enemy-downed',targetId:event.targetId,engine:'johakyu'});}
   if(event.type==='finisher'&&victim?.down&&!victim.ended&&!victim.down.executed){victim.down.executed=true;victim.down.executedBy=event.sourceId;victim.down.executionId=event.attackId;result.get(victim.id).push({type:'enemy-finisher',sourceId:event.sourceId,attackId:event.attackId,engine:'johakyu'});}
   if(event.type==='finisher-complete'&&victim?.down?.executed&&!victim.ended&&victim.down.executionId===event.attackId){endLifeEarly(victim,`第${front.stage+1}前線で敵の葬焉`);result.get(victim.id).push({type:'life-end',cause:'enemy-finisher',sourceId:event.sourceId,attackId:event.attackId,engine:'johakyu'});}
   if(event.type==='execution-blocked'&&owner?.combat)owner.combat.executionBlock={reason:event.reason,remaining:.35};
   if(event.type==='phase-change'&&event.phase==='jo'&&owner&&owner.combat)selectCombatCombo(owner,owner.combat,{advance:true});
   if(event.type==='actor-downed'&&victim&&!victim.down&&!victim.ended){const outcome=combatBodyOutcome(victim),chance=outcome.fatal?1:fatalityChance(victim);if(hash(`${victim.seed}:${event.id||event.triggerEventId}:fatal`)<chance){endLifeEarly(victim,`第${front.stage+1}前線の戦い`);result.get(victim.id).push({type:'life-end',cause:'combat',engine:'johakyu'});}else{victim.down={elapsed:0,rescueSeconds:40,frontier:true};victim.combat=null;result.get(victim.id).push({type:'downed',engine:'johakyu'});}}
 }
 const nonlethal=active.every(s=>combatFinisherRuntime(s).nonlethal),cleared=front.enemies.every(e=>e.dead||nonlethal&&e.downed);
 // The finishing contact can defeat the last enemy before the authored motion ends.
 // Preserve the shared action until its follow-through and recovery have finished.
 if(cleared&&!active.some(state=>byId.get(state.id)?.action?.finisher)){front.cleared=true;front.clearSeconds+=dt;for(const state of active){state.combat=null;state.attacking=false;result.get(state.id).push({type:'front-cleared',stage:front.stage,nonlethal,engine:'johakyu'});}}
 return result;
}
