import {createJohakyuDomainActor,recoverJohakyuStamina} from '@soul/johakyu-combat/domain';
import {beginJohakyuStage,cancelJohakyuStage,johakyuStageIsActive} from '@soul/johakyu-combat/execution-capability';
import {applyChoreographyImpact,combatBodyOutcome} from '@soul/johakyu-combat/choreography';
import {PHASES,PHASE_LABELS,DEFENSIVE_KINDS,compileBattleLoadout,defineTechnique,freeze} from './technique.js';
import {clamp,stageChoreography,stagePoseProgress,timelinePhase,executionIdentity} from './choreography.js';
import {createJohakyuExchangeState,reduceJohakyuExchange,battleSpacing,chooseExchangeIntent,footworkVelocity,moveWithResistance} from './exchange.js';
import {resolveImpact} from './impact.js';
import {resolveJohakyuMotion as semanticMotion} from '@soul/johakyu-combat/motion-contract';
const BOUNDS=Object.freeze({minX:-6.75,maxX:6.75,minZ:-5.85,maxZ:5.65});
const SPEED={stay:0,forward:.85,chase:1.35,rush:1.65,retreat:1.05,sideL:.85,sideR:.85,orbitL:.65,orbitR:.65,cross:.85,spiral:.85};
const clone=value=>structuredClone(value);
const distance=(a,b)=>Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z);
const live=a=>!a.dead&&!a.incapacitated&&!a.downed;
/** Platform-free authority. Hosts own actor eligibility, learning, persistence and encounters. */
export function createJohakyuBattleRuntime({battleId,actors:initial=[],bounds=BOUNDS,blocked=()=>false,recoverStamina=true}={}){
  if(!battleId)throw new TypeError('Battle identity required');
  const actors=new Map(),exchanges=new Map(),seen=new Set();
  let time=0,revision=0,serial=0,hitstop=0,events=[],trace=[];
  function emit(row){const event={...row,time,authority:'johakyu-battle'};events.push(event);trace.push(event);if(trace.length>240)trace.shift();return event;}
  function upsert(raw){
    let actor=actors.get(raw.id);
    if(!actor){
      const domain=createJohakyuDomainActor({...raw,hp:Math.max(0,raw.hp??100),incapacitated:Boolean(raw.downed||raw.incapacitated)});
      actor={...domain,position:{x:raw.position?.x??0,z:raw.position?.z??0},yaw:raw.yaw||0,action:null,cursor:{phaseIndex:0,techniqueIndex:0,stageIndex:0,cycle:0},
        readyAt:time+(raw.readyDelay??.25),readSeconds:0,decision:null,decisionUntil:0,posture:0,defenseDebt:0,lastContactAt:-10,staggerUntil:0,impulseVelocity:{x:0,z:0},counterUntil:0,counterTarget:null,downed:Boolean(raw.downed),downedAt:raw.downed?time:null,spawnUntil:time+(raw.spawnSeconds??0)};
      actors.set(raw.id,actor);
    }
    const changedWeapon=actor.equipment.weapon!==raw.equipment?.weapon,wasDowned=actor.downed;
    if(changedWeapon&&raw.equipment){cancelJohakyuStage(actor.action);actor.action=null;actor.override=null;actor.cursor={phaseIndex:0,techniqueIndex:0,stageIndex:0,cycle:actor.cursor.cycle+1};}
    for(const key of ['hp','maxHp','stamina','staminaCap','injuries','dead','downed','position','equipment','ageSeconds','staminaMultiplier','damageScale','mind','stance','zanshin','nonlethal','self','kind','boss','tempo','finisherProfile','targetId','canAttack','canFinish','scope','spawnStyle','recoverStamina','mitigation'])if(raw[key]!==undefined)actor[key]=clone(raw[key]);
    actor.stability=raw.stability??({chinshin:.95,seigan:.72,ryu:.65,kosei:.58}[actor.stance]||.7);
    if(raw.downed!==undefined){actor.incapacitated=Boolean(raw.downed);actor.downedAt=raw.downed?(wasDowned?actor.downedAt??time:time):null;}
    if(raw.loadout){actor.loadout=compileBattleLoadout(raw.loadout,actor.equipment.weapon);}
    actor.loadout??=compileBattleLoadout({},actor.equipment.weapon);
    if(!live(actor)){cancelJohakyuStage(actor.action);actor.action=null;}
    return actor;
  }
  initial.forEach(upsert);
  function sync(rows){const ids=new Set(rows.map(row=>row.id));for(const [id,a] of actors)if(!ids.has(id)){cancelJohakyuStage(a.action);actors.delete(id);}rows.forEach(upsert);}
  function pair(a,b){const key=[a.id,b.id].sort().join('::');if(!exchanges.has(key))exchanges.set(key,createJohakyuExchangeState({sourceId:a.id,targetId:b.id}));return{key,state:exchanges.get(key)};}
  function exchange(a,b,event){const p=pair(a,b),next=reduceJohakyuExchange(p.state,{...event,sourceId:a.id,targetId:b.id});exchanges.set(p.key,next);if(next.mode!==p.state.mode||next.initiativeId!==p.state.initiativeId)emit({type:'exchange',sourceId:a.id,targetId:b.id,...next});return next;}
  function targetFor(actor,{downed=false}={}){return [...actors.values()].filter(a=>a.side!==actor.side&&!a.dead&&(downed?a.downed:live(a)&&time>=a.spawnUntil)).sort((a,b)=>Number(b.id===actor.targetId)-Number(a.id===actor.targetId)||distance(actor,a)-distance(actor,b)||a.id.localeCompare(b.id))[0]||null;}
  function node(actor){const c=actor.cursor,phase=PHASES[c.phaseIndex],chain=actor.loadout[phase],technique=chain[Math.min(c.techniqueIndex,chain.length-1)];return {phase,chain,technique,stage:technique.stages[Math.min(c.stageIndex,technique.stages.length-1)]};}
  function begin(actor,target,{reaction=null,finisher=false}={}){
    if(!reaction&&!finisher&&!actor.override&&actor.queuedTechnique){actor.override={technique:actor.queuedTechnique,stageIndex:0};actor.queuedTechnique=null;}
    const n=node(actor),technique=reaction?defineTechnique({id:`reaction.${reaction}`,name:reaction==='parry'?'弾き':reaction==='counter'?'返し':'受け',steps:[{kind:reaction,footwork:reaction==='counter'?'chase':'stay',charge:'none'}]},{weapon:actor.equipment.weapon}):finisher?defineTechnique({id:'finisher.execution',name:'トドメ',rhythm:'weight',steps:[{kind:actor.equipment.weapon==='fist'?'bash':'heavy',footwork:'stay',charge:'breath'}]},{weapon:actor.equipment.weapon}):actor.override?.technique||n.technique;
    const stage=reaction||finisher?technique.stages[0]:actor.override?technique.stages[actor.override.stageIndex]:n.stage,phase=finisher?'finisher':reaction?'uke':actor.override?'one':n.phase;
    const baseChoreography=stageChoreography(technique,stage,{weapon:actor.equipment.weapon,tempo:finisher?1:actor.tempo||1,chainLength:finisher?1:n.chain.length});
    const finisherScale=actor.finisherProfile?.durationScale||({sokudan:.9,kakudan:1,danzetsu:1.1}[actor.finisherProfile]||1);
    const choreography=finisher?freeze({...baseChoreography,duration:Math.max(1.7,Math.min(2.3,2*finisherScale))}):baseChoreography;
    const execution={id:`${battleId}:${actor.id}:${++serial}`,actorId:actor.id,targetId:target.id,techniqueId:technique.id,technique,stageIndex:stage.stageIndex,
      kind:stage.kind,footwork:stage.footwork,charge:stage.charge,phase,weapon:actor.equipment.weapon,chainId:`${actor.id}:${actor.cursor.cycle}:${n.phase}`,techniqueIndex:actor.cursor.techniqueIndex,
      chainLength:n.chain.length,choreography,elapsed:0,duration:choreography.duration,contactResolved:false,reaction,finisher,scope:technique.source==='trial'?'trial':actor.scope||'equipped'};
    if(!semanticMotion(execution).supported){actor.readyAt=time+.5;emit({type:'execution-blocked',sourceId:actor.id,targetId:target.id,...executionIdentity(execution),reason:'unsupported-stage'});return null;}
    const staminaBefore=actor.stamina,receipt=beginJohakyuStage(actor,execution,{weapon:execution.weapon,phase,techniqueId:technique.id,...stage,staminaMultiplier:actor.staminaMultiplier??1});
    if(!receipt.allowed){actor.readyAt=time+.35;emit({type:'execution-blocked',sourceId:actor.id,targetId:target.id,...executionIdentity(execution),reason:receipt.reason});return null;}
    execution.paid=receipt.paid;actor.action=execution;actor.phaseCue=null;actor.decision=null;actor.readSeconds=0;
    if(!reaction&&!finisher){const p=pair(actor,target).state;if(p.mode!=='pressure')exchange(actor,target,{type:'normal-start',phase:n.phase,seeded:true});exchange(actor,target,{type:'commit',phase:n.phase});}
    if(reaction==='counter')exchange(actor,target,{type:'counter-start'});
    emit({type:finisher?'finisher-start':reaction?'reaction-start':'stage-start',sourceId:actor.id,actorId:actor.id,targetId:target.id,...executionIdentity(execution),staminaBefore,staminaPaid:receipt.paid});return execution;
  }
  function finish(actor){
    const action=actor.action;if(!action)return;emit({type:'stage-complete',sourceId:actor.id,targetId:action.targetId,...executionIdentity(action)});cancelJohakyuStage(action);actor.action=null;actor.readyAt=time+.055;
    if(action.finisher){emit({type:'finisher-complete',sourceId:actor.id,targetId:action.targetId,...executionIdentity(action)});return;}
    if(action.phase==='one'){actor.override.stageIndex++;if(actor.override.stageIndex>=actor.override.technique.stages.length){actor.override=null;actor.readyAt=time+.45;emit({type:'technique-complete',sourceId:actor.id,targetId:action.targetId,...executionIdentity(action)});}return;}
    if(action.reaction){if(action.reaction==='counter'){actor.counterUntil=0;const target=actors.get(action.targetId);if(target)exchange(actor,target,{type:'counter-complete'});}return;}
    const c=actor.cursor,n=node(actor);c.stageIndex++;
    if(c.stageIndex>=n.technique.stages.length){c.stageIndex=0;c.techniqueIndex++;const opponent=actors.get(action.targetId);if(opponent){exchange(actor,opponent,{type:'offense-complete',phase:action.phase});actor.readyAt=time+.46;if(action.phase==='kyu'||actor.stamina<40||actor.mind?.spacing>.25)actor.decision={intent:'disengage',footwork:'retreat',targetId:opponent.id,stopDistance:battleSpacing(actor,opponent,distance(actor,opponent)).engagementRange+.3};}emit({type:'technique-complete',sourceId:actor.id,targetId:action.targetId,...executionIdentity(action)});
      if(c.techniqueIndex>=n.chain.length){c.techniqueIndex=0;c.phaseIndex=(c.phaseIndex+1)%3;emit({type:'phase-change',actorId:actor.id,phase:PHASES[c.phaseIndex]});
        if(c.phaseIndex===0){c.cycle++;actor.readyAt=time+({breath:.24,pursuit:.28,guard:.38}[actor.zanshin]||.32);const target=actors.get(action.targetId);if(target)exchange(actor,target,{type:'kyu-complete',phase:'kyu'});emit({type:'zanshin',actorId:actor.id});}
      }
    }
  }
  function interrupt(actor,reason){const action=actor.action;if(!action)return;cancelJohakyuStage(action);actor.action=null;actor.override=null;actor.cursor={phaseIndex:0,techniqueIndex:0,stageIndex:0,cycle:actor.cursor.cycle+1};actor.readyAt=Math.max(actor.readyAt,time+.22);const target=actors.get(action.targetId);if(target)exchange(actor,target,{type:'interrupted',phase:action.phase});emit({type:'interrupted',sourceId:actor.id,targetId:action.targetId,reason,...executionIdentity(action)});}
  function decide(actor,dt){
    if(!live(actor)||time<actor.spawnUntil||actor.action||time<actor.staggerUntil)return;
    const target=targetFor(actor),downed=!actor.nonlethal&&actor.canFinish!==false?targetFor(actor,{downed:true}):null;
    if(downed&&(!target||distance(actor,target)>2.8)){
      if(distance(actor,downed)<=1.9&&time>=actor.readyAt&&time-(downed.downedAt??time)>=.4){begin(actor,downed,{finisher:true});return;}
      if(!target){actor.decision={intent:'approach',footwork:'forward',stopDistance:1.8,targetId:downed.id};return;}
    }
    if(!target){actor.decision=null;return;}
    actor.targetId=target.id;
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
    actor.readSeconds+=dt;
    if(!actor.decision||time>=actor.decisionUntil){actor.decision={...chooseExchangeIntent({actor,target,exchange:pair(actor,target).state,phase:n.phase,distance:distance(actor,target),threat,readSeconds:actor.readSeconds,serial:actor.cursor.cycle+actor.cursor.stageIndex}),targetId:target.id};actor.decisionUntil=time+.12;}
    if(actor.decision.intent==='commit'&&actor.canAttack!==false){
      begin(actor,target);}
  }
  function move(actor,dt){
    const before={...actor.position};moveWithResistance(actor,dt,{bounds,blocked});
    if(!live(actor)||time<actor.staggerUntil)return;
    const a=actor.action,target=actors.get(a?.targetId||actor.decision?.targetId);if(!target)return;
    const footwork=a?.footwork||actor.decision?.footwork||'stay',speed=SPEED[footwork]??1,d=distance(actor,target),spacing=battleSpacing(actor,target,d);
    const movement=footworkVelocity(footwork,actor.position,target.position,speed*(combatBodyOutcome(actor).movementScale)*(a?.chainLength>1&&['forward','chase','rush'].includes(footwork)?1.12:1));
    let scale=dt;const radial=(movement.x*(target.position.x-actor.position.x)+movement.z*(target.position.z-actor.position.z))/Math.max(.001,d);
    const stop=actor.decision?.stopDistance??spacing.preferredSpacing;
    if(radial>0)scale=Math.min(dt,Math.max(0,d-stop)/Math.max(.001,radial));
    if(footwork==='retreat'&&actor.decision?.stopDistance)scale=Math.min(dt,Math.max(0,stop-d)/Math.max(.001,speed));
    const next={x:clamp(actor.position.x+movement.x*scale,bounds.minX,bounds.maxX),z:clamp(actor.position.z+movement.z*scale,bounds.minZ,bounds.maxZ)};
    if(!blocked(actor.position,next,actor))actor.position=next;
    actor.approachSpeed=Math.max(0,radial);actor.moving=Math.hypot(actor.position.x-before.x,actor.position.z-before.z)>.0001;actor.yaw=Math.atan2(target.position.x-actor.position.x,target.position.z-actor.position.z);
  }
  function separate(){const rows=[...actors.values()].filter(live);for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){const a=rows[i],b=rows[j],d=distance(a,b);if(d>=1.46)continue;const v=d>.001?{x:(b.position.x-a.position.x)/d,z:(b.position.z-a.position.z)/d}:{x:1,z:0},push=(1.46-d)/2;for(const [actor,sign]of [[a,-1],[b,1]]){const next={x:actor.position.x+v.x*push*sign,z:actor.position.z+v.z*push*sign};if(!blocked(actor.position,next,actor))actor.position=next;}}}
  function applyContact(source,execution,samples){
    const target=actors.get(execution.targetId);if(execution.contactResolved||!johakyuStageIsActive(execution)||!target||target.dead)return;
    execution.contactResolved=true;
    const key=`${execution.id}:${target.id}`;if(seen.has(key))return;seen.add(key);if(seen.size>1024)seen.delete(seen.values().next().value);
    const d=distance(source,target),spacing=battleSpacing(source,target,d);
    if(d>spacing.engagementRange||blocked(source.position,target.position,source)){emit({type:blocked(source.position,target.position,source)?'weapon-blocked':'miss',sourceId:source.id,targetId:target.id,...executionIdentity(execution),distance:d,reach:spacing.engagementRange});return;}
    const incoming=target.action,progress=incoming?incoming.elapsed/incoming.duration:0;
    const defense=incoming&&johakyuStageIsActive(incoming)&&incoming.targetId===source.id&&['guard','brace','parry'].includes(incoming.kind)&&progress>=.025&&progress<=.92?incoming.kind:null;
    const clash=Boolean(incoming&&incoming.choreography.offense&&!incoming.contactResolved&&incoming.targetId===source.id&&Math.abs(progress-incoming.choreography.contactProgress)<.045&&incoming.kind!=='counter'&&execution.kind!=='counter');
    const observation=samples.find(row=>row.attackId===execution.id&&row.targetId===target.id&&Math.hypot(row.point?.x-target.position.x,row.point?.z-target.position.z)<1.5);
    const point={x:(source.position.x+target.position.x)/2,y:1.05,z:(source.position.z+target.position.z)/2};
    const impact=resolveImpact({execution,source,target,defense,clash,contactPoint:point,bodyPart:execution.kind==='sweep'?'leftLeg':execution.kind==='back'?'rightArm':'torso',timingError:defense==='parry'?progress-incoming.choreography.contactProgress:0});
    if(clash)incoming.contactResolved=true;
    let damage=impact.damage,part=impact.bodyPart,durability=null;
    if(damage>0){
      const wound=applyChoreographyImpact(target,{damage,maxIntegrity:target.maxHp,sourceId:source.id,phase:execution.finisher?'finisher':execution.phase==='uke'?'ha':execution.phase,part});part=wound.part;durability=wound.durability;
      target.hp=Math.max(0,target.hp-damage);
      if(execution.finisher){target.hp=0;target.dead=true;target.downed=false;target.incapacitated=true;}
      else if(wound.outcome.incapacitated||target.injuries.torso.severity>=.72){if(!target.downed)target.downedAt=time;target.downed=true;target.incapacitated=true;target.hp=0;}
      else if(target.hp<=0)target.hp=Math.max(1,target.maxHp*.18);
    }
    target.lastContactAt=time;target.defenseDebt=defense?target.defenseDebt+1:0;target.posture=Math.min(100,target.posture+impact.postureDamage);target.stamina=Math.max(0,target.stamina-impact.staminaDamage);
    target.impulseVelocity.x+=impact.knockback.x;target.impulseVelocity.z+=impact.knockback.z;source.impulseVelocity.x+=impact.sourceImpulse.x;source.impulseVelocity.z+=impact.sourceImpulse.z;
    target.staggerUntil=Math.max(target.staggerUntil,time+impact.stagger);hitstop=Math.max(hitstop,impact.hitstop);
    if(impact.strongParry){source.staggerUntil=Math.max(source.staggerUntil,time+.34);interrupt(source,'strong-parry');exchange(source,target,{type:'parry',strong:true,phase:execution.phase});target.counterUntil=time+impact.counterOpportunity;target.counterTarget=source.id;}
    else if(impact.interrupted&&!defense)interrupt(target,'impact');
    if(impact.guardBreak)interrupt(target,'guard-break');
    if(clash){interrupt(source,'weapon-clash');interrupt(target,'weapon-clash');}
    if(!defense&&!clash)exchange(source,target,{type:'hit',phase:execution.phase,deep:impact.deepHit});
    const type=clash?'clash':defense==='parry'?'parry':defense?'guard':execution.finisher?'finisher':source.side==='party'?'player-hit':'enemy-hit';
    const event=emit({id:key,type,sourceId:source.id,targetId:target.id,...executionIdentity(execution),choreography:execution.choreography,techniqueName:execution.technique.name,skill:execution.technique.name,
      ...impact,impact:{...impact,damage,bodyPart:part},damage,bodyPart:part,bodyDurability:durability,contactPoint:point,observedContactPoint:observation?.point||null,contactEngine:'shared-contact-anchor',contactDistance:d,contactReach:spacing.engagementRange,
      sourceContactProgress:execution.choreography.contactProgress,defenseContactProgress:incoming?.choreography.contactProgress??null,otherAttackId:clash?incoming.id:null,
      exchangeContinuity:pair(source,target).state.continuity,initiativeId:pair(source,target).state.initiativeId});
    target.lastImpact=event;
    if(target.downed||target.dead){interrupt(target,'incapacitated');emit({type:target.dead?'enemy-down':'actor-downed',sourceId:source.id,targetId:target.id,triggerEventId:event.id});}
  }
  function tick(dt,samples){
    const held=Math.min(dt,hitstop);hitstop-=held;const delta=dt-held;time+=delta;revision++;
    for(const a of actors.values()){
      a.moving=false;if((a.recoverStamina??recoverStamina)&&live(a))recoverJohakyuStamina(a,delta);if(time-a.lastContactAt>1.1)a.posture=Math.max(0,a.posture-delta*7);
      if(a.action){a.action.elapsed+=delta;if(a.action.elapsed>=a.action.duration)finish(a);}
    }
    for(const [key,p]of exchanges)if(p.mode==='zanshin'&&!actors.get(p.completedBy)?.action&&time>=(actors.get(p.completedBy)?.readyAt??0))exchanges.set(key,reduceJohakyuExchange(p,{type:'settle'}));
    for(const a of actors.values())decide(a,delta);
    for(const a of actors.values())move(a,delta);separate();
    for(const a of actors.values()){
      const action=a.action;if(!action||!action.choreography.offense||action.contactResolved)continue;
      if(action.elapsed>=action.duration*action.choreography.contactProgress){action.elapsed=action.duration*action.choreography.contactProgress;applyContact(a,action,samples);}
    }
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
      stamina:{value:a.stamina,cap:a.staminaCap},equipment:{...a.equipment},moving:a.moving,resting:false,dead:a.dead,downed:a.downed,spawnStyle:a.spawnStyle,
      phaseCue:a.phaseCue&&time<a.readyAt?{...a.phaseCue,progress:clamp((time-a.phaseCue.startedAt)/a.phaseCue.duration)}:null,action:actionView(a),exchange:a.decision?{...a.decision}:null,cursor:{...a.cursor},posture:a.posture,stagger:Math.max(0,a.staggerUntil-time),
      impulseVelocity:{...a.impulseVelocity},battleTime:time,hitstop,locomotion:a.decision?{kind:a.decision.footwork}:null,hit:time<a.staggerUntil}));
    return freeze({version:1,authority:'johakyu-battle',battleId,epoch:0,revision,time,hitstop,status:rows.some(a=>a.side==='party'&&!a.dead&&!a.downed)?'battle':'ended',actors:rows,obstacles:[],projectiles:[],exchanges:[...exchanges.values()]});
  }
  function step(dt=1/60,samples=[]){
    if(!Number.isFinite(dt)||dt<0||dt>.25)throw new RangeError('Invalid combat real-time delta');
    events=[];const count=Math.ceil(dt/(1/60));for(let i=0;i<count;i++)tick(dt/count,samples||[]);
    return {frame:snapshot(),events:freeze(clone(events))};
  }
  function queueTechnique(id,technique){const actor=actors.get(id);if(!actor||actor.override||actor.queuedTechnique)return false;actor.queuedTechnique=compileBattleLoadout({jo:technique},actor.equipment.weapon).jo[0];return true;}
  return Object.freeze({step,sync,snapshot,queueTechnique,actor:id=>actors.get(id),inspect:()=>({frame:snapshot(),trace:freeze(clone(trace)),exchanges:freeze(clone([...exchanges.values()]))})});
}
