import {applyJohakyuImpactOnce,createJohakyuBattle,createJohakyuCheckpoint,johakyuActorCapability,recoverJohakyuStamina,restoreJohakyuCheckpoint,selectReachableTarget,spendJohakyuStamina} from '@soul/johakyu-combat/domain';
import {resolveJohakyuMotion} from '@soul/johakyu-combat/motion-contract';
import {addTechniqueToReviewChain,compileTechniqueComposition,createReviewTechniqueComposition,reviewChainLabel,techniqueFromCombatForm} from '@soul/johakyu-combat/technique-composition';

const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const PHASES=Object.freeze(['jo','ha','kyu']);
const PHASE_LABELS=Object.freeze({jo:'序',ha:'破',kyu:'急'});
const PART_LABELS=Object.freeze({head:'頭',torso:'胴',leftArm:'左腕',rightArm:'右腕',leftLeg:'左脚',rightLeg:'右脚'});
const MODES=Object.freeze({duel:'1v1',oneVsThree:'1v3'}),RESUME_SECONDS=7.5,ENCOUNTER_SECONDS=24;
const LAYOUT=Object.freeze({hero:{x:0,z:.35,yaw:0},'enemy-a':{x:0,z:2.25,yaw:Math.PI},'enemy-b':{x:-1.75,z:2.8,yaw:Math.PI},'enemy-c':{x:1.75,z:2.8,yaw:Math.PI}});
const TARGETS=Object.freeze({hero:['enemy-a','enemy-b','enemy-c'],'enemy-a':['hero'],'enemy-b':['hero'],'enemy-c':['hero']});
const KIND_DAMAGE=Object.freeze({slash:7,back:7,thrust:8,pierce:9,heavy:14,diagonal:9,sweep:8,counter:10,bash:7,pommel:6});
const KIND_COST=Object.freeze({slash:5,back:5,thrust:6,pierce:7,heavy:12,diagonal:7,sweep:7,counter:8,bash:6,pommel:5,guard:2,brace:2,parry:3,slip:3,retreat:2,ready:0});
const RHYTHM_SECONDS=Object.freeze({sharp:.58,flow:.66,weight:.82,elastic:.64,seamless:.54});
const CONTACT_REACH=2.35,MIN_SPACING=1.02;
const FOOTWORK_SPEED=Object.freeze({stay:0,forward:.72,chase:1.08,rush:1.5,retreat:.78,sideL:.7,sideR:.7,orbitL:.58,orbitR:.58,cross:.82,spiral:.9});

function buildComposition(rows){
  const composition=createReviewTechniqueComposition();
  for(const [phase,techniques] of Object.entries(rows))for(const [id,name] of techniques)addTechniqueToReviewChain(composition,phase,techniqueFromCombatForm(id,{weapon:'sword',name}));
  return compileTechniqueComposition(composition,{weapon:'sword'});
}
const HERO_COMPOSITION=buildComposition({
  jo:[['action.feint','誘い'],['action.side-step','外し歩']],
  ha:[['action.guard-step','受け流し歩法'],['action.counter','返し']],
  kyu:[['action.crash','打ち崩し'],['action.precision','一点通し']],
});
const ENEMY_COMPOSITION=buildComposition({
  jo:[['basic.sword','剣の型']],ha:[['basic.sword','剣の型']],kyu:[['basic.sword','剣の型']],
});

function actorRows(mode){const rows=[{id:'hero',side:'party',hp:125,maxHp:125,stamina:100,staminaCap:100,seed:73917,generation:4},{id:'enemy-a',side:'enemy',hp:mode==='duel'?150:100,maxHp:mode==='duel'?150:100,stamina:100,staminaCap:100,seed:8101,generation:1}];if(mode==='oneVsThree')rows.push({id:'enemy-b',side:'enemy',hp:82,maxHp:82,stamina:96,staminaCap:100,seed:8102,generation:1},{id:'enemy-c',side:'enemy',hp:108,maxHp:108,stamina:100,staminaCap:100,seed:8103,generation:1});return rows;}
function bodyView(actor){return Object.fromEntries(Object.entries(actor.injuries).map(([part,row])=>{const severity=Math.min(1,Math.max(0,Number(row.severity)||0));return[part,{severity,durability:Math.round((1-severity)*100),label:PART_LABELS[part]}];}));}
function selectTarget(battle,id){for(const candidate of TARGETS[id]){const actor=battle.actors.get(candidate);if(actor&&!actor.dead&&!actor.incapacitated)return actor;}return null;}
function compositionFor(actor){return actor.side==='party'?HERO_COMPOSITION:ENEMY_COMPOSITION;}
function cursorState(){return{phaseIndex:0,techniqueIndex:0,stageIndex:0,cycle:0};}
function nodeFor(actor,cursor){
  const composition=compositionFor(actor),phase=PHASES[cursor.phaseIndex],chain=composition[phase],technique=chain[cursor.techniqueIndex],stage=technique?.stages?.[cursor.stageIndex];
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
function stageDuration(technique,stage){const base=RHYTHM_SECONDS[technique.rhythm]||.66,kindScale=stage.kind==='heavy'?1.22:(['ready','guard','brace'].includes(stage.kind)?.9:1);return Math.max(.38,base*kindScale/Math.max(.72,technique.tempo||1));}
function stageCost(stage){return KIND_COST[stage.kind]??5;}
function stageDamage(stage){return KIND_DAMAGE[stage.kind]??0;}
function motionFor(node){const motion=resolveJohakyuMotion({weapon:'sword',kind:node.stage.step.kind,charge:node.stage.step.charge,phase:node.phase});if(!motion.supported)throw new Error('Unsupported composition motion: '+node.technique.id+'/'+node.stage.step.kind);return motion;}
const clampPosition=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
function positionOf(positions,actor){return positions.get(actor.id)??{x:LAYOUT[actor.id]?.x??0,z:LAYOUT[actor.id]?.z??0};}
function footworkVector(positions,actor,target,footwork){
  const from=positionOf(positions,actor),to=positionOf(positions,target),dx=to.x-from.x,dz=to.z-from.z,length=Math.max(.001,Math.hypot(dx,dz)),tx=dx/length,tz=dz/length,leftX=-tz,leftZ=tx;
  if(footwork==='retreat')return{x:-tx,z:-tz};
  if(footwork==='sideL')return{x:leftX,z:leftZ};if(footwork==='sideR')return{x:-leftX,z:-leftZ};
  if(footwork==='orbitL')return{x:leftX*.94+tx*.18,z:leftZ*.94+tz*.18};if(footwork==='orbitR')return{x:-leftX*.94+tx*.18,z:-leftZ*.94+tz*.18};
  if(footwork==='cross')return{x:tx*.72+leftX*.7,z:tz*.72+leftZ*.7};if(footwork==='spiral')return{x:tx*.62-leftX*.82,z:tz*.62-leftZ*.82};
  if(['forward','chase','rush'].includes(footwork))return{x:tx,z:tz};
  return{x:0,z:0};
}
function advanceFootwork(battle,positions,actions,dt){
  for(const actor of battle.actors.values()){
    const action=actions.get(actor.id),target=action?battle.actors.get(action.targetId):null,footwork=action?.footwork||'stay',speed=FOOTWORK_SPEED[footwork]??0;
    if(!target||!(speed>0)||actor.dead||actor.incapacitated)continue;
    const from=positionOf(positions,actor),targetPos=positionOf(positions,target),vector=footworkVector(positions,actor,target,footwork),closing=['forward','chase','rush','cross','spiral','orbitL','orbitR'].includes(footwork);
    let step=speed*dt;
    if(closing){const distance=Math.hypot(targetPos.x-from.x,targetPos.z-from.z);step=Math.min(step,Math.max(0,distance-MIN_SPACING));}
    positions.set(actor.id,{x:clampPosition(from.x+vector.x*step,-4.8,4.8),z:clampPosition(from.z+vector.z*step,-1.4,5.4)});
  }
}
function contactWindow(positions,source,target){
  const from=positionOf(positions,source),to=positionOf(positions,target),distance=Math.hypot(to.x-from.x,to.z-from.z);
  const reachable=selectReachableTarget({source:{id:source.id,...from},candidates:[{id:target.id,...to,dead:target.dead||target.incapacitated}],reach:CONTACT_REACH});
  return{reachable:Boolean(reachable),distance};
}

export function createJohakyuP7ReviewScenario({mode='duel',duelGap=1.9,enemyLeadSeconds=0}={}){
  if(!Object.hasOwn(MODES,mode))throw new RangeError('Unsupported battle review mode');
  if(!Number.isFinite(duelGap)||duelGap<1||duelGap>5)throw new RangeError('Invalid duel review gap');
  if(!Number.isFinite(enemyLeadSeconds)||enemyLeadSeconds<0||enemyLeadSeconds>1)throw new RangeError('Invalid enemy lead');
  let encounter=1,epoch=1,revision=0,time=0,resumes=0,resumed=false,battle;
  let actionState=new Map(),cursors=new Map(),readyAt=new Map(),positions=new Map(),lastEvents=[],trace=[],lastFrame=null,lastMeta=null,attemptSerial=0;

  function cursorFor(actor){let cursor=cursors.get(actor.id);if(!cursor){cursor=cursorState();cursors.set(actor.id,cursor);}return cursor;}
  function seedReadyWindow(delay=.24){readyAt.clear();for(const actor of battle.actors.values())readyAt.set(actor.id,time+Math.max(0,delay+(actor.side==='enemy'?.12-enemyLeadSeconds:0)));}
  function freshBattle(){
    battle=createJohakyuBattle({battleId:`review-p7:${mode}:${encounter}`,actors:actorRows(mode),seed:73917+encounter});
    actionState=new Map();cursors=new Map();readyAt=new Map();positions=new Map(Object.entries(LAYOUT).filter(([id])=>battle.actors.has(id)).map(([id,row])=>[id,{x:row.x,z:row.z}]));
    if(mode==='duel')positions.set('enemy-a',{x:LAYOUT.hero.x,z:LAYOUT.hero.z+duelGap});
    lastEvents=[];resumed=false;revision=0;attemptSerial=0;seedReadyWindow(.34);
  }
  freshBattle();

  function nextAction(actor){
    if(actor.dead||actor.incapacitated)return null;
    const target=selectTarget(battle,actor.id);if(!target)return null;
    const cursor=cursorFor(actor),node=nodeFor(actor,cursor),cost=stageCost(node.stage);
    if(cost>0&&!spendJohakyuStamina(actor,cost)){readyAt.set(actor.id,time+.32);return null;}
    const motion=motionFor(node),duration=stageDuration(node.technique,node.stage),serial=`${cursor.cycle}:${cursor.phaseIndex}:${cursor.techniqueIndex}:${cursor.stageIndex}`;
    const state={phaseEpoch:`${cursor.cycle}:${cursor.phaseIndex}`,startedAt:time,duration,impacted:false,outcome:null,
      id:`${battle.battleId}:${actor.id}:${serial}:attempt-${++attemptSerial}`,targetId:target.id,node,motion};
    if(actor.id==='hero')trace.push({type:'stage-start',time:Number(time.toFixed(2)),phase:node.phase,techniqueId:node.technique.id,techniqueIndex:cursor.techniqueIndex,stageIndex:cursor.stageIndex,attackId:state.id});
    return state;
  }
  function breakChain(actor,state,reason){
    const cursor=cursorFor(actor),node=nodeFor(actor,cursor),techniqueIndex=cursor.techniqueIndex;
    cursor.stageIndex=0;
    actionState.delete(actor.id);readyAt.set(actor.id,time+.24);
    if(actor.id==='hero')trace.push({type:'chain-break',time:Number(time.toFixed(2)),reason,phase:node.phase,techniqueId:state.node.technique.id,techniqueIndex,stageIndex:state.node.stage.index,restartTechniqueIndex:techniqueIndex,restartStageIndex:0});
  }
  function finishAction(actor,state,{interrupted=false}={}){
    actionState.delete(actor.id);
    const failure=interrupted||state.outcome==='miss';
    if(failure){breakChain(actor,state,interrupted||'miss');return;}
    const moved=advanceCursor(actor,cursorFor(actor));
    if(actor.id==='hero'&&moved.before.phase!==moved.after.phase)trace.push({type:'phase-change',time:Number(time.toFixed(2)),phase:moved.after.phase,reason:'configured-chain-complete'});
    readyAt.set(actor.id,time+.06);
  }
  function currentAction(actor){
    let state=actionState.get(actor.id);
    if(state?.interrupted){finishAction(actor,state,{interrupted:state.interrupted});state=null;}
    if(state&&time-state.startedAt>=state.duration){finishAction(actor,state);state=null;}
    if(!state){if(time<(readyAt.get(actor.id)||0))return null;state=nextAction(actor);if(!state)return null;actionState.set(actor.id,state);}
    const {node}=state,progress=Math.min(.999,Math.max(0,(time-state.startedAt)/state.duration));
    return{id:state.id,targetId:state.targetId,techniqueId:node.technique.id,name:node.technique.name,phase:node.phase,step:node.stage.index,
      stageIndex:node.stage.index,stageLabel:node.stage.label,techniqueIndex:node.chain.indexOf(node.technique),chainLength:node.chain.length,
      chainLabel:reviewChainLabel(node.phase,node.chain.length),cycle:cursorFor(actor).cycle,footwork:node.stage.step.footwork,
      progress,duration:state.duration,motion:state.motion,legal:true,scope:'review-technique-composition'};
  }
  function applyContacts(actions){
    const events=[];
    for(const [id,action] of actions){
      if(!action||!action.motion.offense||action.progress<.46)continue;
      const state=actionState.get(id);if(!state||state.impacted)continue;state.impacted=true;
      const source=battle.actors.get(id),target=battle.actors.get(action.targetId);if(!source||!target)continue;
      const damage=stageDamage(state.node.stage);if(!(damage>0))continue;
      const contact=contactWindow(positions,source,target);
      if(!contact.reachable){state.outcome='miss';trace.push({type:'miss',time:Number(time.toFixed(2)),attackId:action.id,sourceId:source.id,targetId:target.id,phase:action.phase,techniqueId:action.techniqueId,stageIndex:action.stageIndex,distance:Number(contact.distance.toFixed(3)),reach:CONTACT_REACH});continue;}
      const eventId=`${action.id}:${source.id}:${target.id}:impact`,result=applyJohakyuImpactOnce(battle,{eventId,attackId:action.id,sourceId:source.id,targetId:target.id,damage,phase:action.phase});
      if(!result.applied)continue;state.outcome='hit';
      const event=freeze({id:eventId,type:source.side==='party'?'player-hit':'enemy-hit',attackId:action.id,sourceId:source.id,targetId:target.id,damage:result.dealt,phase:action.phase,
        techniqueId:action.techniqueId,techniqueName:action.name,stageIndex:action.stageIndex,stageLabel:action.stageLabel,contactDistance:Number(contact.distance.toFixed(3)),contactReach:CONTACT_REACH,bodyPart:result.part,bodyDurability:result.durability,blocked:false});
      events.push(event);trace.push({type:'impact',time:Number(time.toFixed(2)),...event});
      const targetAction=actionState.get(target.id),targetProgress=targetAction?Math.max(0,(time-targetAction.startedAt)/targetAction.duration):1;if(targetAction&&targetProgress<.34&&!targetAction.impacted&&!['guard','parry','brace'].includes(targetAction.node.stage.step.kind))targetAction.interrupted='hit-before-contact';
    }
    if(events.length){lastEvents=events;if(trace.length>120)trace=trace.slice(-120);}
    return events;
  }
  function positionFor(actor){const p=positionOf(positions,actor);return{x:p.x,z:p.z};}
  function frame(actions){
    const actors=[...battle.actors.values()].map(actor=>{const action=actions.get(actor.id)??null,capability=johakyuActorCapability(actor);void capability;return{id:actor.id,side:actor.side,self:actor.id==='hero',kind:actor.side==='party'?'hero':'enemy',boss:actor.id==='enemy-c',position:positionFor(actor,action),yaw:LAYOUT[actor.id].yaw,hp:actor.hp,maxHp:actor.maxHp,body:bodyView(actor),stamina:{value:actor.stamina,cap:actor.staminaCap},equipment:{weapon:'sword',armor:actor.side==='party'?'heavy':'cloth',shield:false},moving:Boolean(action&&action.footwork!=='stay'),resting:false,dead:actor.dead,downed:actor.incapacitated,hit:false,ageYears:actor.side==='party'?28:0,action};});
    return freeze({version:1,authority:'rinne-domain',reviewFixture:'p7-technique-composition',reviewMode:mode,battleId:battle.battleId,epoch,revision,status:battle.result?'won':'battle',actors,obstacles:[],projectiles:[],result:battle.result??{cleared:false,defeats:0,returns:resumes}});
  }
  function meta(frameValue){
    const hero=battle.actors.get('hero'),injuries=Object.entries(hero.injuries).sort((a,b)=>b[1].severity-a[1].severity),worst=injuries[0],heroView=frameValue.actors.find(actor=>actor.self),action=heroView?.action??null;
    const heroCursor=cursorFor(hero),cursorNode=nodeFor(hero,heroCursor),livingEnemies=[...battle.actors.values()].filter(actor=>actor.side==='enemy'&&!actor.incapacitated&&!actor.dead).length;
    return freeze({mode,modeLabel:MODES[mode],phase:action?.phase??cursorNode.phase,phaseLabel:PHASE_LABELS[action?.phase??cursorNode.phase],
      actionId:action?.id??null,actionName:action?.name??null,actionMotion:action?.motion?.kind??null,techniqueId:action?.techniqueId??cursorNode.technique.id,
      techniqueName:action?.name??cursorNode.technique.name,techniqueIndex:action?.techniqueIndex??heroCursor.techniqueIndex,chainLength:action?.chainLength??cursorNode.chain.length,
      chainLabel:action?.chainLabel??reviewChainLabel(cursorNode.phase,cursorNode.chain.length),stageIndex:action?.stageIndex??heroCursor.stageIndex,stageLabel:action?.stageLabel??cursorNode.stage.label,
      cycle:heroCursor.cycle,stamina:Math.round(hero.stamina),injuryPart:PART_LABELS[worst[0]],injuryPercent:Math.round(worst[1].severity*100),
      party:1,enemies:livingEnemies,resumes,encounter,epoch,battleId:frameValue.battleId});
  }
  function step(dt=1/60){
    if(!Number.isFinite(dt)||dt<0||dt>.25)throw new TypeError('Invalid P7 review delta');
    time+=dt;revision++;for(const actor of battle.actors.values())recoverJohakyuStamina(actor,dt);
    const actions=new Map([...battle.actors.values()].map(actor=>[actor.id,currentAction(actor)]));advanceFootwork(battle,positions,actions,dt);const events=applyContacts(actions);
    if(!resumed&&time>=RESUME_SECONDS){const checkpoint=createJohakyuCheckpoint({battle,lifeId:'review-life',ageSeconds:28*60,encounterId:`review-${encounter}`});battle=restoreJohakyuCheckpoint(checkpoint).battle;epoch++;revision=0;resumes++;resumed=true;actionState.clear();seedReadyWindow(.08);trace.push({type:'resume',time:Number(time.toFixed(2)),epoch});}
    if(time>=ENCOUNTER_SECONDS||battle.result){encounter++;epoch++;time=0;freshBattle();trace.push({type:'encounter-reset',time:0,epoch,encounter});}
    const nextActions=new Map([...battle.actors.values()].map(actor=>[actor.id,currentAction(actor)])),snapshot=frame(nextActions),review=meta(snapshot);lastFrame=snapshot;lastMeta=review;
    return freeze({frame:snapshot,events,meta:review});
  }
  function inspect(){const snapshot=lastFrame??frame(new Map()),review=lastMeta??meta(snapshot);return freeze({frame:snapshot,meta:review,events:lastEvents.slice(),trace:trace.slice()});}
  return Object.freeze({step,inspect,composition:freeze({hero:HERO_COMPOSITION,enemy:ENEMY_COMPOSITION})});
}
