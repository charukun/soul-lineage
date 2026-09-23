import {createBattleSnapshot} from './snapshot.js';
import {createJohakyuDomainActor,recoverJohakyuStamina} from '@soul/johakyu-combat/domain';
import {johakyuStageIsActive} from '@soul/johakyu-combat/execution-capability';
import {applyChoreographyImpact} from '@soul/johakyu-combat/choreography';
import {PHASES,compileBattleLoadout,defineTechnique,freeze} from './technique.js';
import {clamp,executionIdentity} from './choreography.js';
import {createJohakyuExchangeState,reduceJohakyuExchange,battleSpacing} from './exchange.js';
import {resolveImpact} from './impact.js';
import {createBattleDecisions} from './decisions.js';
import {isBattleActorAlive as live} from './state.js';
import {createBattleTargeting} from './targeting.js';
import {createBattleLifecycle} from './lifecycle.js';
import {createBattleExecution} from './execution.js';
import {createBattleMovement} from './movement.js';
import {resolveEngagement} from './engagement.js';
const BOUNDS=Object.freeze({minX:-6.75,maxX:6.75,minZ:-5.85,maxZ:5.65});
const clone=value=>structuredClone(value);
const distance=(a,b)=>Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z);
/** Platform-free authority. Hosts own actor eligibility, learning, persistence and encounters. */
export function createJohakyuBattleRuntime({battleId,actors:initial=[],bounds=BOUNDS,blocked=()=>false,recoverStamina=true}={}){
  if(!battleId)throw new TypeError('Battle identity required');
  const actors=new Map(),exchanges=new Map(),seen=new Set(),manualMoves=new Map();
  let time=0,revision=0,serial=0,eventSerial=0,hitstop=0,events=[],trace=[];
  function emit(row){const event={id:`${battleId}:event:${++eventSerial}`,...row,time,authority:'johakyu-battle'};events.push(event);trace.push(event);if(trace.length>240)trace.shift();return event;}
  const loadoutIdentity=loadout=>PHASES.map(phase=>(loadout?.[phase]||[]).map(technique=>`${technique.id}:${technique.stages.map(stage=>`${stage.kind}/${stage.footwork}/${stage.charge}`).join(',')}`).join('>')).join('|');
  function resetLoadoutExecution(actor){cancel(actor,{delay:.06});}
  function upsert(raw){
    let actor=actors.get(raw.id);
    if(!actor){
      const domain=createJohakyuDomainActor({...raw,hp:Math.max(0,raw.hp??100),incapacitated:Boolean(raw.downed||raw.incapacitated)});
      actor={...domain,position:{x:raw.position?.x??0,z:raw.position?.z??0},yaw:raw.yaw||0,action:null,pendingZanshin:false,cursor:{phaseIndex:0,techniqueIndex:0,stageIndex:0,cycle:0},
        readyAt:time+(raw.readyDelay??.25),chainTargetId:null,chainLastAt:null,readSeconds:0,decision:null,decisionUntil:0,posture:0,defenseDebt:0,lastContactAt:-10,staggerUntil:0,impulseVelocity:{x:0,z:0},counterUntil:0,counterTarget:null,downed:Boolean(raw.downed),downedAt:raw.downed?time:null,executionLifecycle:raw.downed?'FALLING':'ACTIVE',executionPoseEvidence:null,executionSocket:null,spawnUntil:time+(raw.spawnSeconds??0),pursuitSeconds:0,pursuitTargetId:null,pursuitReadyAt:0,pursuitUntil:0,pursuitLastRetreatAt:-10,engagement:null};
      actors.set(raw.id,actor);
    }
    const changedWeapon=raw.equipment&&actor.equipment.weapon!==raw.equipment.weapon,wasDowned=actor.downed,wasDead=actor.dead;
    if(changedWeapon&&raw.equipment)resetLoadoutExecution(actor);
    for(const key of ['hp','maxHp','stamina','staminaCap','injuries','dead','downed','position','equipment','ageSeconds','staminaMultiplier','damageScale','mind','stance','zanshin','nonlethal','self','kind','boss','tempo','finisherProfile','targetId','canAttack','canFinish','scope','spawnStyle','recoverStamina','mitigation','pursuit'])if(raw[key]!==undefined)actor[key]=clone(raw[key]);
    actor.stability=raw.stability??({chinshin:.95,seigan:.72,ryu:.65,kosei:.58}[actor.stance]||.7);
    if(raw.downed!==undefined){actor.incapacitated=Boolean(raw.downed||actor.dead);actor.downedAt=raw.downed?(wasDowned?actor.downedAt??time:time):null;if(wasDowned&&!raw.downed){actor.finisherClaimedBy=null;actor.finisherClaimAttackId=null;actor.executionLifecycle='ACTIVE';actor.executionPoseEvidence=null;actor.executionSocket=null;}else if(!wasDowned&&actor.executionLifecycle==='ACTIVE')actor.executionLifecycle='FALLING';}
    if(raw.loadout){
      const nextLoadout=compileBattleLoadout(raw.loadout,actor.equipment.weapon),nextIdentity=loadoutIdentity(nextLoadout);
      if(!changedWeapon&&actor.loadoutIdentity&&actor.loadoutIdentity!==nextIdentity)resetLoadoutExecution(actor);
      actor.loadout=nextLoadout;actor.loadoutIdentity=nextIdentity;
    }
    actor.loadout??=compileBattleLoadout({},actor.equipment.weapon);actor.loadoutIdentity??=loadoutIdentity(actor.loadout);
    if(!live(actor)&&(actor.action||actor.decision||actor.phaseCue||actor.executionSocket))cancel(actor,{delay:0});
    if(wasDowned&&!actor.downed||wasDead&&!actor.dead){cancel(actor,{delay:.06});actor.impulseVelocity={x:0,z:0};actor.staggerUntil=0;actor.executionLifecycle='ACTIVE';}
    return actor;
  }
  function sync(rows){
    const ids=new Set(rows.map(row=>row.id));
    if(ids.size!==rows.length)throw new TypeError('Duplicate battle actor identity');
    for(const [id,actor] of actors)if(!ids.has(id)){cancel(actor,{delay:0});actors.delete(id);manualMoves.delete(id);}
    rows.forEach(upsert);
    for(const [key,state]of exchanges)if(state.pair?.some(id=>!ids.has(id)))exchanges.delete(key);
    reconcileActors();revision++;
    for(const actor of actors.values())refreshEngagement(actor);
  }
   function setMovement(id,input){
     if(!actors.has(id))return false;
     if(!input){manualMoves.delete(id);return true;}
     const x=Number(input.x),z=Number(input.z);
     if(!Number.isFinite(x)||!Number.isFinite(z))return false;
     const length=Math.hypot(x,z),scale=length>1?1/length:1;
     manualMoves.set(id,{x:x*scale,z:z*scale,dash:Boolean(input.dash)});return true;
   }
  function pair(a,b){const key=[a.id,b.id].sort().join('::');if(!exchanges.has(key))exchanges.set(key,createJohakyuExchangeState({sourceId:a.id,targetId:b.id}));return{key,state:exchanges.get(key)};}
  function exchange(a,b,event){const p=pair(a,b),next=reduceJohakyuExchange(p.state,{...event,sourceId:a.id,targetId:b.id});exchanges.set(p.key,next);if(next.mode!==p.state.mode||next.initiativeId!==p.state.initiativeId)emit({type:'exchange',sourceId:a.id,targetId:b.id,...next});return next;}
  const {targetFor,nearestThreatFor,threatened}=createBattleTargeting({actors,getTime:()=>time,distance,live});
  const lifecycle=createBattleLifecycle({actors,getTime:()=>time,getSerial:()=>serial++,battleId,emit,targetFor,threatened,live,clamp,freeze});
  const {downedStateFor,fullyDownForFinisher,settleZanshin}=lifecycle;
  const {node,begin,finish,breakChain,interrupt,cancel}=createBattleExecution({actors,getTime:()=>time,getSerial:()=>++serial,battleId,emit,exchange,pair,fullyDownForFinisher,distance,live,lifecycle});
  const {decide}=createBattleDecisions({actors,manualMoves,bounds,blocked,getTime:()=>time,targetFor,fullyDownForFinisher,distance,node,begin,breakChain,pair,lifecycle,emit});
  function reconcileActors(){
    for(const actor of actors.values()){
      const action=actor.action,target=action&&actors.get(action.targetId);
      const validTarget=target&&(action.finisher?target.downed&&(!target.dead||action.contactResolved):action.contactResolved||live(target));
      if(action&&(!live(actor)||!validTarget))interrupt(actor,!live(actor)?'incapacitated':'target-lost');
      if(!actor.action&&actor.chainTargetId&&!live(actors.get(actor.chainTargetId)))breakChain(actor,'target-lost');
      if(actor.decision&&!actors.has(actor.decision.targetId)){lifecycle.releaseExecution(actor);actor.decision=null;}
      if(actor.executionSocket&&!actor.action?.finisher){
        const victim=actors.get(actor.decision?.targetId);
        if(!live(actor)||!victim?.downed||victim.dead||actor.nonlethal||actor.canFinish===false)lifecycle.releaseExecution(actor);
      }
    }
    lifecycle.reconcile();
  }
  const {move,separate}=createBattleMovement({actors,manualMoves,bounds,blocked,getTime:()=>time,targetFor,distance,live,clamp});
  function refreshEngagement(actor){actor.engagement=resolveEngagement({actor,threat:live(actor)?nearestThreatFor(actor):null,distance});}
  function applyContact(source,execution,samples){
    const target=actors.get(execution.targetId);if(execution.contactResolved||!johakyuStageIsActive(execution)||!target||target.dead)return;
    execution.contactResolved=true;
    if(target.firstInspirationUntil>time){
      emit({type:'inspiration-protected',sourceId:source.id,targetId:target.id,...executionIdentity(execution)});
      return;
    }
    const key=`${execution.id}:${target.id}`;if(seen.has(key))return;seen.add(key);if(seen.size>1024)seen.delete(seen.values().next().value);
    const d=distance(source,target),spacing=battleSpacing(source,target,d);
    if(d>spacing.engagementRange||blocked(source.position,target.position,source)){execution.breakReason=blocked(source.position,target.position,source)?'weapon-blocked':'miss';emit({type:execution.breakReason,sourceId:source.id,targetId:target.id,...executionIdentity(execution),distance:d,reach:spacing.engagementRange});return;}
    const incoming=target.action,progress=incoming?incoming.elapsed/incoming.duration:0;
    const defense=incoming&&johakyuStageIsActive(incoming)&&incoming.targetId===source.id&&['guard','brace','parry'].includes(incoming.kind)&&progress>=.025&&progress<=.92?incoming.kind:null;
    const clash=Boolean(incoming&&incoming.choreography.offense&&!incoming.contactResolved&&incoming.targetId===source.id&&Math.abs(progress-incoming.choreography.contactProgress)<.045&&incoming.kind!=='counter'&&execution.kind!=='counter');
    const observation=samples.find(row=>row.attackId===execution.id&&row.targetId===target.id&&Math.hypot(row.point?.x-target.position.x,row.point?.z-target.position.z)<1.5);
    const point=execution.finisher?observation?.point||{x:target.position.x,y:.42,z:target.position.z}:observation?.point||{x:(source.position.x+target.position.x)/2,y:1.05,z:(source.position.z+target.position.z)/2};
    let impact=resolveImpact({execution,source,target,defense,clash,contactPoint:point,bodyPart:execution.kind==='sweep'?'leftLeg':execution.kind==='back'?'rightArm':'torso',timingError:defense==='parry'?progress-incoming.choreography.contactProgress:0});
    if(execution.technique.source==='trial'&&execution.stageIndex===0&&!impact.blocked&&!target.boss){
      const profile=execution.technique.firstInspirationPresentation,dx=target.position.x-source.position.x,dz=target.position.z-source.position.z,d=Math.max(.001,Math.hypot(dx,dz));
      const massScale=(target.stability??.7)>=1?.45:1,push=Math.max(Math.hypot(impact.knockback.x,impact.knockback.z),profile.firstCastImpulse*massScale);
      impact={...impact,knockback:{x:dx/d*push,z:dz/d*push},stagger:Math.max(impact.stagger,profile.firstCastStaggerSeconds*massScale)};
    }
    if(clash)incoming.contactResolved=true;
    let damage=impact.damage,part=impact.bodyPart,durability=null;
    if(damage>0){
      const wound=applyChoreographyImpact(target,{damage,maxIntegrity:target.maxHp,sourceId:source.id,phase:execution.finisher?'finisher':execution.phase==='uke'?'ha':execution.phase,part});part=wound.part;durability=wound.durability;
      target.hp=Math.max(0,target.hp-damage);
      if(execution.finisher)lifecycle.recordExecuted(target);
      else if(wound.outcome.incapacitated||target.injuries.torso.severity>=.72)lifecycle.recordDowned(target);
      else if(target.hp<=0)target.hp=Math.max(1,target.maxHp*.18);
    }
    const criticalPart=!impact.blocked&&impact.reactionSeverity>=1.02&&['head','leftArm','rightArm','leftLeg','rightLeg'].includes(part);
    const criticalStop=execution.phase==='kyu'||execution.finisher?.118:execution.phase==='ha'?.105:.094;
    const contactHitstop=criticalPart?Math.max(impact.hitstop,criticalStop):impact.hitstop;
    const resolvedImpact=contactHitstop===impact.hitstop?impact:{...impact,hitstop:contactHitstop};
    target.lastContactAt=time;target.defenseDebt=defense?target.defenseDebt+1:0;target.posture=Math.min(100,target.posture+impact.postureDamage);target.stamina=Math.max(0,target.stamina-impact.staminaDamage);
    if(!execution.finisher){target.impulseVelocity.x+=impact.knockback.x;target.impulseVelocity.z+=impact.knockback.z;source.impulseVelocity.x+=impact.sourceImpulse.x;source.impulseVelocity.z+=impact.sourceImpulse.z;}
    target.staggerUntil=Math.max(target.staggerUntil,time+impact.stagger);hitstop=Math.max(hitstop,contactHitstop);
    if(impact.strongParry){source.staggerUntil=Math.max(source.staggerUntil,time+.34);interrupt(source,'strong-parry');exchange(source,target,{type:'parry',strong:true,phase:execution.phase});target.counterUntil=time+impact.counterOpportunity;target.counterTarget=source.id;}
    else if(impact.interrupted&&!defense)interrupt(target,'impact');
    if(impact.guardBreak)interrupt(target,'guard-break');
    if(clash){interrupt(source,'weapon-clash');interrupt(target,'weapon-clash');}
    if(!defense&&!clash)exchange(source,target,{type:'hit',phase:execution.phase,deep:impact.deepHit});
    const type=clash?'clash':defense==='parry'?'parry':defense?'guard':execution.finisher?'finisher':source.side==='party'?'player-hit':'enemy-hit';
    const event=emit({id:key,type,sourceId:source.id,targetId:target.id,...executionIdentity(execution),choreography:execution.choreography,techniqueName:execution.technique.name,skill:execution.technique.name,
      ...resolvedImpact,impact:{...resolvedImpact,damage,bodyPart:part},damage,bodyPart:part,bodyDurability:durability,contactPoint:point,observedContactPoint:observation?.point||null,contactEngine:'shared-contact-anchor',contactDistance:d,contactReach:spacing.engagementRange,
      sourceContactProgress:execution.choreography.contactProgress,defenseContactProgress:incoming?.choreography.contactProgress??null,otherAttackId:clash?incoming.id:null,
      otherKind:clash?incoming.kind:null,otherWeapon:clash?incoming.weapon:null,otherPhase:clash?incoming.phase:null,otherTechniqueId:clash?incoming.techniqueId:null,otherStageIndex:clash?incoming.stageIndex:null,otherContactProgress:clash?incoming.choreography.contactProgress:null,
      exchangeContinuity:pair(source,target).state.continuity,initiativeId:pair(source,target).state.initiativeId});
    target.lastImpact=event;
    if(target.downed||target.dead){interrupt(target,'incapacitated');emit({type:target.dead?'enemy-down':'actor-downed',sourceId:source.id,targetId:target.id,triggerEventId:event.id});}
  }
  function tick(dt,samples){
    hitstop=Math.max(0,hitstop-dt);const delta=dt;time+=dt;revision++;
    reconcileActors();
    for(const a of actors.values()){
      a.moving=false;if((a.recoverStamina??recoverStamina)&&live(a))recoverJohakyuStamina(a,delta);if(time-a.lastContactAt>1.1)a.posture=Math.max(0,a.posture-delta*7);
      if(a.action){a.action.elapsed+=delta;if(a.action.elapsed>=a.action.duration)finish(a);}
      lifecycle.advanceCue(a);
    }
    for(const a of actors.values())if(a.queuedInspiration){
      const request=a.queuedInspiration;a.queuedInspiration=null;
      const target=actors.get(request.targetId);
      if(!live(a)||!target||!live(target)||a.action?.finisher)continue;
      cancel(a,{delay:0});
      a.override={technique:request.technique,stageIndex:0,inspirationPhase:request.phase};
      a.readyAt=time;
      if(!begin(a,target))a.override=null;
    }
    for(const [key,p]of exchanges)if(p.mode==='zanshin'&&!actors.get(p.completedBy)?.action&&time>=(actors.get(p.completedBy)?.readyAt??0))exchanges.set(key,reduceJohakyuExchange(p,{type:'settle'}));
    for(const a of actors.values())decide(a,delta);
    for(const a of actors.values())settleZanshin(a);
    const beforeMove=new Map([...actors.values()].map(a=>[a.id,{...a.position}]));
    for(const a of actors.values())move(a,delta);separate();
    for(const a of actors.values()){
      if(!a.pursuit||!live(a)){a.pursuitSeconds=0;a.pursuitUntil=0;continue;}
      const target=targetFor(a),previous=target&&beforeMove.get(target.id),away=target&&previous
        ?(target.position.x-previous.x)*(previous.x-a.position.x)+(target.position.z-previous.z)*(previous.z-a.position.z):0;
      if(target?.id!==a.pursuitTargetId){a.pursuitSeconds=0;a.pursuitUntil=0;}
      if(target?.side==='enemy'&&(target.action?.footwork==='retreat'||target.decision?.footwork==='retreat')
        &&away>.0001&&target.moving){
        if(time-a.pursuitLastRetreatAt>.28)a.pursuitSeconds=0;
        a.pursuitSeconds=Math.min(1.5,a.pursuitSeconds+delta);
        a.pursuitLastRetreatAt=time;
        // The retreat itself is brief. Keep the opening through the current attack recovery.
        if(a.pursuitSeconds>=.22)a.pursuitUntil=time+1.35;
      }else if(time-a.pursuitLastRetreatAt>.28)a.pursuitSeconds=0;
      a.pursuitTargetId=target?.id||null;
    }
    for(const a of actors.values()){
      const action=a.action;if(!action||!action.choreography.offense||action.contactResolved)continue;
      if(action.elapsed>=action.duration*action.choreography.contactProgress){action.elapsed=action.duration*action.choreography.contactProgress;applyContact(a,action,samples);}
    }
    lifecycle.reconcile();
    for(const actor of actors.values())refreshEngagement(actor);
  }
  const snapshot=createBattleSnapshot({actors,exchanges,battleId,clock:()=>({time,revision,hitstop}),downedStateFor});
  function step(dt=1/60,samples=[]){
    if(!Number.isFinite(dt)||dt<0||dt>.25)throw new RangeError('Invalid combat real-time delta');
    events=[];for(const sample of samples||[]){if(sample?.type!=='ground-pose')continue;const actor=actors.get(sample.actorId);if(actor?.downed)actor.executionPoseEvidence={clip:sample.clip,grounded:sample.grounded===true,vertical:sample.vertical,horizontal:sample.horizontal};}const count=Math.ceil(dt/(1/60));for(let i=0;i<count;i++)tick(dt/count,samples||[]);
    return {frame:snapshot(),events:freeze(clone(events))};
  }
   function queueTechnique(id,technique){const actor=actors.get(id);if(!actor||actor.override||actor.queuedTechnique)return false;actor.queuedTechnique=compileBattleLoadout({jo:technique},actor.equipment.weapon).jo[0];return true;}
   function inspire(id,technique,targetId,phase){
     const actor=actors.get(id),target=actors.get(targetId);
     if(!actor||!live(actor)||!target||!live(target)||actor.action?.finisher||actor.override?.technique.source==='trial'||actor.queuedInspiration||!PHASES.includes(phase))return false;
     const compiled=defineTechnique({...technique,source:'trial'},{weapon:actor.equipment.weapon});
     if(!compiled)return false;
     actor.queuedInspiration={technique:compiled,targetId,phase};return true;
   }
   if(new Set(initial.map(row=>row.id)).size!==initial.length)throw new TypeError('Duplicate battle actor identity');
   function recoverActor(id,{position,hp,injuries,readyDelay=.6}={}){
     const actor=actors.get(id);if(!actor)return false;
     cancel(actor,{delay:0});
     actor.dead=false;actor.downed=false;actor.incapacitated=false;actor.downedAt=null;
     actor.executionLifecycle='ACTIVE';actor.executionPoseEvidence=null;
     actor.finisherClaimedBy=null;actor.finisherClaimAttackId=null;actor.finisherExecutedAt=null;
     actor.hp=hp??actor.maxHp;actor.staggerUntil=0;actor.impulseVelocity={x:0,z:0};
     actor.firstInspirationUntil=0;actor.firstInspirationTechniqueId=null;actor.targetId=null;
     actor.spawnUntil=time;actor.readyAt=time+Math.max(0,readyDelay);
     if(position)actor.position=clone(position);if(injuries)actor.injuries=clone(injuries);
     manualMoves.delete(id);reconcileActors();refreshEngagement(actor);revision++;
     emit({type:'actor-recovered',actorId:id,sourceId:id});return true;
   }
   initial.forEach(upsert);lifecycle.reconcile();
   for(const actor of actors.values())refreshEngagement(actor);
   return Object.freeze({step,sync,recoverActor,setMovement,snapshot,queueTechnique,inspire,actor:id=>actors.get(id),inspect:()=>({frame:snapshot(),trace:freeze(clone(trace)),exchanges:freeze(clone([...exchanges.values()]))})});
}

