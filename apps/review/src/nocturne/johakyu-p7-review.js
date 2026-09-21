import {applyJohakyuImpactOnce,createJohakyuBattle,createJohakyuCheckpoint,johakyuActorCapability,recoverJohakyuStamina,restoreJohakyuCheckpoint,spendJohakyuStamina} from '@soul/johakyu-combat/domain';
import {resolveJohakyuMotion} from '@soul/johakyu-combat/motion-contract';

const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const PHASE_LABELS=Object.freeze({jo:'序',ha:'破',kyu:'急'});
const PART_LABELS=Object.freeze({head:'頭',torso:'胴',leftArm:'左腕',rightArm:'右腕',leftLeg:'左脚',rightLeg:'右脚'});
const MODES=Object.freeze({duel:'1v1',oneVsThree:'1v3'}),RESUME_SECONDS=7.5,ENCOUNTER_SECONDS=18;
const LAYOUT=Object.freeze({hero:{x:0,z:.35,yaw:0},'enemy-a':{x:0,z:2.25,yaw:Math.PI},'enemy-b':{x:-1.75,z:2.8,yaw:Math.PI},'enemy-c':{x:1.75,z:2.8,yaw:Math.PI}});
const TARGETS=Object.freeze({hero:['enemy-a','enemy-b','enemy-c'],'enemy-a':['hero'],'enemy-b':['hero'],'enemy-c':['hero']});
const DAMAGE=Object.freeze({jo:6,ha:10,kyu:16});
const TACTICS=Object.freeze({
  jo:Object.freeze({
    party:Object.freeze([
      {kind:'ready',name:'見切り',duration:.68,cost:0},
      {kind:'slash',name:'探り斬り',duration:.88,cost:5},
      {kind:'retreat',name:'間を切る',duration:.72,cost:2},
      {kind:'thrust',name:'差し込み',duration:.86,cost:6},
    ]),
    enemy:Object.freeze([
      {kind:'ready',name:'様子見',duration:.72,cost:0},
      {kind:'guard',name:'受け構え',duration:.68,cost:2},
      {kind:'slash',name:'牽制',duration:.94,cost:5},
    ]),
  }),
  ha:Object.freeze({
    party:Object.freeze([
      {kind:'guard',name:'受け',duration:.64,cost:3},
      {kind:'counter',name:'返し',duration:.82,cost:8},
      {kind:'diagonal',name:'崩し斬り',duration:.88,cost:9},
      {kind:'sweep',name:'薙ぎ崩し',duration:.92,cost:10},
    ]),
    enemy:Object.freeze([
      {kind:'slash',name:'攻め込み',duration:.88,cost:7},
      {kind:'guard',name:'受け',duration:.66,cost:3},
      {kind:'counter',name:'返し',duration:.84,cost:8},
      {kind:'back',name:'切り返し',duration:.9,cost:9},
    ]),
  }),
  kyu:Object.freeze({
    party:Object.freeze([
      {kind:'heavy',name:'決め太刀',duration:1.02,cost:14},
      {kind:'thrust',name:'詰め',duration:.78,cost:11},
      {kind:'heavy',name:'押し切り',duration:.98,cost:14},
    ]),
    enemy:Object.freeze([
      {kind:'guard',name:'凌ぎ',duration:.64,cost:4},
      {kind:'heavy',name:'逆転打',duration:1.08,cost:13},
      {kind:'counter',name:'最後の返し',duration:.82,cost:10},
    ]),
  }),
});

function actorRows(mode){const rows=[{id:'hero',side:'party',hp:125,maxHp:125,stamina:100,staminaCap:100,seed:73917,generation:4},{id:'enemy-a',side:'enemy',hp:100,maxHp:100,stamina:100,staminaCap:100,seed:8101,generation:1}];if(mode==='oneVsThree')rows.push({id:'enemy-b',side:'enemy',hp:82,maxHp:82,stamina:96,staminaCap:100,seed:8102,generation:1},{id:'enemy-c',side:'enemy',hp:108,maxHp:108,stamina:100,staminaCap:100,seed:8103,generation:1});return rows;}
function bodyView(actor){return Object.fromEntries(Object.entries(actor.injuries).map(([part,row])=>{const severity=Math.min(1,Math.max(0,Number(row.severity)||0));return[part,{severity,durability:Math.round((1-severity)*100),label:PART_LABELS[part]}];}));}
function selectTarget(battle,id){for(const candidate of TARGETS[id]){const actor=battle.actors.get(candidate);if(actor&&!actor.dead&&!actor.incapacitated)return actor;}return null;}
function maxSeverity(actor){return Math.max(0,...Object.values(actor.injuries||{}).map(row=>Number(row?.severity)||0));}
function damageFor(id,phase,kind){const heavy=kind==='heavy'?1.24:kind==='counter'?1.08:1;return Math.round((DAMAGE[phase]+(id==='enemy-c'?2:0))*heavy);}
function motionFor(kind,phase){const motion=resolveJohakyuMotion({weapon:'sword',kind,phase});if(!motion.supported)throw new Error('Unsupported situational motion: '+phase+'/'+kind);return motion;}

export function createJohakyuP7ReviewScenario({mode='duel'}={}){
  if(!Object.hasOwn(MODES,mode))throw new RangeError('Unsupported battle review mode');
  let encounter=1,epoch=1,revision=0,time=0,resumes=0,resumed=false,battle;
  let actionState=new Map(),serials=new Map(),lastEvents=[],trace=[],lastFrame=null,lastMeta=null;
  let flow;
  function resetFlow(){flow={phase:'jo',epoch:1,initiative:0,phaseExchanges:0,heroHits:0,enemyHits:0,reason:'opening-read'};}
  function freshBattle(){battle=createJohakyuBattle({battleId:`review-p7:${mode}:${encounter}`,actors:actorRows(mode),seed:73917+encounter});actionState=new Map();serials=new Map();lastEvents=[];resumed=false;revision=0;resetFlow();}
  freshBattle();

  function transition(next,reason){
    if(flow.phase===next)return;
    flow={phase:next,epoch:flow.epoch+1,initiative:0,phaseExchanges:0,heroHits:0,enemyHits:0,reason};
    actionState.clear();
    trace.push({type:'phase-change',time:Number(time.toFixed(2)),phase:next,reason});
  }
  function evaluateFlow(){
    const hero=battle.actors.get('hero'),targets=[...battle.actors.values()].filter(actor=>actor.side==='enemy'&&!actor.dead&&!actor.incapacitated);
    const weakest=targets.length?Math.min(...targets.map(actor=>actor.hp/actor.maxHp)):0;
    const injury=targets.length?Math.max(...targets.map(maxSeverity)):1;
    const heroPressure=hero.hp/hero.maxHp<.7||maxSeverity(hero)>.18;
    if(flow.phase==='jo'){
      const readEstablished=(flow.heroHits>0&&flow.enemyHits>0)||Math.abs(flow.initiative)>=2;
      if(flow.phaseExchanges>=2&&readEstablished)transition('ha',flow.initiative>=0?'opening-read-won':'opening-read-contested');
      return;
    }
    if(flow.phase==='ha'){
      const opening=weakest<.76||injury>.16||heroPressure||Math.abs(flow.initiative)>=2;
      if(flow.phaseExchanges>=2&&opening)transition('kyu',heroPressure&&flow.initiative<0?'danger-window':'decisive-opening');
      return;
    }
    if(flow.phase==='kyu'&&flow.phaseExchanges>=3&&!battle.result){
      const stillUndecided=weakest>.42&&hero.hp/hero.maxHp>.42;
      if(stillUndecided)transition('ha','decisive-window-closed');
    }
  }
  function nextAction(actor){
    if(actor.dead||actor.incapacitated)return null;
    const target=selectTarget(battle,actor.id);if(!target)return null;
    const role=actor.side==='party'?'party':'enemy',plan=TACTICS[flow.phase][role],serial=serials.get(actor.id)||0;
    let choice=plan[serial%plan.length],motion=motionFor(choice.kind,flow.phase),allowed=choice.cost===0||spendJohakyuStamina(actor,choice.cost);
    if(!allowed){choice={kind:'ready',name:'息を整える',duration:.7,cost:0};motion=motionFor('ready',flow.phase);}
    serials.set(actor.id,serial+1);
    return {serial,phaseEpoch:flow.epoch,startedAt:time,duration:choice.duration,impacted:false,kind:choice.kind,
      id:`${battle.battleId}:${actor.id}:${flow.epoch}:${serial}`,targetId:target.id,name:`${PHASE_LABELS[flow.phase]}・${choice.name}`,motion};
  }
  function currentAction(actor){
    let state=actionState.get(actor.id);
    if(state&&(state.phaseEpoch!==flow.epoch||time-state.startedAt>=state.duration)){state=null;actionState.delete(actor.id);}
    if(!state){state=nextAction(actor);if(!state)return null;actionState.set(actor.id,state);}
    const progress=Math.min(.999,Math.max(0,(time-state.startedAt)/state.duration));
    return{id:state.id,targetId:state.targetId,techniqueId:'basic.sword',name:state.name,phase:flow.phase,step:state.serial%3,progress,duration:state.duration,motion:state.motion,legal:true,scope:'review-p7-situational'};
  }
  function applyContacts(actions){
    const events=[];
    for(const [id,action] of actions){
      if(!action||!action.motion.offense||action.progress<.46)continue;
      const state=actionState.get(id);if(!state||state.impacted)continue;state.impacted=true;
      const source=battle.actors.get(id),target=battle.actors.get(action.targetId);if(!source||!target)continue;
      const eventId=`${action.id}:${source.id}:${target.id}:impact`,result=applyJohakyuImpactOnce(battle,{eventId,attackId:action.id,sourceId:source.id,targetId:target.id,damage:damageFor(id,flow.phase,state.kind),phase:flow.phase});
      if(!result.applied)continue;
      const partyHit=source.side==='party';flow.phaseExchanges++;flow.initiative+=partyHit?1:-1;if(partyHit)flow.heroHits++;else flow.enemyHits++;
      const event=freeze({id:eventId,type:partyHit?'player-hit':'enemy-hit',attackId:action.id,sourceId:source.id,targetId:target.id,damage:result.dealt,phase:flow.phase,bodyPart:result.part,bodyDurability:result.durability,blocked:false});
      events.push(event);trace.push({type:'impact',time:Number(time.toFixed(2)),...event});
    }
    if(events.length){lastEvents=events;if(trace.length>100)trace=trace.slice(-100);evaluateFlow();}
    return events;
  }
  function positionFor(actor,action){
    const base=LAYOUT[actor.id],index=Object.keys(LAYOUT).indexOf(actor.id),phaseOffset=flow.phase==='jo'?.34:flow.phase==='kyu'?-.26:0;
    let z=base.z+(actor.side==='enemy'?phaseOffset:0),x=base.x;
    if(action?.motion?.kind==='retreat')z+=actor.side==='party'?-.28:.28;
    if(action?.motion?.offense)z+=actor.side==='party'?.08:-.12;
    return{x:x+Math.sin(time*.7+index)*.055,z:z+Math.cos(time*.55+index)*.04};
  }
  function frame(actions){
    const actors=[...battle.actors.values()].map(actor=>{const action=actions.get(actor.id)??null,capability=johakyuActorCapability(actor);void capability;return{id:actor.id,side:actor.side,self:actor.id==='hero',kind:actor.side==='party'?'hero':'enemy',boss:actor.id==='enemy-c',position:positionFor(actor,action),yaw:LAYOUT[actor.id].yaw,hp:actor.hp,maxHp:actor.maxHp,body:bodyView(actor),stamina:{value:actor.stamina,cap:actor.staminaCap},equipment:{weapon:'sword',armor:actor.side==='party'?'heavy':'cloth',shield:false},moving:Boolean(action?.motion?.kind==='retreat'),resting:false,dead:actor.dead,downed:actor.incapacitated,hit:false,ageYears:actor.side==='party'?28:0,action};});
    return freeze({version:1,authority:'rinne-domain',reviewFixture:'p7',reviewMode:mode,battleId:battle.battleId,epoch,revision,status:battle.result?'won':'battle',actors,obstacles:[],projectiles:[],result:battle.result??{cleared:false,defeats:0,returns:resumes}});
  }
  function meta(frameValue){
    const hero=battle.actors.get('hero'),injuries=Object.entries(hero.injuries).sort((a,b)=>b[1].severity-a[1].severity),worst=injuries[0],heroView=frameValue.actors.find(actor=>actor.self),action=heroView?.action??null;
    const livingEnemies=[...battle.actors.values()].filter(actor=>actor.side==='enemy'&&!actor.incapacitated&&!actor.dead).length;
    return freeze({mode,modeLabel:MODES[mode],phase:action?.phase??null,phaseLabel:action?.phase?PHASE_LABELS[action.phase]:'',actionId:action?.id??null,actionName:action?.name??null,actionMotion:action?.motion?.kind??null,
      flowPhase:flow.phase,flowEpoch:flow.epoch,flowReason:flow.reason,initiative:flow.initiative,phaseExchanges:flow.phaseExchanges,
      stamina:Math.round(hero.stamina),injuryPart:PART_LABELS[worst[0]],injuryPercent:Math.round(worst[1].severity*100),party:1,enemies:livingEnemies,resumes,encounter,epoch,battleId:frameValue.battleId});
  }
  function step(dt=1/60){
    if(!Number.isFinite(dt)||dt<0||dt>.25)throw new TypeError('Invalid P7 review delta');
    time+=dt;revision++;for(const actor of battle.actors.values())recoverJohakyuStamina(actor,dt);
    const actions=new Map([...battle.actors.values()].map(actor=>[actor.id,currentAction(actor)])),events=applyContacts(actions);
    if(!resumed&&time>=RESUME_SECONDS){const checkpoint=createJohakyuCheckpoint({battle,lifeId:'review-life',ageSeconds:28*60,encounterId:`review-${encounter}`});battle=restoreJohakyuCheckpoint(checkpoint).battle;epoch++;revision=0;resumes++;resumed=true;actionState.clear();trace.push({type:'resume',time:Number(time.toFixed(2)),epoch});}
    if(time>=ENCOUNTER_SECONDS||battle.result){encounter++;epoch++;time=0;freshBattle();trace.push({type:'encounter-reset',time:0,epoch,encounter});}
    const nextActions=new Map([...battle.actors.values()].map(actor=>[actor.id,currentAction(actor)])),snapshot=frame(nextActions),review=meta(snapshot);lastFrame=snapshot;lastMeta=review;
    return freeze({frame:snapshot,events,meta:review});
  }
  function inspect(){const snapshot=lastFrame??frame(new Map()),review=lastMeta??meta(snapshot);return freeze({frame:snapshot,meta:review,events:lastEvents.slice(),trace:trace.slice()});}
  return Object.freeze({step,inspect});
}
