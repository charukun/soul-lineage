import { createTidebreakRuntime } from '@soul/tidebreak-combat';
import { resolveInspirationAnswer } from '@soul/game-data';
import {johakyuStageCapability} from '@soul/johakyu-combat/execution-capability';
import {executedTechniqueId,readJohakyuTechniqueTruth} from './johakyu-technique-contract.js';
import { WEAPONS, ARMORS, endLifeEarly, spendStamina, skillEffects } from './domain.js';
import { beginCombatState } from './combat-loadout-runtime.js';
import { bodyRuntime, comboById, selectCombatCombo, techniqueName } from '../combat-loadout.js';
import { chooseEnemyAttention,decayEnemyThreat,directionalDefenseFor,noteEnemyThreat,resolveBodyIntent,staminaPolicyFor,tidebreakMindVectorFor } from './combat-tactics.js';
import { tidebreakFrameFromSnapshot } from './tidebreak-pose.js';
import { defensiveLoadoutFor,passiveEnemyLoadout,tidebreakLoadoutFor,tidebreakMindsetFor,tidebreakWeaponFor } from './tidebreak-loadout.js';
import {applyChoreographyImpact} from './combat-choreography.js';
import {lineBlocked} from './combat-world-contact.js';
import {readSavedBody,readSavedTerrain} from './johakyu-save-contract.js';
export { tidebreakLoadoutFor, tidebreakMindVector, tidebreakMindsetFor, tidebreakWeaponFor } from './tidebreak-loadout.js';
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const finite=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
const TAU=Math.PI*2,ARENA={minX:-6.75,maxX:6.75,minZ:-5.85,maxZ:5.65},THREAT_RADIUS=3.55;
const SESSIONS=new WeakMap(),SESSION_SERIALS=new WeakMap();
function wrapAngle(value){value=Number(value)||0;while(value>Math.PI)value-=TAU;while(value<-Math.PI)value+=TAU;return value;}
function angleDelta(from,to){return wrapAngle(to-from);}
function turnToward(from,to,maxStep){return wrapAngle(from+clamp(angleDelta(from,to),-maxStep,maxStep));}
function angleTo(from,to){return Math.atan2(to.x-from.x,to.z-from.z);}
function hash01(value){const text=String(value);let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0)/4294967295;}
function hashSeed(value){return Math.max(1,Math.floor(hash01(value)*0x7ffffffe));}
function cleanThreat(raw){const out={};if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;for(const [id,value]of Object.entries(raw).slice(0,30))if(typeof id==='string'&&id.length<=120&&finite(value,0,80))out[id]=value;return out;}
function enemyDefaults(id,x,z){return{yaw:angleTo({x,z},{x:0,z:5.2}),attackWindow:0,moving:false,attentionTargetId:null,threat:{},tidebreakPose:null,attacking:false,downed:false,downedElapsed:0};}
export function createFront(stage=0,seed=1){const boss=stage>=5,count=boss?1:3+Math.min(2,stage),rows=[];for(let i=0;i<count;i++){const angle=(i/Math.max(1,count))*Math.PI*1.5+.3,ring=boss?2:2.5+(i%2)*1.2,x=Math.sin(angle)*ring,z=-1.2-Math.cos(angle)*ring;rows.push({id:`front-${stage}-${i}`,x,z,hp:boss?180:42+stage*9,maxHp:boss?180:42+stage*9,dead:false,cooldown:.4+i*.18,flash:0,...enemyDefaults(`front-${stage}-${i}`,x,z)});}return{stage,enemies:rows,cleared:false,clearSeconds:0};}
export function normalizeFront(raw,stage=0,seed=1){
  if(!raw)return createFront(stage,seed);if(!Number.isInteger(raw.stage)||raw.stage<0||raw.stage>5||raw.stage!==stage||!Array.isArray(raw.enemies)||raw.enemies.length<1||raw.enemies.length>6)throw Error('前線の保存データが不正です。');
  const ids=new Set(),enemies=raw.enemies.map(e=>{if(!e||typeof e.id!=='string'||e.id.length>80||ids.has(e.id)||!finite(e.x,-20,20)||!finite(e.z,-20,20)||!finite(e.maxHp,1,1000)||!finite(e.hp,0,e.maxHp)||typeof e.dead!=='boolean'||!finite(e.cooldown,-30,30))throw Error('前線の敵データが不正です。');ids.add(e.id);const fallback=enemyDefaults(e.id,e.x,e.z),attention=typeof e.attentionTargetId==='string'&&e.attentionTargetId.length<=120?e.attentionTargetId:null;return{id:e.id,x:e.x,z:e.z,hp:e.hp,maxHp:e.maxHp,dead:e.dead,cooldown:e.cooldown,flash:finite(e.flash,0,1)?e.flash:0,yaw:Number.isFinite(e.yaw)?wrapAngle(e.yaw):fallback.yaw,attackWindow:finite(e.attackWindow,0,3)?e.attackWindow:0,moving:false,attentionTargetId:attention,threat:cleanThreat(e.threat),tidebreakPose:null,attacking:false,injuries:readSavedBody(e.injuries),downed:e.dead?false:Boolean(e.downed),downedElapsed:finite(e.downedElapsed,0,3600)?e.downedElapsed:0};});
  const allDead=enemies.every(e=>e.dead);if(raw.cleared===true&&!allDead)throw Error('前線の撃破状態が不正です。');const cleared=allDead,clearSeconds=finite(raw.clearSeconds,0,3600)?raw.clearSeconds:0;return{stage,enemies,cleared,clearSeconds,...(raw.terrain?{terrain:readSavedTerrain(raw.terrain)}:{})};
}
export function frontierFatalityChance(state){const effects=skillEffects(state),body=bodyRuntime(state),armor=ARMORS[state.equipment.armor]||ARMORS.cloth,shield=state.equipment.shield?.12:0,survival=armor.guard+shield+body.guardBonus+effects.mitigation+effects.evasion*.35+effects.recovery*.2;return clamp(.84-survival*.86,.2,.84);}
function heroHpScale(state){const effects=skillEffects(state),body=bodyRuntime(state),armor=ARMORS[state.equipment.armor]||ARMORS.cloth,shield=state.equipment.shield?.12:0,guard=clamp(armor.guard+shield+body.guardBonus,0,.72);return clamp((1-guard)*(1-effects.mitigation),.18,1);}
function enemyHpScale(state){return clamp(1+skillEffects(state).damage,1,1.7);}
export function enemyWeapon(front,target){if(front.stage>=5)return'great';const pool=['sword','spear','axe','great'],index=Math.floor(hash01(`${target.id}:weapon`)*pool.length)%pool.length;return pool[index];}
function enemyStyle(front,target){if(front.stage>=5)return'assault';const pool=['balanced','assault','defensive','counter','patient'],index=Math.floor(hash01(`${target.id}:mind`)*pool.length)%pool.length;return pool[index];}
function sessionMap(state){let map=SESSIONS.get(state);if(!map){map=new Map();SESSIONS.set(state,map);}return map;}
function combatSignature(state,target,front,{secondary=false,enemyCanHit=true}={}){
  const defense=directionalDefenseFor(state,target),policy=staminaPolicyFor(state);
  // The executor consumes a discrete mindset. Continuous HP/injury drift must not restart every attack.
  return JSON.stringify({target:target.id,role:secondary?'threat':'primary',enemyCanHit,sector:defense.sector,receive:defense.receive,stamina:policy.band,weapon:tidebreakWeaponFor(state.equipment.weapon),mind:tidebreakMindsetFor(state),loadout:secondary?defensiveLoadoutFor(state,target):tidebreakLoadoutFor(state,state?.combat?.comboId,target),armor:state.equipment.armor,shield:state.equipment.shield,enemyWeapon:enemyWeapon(front,target),enemyStyle:enemyStyle(front,target)});
}
function createSession(state,target,front,signature,{secondary=false,enemyCanHit=true}={}){
  const weapon=tidebreakWeaponFor(state.equipment.weapon),loadout=secondary?defensiveLoadoutFor(state,target):tidebreakLoadoutFor(state,state?.combat?.comboId,target),mindset=tidebreakMindsetFor(state),hScale=heroHpScale(state),eScale=enemyHpScale(state),foeWeapon=enemyWeapon(front,target),runtime=createTidebreakRuntime({seed:hashSeed(`${state.seed}:${state.generation}:${target.id}:${secondary?'threat':'primary'}:${enemyCanHit?'aggro':'ignore'}`),weapon});
  const snapshot=runtime.configure({encounterReady:true,weapon,enemyWeapon:foeWeapon,enemyStyle:enemyStyle(front,target),enemyLoadout:enemyCanHit?undefined:passiveEnemyLoadout(foeWeapon),loadout,mindset,hp:Math.max(.001,state.hp/hScale),maxhp:Math.max(.001,state.maxHp/hScale),enemyHp:Math.max(.001,target.hp/eScale),positions:{hero:{x:state.position.x,z:state.position.z,yaw:state.yaw},enemy:{x:target.x,z:target.z,yaw:target.yaw}}});
  const ordinal=(SESSION_SERIALS.get(state)||0)+1;SESSION_SERIALS.set(state,ordinal);
  const session={id:`${state.id}:${state.generation}:${front.stage}:${ordinal}`,runtime,loadout,targetId:target.id,signature,secondary,enemyCanHit,heroHpScale:hScale,enemyHpScale:eScale,last:snapshot,lastAttackKey:snapshot.hero.execution?String(snapshot.hero.execution.attackId):null,oneMotionArmed:null,invalid:false,rotateAfterKyu:false};sessionMap(state).set(target.id,session);return session;
}
function sessionDrift(session,state,target){const h=session.last?.hero,e=session.last?.enemy;if(!h||!e)return Infinity;return Math.max(Math.hypot(h.x-state.position.x,h.z-state.position.z),Math.hypot(e.x-target.x,e.z-target.z));}
function sessionFor(state,target,front,options={}){
  const signature=combatSignature(state,target,front,options),existing=sessionMap(state).get(target.id),next=JSON.parse(signature),prior=existing?JSON.parse(existing.signature):null;
  const hardChanged=prior&&['weapon','armor','shield','enemyWeapon','enemyStyle'].some(key=>prior[key]!==next[key]);
  if(!existing||hardChanged||existing.invalid||sessionDrift(existing,state,target)>1.15)return createSession(state,target,front,signature,options);
  if(existing.signature!==signature){
    existing.runtime.setPolicy({loadout:next.loadout,mindset:next.mind,enemyLoadout:next.enemyCanHit?null:passiveEnemyLoadout(next.enemyWeapon)});
    existing.signature=signature;existing.loadout=next.loadout;existing.secondary=Boolean(options.secondary);existing.enemyCanHit=Boolean(options.enemyCanHit);
  }
  return existing;
}
function clearSession(state,targetId=null){const map=SESSIONS.get(state);if(!map)return;if(targetId!==null){map.delete(targetId);if(!map.size)SESSIONS.delete(state);}else SESSIONS.delete(state);}
function pruneSessions(state,keep){const map=SESSIONS.get(state);if(!map)return;for(const id of map.keys())if(!keep.has(id))map.delete(id);if(!map.size)SESSIONS.delete(state);}
function nearestEnemy(position,enemies){let best=null,bestDistance=Infinity;for(const enemy of enemies){const d=dist(position,enemy);if(d<bestDistance){best=enemy;bestDistance=d;}}return{enemy:best,distance:bestDistance};}
function advanceEnemyClock(front,dt){for(const enemy of front.enemies){enemy.flash=Math.max(0,enemy.flash-dt*4);enemy.attackWindow=Math.max(0,(enemy.attackWindow||0)-dt);decayEnemyThreat(enemy,dt);if(enemy.downed&&!enemy.dead){enemy.downedElapsed=(Number(enemy.downedElapsed)||0)+dt;enemy.moving=false;enemy.attacking=false;enemy.attackWindow=0;continue;}if(!enemy.dead)enemy.cooldown=Math.max(-1,(Number(enemy.cooldown)||0)-dt);else{enemy.moving=false;enemy.attacking=false;}}}
function refreshAttention(living,states){for(const enemy of living){const target=chooseEnemyAttention(enemy,states);enemy.attentionTargetId=target?.id||null;}}
function formationStep(enemy,target,others,dt,stage){const dx=enemy.x-target.position.x,dz=enemy.z-target.position.z,d=Math.max(.001,Math.hypot(dx,dz)),ox=dx/d,oz=dz/d,orbit=hash01(`${enemy.id}:orbit`)<.5?-1:1,ready=enemy.cooldown<=.12,committed=enemy.attackWindow>0,preferred=stage>=5?1.65:ready?1.48:1.86+hash01(`${enemy.id}:ring`)*.42,radial=clamp((d-preferred)*(d>3.2?1.15:.82),-.75,1.45),tx=-oz*orbit,tz=ox*orbit,orbitSpeed=d>3.35?.12:(ready?.24:.48+hash01(`${enemy.id}:pace`)*.2);let vx=-ox*radial+tx*orbitSpeed,vz=-oz*radial+tz*orbitSpeed;for(const other of others){if(other.id===enemy.id)continue;const sx=enemy.x-other.x,sz=enemy.z-other.z,separation=Math.hypot(sx,sz);if(separation>0&&separation<1.08){const push=(1-separation/1.08)*1.55;vx+=sx/separation*push;vz+=sz/separation*push;}}if(committed){vx*=.22;vz*=.22;}const magnitude=Math.hypot(vx,vz),speed=1.02+Math.min(.28,stage*.045)+(d>3.2?.5:0),scale=magnitude>speed?speed/magnitude:1,beforeX=enemy.x,beforeZ=enemy.z;enemy.x=clamp(enemy.x+vx*scale*dt,ARENA.minX,ARENA.maxX);enemy.z=clamp(enemy.z+vz*scale*dt,ARENA.minZ,ARENA.maxZ);enemy.yaw=turnToward(enemy.yaw,angleTo(enemy,target.position),dt*5.4);enemy.moving=Math.hypot(enemy.x-beforeX,enemy.z-beforeZ)>.002;}
function advanceEnemyFormation(state,living,dt,stage,skipId=null){for(const enemy of living){if(enemy.id===skipId)continue;formationStep(enemy,state,living,dt,stage);}}
function advanceSharedEnemyFormation(states,living,dt,stage){for(const enemy of living){const target=states.find(state=>state.id===enemy.attentionTargetId)||chooseEnemyAttention(enemy,states);if(target)formationStep(enemy,target,living,dt,stage);}}
function allowedLiving(front,allowedEnemyIds){const living=front.enemies.filter(enemy=>!enemy.dead&&!enemy.downed);return allowedEnemyIds?living.filter(enemy=>allowedEnemyIds.has(enemy.id)):living;}
const FINISHER_RANGE=1.9,FINISHER_DURATION=.92,FINISHER_IMPACT=.58;
function recordEnemyDown(state,target,events){if(target.dead||target.downed)return;delete target._combatContributors;target.hp=0;target.downed=true;target.downedElapsed=0;target.moving=false;target.attacking=false;target.attackWindow=0;target.tidebreakPose=null;state.defeats=(Number(state.defeats)||0)+1;const row=state.experiences.combat||{count:0,score:0,last:0};state.experiences.combat={count:row.count+1,score:row.score+1,last:state.ageSeconds};clearSession(state,target.id);if(state.combat?.targetId===target.id)state.combat=null;state.attacking=false;events.push({type:'enemy-downed',targetId:target.id,engine:'tidebreak'});}
function finisherFrame(progress,targetId){const p=clamp(progress,0,1),swing=Math.sin(p*Math.PI),commit=clamp((p-.3)/.42,0,1);return{attack:'heavy',progress:p,slot:'kyu',skill:'止め',guarding:false,stun:0,targetId,intent:'finisher',sector:'front',pose:{pitch:-.08-.34*swing,twist:.22-.68*commit,roll:-.08*swing,pelvisYaw:.18-.32*commit,headPitch:-.08,headLag:.08,crouch:-.16*swing,hand:[.34,1.08,.12],tip:[.18+.18*commit,.52+.26*(1-commit),1.02-.48*commit],left:[-.26,1.14,.06]}};}
function finishEnemy(state,target,events){if(target.dead)return;target.dead=true;target.downed=false;target.downedElapsed=0;target.moving=false;target.attacking=false;target.tidebreakPose=null;events.push({type:'enemy-down',targetId:target.id,engine:'tidebreak',finisher:true});}
function startFinisher(state,target,events){state.finisher={targetId:target.id,elapsed:0,duration:FINISHER_DURATION,impactAt:FINISHER_IMPACT,committed:false};state.combat={targetId:target.id,phase:'kyu',engine:'finisher',attackCooldown:FINISHER_DURATION,tidebreakPose:finisherFrame(0,target.id)};state.attacking=true;state.moving=false;events.push({type:'finisher-start',targetId:target.id,engine:'tidebreak'});}
function advanceFinisher(state,front,dt,events){const run=state.finisher;if(!run)return false;const target=front.enemies.find(enemy=>enemy.id===run.targetId);if(!target||target.dead||!target.downed){state.finisher=null;if(state.combat?.engine==='finisher')state.combat=null;state.attacking=false;return false;}run.elapsed+=dt;const progress=clamp(run.elapsed/run.duration,0,1);state.combat={targetId:target.id,phase:'kyu',engine:'finisher',attackCooldown:Math.max(0,run.duration-run.elapsed),tidebreakPose:finisherFrame(progress,target.id)};state.yaw=turnToward(state.yaw,angleTo(state.position,target),Math.max(.08,dt*9));state.attacking=true;state.moving=false;if(!run.committed&&progress>=run.impactAt){run.committed=true;events.push({type:'finisher',targetId:target.id,phase:'finisher',damage:Math.max(1,target.maxHp*.4),manual:true,engine:'tidebreak'});}if(progress>=1){finishEnemy(state,target,events);state.finisher=null;state.combat=null;state.attacking=false;}return true;}
function maybeStartFinisher(state,front,events){if(state.finisher||state.down||state.ended)return false;if(front.enemies.some(enemy=>!enemy.dead&&!enemy.downed&&dist(state.position,enemy)<=THREAT_RADIUS))return false;const downed=front.enemies.filter(enemy=>enemy.downed&&!enemy.dead);if(!downed.length)return false;const nearest=nearestEnemy(state.position,downed);if(!nearest.enemy||nearest.distance>FINISHER_RANGE)return false;startFinisher(state,nearest.enemy,events);return true;}
function causalTechnique(session,actor){const id=executedTechniqueId(actor),row=resolveInspirationAnswer(id);return row?{id,row}:null;}
function executionStage(session,execution){
  if(!execution)return null;
  const recipe=session.loadout?.[execution.phase]||session.loadout?.uke;
  return recipe?.steps?.[execution.stepIndex]||null;
}
function executionCapability(state,session,next){
  const execution=next.hero.execution;if(!execution)return null;
  const step=executionStage(session,execution)||{},base=WEAPONS[state.equipment.weapon]||WEAPONS.fist,phase=execution.phase||next.hero.slot||'jo';
  const effort=causalTechnique(session,next.hero)?.row.effort||1,cost=session.secondary?0:base.stamina*(phase==='kyu'?1.25:phase==='ha'?1.08:1)*effort;
  return johakyuStageCapability(state,{weapon:execution.weapon||tidebreakWeaponFor(state.equipment.weapon),phase,kind:execution.kind||step.kind||'ready',footwork:step.footwork||'stay',charge:execution.charge||step.charge||'none',staminaCost:cost});
}
function chargeAttackStamina(state,session,next,events){
  const execution=next.hero.execution,key=execution?String(execution.attackId):null;let paid=true;
  if(key&&key!==session.lastAttackKey&&!session.oneMotionArmed){
    const capability=executionCapability(state,session,next);
    if(capability&&!capability.allowed){
      paid=false;session.invalid=true;
      const remaining=capability.reason==='arm-injury'||capability.reason==='leg-injury'?.85:.45;
      if(state.combat){state.combat.executionBlock={reason:capability.reason,remaining,phase:execution.phase||next.hero.slot||'jo',kind:execution.kind||null,stageIndex:execution.stepIndex??null};state.combat.attackCooldown=Math.max(Number(state.combat.attackCooldown)||0,remaining);}
      events.push({type:'execution-blocked',reason:capability.reason,phase:execution.phase||next.hero.slot||'jo',kind:execution.kind||null,stageIndex:execution.stepIndex??null,targetId:session.targetId,engine:'tidebreak',authority:'rinne-domain'});
    }else if(!session.secondary){
      const cost=capability?.stamina?.effectiveCost??0;paid=spendStamina(state,cost);
      if(!paid){state.stamina=0;session.invalid=true;events.push({type:'execution-blocked',reason:'stamina',phase:execution.phase||next.hero.slot||'jo',kind:execution.kind||null,stageIndex:execution.stepIndex??null,targetId:session.targetId,engine:'tidebreak',authority:'rinne-domain'});}
    }
  }
  session.lastAttackKey=key;return paid;
}
function armOneMotion(state,session,dt){const queued=state.combat?.oneMotionQueued;if(!queued||session.secondary||state.combat.oneMotionRecovery>0||!staminaPolicyFor(state).allowOffense)return;queued.ttl-=dt;if(queued.ttl<=0){state.combat.oneMotionQueued=null;return;}if(session.last.hero.attack)return;const base=WEAPONS[state.equipment.weapon]||WEAPONS.fist,cost=Math.max(22,base.stamina*2.6);if(!spendStamina(state,cost))return;session.oneMotionArmed=queued.skill;state.combat.oneMotionQueued=null;}
function applyTidebreakStep(state,target,front,dt,events,{primary=false,bodyAuthority=false,enemyPositionAuthority=false,enemyCanHit=true,intent='attack',sharedParticipantCount=1}={}){
  const session=sessionFor(state,target,front,{secondary:!primary,enemyCanHit});armOneMotion(state,session,dt);const manual=primary&&state.moving?.67:0;session.runtime.input(Math.sin(state.yaw),Math.cos(state.yaw),manual,0);
  const beforeHero=state.hp,beforeEnemy=target.hp,beforeX=state.position.x,beforeZ=state.position.z,beforeEnemyX=target.x,beforeEnemyZ=target.z,previous=session.last,next=session.runtime.step(dt),paid=chargeAttackStamina(state,session,next,events),executionAccepted=paid||!next.hero.execution,defense=directionalDefenseFor(state,target);
  if(bodyAuthority&&executionAccepted){state.position.x=clamp(next.hero.x,ARENA.minX,ARENA.maxX);state.position.z=clamp(next.hero.z,ARENA.minZ,ARENA.maxZ);state.yaw=wrapAngle(next.hero.yaw);state.moving=state.moving||Math.hypot(state.position.x-beforeX,state.position.z-beforeZ)>.002;}
  if(enemyPositionAuthority&&enemyCanHit){target.x=clamp(next.enemy.x,ARENA.minX,ARENA.maxX);target.z=clamp(next.enemy.z,ARENA.minZ,ARENA.maxZ);target.yaw=wrapAngle(next.enemy.yaw);target.moving=Math.hypot(target.x-beforeEnemyX,target.z-beforeEnemyZ)>.002;}
  target.attackWindow=Math.max(target.attackWindow||0,(enemyCanHit&&next.enemy.attack)? .32 : 0);if(enemyCanHit&&next.enemy.attack)target.cooldown=Math.max(target.cooldown,.55);target.attacking=enemyCanHit&&Boolean(next.enemy.attack);
  const runtimeHeroBefore=previous.hero.hp*session.heroHpScale,runtimeHeroAfter=next.hero.hp*session.heroHpScale,runtimeEnemyBefore=previous.enemy.hp*session.enemyHpScale,runtimeEnemyAfter=next.enemy.hp*session.enemyHpScale;
  const openContact=!lineBlocked(front,state.position,target);
  let taken=enemyCanHit&&openContact?Math.max(0,runtimeHeroBefore-runtimeHeroAfter)*defense.damageScale:0,dealt=paid&&openContact?Math.max(0,runtimeEnemyBefore-runtimeEnemyAfter):0;
  if(!openContact&&(runtimeHeroBefore>runtimeHeroAfter||runtimeEnemyBefore>runtimeEnemyAfter)){session.invalid=true;events.push({type:'weapon-blocked',sourceId:state.id,targetId:target.id,engine:'tidebreak',reason:'terrain'});}
  state.hp=clamp(beforeHero-taken,0,state.maxHp);target.hp=clamp(beforeEnemy-dealt,0,target.maxHp);if(dealt>.001){target.flash=1;noteEnemyThreat(target,state.id,dealt,primary? .2 : .08);}
  const slot=['jo','ha','kyu'].includes(next.hero.slot)?next.hero.slot:null;if(primary&&slot)state.combat.phase=slot;
  if(state.combat){state.combat.engine='tidebreak';state.combat.tidebreakVersion=session.runtime.sourceVersion;state.combat.mindVector=tidebreakMindVectorFor(state);if(primary)state.combat.attackCooldown=Math.max(Number(state.combat.attackCooldown)||0,next.hero.attack?1.3:0);if(executionAccepted&&(bodyAuthority||!state.combat.tidebreakPose))state.combat.tidebreakPose=tidebreakFrameFromSnapshot(next.hero,{targetId:target.id,intent,sector:defense.sector});if(!executionAccepted&&next.hero.execution)state.combat.tidebreakPose=null;}
  if(enemyCanHit&&target.attentionTargetId===state.id)target.tidebreakPose=tidebreakFrameFromSnapshot(next.enemy,{targetId:state.id,intent:'attack',sector:'front'});if(state.combat?.tidebreakPose)state.combat.tidebreakPose.johakyu=readJohakyuTechniqueTruth(state,state.combat.tidebreakPose,{sessionId:session.id});state.attacking=Boolean(executionAccepted&&state.combat?.tidebreakPose?.attack);
  const executedActor=next.hero.skill?next.hero:previous.hero,causal=causalTechnique(session,executedActor);
  if(primary&&state.inspiration)state.inspiration.execution=causal?{...tidebreakFrameFromSnapshot(executedActor,{targetId:target.id,intent,sector:defense.sector}),techniqueId:causal.id,paid}:null;
  const armed=primary?session.oneMotionArmed:null,stepImpacts=Array.isArray(next.impacts)?next.impacts:[],outgoingImpact=[...stepImpacts].reverse().find(row=>row?.sourceHero&&!row?.targetHero)||null,incomingImpact=[...stepImpacts].reverse().find(row=>!row?.sourceHero&&row?.targetHero)||null;
  if(dealt>.001&&armed){const extra=Math.min(target.hp,dealt*.78);target.hp-=extra;dealt+=extra;session.oneMotionArmed=null;session.invalid=true;state.combat.zanshinSeconds=.95;state.combat.oneMotionRecovery=1.8;state.combat.attackCooldown=1.8;events.push({type:'one-motion',targetId:target.id,skill:armed,damage:dealt,impact:outgoingImpact,feel:next.feel,engine:'tidebreak'});}
  const enemyBody=dealt>.001?applyChoreographyImpact(target,{damage:dealt,maxIntegrity:target.maxHp,sector:'front',sourceId:state.id,phase:armed?'one':(slot||state.combat?.phase||'jo')}):null;
  const heroBody=taken>.001?applyChoreographyImpact(state,{damage:taken,maxIntegrity:state.maxHp,sector:defense.sector,sourceId:target.id,phase:next.enemy?.slot||'ha'}):null;
  if(dealt>.001){target._combatContributors=Array.isArray(target._combatContributors)?target._combatContributors:[];if(!target._combatContributors.includes(state.id))target._combatContributors.push(state.id);target._combatContributors=target._combatContributors.slice(-6);}
  const requiredContributors=sharedParticipantCount>1?Math.min(2,sharedParticipantCount):1,enemyDefeated=Boolean(enemyBody?.outcome.incapacitated&&target._combatContributors?.length>=requiredContributors);
  if(enemyDefeated)target.hp=0;else if(target.hp<=.001){target.hp=Math.max(1,target.maxHp*.18);session.invalid=true;}
  if(heroBody?.outcome.incapacitated)state.hp=0;else if(state.hp<=.001){state.hp=Math.max(1,state.maxHp*.18);session.invalid=true;}
  if(dealt>.001)events.push({type:'player-hit',targetId:target.id,techniqueId:armed?armed:executedTechniqueId(executedActor),attackId:outgoingImpact?.attackId!=null?`${session.id}:${outgoingImpact.attackId}`:null,sourceId:state.id,skill:armed?techniqueName(armed,state):(next.hero.skill||(!primary?'受け返し':techniqueName(comboById(state,state.combat?.comboId)?.slots?.[slot||state.combat?.phase],state))),phase:armed?'one':(!primary?'uke':(slot||state.combat?.phase||'jo')),damage:dealt,bodyPart:enemyBody?.part||null,bodyDurability:enemyBody?.durability??null,injuryStage:enemyBody?.stage||null,manual:Boolean(armed),impact:outgoingImpact,feel:next.feel,engine:'tidebreak'});
  if(taken>.001)events.push({type:'enemy-hit',sourceId:target.id,targetId:state.id,attackId:incomingImpact?.attackId!=null?`${session.id}:${incomingImpact.attackId}`:null,damage:taken,bodyPart:heroBody?.part||null,bodyDurability:heroBody?.durability??null,injuryStage:heroBody?.stage||null,sector:defense.sector,awareness:defense.awareness,impact:incomingImpact,feel:next.feel,engine:'tidebreak'});
  const counters=(next.stats?.counters||0)-(previous.stats?.counters||0);if(enemyCanHit&&counters>0&&taken<=.001)events.push({type:'evaded',sourceId:target.id,defense:'counter',sector:defense.sector,engine:'tidebreak'});
  if(primary){const kyuUses=(next.stats?.uses?.kyu||0)-(previous.stats?.uses?.kyu||0);if(kyuUses>0)session.rotateAfterKyu=true;if(session.rotateAfterKyu&&!next.hero.attack&&state.combat){selectCombatCombo(state,state.combat,{advance:true});state.combat.phase='jo';session.rotateAfterKyu=false;session.invalid=true;}}
  session.last=next;if(enemyDefeated)recordEnemyDown(state,target,events);
  if(heroBody?.outcome.incapacitated&&!state.ended&&!state.down){const fatalChance=heroBody.outcome.fatal?1:frontierFatalityChance(state),fatalRoll=hash01(`${state.seed}:${target.id}:fatal:${front.stage}:${Math.floor(state.ageSeconds)}:${state.defeats}`);clearSession(state);if(fatalRoll<fatalChance){endLifeEarly(state,`第${front.stage+1}前線の戦い`);events.push({type:'life-end',cause:'combat',fatalChance,engine:'tidebreak'});}else{state.down={elapsed:0,rescueSeconds:40,frontier:true};state.combat=null;events.push({type:'downed',fatalChance,engine:'tidebreak'});}}
  if(target.dead){clearSession(state,target.id);if(primary&&state.combat?.targetId===target.id)state.combat=null;}
}
function tickFrontStep(state,front,dt,{advanceEnemies=true,allowedEnemyIds=null,advanceFormation=true,heroPositionAuthority=true,enemyPositionAuthority=true,attentionStates=null,sharedParticipantCount=1}={}){
  const events=[];if(state.inspiration)state.inspiration.execution=null;
  if(state.combat?.oneMotionRecovery>0){state.combat.oneMotionRecovery=Math.max(0,state.combat.oneMotionRecovery-dt);state.combat.attackCooldown=state.combat.oneMotionRecovery;state.combat.zanshinSeconds=Math.max(0,(state.combat.zanshinSeconds||0)-dt);}
  if(state.combat?.executionBlock){state.combat.executionBlock.remaining=Math.max(0,(Number(state.combat.executionBlock.remaining)||0)-dt);if(state.combat.executionBlock.remaining<=0)delete state.combat.executionBlock;}
  if(state.zone!=='frontier'||state.ended)return events;if(advanceEnemies)advanceEnemyClock(front,dt);const remaining=front.enemies.filter(enemy=>!enemy.dead);if(!remaining.length){front.cleared=true;if(advanceEnemies)front.clearSeconds+=dt;state.finisher=null;state.combat=null;state.attacking=false;clearSession(state);return[{type:'front-cleared',stage:front.stage,engine:'tidebreak'}];}if(advanceFinisher(state,front,dt,events))return events;if(maybeStartFinisher(state,front,events)){advanceFinisher(state,front,0,events);return events;}const allLiving=remaining.filter(enemy=>!enemy.downed);refreshAttention(allLiving,attentionStates||[state]);
  if(state.down){clearSession(state);state.attacking=false;if(advanceEnemies)for(const enemy of allLiving)enemy.moving=false;state.down.elapsed+=dt;if(state.down.elapsed>=40){state.down=null;state.zone='village';state.front=0;state.hp=Math.max(30,state.maxHp*.3);state.stamina=state.staminaCap*.6;state.combat=null;events.push({type:'rescued'});}return events;}
  let living=allowedLiving(front,allowedEnemyIds);if(!living.length){if(state.combat){state.combat=null;state.attacking=false;clearSession(state);}return events;}let nearest=nearestEnemy(state.position,living),target=state.combat?living.find(enemy=>enemy.id===state.combat.targetId&&!enemy.dead):null;
  if(!state.combat&&nearest.distance<=3.25){state.combat=beginCombatState(state,nearest.enemy.id);state.combat.engine='tidebreak';target=nearest.enemy;}if(state.combat&&!target){if(nearest.distance<=3.25){state.combat.targetId=nearest.enemy.id;target=nearest.enemy;}else{state.combat=null;state.attacking=false;}}if(state.combat&&target&&dist(state.position,target)>5.4){clearSession(state,target.id);state.combat=null;state.attacking=false;target=null;events.push({type:'disengage'});}
  if(advanceFormation)advanceEnemyFormation(state,living,dt,front.stage,target?.id||null);living=allowedLiving(front,allowedEnemyIds);const threats=living.filter(enemy=>!enemy.dead&&dist(state.position,enemy)<=THREAT_RADIUS);let intent=resolveBodyIntent(state,threats,state.combat?.targetId||null);
  // Recovery prevents new offense, not enemy participation or incoming damage.
  if(state.combat?.oneMotionRecovery>0||state.combat?.executionBlock?.remaining>0)intent={...intent,mode:'recover',stamina:{...intent.stamina,allowOffense:false}};
  if(state.combat){state.combat.bodyIntent=intent.mode;state.combat.bodyTargetId=intent.bodyTargetId;state.combat.mindVector=intent.vector;state.combat.staminaBand=intent.stamina.band;state.combat.tidebreakPose=null;}
  for(const enemy of threats){if(state.down||state.ended)break;const isTarget=enemy.id===state.combat?.targetId,offense=isTarget&&intent.mode==='attack'&&intent.stamina.allowOffense,bodyAuthority=heroPositionAuthority&&enemy.id===intent.bodyTargetId,enemyCanHit=enemy.attentionTargetId===state.id||!enemy.attentionTargetId;applyTidebreakStep(state,enemy,front,dt,events,{primary:offense,bodyAuthority,enemyPositionAuthority:enemyPositionAuthority&&enemyCanHit,enemyCanHit,intent:intent.mode,sharedParticipantCount});}
  const keep=new Set(threats.map(enemy=>enemy.id));if(state.combat?.targetId)keep.add(state.combat.targetId);pruneSessions(state,keep);if(state.combat)state.combat.threatIds=[...keep];if(front.enemies.every(enemy=>enemy.dead)){front.cleared=true;if(advanceEnemies)front.clearSeconds+=dt;state.finisher=null;state.combat=null;state.attacking=false;clearSession(state);}return events;
}
/** Shared frontier is many-to-many. Attention changes enemy intent, never participation rights. */
function tickSharedFrontStep(states,front,dt){const ordered=[...states].sort((a,b)=>a.id.localeCompare(b.id)),events=new Map();if(!ordered.length)return events;if(ordered.length===1){events.set(ordered[0].id,tickFront(ordered[0],front,dt));return events;}advanceEnemyClock(front,dt);const eligible=ordered.filter(state=>!state.down&&!state.ended),living=front.enemies.filter(row=>!row.dead);refreshAttention(living,eligible);advanceSharedEnemyFormation(eligible,living,dt,front.stage);for(const state of ordered)events.set(state.id,tickFront(state,front,dt,{advanceEnemies:false,advanceFormation:false,heroPositionAuthority:true,enemyPositionAuthority:false,attentionStates:eligible,sharedParticipantCount:eligible.length}));if(front.enemies.every(enemy=>enemy.dead)){front.cleared=true;front.clearSeconds+=dt;}return events;}

// Tidebreak caps one motor step at 1/30 s. Subdivide real time here instead of
// silently discarding elapsed time on lower-rate clients or server ticks.
function realSteps(dt){
  if(!Number.isFinite(dt)||dt<0||dt>.25)throw new RangeError('Invalid combat real-time delta');
  return dt>0?Math.ceil(dt/(1/60)):0;
}
export function tickFront(state,front,dt,options={}){
  const count=realSteps(dt),events=[];
  for(let i=0;i<count;i++)events.push(...tickFrontStep(state,front,dt/count,options));
  return events;
}
export function tickSharedFront(states,front,dt){
  const count=realSteps(dt),events=new Map(states.map(state=>[state.id,[]]));
  for(let i=0;i<count;i++)for(const [id,rows] of tickSharedFrontStep(states,front,dt/count))events.get(id).push(...rows);
  return events;
}
