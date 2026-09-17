import { WEAPONS } from './domain.js';
import { tickFront as tickCoreFront, tickSharedFront as tickCoreSharedFront } from './combat-core.js';
import {
  applyCombatInjury,combatLegacySnapshot,ensureCombatGrowthState,injuryEffects,noteTechniqueUse,recordCombatLesson,recoverPersistentInjuries,
} from './combat-growth.js';
import { applyMultiTargetContact,ensureCombatTerrain,lineBlocked,terrainMovementScale,tickRangedProjectiles } from './combat-world-contact.js';
import { applySquadTactics,assignSquadRoles,recordEnemyPattern,squadSnapshot } from './combat-squad-ai.js';
import { finalizeCombatReplay,recordCombatReplay,replaySummary } from './combat-replay.js';

const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const TAU=Math.PI*2;
const dist=(a,b)=>Math.hypot((a.x||0)-(b.x||0),(a.z||0)-(b.z||0));
function wrap(a){while(a>Math.PI)a-=TAU;while(a<-Math.PI)a+=TAU;return a;}

function prepareState(state){ensureCombatGrowthState(state);recoverPersistentInjuries(state);const effects=injuryEffects(state);state.combatInjuryEffects=effects;state.staminaCap=Math.max(22,Math.min(state.staminaCap||100,100*effects.staminaScale));state.stamina=Math.min(state.stamina,state.staminaCap);return effects;}
function positions(front){return new Map(front.enemies.map(e=>[e.id,{x:e.x,z:e.z}]));}
function applyMovementConsequences(state,front,before,effects){const intended={x:state.position.x,z:state.position.z},terrain=terrainMovementScale(front,before,intended,.3),scale=terrain*effects.movementScale;state.position.x=before.x+(intended.x-before.x)*scale;state.position.z=before.z+(intended.z-before.z)*scale;if(state.combat)state.combat.injuryEffects=effects;}
function applyEnemyTerrain(front,before){for(const enemy of front.enemies){const start=before.get(enemy.id);if(!start||enemy.dead)continue;const intended={x:enemy.x,z:enemy.z},scale=terrainMovementScale(front,start,intended,.3);if(scale>=1)continue;enemy.x=start.x+(intended.x-start.x)*scale;enemy.z=start.z+(intended.z-start.z)*scale;}}
function sourceEnemy(front,id){return front.enemies.find(e=>e.id===id)||null;}
function targetEnemy(front,id){return front.enemies.find(e=>e.id===id)||null;}
function skillEvents(result,events){if(result?.unlocked?.length)events.push({type:'skills',ids:result.unlocked,names:result.names,source:'combat-growth'});}
function attackSector(state,target){const fromTarget=Math.atan2(state.position.x-target.x,state.position.z-target.z),delta=Math.abs(wrap(fromTarget-(Number(target.yaw)||0)));return delta<=Math.PI*.28?'front':delta<=Math.PI*.62?'flank':'back';}
function positionalScale(sector){return sector==='back'?1.25:sector==='flank'?1.1:1;}
function markExtraDown(state,target,events){if(target.dead||target.hp>.001)return;target.hp=0;target.dead=true;target.moving=false;target.attacking=false;state.defeats=(Number(state.defeats)||0)+1;events.push({type:'enemy-down',targetId:target.id,engine:'combat-position'});}

function processCombatEvents(state,front,events){
  const effects=injuryEffects(state),baseWeapon=WEAPONS[state.equipment?.weapon]||WEAPONS.fist,original=[...events];
  for(const event of original){
    if(event.type==='player-hit'&&event.damage>0){
      const target=targetEnemy(front,event.targetId);if(target&&event.engine!=='world-contact'&&lineBlocked(front,state.position,target)){target.hp=Math.min(target.maxHp,target.hp+event.damage);event.blockedByTerrain=true;event.damage=0;events.push({type:'weapon-blocked',targetId:target.id,engine:'world-contact'});noteTechniqueUse(state,event.skill,{phase:event.phase,hit:false});continue;}
      if(!event.projectile&&event.engine!=='world-contact'&&effects.attackScale<.999&&target){const restore=event.damage*(1-effects.attackScale);target.hp=Math.min(target.maxHp,target.hp+restore);event.damage*=effects.attackScale;}
      if(target&&event.damage>0){const sector=attackSector(state,target),scale=positionalScale(sector);event.attackSector=sector;if(scale>1&&!event.projectile){const extra=Math.min(target.hp,event.damage*(scale-1));target.hp=Math.max(0,target.hp-extra);event.damage+=extra;markExtraDown(state,target,events);}}
      noteTechniqueUse(state,event.skill,{phase:event.phase,hit:event.damage>0});if(target)recordEnemyPattern(target,state.id,event.skill);if(event.damage>0)applyMultiTargetContact(state,front,event,events);
    }
    if(event.type==='enemy-hit'&&event.damage>0){
      const injury=applyCombatInjury(state,{damage:event.damage,sector:event.sector||'front',sourceId:event.sourceId});event.part=injury.part;event.injuryGain=injury.gain;events.push({type:'injury',part:injury.part,severity:injury.severity,sourceId:event.sourceId,engine:'combat-growth'});
      if(event.sector==='back')skillEvents(recordCombatLesson(state,'backHit',{amount:.5}),events);if((state.combat?.threatIds?.length||0)>=2)skillEvents(recordCombatLesson(state,'surrounded',{amount:.45}),events);if(state.stamina<=Math.max(8,state.staminaCap*.12))skillEvents(recordCombatLesson(state,'staminaBreak',{amount:.52}),events);
      const enemy=sourceEnemy(front,event.sourceId);if(enemy&&dist(state.position,enemy)>baseWeapon.reach+.55)skillEvents(recordCombatLesson(state,'rangeLoss',{amount:.42}),events);if(event.damage>=state.maxHp*.16)skillEvents(recordCombatLesson(state,'knockdown',{amount:.38}),events);
    }
    if(event.type==='life-end'||event.type==='downed')state.combatLegacyFinal=combatLegacySnapshot(state);
  }
  return events;
}

function finalizeIfNeeded(state,front){if(front.cleared||state.ended||state.down||state.zone!=='frontier')finalizeCombatReplay(state);}

export function tickEvolvedFront(state,front,dt,options={}){ensureCombatTerrain(front);const effects=prepareState(state),before={x:state.position.x,z:state.position.z},enemyBefore=positions(front),events=[];assignSquadRoles(front,[state]);tickRangedProjectiles(state,front,dt,events);events.push(...tickCoreFront(state,front,dt,options));processCombatEvents(state,front,events);applyMovementConsequences(state,front,before,effects);applySquadTactics(front,[state],dt*.55);applyEnemyTerrain(front,enemyBefore);recordCombatReplay(state,front,dt,events,{force:events.length>0});finalizeIfNeeded(state,front);return events;}

export function tickEvolvedSharedFront(states,front,dt){ensureCombatTerrain(front);const ordered=[...states].sort((a,b)=>a.id.localeCompare(b.id)),before=new Map(),effects=new Map(),extra=new Map();for(const state of ordered){effects.set(state.id,prepareState(state));before.set(state.id,{x:state.position.x,z:state.position.z});const rows=[];tickRangedProjectiles(state,front,dt,rows);extra.set(state.id,rows);}const enemyBefore=positions(front);assignSquadRoles(front,ordered);const result=tickCoreSharedFront(ordered,front,dt);for(const state of ordered){const rows=[...(extra.get(state.id)||[]),...(result.get(state.id)||[])];processCombatEvents(state,front,rows);result.set(state.id,rows);applyMovementConsequences(state,front,before.get(state.id),effects.get(state.id));recordCombatReplay(state,front,dt,rows,{force:rows.length>0});finalizeIfNeeded(state,front);}applySquadTactics(front,ordered,dt*.55);applyEnemyTerrain(front,enemyBefore);return result;}

export function combatEvolutionSnapshot(state,front){return{injuries:structuredClone(ensureCombatGrowthState(state).injuries),injuryEffects:injuryEffects(state),legacy:combatLegacySnapshot(state),ammo:structuredClone(state.ammo),squad:squadSnapshot(front),replay:replaySummary(state),terrain:structuredClone(ensureCombatTerrain(front))};}
