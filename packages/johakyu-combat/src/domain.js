import {COMBAT_BODY_PARTS,combatBodyOutcome,applyChoreographyImpact} from './choreography.js';
import {ensureCombatInjuryState,injuryEffects} from './injury.js';
import {spendActionStamina,recoverActionStamina,staminaPolicyFor} from './stamina.js';
import {WEAPONS,ARMORS} from './equipment.js';

const freeze=Object.freeze;
export const BODY_PARTS=COMBAT_BODY_PARTS;
const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,Number(n)||0));
const finite=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const identity=(id,name)=>{if(typeof id!=='string'||!id||id.length>160)throw new TypeError(name+' required');return id;};
function refreshBody(actor){
  const result=combatBodyOutcome(actor);
  actor.body=Object.fromEntries(BODY_PARTS.map(part=>[part,result.body[part].severity]));
  actor.dead=Boolean(actor.dead||result.fatal);
  actor.incapacitated=actor.dead||result.incapacitated||(actor.hp===0&&actor.incapacitated);
  if(actor.incapacitated)actor.hp=0;
  return result;
}
export function createJohakyuDomainActor({id,side='enemy',hp=100,maxHp=hp,stamina=100,staminaCap=100,body,injuries,dead=false,incapacitated=false,ageSeconds=0,seed=1,generation=1,equipment={weapon:'sword',armor:'cloth',shield:false},staminaMultiplier=1}={}){
  identity(id,'actor id');identity(side,'actor side');
  if(!finite(maxHp,1,10000)||!finite(hp,0,maxHp)||!finite(stamina,0,100)||!finite(staminaCap,22,100)||!finite(ageSeconds)||!finite(staminaMultiplier))throw new TypeError('Invalid actor physiology');
  if(!equipment||!WEAPONS[equipment.weapon]||!ARMORS[equipment.armor])throw new TypeError('Invalid actor equipment');
  const actor={id,side,hp,maxHp,stamina,staminaCap,dead:Boolean(dead),incapacitated:Boolean(incapacitated||hp===0),ageSeconds,seed,generation,staminaMultiplier,
    equipment:{weapon:equipment.weapon,armor:equipment.armor,shield:Boolean(equipment.shield)},
    zone:'frontier',moving:false,resting:false,idleSeconds:0,lastSpendSeconds:999,combat:true,
    injuries:Object.fromEntries(BODY_PARTS.map(part=>[part,{severity:clamp(injuries?.[part]?.severity??body?.[part]??0),at:ageSeconds}]))};
  ensureCombatInjuryState(actor);refreshBody(actor);
  return actor;
}
export function createJohakyuBattle({battleId='battle',actors=[],seed=1}={}){
  identity(battleId,'battle id');if(!Array.isArray(actors)||actors.length>12)throw new TypeError('Invalid actors');
  const map=new Map(actors.map(a=>[a.id,createJohakyuDomainActor(a)]));
  if(map.size!==actors.length)throw Error('duplicate actor id');
  return {battleId,seed:seed>>>0,actors:map,applied:new Set(),contacts:new Set(),result:null,revision:0};
}
export function spendJohakyuStamina(actor,amount){
  if(actor.dead||actor.incapacitated)return false;
  return spendActionStamina(actor,amount);
}
export function recoverJohakyuStamina(actor,seconds,{resting=false}={}){
  if(!finite(seconds,0,30))throw new TypeError('Invalid recovery duration');
  if(actor.dead)return actor.stamina;
  actor.resting=Boolean(resting);actor.combat=!resting;
  const capBase=100*(ARMORS[actor.equipment?.armor]||ARMORS.cloth).staminaScale;
  for(let remaining=seconds;remaining>1e-9;){const dt=Math.min(.25,remaining);actor.ageSeconds+=dt;recoverActionStamina(actor,dt,{capBase});injuryEffects(actor);remaining-=dt;}
  refreshBody(actor);return actor.stamina;
}
export function johakyuActorCapability(actor){
  const outcome=refreshBody(actor),stamina=staminaPolicyFor(actor);
  return freeze({...outcome,stamina,canMove:!actor.dead&&!actor.incapacitated,canAttack:!actor.dead&&!actor.incapacitated&&stamina.allowOffense});
}
export function applyJohakyuImpactOnce(battle,{eventId,attackId,sourceId,targetId,damage,part=null,phase='ha',sector='front'}={}){
  identity(eventId,'event id');identity(attackId,'attack id');
  const key=JSON.stringify([attackId,sourceId,targetId]);
  if(battle.applied.has(eventId)||battle.contacts.has(key))return {applied:false,duplicate:true};
  const source=battle.actors.get(sourceId),target=battle.actors.get(targetId);
  if(!source||!target||source===target||source.side===target.side)throw Error('invalid impact actors');
  if(part!==null&&!BODY_PARTS.includes(part))throw Error('invalid body part');
  if(!finite(damage,0,100000))throw new TypeError('Invalid damage');
  if(!['jo','ha','kyu','one','finisher'].includes(phase))throw Error('invalid impact phase');
  if(battle.result||source.dead||source.incapacitated||target.dead||target.incapacitated||damage===0)return {applied:false};
  const dealt=Math.min(target.hp,damage);
  const injury=applyChoreographyImpact(target,{damage:dealt,maxIntegrity:target.maxHp,part,phase,sector,sourceId});
  target.hp=Math.max(0,target.hp-dealt);
  // As in canonical applyTidebreakStep: HP is a pressure buffer, not a second
  // authority that can defeat a healthy body. Body outcome decides incapacity.
  if(injury.outcome.incapacitated)target.hp=0;
  else if(target.hp<=.001)target.hp=Math.max(1,target.maxHp*.18);
  refreshBody(target);battle.applied.add(eventId);battle.contacts.add(key);battle.revision++;
  const living=[...battle.actors.values()].filter(a=>!a.dead&&!a.incapacitated),sides=new Set(living.map(a=>a.side));
  if(sides.size<=1)battle.result=freeze({winner:[...sides][0]??null,reason:'incapacitated'});
  return {applied:true,dealt,part:injury.part,severity:injury.severity,durability:injury.durability,incapacitated:target.incapacitated,dead:target.dead,result:battle.result};
}
export function selectReachableTarget({source,candidates,reach=2.35,blocked=()=>false}={}){if(!source)return null;return candidates.filter(a=>a&&a.id!==source.id&&!a.dead).map(a=>({...a,distance:Math.hypot((a.x??0)-(source.x??0),(a.z??0)-(source.z??0))})).filter(a=>a.distance<=reach&&!blocked(source,a)).sort((a,b)=>a.distance-b.distance||String(a.id).localeCompare(String(b.id)))[0]??null;}
export function validateTechniqueSelection({catalog,known=[],techniqueId,weapon,ageYears=100}={}){if(!catalog?.[techniqueId])return {ok:false,reason:'catalog'};if(!known.includes(techniqueId)&&!techniqueId.startsWith('basic.'))return {ok:false,reason:'unlearned'};if(ageYears<7&&weapon!=='fist')return {ok:false,reason:'age'};return {ok:true,technique:catalog[techniqueId]};}
export function johakyuLifeGate(state,{action='combat'}={}){if(!state||state.ended)return {ok:false,reason:'ended'};if(action==='equip'&&Number(state.ageYears)<7)return {ok:false,reason:'age'};if(action==='depart'&&Number(state.ageYears)<15)return {ok:false,reason:'age'};if(action==='combat'&&state.zone!=='frontier')return {ok:false,reason:'zone'};return {ok:true};}
export function createJohakyuCheckpoint({battle,lifeId,ageSeconds,encounterId,rewardsApplied=[]}={}){return freeze({version:1,lifeId,ageSeconds:Number(ageSeconds)||0,encounterId,battleId:battle.battleId,revision:battle.revision,result:battle.result,actors:[...battle.actors.values()].map(a=>structuredClone(a)),applied:[...battle.applied],contacts:[...battle.contacts],seed:battle.seed,rewardsApplied:[...new Set(rewardsApplied)]});}
export function restoreJohakyuCheckpoint(raw){if(!raw||raw.version!==1||!Array.isArray(raw.actors)||!Array.isArray(raw.applied))throw Error('invalid johakyu checkpoint');const battle=createJohakyuBattle({battleId:raw.battleId,actors:raw.actors,seed:raw.seed});battle.applied=new Set(raw.applied);battle.contacts=new Set(raw.contacts||[]);battle.result=raw.result??null;battle.revision=Number(raw.revision)||0;return {battle,rewardsApplied:new Set(raw.rewardsApplied||[]),lifeId:raw.lifeId,ageSeconds:Number(raw.ageSeconds)||0,encounterId:raw.encounterId};}
export function applyRewardOnce(restored,rewardId,apply){if(restored.rewardsApplied.has(rewardId))return false;apply();restored.rewardsApplied.add(rewardId);return true;}
export function johakyuAcceptanceSnapshot({battle,renderer='nocturne',clockOwner='rinne-domain'}={}){return freeze({schemaVersion:1,renderer,clockOwner,battleId:battle.battleId,revision:battle.revision,result:battle.result,actors:[...battle.actors.values()].map(a=>freeze({id:a.id,side:a.side,hp:a.hp,stamina:a.stamina,dead:a.dead,incapacitated:a.incapacitated,body:freeze({...a.body})}))});}
