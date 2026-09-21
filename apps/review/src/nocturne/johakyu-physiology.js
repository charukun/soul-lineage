import {createJohakyuReviewRules} from './johakyu-rules.js';
import {createJohakyuBattle,createJohakyuDomainActor,applyJohakyuImpactOnce,johakyuActorCapability,recoverJohakyuStamina,spendJohakyuStamina} from '@soul/johakyu-combat/domain';

/** Review-only encounter. Canonical physiology owns HP/injury/stamina; the
 * native renderer owns artwork, clips and motor timing, never a second hit. */
export function createJohakyuPhysiologyRules({mind='balanced',loadout,sequence=null,initialBody={}}={}){
  const base=createJohakyuReviewRules({mind,loadout,sequence});
  let battle,actors=new Map(),events=[],epoch=0,serial=0;
  const row=actor=>{const value=actors.get(actor.object.uuid);if(!value)throw Error('Unbound physiology actor');return value;};
  function sync(actor){const entry=row(actor),body=entry.domain;actor.hp=body.hp;actor.maxHp=body.maxHp;return entry;}
  return Object.freeze({
    ...base,mode:'johakyu-physiology',ownsDamage:true,
    reset(){base.reset();actors=new Map();events=[];serial=0;battle=createJohakyuBattle({battleId:'johakyu-review-'+(++epoch),seed:73917});},
    attach(actor){base.attach(actor);const id=actor.kind==='hero'?'hero':'enemy-'+actors.size;
      const domain=createJohakyuDomainActor({id,side:actor.kind==='hero'?'hero':'enemy',hp:actor.hp,maxHp:actor.maxHp,seed:73917,body:initialBody[id]});
      battle.actors.set(id,domain);actors.set(actor.object.uuid,{domain,speed:actor.speed,damage:actor.damage,intent:null});sync(actor);},
    release(actor){base.release(actor);actors.delete(actor.object.uuid);},
    beginStep(){base.beginStep();events=[];},
    step(actor,dt){base.step(actor,dt);const entry=row(actor);entry.domain.moving=['approach','space'].includes(entry.intent);recoverJohakyuStamina(entry.domain,dt);const capability=johakyuActorCapability(entry.domain);actor.speed=entry.speed*capability.movementScale;actor.damage=entry.damage*capability.attackScale;sync(actor);},
    intent(actor,target){const entry=row(actor),capability=johakyuActorCapability(entry.domain);if(!capability.canAttack){entry.intent='wait';return {mode:'wait',reason:capability.incapacitated?'incapacitated':'stamina'};}const decision=base.intent(actor,target);entry.intent=decision.mode;return decision;},
    begin(actor,options){const entry=row(actor);if(!johakyuActorCapability(entry.domain).canAttack)return null;const action=base.begin(actor,options),cost=9*(action.phase==='kyu'?1.25:action.phase==='ha'?1.08:1);
      if(!spendJohakyuStamina(entry.domain,cost)){base.cancel(actor,action);return null;}return action;},
    applyImpact(source,target,amount,action){
      if(!action?.id)return {applied:false};
      const sourceRow=row(source),targetRow=row(target),id=battle.battleId+':impact:'+(++serial);
      const result=applyJohakyuImpactOnce(battle,{eventId:id,attackId:action.id,sourceId:sourceRow.domain.id,targetId:targetRow.domain.id,damage:amount,phase:action.phase||'ha'});
      if(result.applied){sync(target);events.push(Object.freeze({id,type:'impact',attackId:action.id,sourceId:sourceRow.domain.id,targetId:targetRow.domain.id,phase:action.phase,techniqueId:action.techniqueId,damage:result.dealt,bodyPart:result.part,bodyDurability:result.durability}));}
      return result;
    },
    inspect(actor){const entry=row(actor),capability=johakyuActorCapability(entry.domain);return {...base.inspect(actor),id:entry.domain.id,body:capability.body,stamina:{value:entry.domain.stamina,cap:entry.domain.staminaCap},incapacitated:entry.domain.incapacitated,dead:entry.domain.dead};},
    snapshot(){return Object.freeze({battle:battle?.battleId,mode:'johakyu-physiology',events:Object.freeze(events.slice()),actors:actors.size,result:battle?.result??null});}
  });
}
