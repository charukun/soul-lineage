import {applyJohakyuImpactOnce,createJohakyuBattle,createJohakyuCheckpoint,johakyuActorCapability,recoverJohakyuStamina,restoreJohakyuCheckpoint,spendJohakyuStamina} from '@soul/johakyu-combat/domain';
import {resolveJohakyuMotion} from '@soul/johakyu-combat/motion-contract';
import {createCanonicalReviewComposition,reviewChainSnapshot} from './johakyu-technique-composition.js';

const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const PHASES=Object.freeze(['jo','ha','kyu']),PHASE_LABELS=Object.freeze({jo:'序',ha:'破',kyu:'急'});
const PART_LABELS=Object.freeze({head:'頭',torso:'胴',leftArm:'左腕',rightArm:'右腕',leftLeg:'左脚',rightLeg:'右脚'});
const MODES=Object.freeze({duel:'1v1',oneVsThree:'1v3'}),ENCOUNTER_SECONDS=20;
const LAYOUT=Object.freeze({hero:{x:0,z:.35,yaw:0},'enemy-a':{x:0,z:2.25,yaw:Math.PI},'enemy-b':{x:-1.75,z:2.8,yaw:Math.PI},'enemy-c':{x:1.75,z:2.8,yaw:Math.PI}});
const TARGETS=Object.freeze({hero:['enemy-a','enemy-b','enemy-c'],'enemy-a':['hero'],'enemy-b':['hero'],'enemy-c':['hero']});
const PHASE_DAMAGE=Object.freeze({jo:7,ha:9,kyu:12});
const OFFENSE=new Set(['slash','back','thrust','heavy','diagonal','sweep','counter','pierce','dash','crosscut','round','bash']);
const COST=Object.freeze({ready:0,guard:2,slip:3,brace:2,parry:4,retreat:2,slash:5,back:6,thrust:7,heavy:12,diagonal:7,sweep:8,counter:8,pierce:9,dash:7,crosscut:9,round:9,bash:6});

function actorRows(mode){const rows=[{id:'hero',side:'party',hp:145,maxHp:145,stamina:100,staminaCap:100,seed:73917,generation:4},{id:'enemy-a',side:'enemy',hp:260,maxHp:260,stamina:100,staminaCap:100,seed:8101,generation:1}];if(mode==='oneVsThree')rows.push({id:'enemy-b',side:'enemy',hp:180,maxHp:180,stamina:96,staminaCap:100,seed:8102,generation:1},{id:'enemy-c',side:'enemy',hp:220,maxHp:220,stamina:100,staminaCap:100,seed:8103,generation:1});return rows;}
function bodyView(actor){return Object.fromEntries(Object.entries(actor.injuries).map(([part,row])=>{const severity=Math.min(1,Math.max(0,Number(row.severity)||0));return[part,{severity,durability:Math.round((1-severity)*100),label:PART_LABELS[part]}];}));}
function selectTarget(battle,id){for(const candidate of TARGETS[id]){const actor=battle.actors.get(candidate);if(actor&&!actor.dead&&!actor.incapacitated)return actor;}return null;}
function motionFor(step,phase){const motion=resolveJohakyuMotion({weapon:'sword',kind:step.kind,charge:step.charge,phase});if(!motion.supported)throw new Error('Unsupported technique stage: '+phase+'/'+step.kind);return motion;}
function durationFor(technique,step){const base=OFFENSE.has(step.kind)?.72:.58;return base/Math.max(.75,Math.min(1.3,technique.tempo||1));}
function damageFor(phase,kind){const scale=kind==='heavy'?1.35:kind==='counter'||kind==='pierce'?1.15:1;return Math.round(PHASE_DAMAGE[phase]*scale);}
function phaseIndex(phase){return Math.max(0,PHASES.indexOf(phase));}

export function createJohakyuP7ReviewScenario({mode='duel'}={}){
  if(!Object.hasOwn(MODES,mode))throw new RangeError('Unsupported battle review mode');
  const composition=createCanonicalReviewComposition({weapon:'sword'}),compositionSnapshot=reviewChainSnapshot(composition);
  let encounter=1,epoch=1,revision=0,time=0,battle,actionState=new Map(),readyAt=new Map(),lastEvents=[],trace=[],lastFrame=null,lastMeta=null;
  let sequence={phase:'jo',techniqueIndex:0,stageIndex:0,cycle:0,reason:'chain-start'};

  function freshBattle(){battle=createJohakyuBattle({battleId:`review-technique:${mode}:${encounter}`,actors:actorRows(mode),seed:73917+encounter});actionState=new Map();readyAt=new Map([...battle.actors.keys()].map(id=>[id,time+.28]));lastEvents=[];revision=0;sequence={phase:'jo',techniqueIndex:0,stageIndex:0,cycle:0,reason:'chain-start'};}
  freshBattle();

  function currentTechnique(){const chain=composition[sequence.phase]||[];return chain[sequence.techniqueIndex%Math.max(1,chain.length)]||null;}
  function advanceSequence(reason){
    const chain=composition[sequence.phase]||[],technique=currentTechnique();if(!technique)return;
    if(sequence.stageIndex+1<technique.steps.length){sequence={...sequence,stageIndex:sequence.stageIndex+1,reason};return;}
    if(sequence.techniqueIndex+1<chain.length){sequence={...sequence,techniqueIndex:sequence.techniqueIndex+1,stageIndex:0,reason:'technique-link'};return;}
    const next=PHASES[(phaseIndex(sequence.phase)+1)%PHASES.length],wrapped=next==='jo';
    sequence={phase:next,techniqueIndex:0,stageIndex:0,cycle:sequence.cycle+(wrapped?1:0),reason:'phase-link'};
    trace.push({type:'phase-change',time:Number(time.toFixed(2)),phase:next,reason:'chain-complete'});
  }
  function heroAction(){
    const actor=battle.actors.get('hero');if(!actor||actor.dead||actor.incapacitated)return null;
    let state=actionState.get('hero');
    if(state&&time-state.startedAt>=state.duration){actionState.delete('hero');readyAt.set('hero',time+.1);advanceSequence('stage-complete');state=null;}
    if(!state&&time>=(readyAt.get('hero')||0)){
      const target=selectTarget(battle,'hero'),technique=currentTechnique(),step=technique?.steps?.[sequence.stageIndex];if(!target||!technique||!step)return null;
      const cost=COST[step.kind]??5;if(cost&&!spendJohakyuStamina(actor,cost)){readyAt.set('hero',time+.32);return null;}
      const id=`${battle.battleId}:hero:${sequence.phase}:${sequence.techniqueIndex}:${sequence.stageIndex}:${sequence.cycle}`;
      state={id,targetId:target.id,startedAt:time,duration:durationFor(technique,step),impacted:false,phase:sequence.phase,techniqueId:technique.id,techniqueName:technique.name,techniqueIndex:sequence.techniqueIndex,stageIndex:sequence.stageIndex,step,motion:motionFor(step,sequence.phase)};actionState.set('hero',state);
      trace.push({type:'stage-start',time:Number(time.toFixed(2)),phase:state.phase,techniqueId:state.techniqueId,techniqueName:state.techniqueName,techniqueIndex:state.techniqueIndex,stageIndex:state.stageIndex,kind:step.kind});
    }
    if(!state)return null;return{id:state.id,targetId:state.targetId,techniqueId:state.techniqueId,name:state.techniqueName,phase:state.phase,techniqueIndex:state.techniqueIndex,stageIndex:state.stageIndex,step:state.stageIndex,progress:Math.min(.999,(time-state.startedAt)/state.duration),duration:state.duration,motion:state.motion,legal:true,scope:'review-technique-chain'};
  }
  function enemyAction(actor){
    let state=actionState.get(actor.id);if(state&&time-state.startedAt>=state.duration){actionState.delete(actor.id);readyAt.set(actor.id,time+.38);state=null;}
    if(!state&&time>=(readyAt.get(actor.id)||0)){const target=selectTarget(battle,actor.id);if(!target)return null;const kind=(Math.floor(time*1.3)+actor.id.charCodeAt(actor.id.length-1))%3===0?'guard':'slash',step={kind,footwork:kind==='guard'?'stay':'forward',charge:'none'};state={id:`${battle.battleId}:${actor.id}:${Math.floor(time*10)}`,targetId:target.id,startedAt:time,duration:kind==='guard'?.68:.82,impacted:false,phase:'enemy',step,motion:motionFor(step,'enemy')};actionState.set(actor.id,state);}
    if(!state)return null;return{id:state.id,targetId:state.targetId,techniqueId:null,name:state.step.kind==='guard'?'受け':'斬撃',phase:'enemy',stageIndex:0,step:0,progress:Math.min(.999,(time-state.startedAt)/state.duration),duration:state.duration,motion:state.motion,legal:true,scope:'review-enemy'};
  }
  function actions(){return new Map([...battle.actors.values()].map(actor=>[actor.id,actor.id==='hero'?heroAction():enemyAction(actor)]));}
  function contacts(rows){
    const events=[];
    for(const [id,action] of rows){if(!action||!action.motion.offense||action.progress<.48)continue;const state=actionState.get(id);if(!state||state.impacted)continue;state.impacted=true;const source=battle.actors.get(id),target=battle.actors.get(action.targetId);if(!source||!target)continue;const eventId=`${action.id}:${id}:${target.id}:impact`,phase=id==='hero'?action.phase:'ha',result=applyJohakyuImpactOnce(battle,{eventId,attackId:action.id,sourceId:id,targetId:target.id,damage:id==='hero'?damageFor(phase,state.step.kind):6,phase});if(!result.applied)continue;const event=freeze({id:eventId,type:id==='hero'?'player-hit':'enemy-hit',attackId:action.id,sourceId:id,targetId:target.id,techniqueId:action.techniqueId??null,techniqueName:action.name,techniqueIndex:action.techniqueIndex??null,stageIndex:action.stageIndex??null,damage:result.dealt,phase,bodyPart:result.part,bodyDurability:result.durability,blocked:false});events.push(event);trace.push({type:'impact',time:Number(time.toFixed(2)),...event});}
    if(events.length){lastEvents=events;if(trace.length>120)trace=trace.slice(-120);}return events;
  }
  function positionFor(actor,action){const base=LAYOUT[actor.id],index=Object.keys(LAYOUT).indexOf(actor.id);let z=base.z,x=base.x;if(action?.motion?.footwork==='retreat')z+=actor.side==='party'?-.28:.28;if(action?.motion?.offense)z+=actor.side==='party'?.09:-.1;return{x:x+Math.sin(time*.6+index)*.04,z:z+Math.cos(time*.48+index)*.03};}
  function frame(rows){const actors=[...battle.actors.values()].map(actor=>{const action=rows.get(actor.id)??null,capability=johakyuActorCapability(actor);void capability;return{id:actor.id,side:actor.side,self:actor.id==='hero',kind:actor.side==='party'?'hero':'enemy',boss:actor.id==='enemy-c',position:positionFor(actor,action),yaw:LAYOUT[actor.id].yaw,hp:actor.hp,maxHp:actor.maxHp,body:bodyView(actor),stamina:{value:actor.stamina,cap:actor.staminaCap},equipment:{weapon:'sword',armor:actor.side==='party'?'heavy':'cloth',shield:false},moving:Boolean(action?.motion?.footwork&&action.motion.footwork!=='stay'),resting:false,dead:actor.dead,downed:actor.incapacitated,hit:false,ageYears:actor.side==='party'?28:0,action};});return freeze({version:1,authority:'rinne-domain',reviewFixture:'technique-system',reviewMode:mode,battleId:battle.battleId,epoch,revision,status:battle.result?'won':'battle',actors,obstacles:[],projectiles:[],result:battle.result??{cleared:false,defeats:0,returns:0}});}
  function meta(snapshot){const hero=battle.actors.get('hero'),heroView=snapshot.actors.find(actor=>actor.self),action=heroView?.action??null,injuries=Object.entries(hero.injuries).sort((a,b)=>b[1].severity-a[1].severity),worst=injuries[0];return freeze({mode,modeLabel:MODES[mode],phase:action?.phase??sequence.phase,phaseLabel:PHASE_LABELS[action?.phase??sequence.phase],actionId:action?.id??null,actionName:action?.name??null,actionMotion:action?.motion?.kind??null,techniqueId:action?.techniqueId??currentTechnique()?.id??null,techniqueName:action?.name??currentTechnique()?.name??null,techniqueIndex:action?.techniqueIndex??sequence.techniqueIndex,stageIndex:action?.stageIndex??sequence.stageIndex,stageLabel:`${(action?.stageIndex??sequence.stageIndex)+1}段`,chainLength:composition[sequence.phase]?.length??0,composition:compositionSnapshot,stamina:Math.round(hero.stamina),injuryPart:PART_LABELS[worst[0]],injuryPercent:Math.round(worst[1].severity*100),party:1,enemies:[...battle.actors.values()].filter(actor=>actor.side==='enemy'&&!actor.dead&&!actor.incapacitated).length,encounter,epoch,battleId:snapshot.battleId});}
  function step(dt=1/60){if(!Number.isFinite(dt)||dt<0||dt>.25)throw new TypeError('Invalid P7 review delta');time+=dt;revision++;for(const actor of battle.actors.values())recoverJohakyuStamina(actor,dt);const before=actions(),events=contacts(before);if(time>=ENCOUNTER_SECONDS||battle.result){encounter++;epoch++;time=0;freshBattle();trace.push({type:'encounter-reset',time:0,epoch,encounter});}const next=actions(),snapshot=frame(next),review=meta(snapshot);lastFrame=snapshot;lastMeta=review;return freeze({frame:snapshot,events,meta:review});}
  function inspect(){const snapshot=lastFrame??frame(new Map()),review=lastMeta??meta(snapshot);return freeze({frame:snapshot,meta:review,events:lastEvents.slice(),trace:trace.slice()});}
  return Object.freeze({step,inspect});
}
