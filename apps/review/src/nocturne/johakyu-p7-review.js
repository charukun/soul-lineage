import {applyJohakyuImpactOnce,createJohakyuBattle,createJohakyuCheckpoint,johakyuActorCapability,recoverJohakyuStamina,restoreJohakyuCheckpoint,selectReachableTarget} from '@soul/johakyu-combat/domain';
import {resolveJohakyuLocomotion,resolveJohakyuMotion} from '@soul/johakyu-combat/motion-contract';
import {addTechniqueToReviewChain,compileTechniqueComposition,createReviewTechniqueComposition,reviewChainLabel,techniqueFromCombatForm} from '@soul/johakyu-combat/technique-composition';
import {johakyuExchangeIntent,isDeepJohakyuExchangeHit,classifyJohakyuParry,johakyuExchangeRestartActors,createJohakyuExchangeState,johakyuExchangeSnapshot,johakyuExchangeHudState,reduceJohakyuExchange} from '@soul/johakyu-combat/exchange-policy';

import {cancelJohakyuStage,johakyuStageCapability} from '@soul/johakyu-combat/execution-capability';
import {beginReviewStage,reviewTechniqueCapability,reviewStageCanResolve} from './johakyu-p7-execution.js';
import {BURST_CADENCE,burstCompositionFor,burstStageDuration,burstSettleSeconds} from './johakyu-burst-cadence.js';

const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const PHASES=Object.freeze(['jo','ha','kyu']);
const PHASE_LABELS=Object.freeze({jo:'序',ha:'破',kyu:'急'});
const PART_LABELS=Object.freeze({head:'頭',torso:'胴',leftArm:'左腕',rightArm:'右腕',leftLeg:'左脚',rightLeg:'右脚'});
const MODES=Object.freeze({duel:'1v1',oneVsThree:'1v3'}),RESPAWN_DELAY_SECONDS=3,ENCOUNTER_MIN_SECONDS=5,ENCOUNTER_TARGET_SECONDS=10,ENCOUNTER_MAX_SECONDS=15;
const LAYOUT=Object.freeze({hero:{x:0,z:.35,yaw:0},'enemy-a':{x:0,z:2.25,yaw:Math.PI},'enemy-b':{x:-1.75,z:2.8,yaw:Math.PI},'enemy-c':{x:1.75,z:2.8,yaw:Math.PI}});
const TARGETS=Object.freeze({hero:['enemy-a','enemy-b','enemy-c'],'enemy-a':['hero'],'enemy-b':['hero'],'enemy-c':['hero']});
const KIND_DAMAGE=Object.freeze({slash:7,back:7,thrust:8,pierce:9,heavy:14,diagonal:9,sweep:8,counter:10,bash:7,pommel:6});
const RHYTHM_SECONDS=Object.freeze({sharp:.58,flow:.66,weight:.82,elastic:.64,seamless:.54});
const CONTACT_REACH=2.35,BODY_CLEARANCE=1.46,FIGHTING_SPACING=1.92,DEEP_ENTRY_SPACING=1.72,ENGAGE_DISTANCE=2.24,DISENGAGE_DISTANCE=3.05,COUNTER_PRESS_DISTANCE=2.08;
const RECOVERY_SECONDS=Object.freeze({miss:.62,blocked:.52,parried:.78,countered:.88,'hit-before-contact':.42,hit:.28});
const REACTION_SECONDS=Object.freeze({guard:.42,parry:.38,counter:.52}),HEAVY_THREATS=new Set(['heavy','sweep','bash','pommel']);
const DEFENSE_WINDOW=Object.freeze({guard:[.12,.92],brace:[.1,.96],parry:[.12,.9]});
const FOOTWORK_SPEED=Object.freeze({stay:0,forward:.72,chase:1.08,rush:1.5,retreat:.78,sideL:.7,sideR:.7,orbitL:.58,orbitR:.58,cross:.82,spiral:.9,counterL:1.08,counterR:1.08});

function buildComposition(rows,weapon='sword'){
  const composition=createReviewTechniqueComposition();
  for(const [phase,techniques] of Object.entries(rows))for(const [id,name] of techniques)addTechniqueToReviewChain(composition,phase,techniqueFromCombatForm(id,{weapon,name}));
  return compileTechniqueComposition(composition,{weapon});
}
const HERO_COMPOSITION=buildComposition({
  jo:[['action.feint','誘い'],['action.side-step','外し歩']],
  ha:[['action.guard-step','受け流し歩法'],['action.counter','返し']],
  kyu:[['action.crash','打ち崩し'],['action.precision','一点通し']],
});
const ENEMY_COMPOSITION=buildComposition({
  jo:[['basic.sword','剣の型']],ha:[['basic.sword','剣の型']],kyu:[['basic.sword','剣の型']],
});
const equippedCompositions=new Map();

function actorRows(mode){const rows=[{id:'hero',side:'party',hp:125,maxHp:125,stamina:100,staminaCap:100,seed:73917,generation:4},{id:'enemy-a',side:'enemy',hp:mode==='duel'?150:100,maxHp:mode==='duel'?150:100,stamina:100,staminaCap:100,seed:8101,generation:1}];if(mode==='oneVsThree')rows.push({id:'enemy-b',side:'enemy',hp:82,maxHp:82,stamina:96,staminaCap:100,seed:8102,generation:1},{id:'enemy-c',side:'enemy',hp:108,maxHp:108,stamina:100,staminaCap:100,seed:8103,generation:1});return rows.map(row=>({...row,equipment:{weapon:'sword',armor:row.side==='party'?'heavy':'cloth',shield:false}}));}
function bodyView(actor){return Object.fromEntries(Object.entries(actor.injuries).map(([part,row])=>{const severity=Math.min(1,Math.max(0,Number(row.severity)||0));return[part,{severity,durability:Math.round((1-severity)*100),label:PART_LABELS[part]}];}));}
function selectTarget(battle,id){for(const candidate of TARGETS[id]){const actor=battle.actors.get(candidate);if(actor&&!actor.dead&&!actor.incapacitated)return actor;}return null;}
function compositionFor(actor,comboStyle='composed'){
  if(comboStyle==='burst')return burstCompositionFor(actor.equipment.weapon);
  const canonical=actor.side==='party'?HERO_COMPOSITION:ENEMY_COMPOSITION,weapon=actor.equipment.weapon;
  if(weapon==='sword')return canonical;
  const key=`${actor.side}:${weapon}`;
  if(!equippedCompositions.has(key)){
    const rows=Object.fromEntries(Object.entries(canonical).map(([phase,chain])=>[phase,chain.map(technique=>[technique.id.startsWith('basic.')?`basic.${weapon}`:technique.id,technique.name])]));
    equippedCompositions.set(key,buildComposition(rows,weapon));
  }
  return equippedCompositions.get(key);
}
function cursorState(comboStyle='composed'){return{comboStyle,phaseIndex:0,techniqueIndex:0,stageIndex:0,cycle:0};}
function nodeFor(actor,cursor){
  const composition=compositionFor(actor,cursor.comboStyle),phase=PHASES[cursor.phaseIndex],chain=composition[phase],technique=chain[cursor.techniqueIndex],stage=technique?.stages?.[cursor.stageIndex];
  if(!technique||!stage)throw new Error('Invalid technique composition cursor');
  return{phase,chain,technique,stage};
}
function advanceCursor(actor,cursor){
  const before=nodeFor(actor,cursor);cursor.stageIndex++;
  if(cursor.stageIndex>=before.technique.stages.length){cursor.stageIndex=0;cursor.techniqueIndex++;
    if(cursor.techniqueIndex>=before.chain.length){cursor.techniqueIndex=0;cursor.phaseIndex++;
      if(cursor.phaseIndex>=PHASES.length){cursor.phaseIndex=0;cursor.cycle++;}}}
  return{before,after:nodeFor(actor,cursor)};
}
function stageDuration(technique,stage,comboStyle){if(comboStyle==='burst')return burstStageDuration(technique,stage);const base=RHYTHM_SECONDS[technique.rhythm]||.66,kindScale=stage.kind==='heavy'?1.22:(['ready','guard','brace'].includes(stage.kind)?.9:1);return Math.max(.38,base*kindScale/Math.max(.72,technique.tempo||1));}
function stageDamage(stage){return KIND_DAMAGE[stage.kind]??0;}
function motionFor(node){const motion=resolveJohakyuMotion({weapon:node.stage.weapon,kind:node.stage.step.kind,charge:node.stage.step.charge,phase:node.phase});if(!motion.supported)throw new Error('Unsupported composition motion: '+node.technique.id+'/'+node.stage.step.kind);return motion;}
const clampPosition=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
function positionOf(positions,actor){return positions.get(actor.id)??{x:LAYOUT[actor.id]?.x??0,z:LAYOUT[actor.id]?.z??0};}
function footworkVector(positions,actor,target,footwork){
  const from=positionOf(positions,actor),to=positionOf(positions,target),dx=to.x-from.x,dz=to.z-from.z,length=Math.max(.001,Math.hypot(dx,dz)),tx=dx/length,tz=dz/length,leftX=-tz,leftZ=tx;
  if(footwork==='retreat')return{x:-tx,z:-tz};
  if(footwork==='sideL')return{x:leftX,z:leftZ};if(footwork==='sideR')return{x:-leftX,z:-leftZ};
  if(footwork==='orbitL')return{x:leftX*.94+tx*.18,z:leftZ*.94+tz*.18};if(footwork==='orbitR')return{x:-leftX*.94+tx*.18,z:-leftZ*.94+tz*.18};
  if(footwork==='cross')return{x:tx*.72+leftX*.7,z:tz*.72+leftZ*.7};if(footwork==='spiral')return{x:tx*.62-leftX*.82,z:tz*.62-leftZ*.82};
  if(footwork==='counterL')return{x:tx*.86+leftX*.5,z:tz*.86+leftZ*.5};if(footwork==='counterR')return{x:tx*.86-leftX*.5,z:tz*.86-leftZ*.5};
  if(['forward','chase','rush'].includes(footwork))return{x:tx,z:tz};
  return{x:0,z:0};
}
function distanceBetween(positions,actor,target){const from=positionOf(positions,actor),to=positionOf(positions,target);return Math.hypot(to.x-from.x,to.z-from.z);}
function contactPointBetween(positions,source,target){
  const from=positionOf(positions,source),to=positionOf(positions,target);
  return{x:Number(((from.x+to.x)*.5).toFixed(3)),z:Number(((from.z+to.z)*.5).toFixed(3))};
}
function parryDirectionFor(state){
  const authored=state?.motion?.deflect;
  if(authored==='left'||authored==='right')return authored;
  const trajectory=state?.motion?.bladeTrajectory;
  return trajectory==='left-to-right'||trajectory==='forward'?'right':'left';
}
function resolveBodySeparation(battle,positions){
  const live=[...battle.actors.values()].filter(actor=>!actor.dead&&!actor.incapacitated);
  for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){
    const a=live[i],b=live[j],pa=positionOf(positions,a),pb=positionOf(positions,b),dx=pb.x-pa.x,dz=pb.z-pa.z;
    let distance=Math.hypot(dx,dz);if(distance>=BODY_CLEARANCE-.0001)continue;
    const nx=distance>.0001?dx/distance:((a.id<b.id)?1:-1),nz=distance>.0001?dz/distance:0,push=(BODY_CLEARANCE-distance)*.5;
    positions.set(a.id,{x:clampPosition(pa.x-nx*push,-4.8,4.8),z:clampPosition(pa.z-nz*push,-1.4,5.4)});
    positions.set(b.id,{x:clampPosition(pb.x+nx*push,-4.8,4.8),z:clampPosition(pb.z+nz*push,-1.4,5.4)});
    distance=distanceBetween(positions,a,b);
    if(distance<BODY_CLEARANCE-.01){
      const corrected=positionOf(positions,b),extra=BODY_CLEARANCE-distance;
      positions.set(b.id,{x:clampPosition(corrected.x+nx*extra,-4.8,4.8),z:clampPosition(corrected.z+nz*extra,-1.4,5.4)});
    }
  }
}
function maneuverDone(positions,actor,target,maneuver,now){
  if(!maneuver||now>=maneuver.until)return true;
  const distance=distanceBetween(positions,actor,target);
  if(maneuver.footwork==='retreat'&&Number.isFinite(maneuver.stopDistance))return distance>=maneuver.stopDistance-.015;
  if(['forward','chase','rush'].includes(maneuver.footwork)&&Number.isFinite(maneuver.stopDistance))return distance<=maneuver.stopDistance+.015;
  return false;
}
function advanceFootwork(battle,positions,actions,maneuvers,now,dt){
  for(const actor of battle.actors.values()){
    const action=actions.get(actor.id);let maneuver=!action?maneuvers.get(actor.id):null;
    if(maneuver){
      const maneuverTarget=battle.actors.get(maneuver.targetId);
      if(!maneuverTarget||maneuverDone(positions,actor,maneuverTarget,maneuver,now)){maneuvers.delete(actor.id);maneuver=null;}
    }
    const target=action?battle.actors.get(action.targetId):(maneuver?battle.actors.get(maneuver.targetId):null);
    if(!target||actor.dead||actor.incapacitated)continue;
    const from=positionOf(positions,actor),targetPos=positionOf(positions,target),distance=Math.hypot(targetPos.x-from.x,targetPos.z-from.z);
    const footwork=action?.footwork||maneuver?.footwork||'stay',speed=FOOTWORK_SPEED[footwork]??0;if(!(speed>0))continue;
    const movement=johakyuStageCapability(actor,{weapon:actor.equipment.weapon,kind:'ready',footwork});
    if(!movement.allowed)continue;
    const vector=footworkVector(positions,actor,target,footwork),closing=['forward','chase','rush','cross','spiral','orbitL','orbitR','counterL','counterR'].includes(footwork);
    const deepEntry=action&&['rush','cross','spiral','counterL','counterR'].includes(footwork);
    const stopDistance=maneuver?.stopDistance??(deepEntry?DEEP_ENTRY_SPACING:FIGHTING_SPACING);
    let step=speed*dt*movement.body.movementScale;
    if(closing)step=Math.min(step,Math.max(0,distance-stopDistance));
    if(footwork==='retreat'&&Number.isFinite(maneuver?.stopDistance))step=Math.min(step,Math.max(0,maneuver.stopDistance-distance));
    positions.set(actor.id,{x:clampPosition(from.x+vector.x*step,-4.8,4.8),z:clampPosition(from.z+vector.z*step,-1.4,5.4)});
  }
}
function contactWindow(positions,source,target){
  const from=positionOf(positions,source),to=positionOf(positions,target),distance=Math.hypot(to.x-from.x,to.z-from.z);
  const reachable=selectReachableTarget({source:{id:source.id,...from},candidates:[{id:target.id,...to,dead:target.dead||target.incapacitated}],reach:CONTACT_REACH});
  return{reachable:Boolean(reachable),distance};
}

// The composed preset remains available to the existing technique laboratory.
// The public battle2 controller selects burst for its nine-strike exchange.
export function createJohakyuP7ReviewScenario({comboStyle='composed',mode='duel',duelGap=3.15,enemyLeadSeconds=0,heroStartPhase='jo',heroStartTechniqueIndex=0,checkpointSeconds=0,actorOverrides={}}={}){
  if(!['composed','burst'].includes(comboStyle))throw new RangeError('Unsupported combo style');
  if(comboStyle==='burst'&&heroStartTechniqueIndex!==0)throw new RangeError('Burst phases contain one three-strike technique');
  if(!Number.isFinite(checkpointSeconds)||checkpointSeconds<0)throw new RangeError('Invalid checkpoint time');
  if(!actorOverrides||typeof actorOverrides!=='object'||Object.keys(actorOverrides).some(id=>!Object.hasOwn(TARGETS,id)))throw new TypeError('Invalid actor fixture overrides');
  if(!Object.hasOwn(MODES,mode))throw new RangeError('Unsupported battle review mode');
  if(!Number.isFinite(duelGap)||duelGap<1||duelGap>5)throw new RangeError('Invalid duel review gap');
  if(!Number.isFinite(enemyLeadSeconds)||enemyLeadSeconds<0||enemyLeadSeconds>1)throw new RangeError('Invalid enemy lead');
  if(!PHASES.includes(heroStartPhase)||!Number.isInteger(heroStartTechniqueIndex)||heroStartTechniqueIndex<0||heroStartTechniqueIndex>2)throw new RangeError('Invalid hero start');
  let encounter=1,epoch=1,revision=0,time=0,resumes=0,resumed=false,battle,respawnAt=null;
  let actionState=new Map(),reactionState=new Map(),reactionCooldowns=new Map(),cursors=new Map(),readyAt=new Map(),positions=new Map(),recoveries=new Map(),maneuvers=new Map(),counterWindows=new Map(),exchangeStates=new Map(),normalPending=new Set(),settleAt=new Map(),terminalFacings=new Map(),lastEvents=[],trace=[],lastFrame=null,lastMeta=null,attemptSerial=0;

  function cursorFor(actor){let cursor=cursors.get(actor.id);if(!cursor){cursor=cursorState(comboStyle);cursors.set(actor.id,cursor);}return cursor;}
  function seedReadyWindow(delay=.24){readyAt.clear();for(const actor of battle.actors.values())readyAt.set(actor.id,time+Math.max(0,delay+(actor.side==='enemy'?.12-enemyLeadSeconds:0)));}
  function freshBattle(carry=null){
    const rows=actorRows(mode).map(row=>{
      const base={...row,...actorOverrides[row.id],id:row.id,side:row.side},kept=carry?.get(row.id)?.actor;
      return kept?{...base,...kept,id:row.id,side:row.side,dead:false,incapacitated:false}:base;
    });
    battle=createJohakyuBattle({battleId:`review-p7:${mode}:${encounter}`,actors:rows,seed:73917+encounter});
    actionState=new Map();reactionState=new Map();reactionCooldowns=new Map();cursors=new Map();readyAt=new Map();positions=new Map(Object.entries(LAYOUT).filter(([id])=>battle.actors.has(id)).map(([id,row])=>[id,{x:row.x,z:row.z}]));recoveries=new Map();maneuvers=new Map();counterWindows=new Map();exchangeStates=new Map();normalPending=new Set();settleAt=new Map();terminalFacings=new Map();respawnAt=null;
    cursors.set('hero',{comboStyle,phaseIndex:PHASES.indexOf(heroStartPhase),techniqueIndex:heroStartTechniqueIndex,stageIndex:0,cycle:0});
    if(mode==='duel')positions.set('enemy-a',{x:LAYOUT.hero.x,z:LAYOUT.hero.z+duelGap});
    if(carry)for(const [id,row] of carry)if(positions.has(id)&&row.position)positions.set(id,{...row.position});
    lastEvents=[];resumed=false;revision=0;attemptSerial=0;seedReadyWindow(.34);
  }
  function winnerCarry(){
    const winner=battle.result?.winner;if(!winner)return new Map();
    return new Map([...battle.actors.values()].filter(actor=>actor.side===winner&&!actor.dead&&!actor.incapacitated).map(actor=>[actor.id,{actor:structuredClone(actor),position:{...positionOf(positions,actor)}}]));
  }
  freshBattle();

  function traceRow(row){trace.push(freeze({...row,time:Number(time.toFixed(2))}));if(trace.length>180)trace=trace.slice(-180);}
  function exchangeKey(a,b){return[a.id,b.id].sort().join('::');}
  function exchangeFor(a,b){
    const key=exchangeKey(a,b);let row=exchangeStates.get(key);
    if(!row){row=createJohakyuExchangeState({sourceId:a.id,targetId:b.id});exchangeStates.set(key,row);}
    return row;
  }
  function updateExchange(source,target,event){
    const key=exchangeKey(source,target),before=exchangeFor(source,target),after=reduceJohakyuExchange(before,{...event,sourceId:event.sourceId??source.id,targetId:event.targetId??target.id});
    exchangeStates.set(key,after);
    for(const id of johakyuExchangeRestartActors(before,after,[...exchangeStates.values()]))normalPending.add(id);
    if(after.mode==='zanshin'&&before.mode!=='zanshin')settleAt.set(key,time+(comboStyle==='burst'?BURST_CADENCE.recovery:.3));
    if(after.mode!=='zanshin')settleAt.delete(key);
    if(before.mode!==after.mode||before.initiativeId!==after.initiativeId||['reverse','reset'].includes(after.continuity))traceRow({type:'exchange',sourceId:source.id,targetId:target.id,mode:after.mode,initiativeId:after.initiativeId,responderId:after.responderId,continuity:after.continuity,reason:after.lastReason,phase:after.lastPhase,serial:after.serial,completedBy:after.completedBy});
    return after;
  }
  function reviewParryStrength(source,target,targetState,defenseNode){
    const reaction=Boolean(targetState?.reaction),fresh=target.stamina/Math.max(1,target.staminaCap)>=.55;
    const parryPhase=comboStyle==='burst'?(combatState(source.id)?.node?.phase??defenseNode?.phase):defenseNode?.phase;
    return classifyJohakyuParry({authored:!reaction&&targetState?.targetId===source.id,counter:reaction&&fresh&&parryPhase==='kyu',phase:parryPhase??'uke',responding:exchangeFor(source,target).initiativeId!==target.id,capable:johakyuStageCapability(target,{weapon:target.equipment.weapon,kind:'parry',phase:'uke'}).allowed});
  }
  function setRecovery(actor,reason,targetId,seconds){
    const until=time+Math.max(0,seconds),previous=recoveries.get(actor.id),lockedUntil=Math.max(until,previous?.until||0);
    recoveries.set(actor.id,{reason,targetId,until:lockedUntil});readyAt.set(actor.id,Math.max(readyAt.get(actor.id)||0,lockedUntil));return lockedUntil;
  }
  function setManeuver(actor,target,{reason,footwork,seconds=.4,stopDistance=null}){
    if(!actor||!target||actor.dead||actor.incapacitated||target.dead||target.incapacitated||battle.result)return null;
    const current=maneuvers.get(actor.id);
    if(current&&current.reason===reason&&current.targetId===target.id&&time<current.until)return current;
    const row={reason,targetId:target.id,footwork,until:time+Math.max(.08,seconds),stopDistance:Number.isFinite(stopDistance)?stopDistance:null};
    maneuvers.set(actor.id,row);traceRow({type:'maneuver-start',actorId:actor.id,targetId:target.id,reason,footwork,stopDistance:row.stopDistance,distance:Number(distanceBetween(positions,actor,target).toFixed(3))});return row;
  }
  function combatState(id){return reactionState.get(id)??actionState.get(id)??null;}
  function stateKind(state){return state?.reactionKind??state?.node?.stage?.step?.kind??null;}
  function stateProgress(state){return state?Math.min(.999,Math.max(0,(time-state.startedAt)/state.duration)):1;}
  function incomingThreat(actor,target){
    const incoming=target?combatState(target.id):null;if(!reviewStageCanResolve(incoming)||!incoming.motion.offense||incoming.impacted)return null;
    const progress=stateProgress(incoming);
    return progress<.58&&distanceBetween(positions,actor,target)<=2.95?{state:incoming,progress}:null;
  }
  function gateAction(actor,target,node){
    const kind=node.stage.step.kind,distance=distanceBetween(positions,actor,target),counterWindow=counterWindows.get(actor.id);
    if(['guard','brace','parry'].includes(kind)){
      if(johakyuExchangeIntent(exchangeFor(actor,target),{actorId:actor.id})==='pressure')return true;
      const threat=incomingThreat(actor,target);
      if(!threat){if(distance<=CONTACT_REACH+.25&&!maneuvers.has(actor.id))setManeuver(actor,target,{reason:'read-threat',footwork:actor.id==='hero'?'orbitL':'orbitR',seconds:.24});return false;}
      maneuvers.delete(actor.id);return true;
    }
    if(kind==='counter'&&counterWindow?.against===target.id&&time<=counterWindow.until){
      if(distance>COUNTER_PRESS_DISTANCE){setManeuver(actor,target,{reason:'counter-press',footwork:'chase',seconds:.5,stopDistance:COUNTER_PRESS_DISTANCE});return false;}
      maneuvers.delete(actor.id);return true;
    }
    const attackFootwork=node.stage.step.footwork,launchDistance=comboStyle==='burst'?ENGAGE_DISTANCE:attackFootwork==='cross'?3.16:attackFootwork==='spiral'?2.82:attackFootwork==='rush'?2.76:attackFootwork==='chase'?2.64:attackFootwork==='forward'?2.55:ENGAGE_DISTANCE;
    if(stageDamage(node.stage)>0&&distance>launchDistance){
      setManeuver(actor,target,{reason:'engage-range',footwork:distance>3.05?'chase':'forward',seconds:.85,stopDistance:launchDistance});return false;
    }
    return true;
  }
  function activeManeuver(actor){
    const row=maneuvers.get(actor.id);if(!row)return null;const target=battle.actors.get(row.targetId);
    if(!target||maneuverDone(positions,actor,target,row,time)){maneuvers.delete(actor.id);return null;}return row;
  }
  function reactionContext(actor){const cursor=cursorFor(actor),node=nodeFor(actor,cursor);return{cursor,node};}
  function beginReaction(actor,target,kind,reason,{footwork=null,parryDirection=null}={}){
    const {node}=reactionContext(actor),motion=resolveJohakyuMotion({weapon:actor.equipment.weapon,kind,phase:'uke'});if(!motion.supported)return null;
    const state={reaction:true,reactionKind:kind,reason,startedAt:time,duration:REACTION_SECONDS[kind],impacted:false,outcome:null,
      id:`${battle.battleId}:${actor.id}:reaction-${kind}:attempt-${++attemptSerial}`,targetId:target.id,motion,context:node,footwork:footwork??(kind==='counter'?'forward':'stay'),parryDirection};
    state.payment=beginReviewStage(actor,state,node,{kind,footwork:state.footwork});
    if(!state.payment.allowed)return null;
    reactionState.set(actor.id,state);maneuvers.delete(actor.id);
    traceRow({type:'reaction-start',actorId:actor.id,targetId:target.id,reaction:kind,reason,phase:node.phase,contextTechniqueId:node.technique.id,staminaPaid:state.payment.paid});
    return state;
  }
  function maybeBeginDefenseReaction(actor,target){
    if(!target||time<(reactionCooldowns.get(actor.id)||0))return null;
    const cursor=cursorFor(actor),node=nodeFor(actor,cursor);if(cursor.stageIndex!==0||['ready','slip','guard','brace','parry'].includes(node.stage.step.kind))return null;
    const settleUntil=readyAt.get(actor.id)||0;if(time>=settleUntil)return null;
    const threat=incomingThreat(actor,target);if(!threat)return null;
    const staminaRatio=actor.stamina/Math.max(1,actor.staminaCap),incomingKind=stateKind(threat.state);
    const kind=HEAVY_THREATS.has(incomingKind)||staminaRatio<.28||threat.progress>.43?'guard':'parry';
    const reaction=beginReaction(actor,target,kind,'incoming-threat');
    if(reaction)reactionCooldowns.set(actor.id,time+(kind==='parry'?2.2:1.6));
    return reaction;
  }
  function maybeBeginCounterReaction(actor,target){
    const window=counterWindows.get(actor.id);if(!window)return null;
    if(time>window.until){counterWindows.delete(actor.id);return null;}
    if(window.against!==target?.id||window.claimed)return null;
    const node=nodeFor(actor,cursorFor(actor));if(node.stage.step.kind==='counter')return null;
    const distance=distanceBetween(positions,actor,target);
    if(distance>COUNTER_PRESS_DISTANCE){setManeuver(actor,target,{reason:'counter-press',footwork:'chase',seconds:.55,stopDistance:COUNTER_PRESS_DISTANCE});return null;}
    const direction=window.parryDirection==='right'?'right':'left',footwork=direction==='right'?'counterR':'counterL';
    const reaction=beginReaction(actor,target,'counter','parry-window',{footwork,parryDirection:direction});
    if(reaction){window.claimed=true;updateExchange(actor,target,{type:'counter-start'});}
    return reaction;
  }
  function finishReaction(actor,state,{interrupted=false}={}){
    cancelJohakyuStage(state);reactionState.delete(actor.id);const target=battle.actors.get(state.targetId);
    if(state.reactionKind==='counter'){
      counterWindows.delete(actor.id);normalPending.add(actor.id);
      if(target)updateExchange(actor,target,{type:'counter-complete'});
    }
    if(state.reactionKind==='counter'&&(state.outcome==='miss'||(!state.impacted&&!interrupted))){
      counterWindows.delete(actor.id);setRecovery(actor,'miss',state.targetId,.38);
      if(target)setManeuver(actor,target,{reason:'miss-reset',footwork:'chase',seconds:.72,stopDistance:ENGAGE_DISTANCE});
    }
    readyAt.set(actor.id,Math.max(readyAt.get(actor.id)||0,time+(state.reactionKind==='counter'?.18:.08)));
    traceRow({type:'reaction-end',actorId:actor.id,targetId:state.targetId,reaction:state.reactionKind,outcome:interrupted||state.outcome||'complete'});
  }
  function actionView(actor,state){
    const progress=stateProgress(state);
    if(state.reaction){
      const node=state.context,cursor=cursorFor(actor);
      return{id:state.id,targetId:state.targetId,techniqueId:node.technique.id,name:state.reactionKind==='parry'?'弾き':state.reactionKind==='guard'?'受け':'返し',phase:node.phase,step:-1,
        stageIndex:-1,stageLabel:'反応',techniqueIndex:node.chain.indexOf(node.technique),chainLength:node.chain.length,chainLabel:reviewChainLabel(node.phase,node.chain.length),cycle:cursor.cycle,
        footwork:state.footwork??(state.reactionKind==='counter'?'forward':'stay'),progress,duration:state.duration,motion:state.motion,legal:true,scope:'combat-reaction',reaction:state.reactionKind,parryDirection:state.parryDirection??null};
    }
    const {node}=state;
    return{id:state.id,targetId:state.targetId,techniqueId:node.technique.id,name:node.technique.name,phase:node.phase,step:node.stage.index,
      stageIndex:node.stage.index,stageLabel:node.stage.label,techniqueIndex:node.chain.indexOf(node.technique),chainLength:node.chain.length,
      chainLabel:reviewChainLabel(node.phase,node.chain.length),cycle:cursorFor(actor).cycle,footwork:node.stage.step.footwork,
      progress,duration:state.duration,motion:state.motion,legal:true,scope:state.transition?'combat-counter-transition':'review-technique-composition'};
  }
  function nextAction(actor){
    if(actor.dead||actor.incapacitated)return null;
    const target=selectTarget(battle,actor.id);if(!target)return null;
    const cursor=cursorFor(actor),node=nodeFor(actor,cursor);
    const motion=motionFor(node),duration=stageDuration(node.technique,node.stage,comboStyle),serial=`${cursor.cycle}:${cursor.phaseIndex}:${cursor.techniqueIndex}:${cursor.stageIndex}`;
    const state={phaseEpoch:`${cursor.cycle}:${cursor.phaseIndex}`,startedAt:time,duration,impacted:false,outcome:null,exchangeContinuity:null,
      id:`${battle.battleId}:${actor.id}:${serial}:attempt-${++attemptSerial}`,targetId:target.id,node,motion};
    const staminaBefore=actor.stamina;
    state.payment=beginReviewStage(actor,state,node);
    if(!state.payment.allowed){
      updateExchange(actor,target,{type:'execution-blocked',phase:node.phase});
      traceRow({type:'execution-blocked',actorId:actor.id,phase:node.phase,reason:state.payment.reason,staminaPaid:0});readyAt.set(actor.id,time+.24);return null;
    }
    const window=counterWindows.get(actor.id);
    state.transition=Boolean(node.stage.step.kind==='counter'&&window?.against===target.id&&time<=window.until);
    if(state.transition){window.claimed=true;updateExchange(actor,target,{type:'counter-start'});}
    else {
      const before=exchangeFor(actor,target),offensive=node.technique.stages.some(stage=>stageDamage(stage)>0);
      if(offensive&&before.mode!=='pressure')updateExchange(actor,target,{type:'normal-start',phase:node.phase,seeded:before.serial===0});
      if(stageDamage(node.stage)>0){const exchange=updateExchange(actor,target,{type:'commit',phase:node.phase});state.exchangeContinuity=exchange.continuity;}
    }
    if(!state.transition)updateExchange(actor,target,{type:'stage',phase:node.phase});
    state.exchangeSerial=exchangeFor(actor,target).serial;
    if(actor.id==='hero'||comboStyle==='burst')traceRow({type:'stage-start',actorId:actor.id,transition:state.transition,exchangeSerial:state.exchangeSerial,phase:node.phase,techniqueId:node.technique.id,techniqueIndex:cursor.techniqueIndex,stageIndex:cursor.stageIndex,kind:node.stage.step.kind,attackId:state.id,distance:Number(distanceBetween(positions,actor,target).toFixed(3)),staminaBefore,staminaPaid:state.payment.paid});
    return state;
  }
  function breakChain(actor,state,reason){
    const cursor=cursorFor(actor),node=nodeFor(actor,cursor),techniqueIndex=cursor.techniqueIndex,target=battle.actors.get(state.targetId);
    cancelJohakyuStage(state);cursor.stageIndex=0;actionState.delete(actor.id);
    const recoverySeconds=RECOVERY_SECONDS[reason]??.34;setRecovery(actor,reason,state.targetId,recoverySeconds);
    if(reason==='miss'&&target)setManeuver(actor,target,{reason:'miss-reset',footwork:'chase',seconds:.9,stopDistance:ENGAGE_DISTANCE});
    if(actor.id==='hero')traceRow({type:'chain-break',reason,phase:node.phase,techniqueId:state.node.technique.id,techniqueIndex,stageIndex:state.node.stage.index,restartTechniqueIndex:techniqueIndex,restartStageIndex:0});
  }
  function selectCapableNode(actor,target){
    const cursor=cursorFor(actor),node=nodeFor(actor,cursor),capability=reviewTechniqueCapability(actor,node);
    if(capability.canContinue)return node;
    if(cursor.stageIndex>0){
      breakChain(actor,{node,targetId:target.id},'execution-blocked');
      updateExchange(actor,target,{type:'execution-blocked',phase:node.phase});
    }else{
      // Only remaining authored techniques in this chain are alternatives. Never
      // replay an earlier technique or invent an unequipped fallback motion.
      for(let index=cursor.techniqueIndex+1;index<node.chain.length;index++){
        const candidate=nodeFor(actor,{...cursor,techniqueIndex:index}),prediction=reviewTechniqueCapability(actor,candidate);
        if(!prediction.canContinue)continue;
        cursor.techniqueIndex=index;
        traceRow({type:'technique-adapted',actorId:actor.id,phase:node.phase,from:node.technique.id,to:candidate.technique.id});return candidate;
      }
      readyAt.set(actor.id,time+.24);
    }
    traceRow({type:'technique-unavailable',actorId:actor.id,phase:node.phase,techniqueId:node.technique.id,canStart:capability.canStart,canContinue:capability.canContinue,reason:capability.reason,blockedStageIndex:capability.blockedStageIndex});
    return null;
  }
  function finishAction(actor,state,{interrupted=false}={}){
    cancelJohakyuStage(state);actionState.delete(actor.id);
    const transitionTarget=battle.actors.get(state.targetId);
    if(state.transition){
      counterWindows.delete(actor.id);normalPending.add(actor.id);
      if(transitionTarget)updateExchange(actor,transitionTarget,{type:'counter-complete'});
      readyAt.set(actor.id,Math.max(readyAt.get(actor.id)||0,time+.18));return;
    }
    const ownPressure=transitionTarget&&johakyuExchangeIntent(exchangeFor(actor,transitionTarget),{actorId:actor.id})==='pressure';
    const parryWhiff=state.node.stage.step.kind==='parry'&&state.outcome!=='parry'&&!ownPressure;
    const failure=interrupted||(state.outcome==='miss'&&state.exchangeContinuity!=='retain')||parryWhiff;
    if(failure){breakChain(actor,state,interrupted||state.outcome||'parry-whiff');return;}
    const moved=advanceCursor(actor,cursorFor(actor)),techniqueComplete=moved.before.technique.id!==moved.after.technique.id||moved.before.phase!==moved.after.phase,exchangeComplete=moved.before.phase==='kyu'&&moved.after.phase==='jo';
    if(actor.id==='hero'&&moved.before.phase!==moved.after.phase)traceRow({type:'phase-change',phase:moved.after.phase,reason:'configured-chain-complete'});
    const target=battle.actors.get(state.targetId);
    if(exchangeComplete&&target){
      updateExchange(actor,target,{type:'kyu-complete',phase:'kyu',serial:state.exchangeSerial});
      if(distanceBetween(positions,actor,target)<=CONTACT_REACH&&!activeManeuver(actor)){
        const footwork=((actor.id==='hero')!==Boolean(cursorFor(actor).cycle%2))?'orbitL':'orbitR';
        setManeuver(actor,target,{reason:'exchange-zanshin',footwork,seconds:.3});
      }
    }
    const settle=comboStyle==='burst'?burstSettleSeconds(moved.before.phase,moved.after.phase):exchangeComplete?.3:(state.motion.offense?.05:.12);
    // Ending recovery is a real action lock, not merely a HUD label or an AI
    // delay that can be cancelled immediately into another defensive reaction.
    if(comboStyle==='burst'&&exchangeComplete)setRecovery(actor,'zanshin',state.targetId,settle);
    readyAt.set(actor.id,Math.max(readyAt.get(actor.id)||0,time+settle));
  }
  function currentAction(actor){
    // Keep the defeated body in the frame, but never let its old action or AI
    // overwrite the terminal pose while the remaining fighters finish the bout.
    if(actor.dead||actor.incapacitated){
      for(const states of [actionState,reactionState]){const pending=states.get(actor.id);if(pending)cancelJohakyuStage(pending);states.delete(actor.id);}
      maneuvers.delete(actor.id);counterWindows.delete(actor.id);recoveries.delete(actor.id);return null;
    }
    let reaction=reactionState.get(actor.id);
    if(reaction?.interrupted){finishReaction(actor,reaction,{interrupted:reaction.interrupted});reaction=null;}
    if(reaction&&time-reaction.startedAt>=reaction.duration){finishReaction(actor,reaction);reaction=null;}
    let state=actionState.get(actor.id);
    if(state?.interrupted){finishAction(actor,state,{interrupted:state.interrupted});state=null;}
    if(state&&time-state.startedAt>=state.duration){finishAction(actor,state);state=null;}
    if(reaction)return actionView(actor,reaction);
    if(state)return actionView(actor,state);
    if(battle.result){maneuvers.delete(actor.id);return null;}
    const recovery=recoveries.get(actor.id);if(recovery&&time<recovery.until)return null;if(recovery)recoveries.delete(actor.id);
    const target=selectTarget(battle,actor.id);if(!target)return null;
    const counterWindow=counterWindows.get(actor.id);
    if(counterWindow&&time<=counterWindow.until){
      const counter=maybeBeginCounterReaction(actor,target);if(counter)return actionView(actor,counter);
      if(counterWindow.claimed===false&&nodeFor(actor,cursorFor(actor)).stage.step.kind!=='counter')return null;
    }
    const defense=maybeBeginDefenseReaction(actor,target);if(defense)return actionView(actor,defense);
    if(time<(readyAt.get(actor.id)||0))return null;
    // All old action/reaction finish handlers have run. A counter may use the old
    // context, but only the next ordinary sequence consumes the deferred restart.
    const window=counterWindows.get(actor.id),counterTransition=window&&time<=window.until&&!window.claimed&&nodeFor(actor,cursorFor(actor)).stage.step.kind==='counter';
    if(normalPending.has(actor.id)&&!counterTransition){
      const cursor=cursorFor(actor);cursor.phaseIndex=0;cursor.techniqueIndex=0;cursor.stageIndex=0;cursor.cycle++;normalPending.delete(actor.id);
      traceRow({type:'normal-offense-ready',actorId:actor.id,phase:'jo'});
    }
    const node=counterTransition?nodeFor(actor,cursorFor(actor)):selectCapableNode(actor,target);if(!node)return null;
    const threat=['guard','brace','parry'].includes(node.stage.step.kind)?incomingThreat(actor,target):null;
    // Shared pair meaning informs selection, not the domain contact executor.
    if(stageDamage(node.stage)>0&&!counterTransition&&johakyuExchangeIntent(exchangeFor(actor,target),{actorId:actor.id})==='respond'){
      const incoming=incomingThreat(actor,target);
      if(incoming&&exchangeFor(actor,target).mode==='pressure'&&time>=(reactionCooldowns.get(actor.id)||0)){const kind=HEAVY_THREATS.has(stateKind(incoming.state))||actor.stamina/Math.max(1,actor.staminaCap)<.28||incoming.progress>.43?'guard':'parry',response=beginReaction(actor,target,kind,'opponent-pressure');if(response){reactionCooldowns.set(actor.id,time+1.15);return actionView(actor,response);}}
      setManeuver(actor,target,{reason:'read-pressure',footwork:actor.side==='party'?'orbitL':'orbitR',seconds:.2});return null;
    }
    if(activeManeuver(actor)&&!threat)return null;
    if(!gateAction(actor,target,node))return null;
    state=nextAction(actor);if(!state)return null;actionState.set(actor.id,state);
    return actionView(actor,state);
  }
  function defenseContact(targetState,progress){
    if(!reviewStageCanResolve(targetState))return null;
    const kind=stateKind(targetState),window=DEFENSE_WINDOW[kind];
    return window&&progress>=window[0]&&progress<=window[1]?kind:null;
  }
  function resolveAttackClashes(actions,events){
    const handled=new Set();
    for(const [id,action] of actions){
      if(!action?.motion?.offense||action.progress<.4||action.progress>.72)continue;
      const otherAction=actions.get(action.targetId);if(!otherAction?.motion?.offense||otherAction.targetId!==id||otherAction.progress<.4||otherAction.progress>.72)continue;
      const pair=[id,action.targetId].sort().join('::');if(handled.has(pair))continue;handled.add(pair);
      const state=combatState(id),otherState=combatState(action.targetId);
      if(!reviewStageCanResolve(state,action)||!reviewStageCanResolve(otherState,otherAction)||state.impacted||otherState.impacted)continue;
      if(Math.abs(action.progress-otherAction.progress)>.18)continue;
      const source=battle.actors.get(id),target=battle.actors.get(action.targetId);if(!source||!target||source.dead||target.dead||source.incapacitated||target.incapacitated)continue;
      const contact=contactWindow(positions,source,target);if(!contact.reachable)continue;
      state.impacted=true;otherState.impacted=true;state.outcome='clash';otherState.outcome='clash';
      const event=freeze({id:`clash:${[action.id,otherAction.id].sort().join(':')}`,type:'clash',sourceId:source.id,targetId:target.id,attackId:action.id,otherAttackId:otherAction.id,damage:0,blocked:true,contactDistance:Number(contact.distance.toFixed(3)),contactReach:CONTACT_REACH,contactPoint:contactPointBetween(positions,source,target),sourceContactProgress:state.motion.contactProgress??.5,targetContactProgress:otherState.motion.contactProgress??.5});
      events.push(event);traceRow({...event});
      setRecovery(source,'clash',target.id,.22);setRecovery(target,'clash',source.id,.22);
      setManeuver(source,target,{reason:'weapon-clash',footwork:'retreat',seconds:.38,stopDistance:2.28});
      setManeuver(target,source,{reason:'weapon-clash',footwork:'retreat',seconds:.38,stopDistance:2.28});
    }
  }
  function applyContacts(actions){
    const events=[];resolveAttackClashes(actions,events);
    for(const [id,action] of actions){
      if(battle.result)break;
      if(!action||!action.motion.offense||action.progress<.46)continue;
      const state=combatState(id);if(!reviewStageCanResolve(state,action)||state.impacted)continue;state.impacted=true;
      const source=battle.actors.get(id),target=battle.actors.get(action.targetId);if(!source||!target||source.dead||source.incapacitated||target.dead||target.incapacitated)continue;
      const damage=state.reactionKind==='counter'?KIND_DAMAGE.counter:stageDamage(state.node.stage);if(!(damage>0))continue;
      const contact=contactWindow(positions,source,target);
      if(!contact.reachable){state.outcome='miss';state.exchangeContinuity=updateExchange(source,target,{type:'miss',phase:action.phase,major:contact.distance>CONTACT_REACH+.2}).continuity;trace.push({type:'miss',time:Number(time.toFixed(2)),attackId:action.id,sourceId:source.id,targetId:target.id,phase:action.phase,techniqueId:action.techniqueId,stageIndex:action.stageIndex,distance:Number(contact.distance.toFixed(3)),reach:CONTACT_REACH,exchangeContinuity:state.exchangeContinuity});continue;}
      const targetState=combatState(target.id),targetProgress=stateProgress(targetState),defense=defenseContact(targetState,targetProgress);
      if(defense){
        const parried=defense==='parry',parryDirection=parried?parryDirectionFor(state):null,defenseNode=targetState.context??targetState.node,defenseStage=targetState.reaction?-1:targetState.node.stage.index;
        const parryStrength=parried?reviewParryStrength(source,target,targetState,defenseNode):null,strongParry=Boolean(parryStrength?.strong);
        const exchange=updateExchange(source,target,{type:parried?'parry':'guard',phase:action.phase,strong:strongParry});state.exchangeContinuity=exchange.continuity;state.outcome=parried?'parried':'blocked';
        targetState.outcome=parried?'parry':'guard';
        if(strongParry){state.interrupted='strong-parry';cancelJohakyuStage(state);counterWindows.set(target.id,{against:source.id,until:time+1.35,claimed:false,parryDirection});}
        const event=freeze({id:`${action.id}:${source.id}:${target.id}:${defense}`,type:parried?'parry':'guard',attackId:action.id,sourceId:source.id,targetId:target.id,phase:action.phase,damage:0,blocked:true,parried,strongParry,parryStrength:parryStrength?.strength??null,parryDirection,exchangeMode:exchange.mode,exchangeContinuity:exchange.continuity,initiativeId:exchange.initiativeId,techniqueId:action.techniqueId,techniqueName:action.name,stageIndex:action.stageIndex,stageLabel:action.stageLabel,defenseTechniqueId:defenseNode.technique.id,defenseTechniqueName:defenseNode.technique.name,defenseStageIndex:defenseStage,defenseScope:targetState.reaction?'combat-reaction':'review-technique-composition',defenseActionId:targetState.id,sourceContactProgress:state.motion.contactProgress??.5,defenseContactProgress:targetState.motion.contactProgress??.43,sourceBladeTrajectory:state.motion.bladeTrajectory??'neutral',sourceProgress:Number(action.progress.toFixed(3)),contactDistance:Number(contact.distance.toFixed(3)),contactReach:CONTACT_REACH,bodyClearance:BODY_CLEARANCE,contactPoint:contactPointBetween(positions,source,target)});
        events.push(event);traceRow({...event});
        if(strongParry){setRecovery(source,'parried',target.id,RECOVERY_SECONDS.parried);setManeuver(source,target,{reason:'parried-recoil',footwork:'retreat',seconds:.64,stopDistance:DISENGAGE_DISTANCE});}
        continue;
      }
      const counterWindow=counterWindows.get(source.id),countered=(state.reactionKind==='counter'||stateKind(state)==='counter')&&counterWindow?.against===target.id&&time<=counterWindow.until;
      const dealtDamage=countered?Math.round(damage*1.18):damage;
      // Battle2 is a short duel showcase: the opening 5 seconds preserve normal
      // pressure, then landed blows gain resolution weight so most encounters close
      // around 10 seconds and strongly converge before the 15 second ceiling.
      const resolutionProgress=Math.min(1,Math.max(0,(time-ENCOUNTER_MIN_SECONDS)/(ENCOUNTER_MAX_SECONDS-ENCOUNTER_MIN_SECONDS)));
      const pressureDamage=time<ENCOUNTER_MIN_SECONDS?dealtDamage:Math.max(dealtDamage,Math.round(dealtDamage*(1+resolutionProgress*1.8)));
      const hpRatio=target.hp/Math.max(1,target.maxHp);
      const decisive=time>=ENCOUNTER_MIN_SECONDS&&(
        (action.phase==='kyu'&&(hpRatio<=.72||time>=ENCOUNTER_TARGET_SECONDS))||
        (time>=12&&hpRatio<=.88)||
        time>=14
      );
      const resolvedDamage=decisive?Math.max(pressureDamage,target.maxHp*(time>=14?.56:.46)):pressureDamage;
      const eventId=`${action.id}:${source.id}:${target.id}:impact`,result=applyJohakyuImpactOnce(battle,{eventId,attackId:action.id,sourceId:source.id,targetId:target.id,damage:resolvedDamage,part:decisive?'torso':null,phase:decisive?'finisher':action.phase});
      if(!result.applied)continue;state.outcome='hit';if(countered)counterWindows.delete(source.id);
      const deepHit=isDeepJohakyuExchangeHit({damage:result.dealt,maxHp:target.maxHp,outcome:{incapacitated:result.incapacitated}}),exchange=updateExchange(source,target,{type:'hit',phase:action.phase,deep:deepHit});state.exchangeContinuity=exchange.continuity;
      const event=freeze({id:eventId,type:source.side==='party'?'player-hit':'enemy-hit',attackId:action.id,sourceId:source.id,targetId:target.id,damage:result.dealt,phase:action.phase,counter:countered,deepHit,exchangeMode:exchange.mode,exchangeContinuity:exchange.continuity,initiativeId:exchange.initiativeId,
        techniqueId:action.techniqueId,techniqueName:action.name,stageIndex:action.stageIndex,stageLabel:action.stageLabel,contactDistance:Number(contact.distance.toFixed(3)),contactReach:CONTACT_REACH,bodyPart:result.part,bodyDurability:result.durability,blocked:false});
      events.push(event);traceRow({...event});
      const targetAction=combatState(target.id),incomingProgress=stateProgress(targetAction),targetKind=stateKind(targetAction);
      if(countered){
        setRecovery(target,'countered',source.id,RECOVERY_SECONDS.countered);
        if(targetAction&&!['guard','parry','brace'].includes(targetKind)){targetAction.interrupted='countered';cancelJohakyuStage(targetAction);}
        setManeuver(target,source,{reason:'countered-withdrawal',footwork:'retreat',seconds:.72,stopDistance:DISENGAGE_DISTANCE});
      }else if(deepHit&&targetAction&&incomingProgress<.34&&!targetAction.impacted&&!['guard','parry','brace'].includes(targetKind)){
        targetAction.interrupted='hit-before-contact';cancelJohakyuStage(targetAction);setManeuver(target,source,{reason:'hit-withdrawal',footwork:'retreat',seconds:.4,stopDistance:2.72});
      }else if(!targetAction){
        setRecovery(target,'hit',source.id,.2);setManeuver(target,source,{reason:'hit-withdrawal',footwork:'retreat',seconds:.34,stopDistance:2.62});
      }
    }
    if(events.length){lastEvents=events;if(trace.length>120)trace=trace.slice(-120);}
    return events;
  }
  function positionFor(actor){const p=positionOf(positions,actor);return{x:p.x,z:p.z};}
  function facingYaw(actor){
    if(terminalFacings.has(actor.id))return terminalFacings.get(actor.id);
    const target=selectTarget(battle,actor.id),from=positionOf(positions,actor),to=target?positionOf(positions,target):null;
    const yaw=to?Math.atan2(to.x-from.x,to.z-from.z):LAYOUT[actor.id]?.yaw??0;
    if(actor.dead||actor.incapacitated)terminalFacings.set(actor.id,yaw);
    return yaw;
  }
  function locomotionFor(actor){const maneuver=activeManeuver(actor);if(!maneuver)return null;const binding=resolveJohakyuLocomotion({footwork:maneuver.footwork});return binding.supported?Object.freeze({kind:maneuver.footwork,clip:binding.clip}):Object.freeze({kind:maneuver.footwork,clip:null});}
  function frame(actions){
    const actors=[...battle.actors.values()].map(actor=>{const action=actions.get(actor.id)??null,maneuver=!action?activeManeuver(actor):null,capability=johakyuActorCapability(actor);return{id:actor.id,side:actor.side,self:actor.id==='hero',kind:actor.side==='party'?'hero':'enemy',boss:actor.id==='enemy-c',position:positionFor(actor),yaw:facingYaw(actor),hp:actor.hp,maxHp:actor.maxHp,body:bodyView(actor),stamina:{value:actor.stamina,cap:actor.staminaCap},capability:{canMove:capability.canMove,canAttack:capability.canAttack,stamina:capability.stamina},equipment:{...actor.equipment},moving:Boolean(capability.canMove&&(action&&action.footwork!=='stay'||maneuver)),locomotion:!action?locomotionFor(actor):null,resting:false,dead:actor.dead,downed:actor.incapacitated,hit:false,ageYears:actor.side==='party'?28:0,action};});
    return freeze({version:1,authority:'rinne-domain',reviewFixture:'p7-technique-composition',reviewMode:mode,battleId:battle.battleId,epoch,revision,status:battle.result?(battle.result.winner==='party'?'won':'lost'):'battle',actors,obstacles:[],projectiles:[],result:battle.result??{cleared:false,defeats:0,returns:resumes}});
  }
  function meta(frameValue){
    const hero=battle.actors.get('hero'),injuries=Object.entries(hero.injuries).sort((a,b)=>b[1].severity-a[1].severity),worst=injuries[0],heroView=frameValue.actors.find(actor=>actor.self),action=heroView?.action??null;
    const heroCursor=cursorFor(hero),cursorNode=nodeFor(hero,heroCursor),livingEnemies=[...battle.actors.values()].filter(actor=>actor.side==='enemy'&&!actor.incapacitated&&!actor.dead).length,target=selectTarget(battle,'hero');
    const exchange=target?exchangeStates.get(exchangeKey(hero,target))??null:null,exchangeView=exchange?johakyuExchangeSnapshot(exchange):null,phase=action?.phase??cursorNode.phase;
    const recovery=recoveries.get(hero.id),recoveringBurst=comboStyle==='burst'&&recovery?.reason==='zanshin'&&time<recovery.until;
    const hudState=hero.dead||hero.incapacitated?'idle':battle.result||recoveringBurst?'zanshin':johakyuExchangeHudState(exchangeView,{actorId:'hero',phase:action?.phase??exchangeView?.lastPhase,reaction:action?.scope==='combat-reaction'||action?.scope==='combat-counter-transition'});
    return freeze({comboStyle,recoveryRemaining:recoveringBurst?Math.max(0,recovery.until-time):0,mode,modeLabel:MODES[mode],phase,phaseLabel:PHASE_LABELS[phase],hudState,exchangeMode:exchangeView?.mode??'read',initiativeId:exchangeView?.initiativeId??null,
      exchangeSerial:exchangeView?.serial??0,completedBy:exchangeView?.completedBy??null,actionId:action?.id??null,actionName:action?.name??null,actionMotion:action?.motion?.kind??null,techniqueId:action?.techniqueId??cursorNode.technique.id,
      techniqueName:action?.name??cursorNode.technique.name,techniqueIndex:action?.techniqueIndex??heroCursor.techniqueIndex,chainLength:action?.chainLength??cursorNode.chain.length,
      chainLabel:action?.chainLabel??reviewChainLabel(cursorNode.phase,cursorNode.chain.length),stageIndex:action?.stageIndex??heroCursor.stageIndex,stageLabel:action?.stageLabel??cursorNode.stage.label,
      cycle:heroCursor.cycle,stamina:Math.round(hero.stamina),injuryPart:PART_LABELS[worst[0]],injuryPercent:Math.round(worst[1].severity*100),
      party:1,enemies:livingEnemies,resumes,encounter,epoch,battleId:frameValue.battleId,respawnIn:respawnAt===null?null:Math.max(0,respawnAt-time)});
  }
  function step(dt=1/60){
    if(!Number.isFinite(dt)||dt<0||dt>.25)throw new TypeError('Invalid P7 review delta');
    time+=dt;revision++;
    for(const [key,until]of settleAt)if(time>=until){const row=exchangeStates.get(key);exchangeStates.set(key,reduceJohakyuExchange(row,{type:'settle'}));settleAt.delete(key);}
    for(const actor of battle.actors.values())recoverJohakyuStamina(actor,dt);
    const actions=new Map([...battle.actors.values()].map(actor=>[actor.id,currentAction(actor)]));advanceFootwork(battle,positions,actions,maneuvers,time,dt);resolveBodySeparation(battle,positions);const events=applyContacts(actions);
    if(!battle.result&&checkpointSeconds>0&&!resumed&&time>=checkpointSeconds){const checkpoint=createJohakyuCheckpoint({battle,lifeId:'review-life',ageSeconds:28*60,encounterId:`review-${encounter}`});battle=restoreJohakyuCheckpoint(checkpoint).battle;epoch++;revision=0;resumes++;resumed=true;actionState.clear();reactionState.clear();reactionCooldowns.clear();counterWindows.clear();exchangeStates.clear();normalPending.clear();settleAt.clear();cursors.clear();maneuvers.clear();recoveries.clear();seedReadyWindow(.08);traceRow({type:'resume',epoch});}
    // No timed reset of a living encounter. Keep the final impact and terminal
    // actors in this epoch long enough to play their fall before endless repop.
    if(battle.result&&respawnAt===null){respawnAt=time+RESPAWN_DELAY_SECONDS;traceRow({type:'encounter-ended',winner:battle.result.winner,respawnDelay:RESPAWN_DELAY_SECONDS});}
    if(respawnAt!==null&&time>=respawnAt){
      const carry=winnerCarry(),winner=battle.result?.winner??null;encounter++;epoch++;time=0;freshBattle(carry);events.length=0;
      traceRow({type:'encounter-reset',epoch,encounter,winner,carried:[...carry.keys()]});
    }
    const nextActions=new Map([...battle.actors.values()].map(actor=>[actor.id,currentAction(actor)])),snapshot=frame(nextActions),review=meta(snapshot);lastFrame=snapshot;lastMeta=review;
    return freeze({frame:snapshot,events,meta:review});
  }
  function inspect(){const snapshot=lastFrame??frame(new Map()),review=lastMeta??meta(snapshot);return freeze({frame:snapshot,meta:review,events:lastEvents.slice(),trace:trace.slice(),exchanges:freeze([...exchangeStates.entries()].map(([key,value])=>freeze({key,...johakyuExchangeSnapshot(value)})))});}
  return Object.freeze({step,inspect,composition:freeze({hero:compositionFor(battle.actors.get('hero'),comboStyle),enemy:compositionFor(battle.actors.get('enemy-a'),comboStyle)})});
}