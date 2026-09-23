import {createJohakyuDomainActor,recoverJohakyuStamina} from '@soul/johakyu-combat/domain';
import {cancelJohakyuStage,johakyuStageIsActive} from '@soul/johakyu-combat/execution-capability';
import {applyChoreographyImpact} from '@soul/johakyu-combat/choreography';
import {PHASES,PHASE_LABELS,DEFENSIVE_KINDS,compileBattleLoadout,defineTechnique,freeze} from './technique.js';
import {clamp,stagePoseProgress,timelinePhase,executionIdentity} from './choreography.js';
import {createJohakyuExchangeState,reduceJohakyuExchange,battleSpacing,chooseExchangeIntent} from './exchange.js';
import {resolveImpact} from './impact.js';
import {executionSockets} from './execution-socket.js';
import {resolveJohakyuMotion as semanticMotion} from '@soul/johakyu-combat/motion-contract';
import {createBattleTargeting} from './targeting.js';
import {createBattleLifecycle} from './lifecycle.js';
import {createBattleExecution} from './execution.js';
import {createBattleMovement} from './movement.js';
import {resolveEngagement,engagementReady} from './engagement.js';
const BOUNDS=Object.freeze({minX:-6.75,maxX:6.75,minZ:-5.85,maxZ:5.65});
const clone=value=>structuredClone(value);
const distance=(a,b)=>Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z);
const live=a=>!a.dead&&!a.incapacitated&&!a.downed;
/** Platform-free authority. Hosts own actor eligibility, learning, persistence and encounters. */
export function createJohakyuBattleRuntime({battleId,actors:initial=[],bounds=BOUNDS,blocked=()=>false,recoverStamina=true}={}){
  if(!battleId)throw new TypeError('Battle identity required');
  const actors=new Map(),exchanges=new Map(),seen=new Set(),manualMoves=new Map();
  let time=0,revision=0,serial=0,hitstop=0,events=[],trace=[];
  function emit(row){const event={...row,time,authority:'johakyu-battle'};events.push(event);trace.push(event);if(trace.length>240)trace.shift();return event;}
  const loadoutIdentity=loadout=>PHASES.map(phase=>(loadout?.[phase]||[]).map(technique=>`${technique.id}:${technique.stages.map(stage=>`${stage.kind}/${stage.footwork}/${stage.charge}`).join(',')}`).join('>')).join('|');
  function resetLoadoutExecution(actor){
    cancelJohakyuStage(actor.action);actor.action=null;actor.override=null;actor.queuedTechnique=null;actor.chainTargetId=null;actor.chainLastAt=null;actor.phaseCue=null;actor.pendingZanshin=false;actor.decision=null;actor.decisionUntil=0;actor.readSeconds=0;
    actor.cursor={phaseIndex:0,techniqueIndex:0,stageIndex:0,cycle:(actor.cursor?.cycle||0)+1};actor.readyAt=Math.max(time+.06,Number(actor.staggerUntil)||0);
  }
  function upsert(raw){
    let actor=actors.get(raw.id);
    if(!actor){
      const domain=createJohakyuDomainActor({...raw,hp:Math.max(0,raw.hp??100),incapacitated:Boolean(raw.downed||raw.incapacitated)});
      actor={...domain,position:{x:raw.position?.x??0,z:raw.position?.z??0},yaw:raw.yaw||0,action:null,pendingZanshin:false,cursor:{phaseIndex:0,techniqueIndex:0,stageIndex:0,cycle:0},
        readyAt:time+(raw.readyDelay??.25),chainTargetId:null,chainLastAt:null,readSeconds:0,decision:null,decisionUntil:0,posture:0,defenseDebt:0,lastContactAt:-10,staggerUntil:0,impulseVelocity:{x:0,z:0},counterUntil:0,counterTarget:null,downed:Boolean(raw.downed),downedAt:raw.downed?time:null,executionLifecycle:raw.downed?'FALLING':'ACTIVE',executionPoseEvidence:null,executionSocket:null,spawnUntil:time+(raw.spawnSeconds??0),pursuitSeconds:0,pursuitTargetId:null,pursuitReadyAt:0,pursuitUntil:0,pursuitLastRetreatAt:-10,engagement:null};
      actors.set(raw.id,actor);
    }
    const changedWeapon=actor.equipment.weapon!==raw.equipment?.weapon,wasDowned=actor.downed;
    if(changedWeapon&&raw.equipment)resetLoadoutExecution(actor);
    for(const key of ['hp','maxHp','stamina','staminaCap','injuries','dead','downed','position','equipment','ageSeconds','staminaMultiplier','damageScale','mind','stance','zanshin','nonlethal','self','kind','boss','tempo','finisherProfile','targetId','canAttack','canFinish','scope','spawnStyle','recoverStamina','mitigation','pursuit'])if(raw[key]!==undefined)actor[key]=clone(raw[key]);
    actor.stability=raw.stability??({chinshin:.95,seigan:.72,ryu:.65,kosei:.58}[actor.stance]||.7);
    if(raw.downed!==undefined){actor.incapacitated=Boolean(raw.downed);actor.downedAt=raw.downed?(wasDowned?actor.downedAt??time:time):null;if(!raw.downed){actor.finisherClaimedBy=null;actor.finisherClaimAttackId=null;actor.executionLifecycle='ACTIVE';actor.executionPoseEvidence=null;actor.executionSocket=null;}else if(!wasDowned&&actor.executionLifecycle==='ACTIVE')actor.executionLifecycle='FALLING';}
    if(raw.loadout){
      const nextLoadout=compileBattleLoadout(raw.loadout,actor.equipment.weapon),nextIdentity=loadoutIdentity(nextLoadout);
      if(!changedWeapon&&actor.loadoutIdentity&&actor.loadoutIdentity!==nextIdentity)resetLoadoutExecution(actor);
      actor.loadout=nextLoadout;actor.loadoutIdentity=nextIdentity;
    }
    actor.loadout??=compileBattleLoadout({},actor.equipment.weapon);actor.loadoutIdentity??=loadoutIdentity(actor.loadout);
    if(!live(actor)){cancelJohakyuStage(actor.action);actor.action=null;}
    return actor;
  }
  initial.forEach(upsert);
  function sync(rows){const ids=new Set(rows.map(row=>row.id));for(const [id,a] of actors)if(!ids.has(id)){cancelJohakyuStage(a.action);actors.delete(id);manualMoves.delete(id);}rows.forEach(upsert);for(const actor of actors.values())refreshEngagement(actor);}
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
  const {targetFor,nearestThreatFor}=createBattleTargeting({actors,getTime:()=>time,distance,live});
  const {downedStateFor,fullyDownForFinisher,settleZanshin}=createBattleLifecycle({actors,getTime:()=>time,getSerial:()=>serial++,battleId,emit,targetFor,distance,live,clamp,freeze});
  const {node,begin,finish,breakChain,interrupt}=createBattleExecution({actors,getTime:()=>time,getSerial:()=>++serial,battleId,emit,exchange,pair,fullyDownForFinisher,distance,live});
  function decide(actor,dt){
    if(!live(actor)||time<actor.spawnUntil||actor.action||time<actor.staggerUntil)return;
    if(actor.phaseCue?.phase==='zanshin'){
      if(!threatened(actor))return;
      actor.phaseCue=null;actor.pendingZanshin=true;actor.readyAt=time;
    }
    const target=targetFor(actor);
    if(actor.chainTargetId&&(actor.chainTargetId!==target?.id||actor.chainLastAt!==null&&time-actor.chainLastAt>2.5))breakChain(actor,target?'target-changed':'target-lost');
    const downed=!actor.nonlethal&&actor.canFinish!==false?targetFor(actor,{downed:true}):null;
    if(downed&&(!target||distance(actor,target)>2.8)){
      if(downed.executionLifecycle==='FALLING')downedStateFor(downed);
      if(fullyDownForFinisher(downed)&&(!downed.finisherClaimedBy||downed.finisherClaimedBy===actor.id)){
        const socket=executionSockets(downed,{bounds,blocked,actors:[...actors.values()],executor:actor})[0];
        if(socket){
          actor.executionSocket=socket;actor.targetId=downed.id;downed.finisherClaimedBy=actor.id;actor.decision={intent:'execution-approach',footwork:'forward',stopDistance:0,targetId:downed.id};
          downed.executionLifecycle='EXECUTION_APPROACH';
          const gap=distance(actor,{position:socket.position});
          if(gap<=.17&&time>=actor.readyAt){actor.yaw=socket.yaw;downed.executionLifecycle='EXECUTION_LOCK';begin(actor,downed,{finisher:true});return;}
          return;
        }
      }
      if(!target){actor.decision=null;return;}
    }
    if(!target){actor.decision=null;return;}
    actor.targetId=target.id;
    // A committed retreat is read from actual enemy displacement, not its intended stance.
    if(actor.pursuit&&target.side==='enemy'&&actor.pursuitTargetId===target.id&&actor.pursuitUntil>=time
      &&time>=actor.pursuitReadyAt&&time>=actor.readyAt&&actor.canAttack!==false&&actor.stamina>=22
      &&distance(actor,target)>1.46&&distance(actor,target)<4.5&&!blocked(actor.position,target.position,actor)){
      const d=distance(actor,target),spacing=battleSpacing(actor,target,d);
      if(d>spacing.engagementRange){
        // Pursuit closes the gap as locomotion first. The attack action starts only after the shared engagement boundary is crossed.
        actor.decision={...spacing,intent:'pursuit',footwork:'rush',stopDistance:spacing.engagementRange-.04,targetId:target.id};actor.decisionUntil=time+.12;return;
      }
      const kind=actor.equipment.weapon==='fist'?'straight':'dash';
      actor.override={technique:defineTechnique({id:'heart.pursuer',name:'追う者',steps:[{kind,footwork:'rush',charge:'none'}]},{weapon:actor.equipment.weapon}),stageIndex:0};
      if(begin(actor,target)){actor.pursuitSeconds=0;actor.pursuitUntil=0;actor.pursuitReadyAt=time+2.8;emit({type:'pursuit-leap',sourceId:actor.id,targetId:target.id});return;}
      actor.override=null;
    }
    const opposing=target.action,threat=opposing&&opposing.targetId===actor.id&&opposing.choreography.offense&&!opposing.contactResolved?opposing:null;
    if(threat&&time>=actor.readyAt&&threat.elapsed/threat.duration>.15&&distance(actor,target)<battleSpacing(target,actor,distance(actor,target)).engagementRange){
      const current=node(actor),authored=['parry','guard','brace'].includes(current.stage.kind);
      const intent=chooseExchangeIntent({actor,target,exchange:pair(actor,target).state,phase:current.phase,distance:distance(actor,target),threat});
      if(authored||actor.defenseDebt<2&&['intercept','guard-pressure'].includes(intent.intent)){
        const action=begin(actor,target,{reaction:authored?null:intent.intent==='intercept'?'parry':'guard'});
        if(action){const remaining=Math.max(.015,threat.duration*threat.choreography.contactProgress-threat.elapsed);action.elapsed=Math.max(0,action.duration*action.choreography.contactProgress-remaining);return;}
      }
    }
    if(time<actor.readyAt)return;
    const n=node(actor),counter=actor.counterUntil>time&&actor.counterTarget===target.id;
    if(counter&&distance(actor,target)<=battleSpacing(actor,target,distance(actor,target)).engagementRange){begin(actor,target,{reaction:'counter'});return;}
    // A live combo proceeds straight into its next authored stage while the target remains in reach.
    if(actor.chainTargetId===target.id&&actor.chainLastAt!==null&&actor.canAttack!==false&&actor.stamina>=14&&actor.posture<=82&&distance(actor,target)<=battleSpacing(actor,target,distance(actor,target)).engagementRange){
      if(begin(actor,target))return;
    }
    actor.readSeconds+=dt;
    if(!actor.decision||time>=actor.decisionUntil){actor.decision={...chooseExchangeIntent({actor,target,exchange:pair(actor,target).state,phase:n.phase,distance:distance(actor,target),threat,readSeconds:actor.readSeconds,serial:actor.cursor.cycle+actor.cursor.stageIndex}),targetId:target.id};actor.decisionUntil=time+.12;}
    if(actor.decision.intent==='commit'&&actor.canAttack!==false){
      begin(actor,target);}
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
      if(execution.finisher){target.hp=0;target.dead=true;target.downed=true;target.incapacitated=true;target.finisherExecutedAt=time;target.executionLifecycle='EXECUTED';}
      else if(wound.outcome.incapacitated||target.injuries.torso.severity>=.72){if(!target.downed)target.downedAt=time;target.downed=true;target.incapacitated=true;target.hp=0;target.executionLifecycle='FALLING';target.executionPoseEvidence=null;}
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
    for(const victim of actors.values())if(victim.finisherClaimedBy&&!victim.dead){
      const owner=actors.get(victim.finisherClaimedBy);
      if(!owner||!live(owner)||owner.action?.finisher&&owner.action.targetId!==victim.id||!owner.action?.finisher&&owner.decision?.targetId!==victim.id){victim.finisherClaimedBy=null;victim.finisherClaimAttackId=null;victim.executionLifecycle='SETTLED';}
    }
    for(const a of actors.values()){
      a.moving=false;if((a.recoverStamina??recoverStamina)&&live(a))recoverJohakyuStamina(a,delta);if(time-a.lastContactAt>1.1)a.posture=Math.max(0,a.posture-delta*7);
      if(a.action){a.action.elapsed+=delta;if(a.action.elapsed>=a.action.duration)finish(a);}
      if(a.phaseCue&&time>=a.phaseCue.startedAt+a.phaseCue.duration)a.phaseCue=null;
    }
    for(const a of actors.values())if(a.queuedInspiration){
      const request=a.queuedInspiration;a.queuedInspiration=null;
      const target=actors.get(request.targetId);
      if(!live(a)||!target||!live(target))continue;
      if(a.action){cancelJohakyuStage(a.action);a.action=null;}
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
    for(const actor of actors.values())refreshEngagement(actor);
  }
  function actionView(a){
    const action=a.action;if(!action)return null;const progress=clamp(action.elapsed/action.duration);
    return {id:action.id,...executionIdentity(action),name:action.technique.name,targetId:action.targetId,step:action.stageIndex,stageLabel:action.technique.stages[action.stageIndex].label,
      chainLength:action.chainLength,chainLabel:`${PHASE_LABELS[action.phase]||'受'} · ${action.chainLength}連`,cycle:a.cursor.cycle,
      progress,poseProgress:stagePoseProgress(progress,action.choreography),duration:action.duration,choreography:action.choreography,timelinePhase:timelinePhase(progress,action.choreography),
      motion:{supported:true,kind:action.kind,weapon:action.weapon,phase:action.phase,charge:action.charge,footwork:action.footwork,...action.choreography},
      technique:action.technique,legal:true,scope:action.scope,reaction:action.reaction,finisher:action.finisher};
  }
  function snapshot(){
    const rows=[...actors.values()].map(a=>({id:a.id,side:a.side,self:Boolean(a.self),kind:a.kind|| (a.side==='party'?'hero':'enemy'),boss:Boolean(a.boss),position:{...a.position},yaw:a.yaw,
      hp:a.hp,maxHp:a.maxHp,body:Object.fromEntries(Object.entries(a.injuries).map(([part,row])=>[part,{severity:row.severity,durability:Math.round((1-row.severity)*100)}])),
      stamina:{value:a.stamina,cap:a.staminaCap},equipment:{...a.equipment},moving:a.moving,resting:false,dead:a.dead,downed:a.downed,executionState:a.executionLifecycle,executionSocket:a.executionSocket?clone(a.executionSocket):null,executorId:a.finisherClaimedBy||null,downedState:downedStateFor(a),spawnStyle:a.spawnStyle,
      phaseCue:a.phaseCue&&time<a.readyAt?{...a.phaseCue,progress:clamp((time-a.phaseCue.startedAt)/a.phaseCue.duration)}:null,action:actionView(a),exchange:a.decision?{...a.decision}:null,cursor:{...a.cursor},posture:a.posture,engagement:{...a.engagement},combatReady:engagementReady(a.engagement),combatReadyRange:a.engagement?{ready:engagementReady(a.engagement),distance:a.engagement.distance,weaponReach:a.engagement.weaponReach,enterRange:a.engagement.enterRange,exitRange:a.engagement.exitRange}:null,combatReadyTargetId:a.engagement?.threatId||null,stagger:Math.max(0,a.staggerUntil-time),
      impulseVelocity:{...a.impulseVelocity},battleTime:time,hitstop,locomotion:a.decision?{kind:a.decision.footwork}:null,hit:time<a.staggerUntil}));
    return freeze({version:1,authority:'johakyu-battle',battleId,epoch:0,revision,time,hitstop,status:rows.some(a=>a.side==='party'&&!a.dead&&!a.downed)?'battle':'ended',actors:rows,obstacles:[],projectiles:[],exchanges:[...exchanges.values()]});
  }
  function step(dt=1/60,samples=[]){
    if(!Number.isFinite(dt)||dt<0||dt>.25)throw new RangeError('Invalid combat real-time delta');
    events=[];for(const sample of samples||[]){if(sample?.type!=='ground-pose')continue;const actor=actors.get(sample.actorId);if(actor?.downed)actor.executionPoseEvidence={clip:sample.clip,grounded:sample.grounded===true,vertical:sample.vertical,horizontal:sample.horizontal};}const count=Math.ceil(dt/(1/60));for(let i=0;i<count;i++)tick(dt/count,samples||[]);
    return {frame:snapshot(),events:freeze(clone(events))};
  }
   function queueTechnique(id,technique){const actor=actors.get(id);if(!actor||actor.override||actor.queuedTechnique)return false;actor.queuedTechnique=compileBattleLoadout({jo:technique},actor.equipment.weapon).jo[0];return true;}
   function inspire(id,technique,targetId,phase){
     const actor=actors.get(id),target=actors.get(targetId);
     if(!actor||!live(actor)||!target||!live(target)||actor.queuedInspiration||!PHASES.includes(phase))return false;
     const compiled=defineTechnique({...technique,source:'trial'},{weapon:actor.equipment.weapon});
     if(!compiled)return false;
     actor.queuedInspiration={technique:compiled,targetId,phase};return true;
   }
   for(const actor of actors.values())refreshEngagement(actor);
   return Object.freeze({step,sync,setMovement,snapshot,queueTechnique,inspire,actor:id=>actors.get(id),inspect:()=>({frame:snapshot(),trace:freeze(clone(trace)),exchanges:freeze(clone([...exchanges.values()]))})});
}
