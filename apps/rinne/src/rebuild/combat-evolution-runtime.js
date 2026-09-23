import { endLifeEarly } from './domain.js';
import { frontierFatalityChance, tickFront as tickCoreFront, tickSharedFront as tickCoreSharedFront } from './combat-core.js';
import { directionalDefenseFor } from './combat-tactics.js';
import { applyCombatInjury,ensureCombatInjuryState,injuryEffects,recoverPersistentInjuries } from './combat-injury.js';
import { applyWorldBodyContact,applyMultiTargetContact,enemySweepTargets,ensureCombatTerrain,lineBlocked,terrainMovementScale,tickRangedProjectiles } from './combat-world-contact.js';
import { applySquadTactics,assignSquadRoles,recordEnemyPattern,squadSnapshot } from './combat-squad-ai.js';
import { finalizeCombatReplay,recordCombatReplay,replaySummary } from './combat-replay.js';
import { prepareInspirationCombat, settleInspirationCombat, observePeerInspiration } from './inspiration-combat.js';

const TAU=Math.PI*2;
function wrap(a){while(a>Math.PI)a-=TAU;while(a<-Math.PI)a+=TAU;return a;}
function hash01(value){const text=String(value);let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0)/4294967295;}
function prepareState(state){ensureCombatInjuryState(state);recoverPersistentInjuries(state);const effects=injuryEffects(state);state.combatInjuryEffects=effects;state.staminaCap=Math.max(22,Math.min(state.staminaCap||100,100*effects.staminaScale));state.stamina=Math.min(state.stamina,state.staminaCap);return effects;}
function constrainEntryMovement(state,front,effects){const current={x:state.position.x,z:state.position.z},previous=state.combatWorldPosition;if(!previous||previous.stage!==front.stage){state.combatWorldPosition={stage:front.stage,...current};return current;}const from={x:previous.x,z:previous.z},terrain=terrainMovementScale(front,from,current,.3),scale=terrain*effects.movementScale;state.position.x=from.x+(current.x-from.x)*scale;state.position.z=from.z+(current.z-from.z)*scale;return{x:state.position.x,z:state.position.z};}
function rememberWorldPosition(state,front){if(state.zone==='frontier')state.combatWorldPosition={stage:front.stage,x:state.position.x,z:state.position.z};else delete state.combatWorldPosition;}
function positions(front){return new Map(front.enemies.map(e=>[e.id,{x:e.x,z:e.z}]));}
function applyMovementConsequences(state,front,before,effects){const intended={x:state.position.x,z:state.position.z},terrain=terrainMovementScale(front,before,intended,.3),scale=terrain*effects.movementScale;state.position.x=before.x+(intended.x-before.x)*scale;state.position.z=before.z+(intended.z-before.z)*scale;if(state.combat)state.combat.injuryEffects=effects;}
function applyEnemyTerrain(front,before){for(const enemy of front.enemies){const start=before.get(enemy.id);if(!start||enemy.dead)continue;const intended={x:enemy.x,z:enemy.z},scale=terrainMovementScale(front,start,intended,.3);if(scale>=1)continue;enemy.x=start.x+(intended.x-start.x)*scale;enemy.z=start.z+(intended.z-start.z)*scale;}}
function sourceEnemy(front,id){return front.enemies.find(e=>e.id===id)||null;}
function targetEnemy(front,id){return front.enemies.find(e=>e.id===id)||null;}
function attackSector(state,target){const fromTarget=Math.atan2(state.position.x-target.x,state.position.z-target.z),delta=Math.abs(wrap(fromTarget-(Number(target.yaw)||0)));return delta<=Math.PI*.28?'front':delta<=Math.PI*.62?'flank':'back';}
function positionalScale(sector){return sector==='back'?1.25:sector==='flank'?1.1:1;}
function markExtraDown(state,target,events){if(target.dead||target.downed||target.hp>.001)return;target.hp=0;target.downed=true;target.downedElapsed=0;target.moving=false;target.attacking=false;state.defeats=(Number(state.defeats)||0)+1;events.push({type:'enemy-downed',targetId:target.id,engine:'combat-position'});}
function undoCoreDown(state,target,events){if(!target?.downed||!(target.hp>0))return;target.downed=false;target.downedElapsed=0;target.moving=false;target.attacking=false;state.defeats=Math.max(0,(Number(state.defeats)||0)-1);for(let i=events.length-1;i>=0;i--)if(events[i].type==='enemy-downed'&&events[i].targetId===target.id)events.splice(i,1);}
function resolveCollateralLethal(state,attacker,front,events){if(state.hp>0||state.down||state.ended)return;const fatalChance=frontierFatalityChance(state),fatalRoll=hash01(`${state.seed}:${attacker.id}:sweep-fatal:${front.stage}:${Math.floor(state.ageSeconds)}:${state.defeats}`);if(fatalRoll<fatalChance){endLifeEarly(state,`第${front.stage+1}前線の巻き込み`);events.push({type:'life-end',cause:'combat',fatalChance,sourceId:attacker.id,multiTarget:true,engine:'world-contact'});}else{state.down={elapsed:0,rescueSeconds:40,frontier:true};state.combat=null;events.push({type:'downed',fatalChance,sourceId:attacker.id,multiTarget:true,engine:'world-contact'});}}
function applyEnemyCollateral(states,front,result){const seen=new Set();for(const [primaryId,rows]of result){for(const event of [...rows]){if(event.engine==='johakyu'||event.type!=='enemy-hit'||event.multiTarget||!(event.damage>0))continue;const attacker=sourceEnemy(front,event.sourceId),key=`${primaryId}:${event.sourceId}`;if(!attacker||seen.has(key))continue;seen.add(key);for(const victim of enemySweepTargets(attacker,states,primaryId,front)){const defense=directionalDefenseFor(victim,attacker),contact=applyWorldBodyContact(attacker,victim,{attackId:event.attackId,damage:event.damage*.72*defense.damageScale,sector:defense.sector,phase:event.phase||'ha'});if(!contact)continue;const targetRows=result.get(victim.id)||[];targetRows.push({type:'enemy-hit',...contact,sector:defense.sector,awareness:defense.awareness,multiTarget:true,engine:'world-contact'});result.set(victim.id,targetRows);resolveCollateralLethal(victim,attacker,front,targetRows);}}}return result;}
export function processCombatEvents(state,front,events){
  const effects=injuryEffects(state),original=[...events];
  for(const event of original){
    // Shared runtime already resolved terrain, power, body injury and each contact.
    if(event.engine==='johakyu'){if(event.type==='player-hit'){const target=targetEnemy(front,event.targetId);if(target)recordEnemyPattern(target,state.id,event.skill);}if(event.type==='enemy-hit'&&event.bodyPart)events.push({type:'injury',part:event.bodyPart,severity:state.injuries[event.bodyPart].severity,sourceId:event.sourceId,attackId:event.attackId,engine:'combat-injury'});continue;}
    if(event.type==='player-hit'&&event.damage>0){
      const target=targetEnemy(front,event.targetId);if(target&&event.engine!=='world-contact'&&lineBlocked(front,state.position,target)){target.hp=Math.min(target.maxHp,target.hp+event.damage);undoCoreDown(state,target,events);event.blockedByTerrain=true;event.damage=0;events.push({type:'weapon-blocked',targetId:target.id,engine:'world-contact'});continue;}
      if(!event.projectile&&event.engine!=='world-contact'&&effects.attackScale<.999&&target){const restore=event.damage*(1-effects.attackScale);target.hp=Math.min(target.maxHp,target.hp+restore);event.damage*=effects.attackScale;undoCoreDown(state,target,events);}
      if(target&&event.damage>0){const sector=attackSector(state,target),scale=positionalScale(sector);event.attackSector=sector;if(scale>1&&!event.projectile){const extra=Math.min(target.hp,event.damage*(scale-1));target.hp=Math.max(0,target.hp-extra);event.damage+=extra;markExtraDown(state,target,events);}}
      if(target)recordEnemyPattern(target,state.id,event.skill);if(event.damage>0){const extras=applyMultiTargetContact(state,front,event,events);for(const extra of extras){const secondary=targetEnemy(front,extra.targetId);if(secondary)recordEnemyPattern(secondary,state.id,extra.skill);}}
    }
    if(event.type==='enemy-hit'&&event.damage>0){
      // Core contacts already applied the six-part injury. Announce that exact
      // part rather than rolling and applying a second wound in presentation.
      const injury=event.bodyPart?{part:event.bodyPart,severity:state.injuries[event.bodyPart].severity,gain:0}:applyCombatInjury(state,{damage:event.damage,sector:event.sector||'front',sourceId:event.sourceId});
      event.part=injury.part;event.injuryGain=injury.gain;events.push({type:'injury',part:injury.part,severity:injury.severity,sourceId:event.sourceId,attackId:event.attackId,engine:'combat-injury'});
    }
  }return events;
}
function settleFront(state,front){if(front.enemies.every(enemy=>enemy.dead)){front.cleared=true;state.combat=null;state.attacking=false;}}
function recordAndFinalize(state,front,dt,events){const terminal=front.cleared||state.ended||state.down||state.zone!=='frontier',terminalEvent=events.some(event=>['life-end','downed','front-cleared'].includes(event.type));if(!terminal||state.combatReplay||terminalEvent)recordCombatReplay(state,front,dt,events,{force:events.length>0});if(terminal&&state.combatReplay)finalizeCombatReplay(state);}
function finishTickState(state,front){ensureCombatInjuryState(state);rememberWorldPosition(state,front);}
export function tickEvolvedFront(state,front,dt,options={}){
  ensureCombatTerrain(front);const effects=prepareState(state),before=constrainEntryMovement(state,front,effects),enemyBefore=positions(front),events=[];
  const context=prepareInspirationCombat(state,front,dt);
  assignSquadRoles(front,[state]);events.push(...tickCoreFront(state,front,dt,options));
  processCombatEvents(state,front,events);
  settleInspirationCombat(state,front,events,context);settleFront(state,front);recordAndFinalize(state,front,dt,events);finishTickState(state,front);return events;
}
export function tickEvolvedSharedFront(states,front,dt){
  ensureCombatTerrain(front);const ordered=[...states].sort((a,b)=>a.id.localeCompare(b.id)),before=new Map(),effects=new Map(),extra=new Map(),contexts=new Map();
  for(const state of ordered){const effect=prepareState(state);effects.set(state.id,effect);before.set(state.id,constrainEntryMovement(state,front,effect));contexts.set(state.id,prepareInspirationCombat(state,front,dt));extra.set(state.id,[]);}
  const enemyBefore=positions(front);assignSquadRoles(front,ordered);const result=tickCoreSharedFront(ordered,front,dt);
  for(const state of ordered)result.set(state.id,[...(extra.get(state.id)||[]),...(result.get(state.id)||[])]);applyEnemyCollateral(ordered,front,result);
  for(const state of ordered){const rows=result.get(state.id)||[];processCombatEvents(state,front,rows);settleInspirationCombat(state,front,rows,contexts.get(state.id));}
  observePeerInspiration(ordered,front,result);
  for(const state of ordered){settleFront(state,front);recordAndFinalize(state,front,dt,result.get(state.id)||[]);finishTickState(state,front);}return result;
}
export function combatEvolutionSnapshot(state,front){return{injuries:structuredClone(ensureCombatInjuryState(state).injuries),injuryEffects:injuryEffects(state),ammo:structuredClone(state.ammo),squad:squadSnapshot(front),replay:replaySummary(state),terrain:structuredClone(ensureCombatTerrain(front)),inspiration:state.inspiration?{revision:state.inspiration.revision,records:Object.keys(state.inspiration.records),questions:Object.keys(state.inspiration.questions)}:null};}

