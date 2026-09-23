import {enemyWeapon} from './combat-core.js';
import {resolveJohakyuMotion} from '@soul/johakyu-presentation/motion-bindings';

const PARTS=Object.freeze(['head','torso','leftArm','rightArm','leftLeg','rightLeg']);
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function bodyOf(actor){return Object.fromEntries(PARTS.map(part=>{const severity=Math.min(1,Math.max(0,finite(actor.injuries?.[part]?.severity)));return[part,{severity,durability:Math.round((1-severity)*100)}];}));}
function actionOf(actor,pose,battleId){
  if(pose?.battleAction)return pose.battleAction;
  const execution=pose?.execution,truth=pose?.johakyu;
  if(!execution){
    const run=actor.finisher;
    if(!run||pose?.intent!=='finisher')return null;
    return {id:`${battleId}:${actor.id}:finisher:${run.targetId}`,targetId:run.targetId,techniqueId:null,name:'止め',phase:'finisher',step:0,progress:Math.min(1,run.elapsed/run.duration),duration:run.duration,motion:resolveJohakyuMotion({weapon:actor.equipment.weapon,kind:'heavy',phase:'finisher'}),legal:true,scope:'finisher'};
  }
  const weapon=execution.weapon==='greatsword'?'great':execution.weapon;
  const phase=execution.phase||pose.slot||'enemy';
  const motion=resolveJohakyuMotion({weapon,kind:execution.kind,phase:phase==='mind'?'uke':phase,charge:execution.charge||'none'});
  return {id:truth?.attackId||`${battleId}:${actor.id}:${execution.attackId}`,targetId:pose.targetId??null,
    techniqueId:truth?.techniqueId??null,name:truth?.name??null,phase,step:execution.stepIndex??0,
    progress:Math.min(1,Math.max(0,finite(execution.progress,finite(pose.progress)))),duration:finite(execution.motionDuration,1),
    motion,legal:truth?truth.legal:true,scope:truth?.status||'enemy-execution'};
}
function person(actor,battleId,self){
  const pose=actor.combat?.tidebreakPose||actor.combatPose;
  return {id:actor.id,side:'party',self,kind:'hero',position:{x:finite(actor.position?.x),z:finite(actor.position?.z)},yaw:finite(actor.yaw),
    hp:finite(actor.hp),maxHp:finite(actor.maxHp,100),body:bodyOf(actor),
    stamina:{value:finite(actor.stamina),cap:finite(actor.staminaCap,100)},
    equipment:{weapon:actor.equipment?.weapon||'fist',armor:actor.equipment?.armor||'cloth',shield:Boolean(actor.equipment?.shield)},
    moving:Boolean(actor.moving),resting:Boolean(actor.resting&&!actor.moving&&!actor.combat),dead:Boolean(actor.ended),downed:Boolean(actor.down),executionState:actor.down?.executionState||actor.combat?.executionState||'ACTIVE',downedState:actor.down?.downedState||actor.combat?.downedState||null,executionSocket:actor.combat?.executionSocket||null,
    state:pose?.battleState??null,engagement:pose?.engagement??null,combatReady:pose?.combatReady??false,executorId:pose?.executorId??null,
    phaseCue:actor.combat?.phaseCue||null,battleTime:actor.combat?.battleTime??0,hitstop:actor.combat?.hitstop??0,action:actionOf(actor,pose,battleId),hit:Boolean(pose?.stun>0),ageYears:finite(actor.ageYears)};
}
/** Observe the existing main-game authority. No command, RNG, clock or save write. */
export function readRinneBattleFrame(state,front,{peers=[],epoch=0,revision=0}={}){
  if(!state||!front||state.zone!=='frontier')return null;
  const battleId=`${state.id}:${state.generation}:${state.lastDepartureCycle}:${state.returns}:front:${front.stage}`;
  const party=[state,...peers.filter(peer=>peer?.id&&peer.id!==state.id&&peer.zone==='frontier'&&peer.front===state.front)].map(p=>person(p,battleId,p.id===state.id));
  const actors=[...party,...front.enemies.map(enemy=>{
    const pose=enemy.tidebreakPose,action=actionOf(enemy,pose,battleId);
    return {id:enemy.id,side:'enemy',self:false,kind:'enemy',boss:front.stage>=5,
      position:{x:finite(enemy.x),z:finite(enemy.z)},yaw:finite(enemy.yaw),hp:finite(enemy.hp),maxHp:finite(enemy.maxHp,100),
      body:bodyOf(enemy),stamina:null,equipment:{weapon:pose?.weapon==='greatsword'?'great':pose?.weapon||enemyWeapon(front,enemy),shield:Boolean(enemy.shield)},
      state:pose?.battleState??null,engagement:pose?.engagement??null,combatReady:pose?.combatReady??false,executorId:pose?.executorId??null,
      battleTime:front.battleClock?.time??0,hitstop:front.battleClock?.hitstop??0,moving:Boolean(enemy.moving),resting:false,dead:Boolean(enemy.dead),downed:Boolean(enemy.downed),executionState:enemy.executionState||'ACTIVE',downedState:enemy.downedState||null,executionSocket:enemy.executionSocket||null,hit:Boolean(pose?.stun>0),action};
  })];
  if(new Set(actors.map(a=>a.id)).size!==actors.length)throw Error('Duplicate canonical actor identity');
  return freeze({version:1,authority:'johakyu-battle',time:front.battleClock?.time??0,hitstop:front.battleClock?.hitstop??0,battleId,epoch,revision,status:state.ended?'ended':state.down?'rescue':front.cleared?'won':'battle',
    actors,obstacles:(front.terrain?.obstacles||[]).map(row=>({id:row.id,x:row.x,z:row.z,w:row.w,d:row.d,h:row.h})),
    // Host-owned projectile coordinates are data, never independently integrated here.
    projectiles:[state,...peers].flatMap(owner=>(owner.rangedCombat?.projectiles||[]).map(p=>({id:`${owner.id}:${p.id}`,x:p.x,z:p.z}))),
    result:{cleared:Boolean(front.cleared),defeats:finite(state.defeats),returns:finite(state.returns)}});
}
/** Derive event identities from the authoritative executor, never from draw count. */
export function readRinneImpactEvents(events,state,{batchId=null}={}){
  const rows=[];
  for(const [index,event] of (events||[]).entries()){
    if(!['player-hit','enemy-hit','finisher','enemy-down','enemy-downed','downed','life-end','guard','parry','clash','inspiration-start'].includes(event.type))continue;
    if(event.authority==='johakyu-battle'){rows.push({...event});continue;}
    const sourceId=event.sourceId??(event.type==='player-hit'||event.type==='finisher'?state.id:null);
    const targetId=event.targetId??(event.type==='enemy-hit'||event.type==='downed'||event.type==='life-end'?state.id:null);
    const attackId=event.attackId??event.projectileId??null;
    // A semantic batch key is supplied by the main loop; object identity is not
    // a durable network event identity. Missing both means no replayable effect.
    if(!attackId&&!batchId)continue;
    const defense=event.type==='guard'||event.type==='parry',native=event.impact?.execution;
    const sourceMotion=defense&&native?resolveJohakyuMotion({weapon:native.weapon==='greatsword'?'great':native.weapon,kind:native.kind,phase:native.phase==='mind'?'uke':native.phase||'enemy'}):null;
    const contactPoint=event.impact?.point;
    rows.push({id:attackId?`${attackId}:${sourceId}:${targetId}:${event.type}`:`${batchId}:${index}:${event.type}`,
      type:event.type,attackId,sourceId,targetId,damage:finite(event.damage),phase:event.phase??null,bodyPart:event.bodyPart??event.part??null,
      point:contactPoint?Array.from(contactPoint):null,blocked:Boolean(event.blockedByTerrain)||defense,
      ...(defense?{strongParry:event.strongParry===true,exchangeContinuity:event.exchangeContinuity??null,
        contactPoint:contactPoint?{x:contactPoint[0],z:contactPoint[2]}:null,parryDirection:sourceMotion?.deflect??null,
        sourceContactProgress:sourceMotion?.supported?sourceMotion.contactProgress:null,
        defenseContactProgress:resolveJohakyuMotion({weapon:'sword',kind:event.type==='parry'?'parry':'guard',phase:'uke'}).contactProgress}:{}),
      counter:['mind','uke'].includes(event.impact?.execution?.phase)});
  }
  return freeze(rows);
}

