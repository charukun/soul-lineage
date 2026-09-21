import {applyJohakyuImpactOnce,createJohakyuBattle,createJohakyuCheckpoint,johakyuActorCapability,recoverJohakyuStamina,restoreJohakyuCheckpoint,spendJohakyuStamina} from '@soul/johakyu-combat/domain';
import {compileJohakyuCatalogTrial} from '@soul/johakyu-combat/motion-contract';

const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const PHASES=Object.freeze(['jo','ha','kyu']);
const PHASE_LABELS=Object.freeze({jo:'序',ha:'破',kyu:'急'});
const PART_LABELS=Object.freeze({head:'頭',torso:'胴',leftArm:'左腕',rightArm:'右腕',leftLeg:'左脚',rightLeg:'右脚'});
const ATTACK_SECONDS=1.5,RESUME_SECONDS=7.5,ENCOUNTER_SECONDS=15;
const LAYOUT=Object.freeze({
  hero:{x:-1.55,z:.35,yaw:0},ally:{x:1.45,z:.45,yaw:0},
  'enemy-a':{x:-1.35,z:2.2,yaw:Math.PI},'enemy-b':{x:1.35,z:2.25,yaw:Math.PI},'enemy-c':{x:.05,z:3.9,yaw:Math.PI},
});
const OFFSETS=Object.freeze({hero:0,ally:.18,'enemy-a':.36,'enemy-b':.54,'enemy-c':.72});
const TARGETS=Object.freeze({hero:['enemy-a','enemy-c','enemy-b'],ally:['enemy-b','enemy-c','enemy-a'],'enemy-a':['hero','ally'],'enemy-b':['ally','hero'],'enemy-c':['hero','ally']});
const COST=Object.freeze({jo:7,ha:10,kyu:14}),DAMAGE=Object.freeze({jo:7,ha:10,kyu:15});
const sequences=Object.fromEntries(['sword'].map(weapon=>[weapon,Object.fromEntries(compileJohakyuCatalogTrial({weapon}).map(row=>[row.phase,row]))]));

function actorRows(){
  return [
    {id:'hero',side:'party',hp:125,maxHp:125,stamina:100,staminaCap:100,seed:73917,generation:4},
    {id:'ally',side:'party',hp:112,maxHp:112,stamina:92,staminaCap:100,seed:73918,generation:4},
    {id:'enemy-a',side:'enemy',hp:92,maxHp:92,stamina:100,staminaCap:100,seed:8101,generation:1},
    {id:'enemy-b',side:'enemy',hp:88,maxHp:88,stamina:96,staminaCap:100,seed:8102,generation:1},
    {id:'enemy-c',side:'enemy',hp:108,maxHp:108,stamina:100,staminaCap:100,seed:8103,generation:1},
  ];
}
function bodyView(actor){return Object.fromEntries(Object.entries(actor.injuries).map(([part,row])=>{const severity=Math.min(1,Math.max(0,Number(row.severity)||0));return[part,{severity,durability:Math.round((1-severity)*100),label:PART_LABELS[part]}];}));}
function selectTarget(battle,id){for(const candidate of TARGETS[id]){const actor=battle.actors.get(candidate);if(actor&&!actor.dead&&!actor.incapacitated)return actor;}return null;}
function phaseAt(time){return PHASES[Math.floor(time/ATTACK_SECONDS)%PHASES.length];}
function phaseRow(phase){return sequences.sword[phase];}
function stepBinding(phase,serial){const row=phaseRow(phase),offense=row.steps.filter(step=>step.offense);return offense[serial%offense.length]??row.steps[0];}
function attackSerial(time,id){return Math.floor((time+OFFSETS[id])/ATTACK_SECONDS);}
function attackProgress(time,id){const local=(time+OFFSETS[id])%ATTACK_SECONDS;return Math.min(.999,Math.max(0,local/ATTACK_SECONDS));}
function positionFor(id,time){const base=LAYOUT[id],index=Object.keys(LAYOUT).indexOf(id);return{x:base.x+Math.sin(time*.65+index)*.09,z:base.z+Math.cos(time*.52+index)*.06};}
function damageFor(id,phase){return DAMAGE[phase]+(id==='enemy-c'?2:id==='ally'?-1:0);}

export function createJohakyuP7ReviewScenario(){
  let encounter=1,epoch=1,revision=0,time=0,resumes=0,resumed=false;
  let battle,attackState=new Map(),lastEvents=[],trace=[],lastFrame=null,lastMeta=null;
  function freshBattle(){
    battle=createJohakyuBattle({battleId:`review-p7:${encounter}`,actors:actorRows(),seed:73917+encounter});
    attackState=new Map();lastEvents=[];resumed=false;revision=0;
  }
  freshBattle();
  function currentAction(actor){
    if(actor.dead||actor.incapacitated)return null;
    const serial=attackSerial(time,actor.id),phase=PHASES[((serial%PHASES.length)+PHASES.length)%PHASES.length],binding=stepBinding(phase,serial),target=selectTarget(battle,actor.id);
    if(!target)return null;
    let state=attackState.get(actor.id);
    if(!state||state.serial!==serial){
      const allowed=spendJohakyuStamina(actor,COST[phase]);
      state={serial,phase,allowed,impacted:false,attackId:`${battle.battleId}:${actor.id}:${serial}`};attackState.set(actor.id,state);
    }
    if(!state.allowed)return null;
    return{id:state.attackId,targetId:target.id,techniqueId:`basic.sword`,name:`基本・${PHASE_LABELS[phase]}`,phase,step:serial%3,progress:attackProgress(time,actor.id),duration:ATTACK_SECONDS,motion:binding,legal:true,scope:'review-p7-fixture'};
  }
  function applyContacts(actions){
    const events=[];
    for(const [id,action] of actions){
      if(!action||action.progress<.46)continue;
      const state=attackState.get(id);if(!state||state.impacted)continue;state.impacted=true;
      const source=battle.actors.get(id),target=battle.actors.get(action.targetId);if(!source||!target)continue;
      const eventId=`${action.id}:${source.id}:${target.id}:impact`;
      const result=applyJohakyuImpactOnce(battle,{eventId,attackId:action.id,sourceId:source.id,targetId:target.id,damage:damageFor(id,action.phase),phase:action.phase});
      if(!result.applied)continue;
      events.push(freeze({id:eventId,type:source.side==='party'?'player-hit':'enemy-hit',attackId:action.id,sourceId:source.id,targetId:target.id,damage:result.dealt,phase:action.phase,bodyPart:result.part,bodyDurability:result.durability,blocked:false}));
    }
    if(events.length){lastEvents=events;trace.push(...events.map(event=>({type:'impact',time:Number(time.toFixed(2)),...event})));if(trace.length>80)trace=trace.slice(-80);}
    return events;
  }
  function frame(actions){
    const actors=[...battle.actors.values()].map(actor=>{
      const action=actions.get(actor.id)??null;const capability=johakyuActorCapability(actor),position=positionFor(actor.id,time),layout=LAYOUT[actor.id];
      void capability;
      return {id:actor.id,side:actor.side,self:actor.id==='hero',kind:actor.side==='party'?'hero':'enemy',boss:actor.id==='enemy-c',position,yaw:layout.yaw,hp:actor.hp,maxHp:actor.maxHp,body:bodyView(actor),stamina:{value:actor.stamina,cap:actor.staminaCap},equipment:{weapon:'sword',armor:actor.side==='party'?'heavy':'cloth',shield:false},moving:false,resting:false,dead:actor.dead,downed:actor.incapacitated,hit:false,ageYears:actor.side==='party'?28:0,action};
    });
    return freeze({version:1,authority:'rinne-domain',reviewFixture:'p7',battleId:battle.battleId,epoch,revision,status:battle.result?'won':'battle',actors,obstacles:[{id:'cover-left',x:-3.5,z:2.15,w:1.1,d:1,h:1.45},{id:'cover-right',x:3.45,z:2.7,w:1.15,d:1.1,h:1.55}],projectiles:[],result:battle.result??{cleared:false,defeats:0,returns:resumes}});
  }
  function meta(frameValue){
    const hero=battle.actors.get('hero'),injuries=Object.entries(hero.injuries).sort((a,b)=>b[1].severity-a[1].severity),worst=injuries[0];
    const phase=phaseAt(time),livingParty=[...battle.actors.values()].filter(a=>a.side==='party'&&!a.incapacitated&&!a.dead).length,livingEnemies=[...battle.actors.values()].filter(a=>a.side==='enemy'&&!a.incapacitated&&!a.dead).length;
    return freeze({phase,phaseLabel:PHASE_LABELS[phase],stamina:Math.round(hero.stamina),injuryPart:PART_LABELS[worst[0]],injuryPercent:Math.round(worst[1].severity*100),party:livingParty,enemies:livingEnemies,resumes,encounter,epoch,battleId:frameValue.battleId});
  }
  function step(dt=1/60){
    if(!Number.isFinite(dt)||dt<0||dt>.25)throw new TypeError('Invalid P7 review delta');
    time+=dt;revision++;
    for(const actor of battle.actors.values())recoverJohakyuStamina(actor,dt);
    const actions=new Map([...battle.actors.values()].map(actor=>[actor.id,currentAction(actor)]));
    const events=applyContacts(actions);
    if(!resumed&&time>=RESUME_SECONDS){
      const checkpoint=createJohakyuCheckpoint({battle,lifeId:'review-life',ageSeconds:28*60,encounterId:`review-${encounter}`});
      battle=restoreJohakyuCheckpoint(checkpoint).battle;epoch++;revision=0;resumes++;resumed=true;attackState=new Map();
      trace.push({type:'resume',time:Number(time.toFixed(2)),epoch});
    }
    if(time>=ENCOUNTER_SECONDS||battle.result){encounter++;epoch++;time=0;freshBattle();trace.push({type:'encounter-reset',time:0,epoch,encounter});}
    const nextActions=new Map([...battle.actors.values()].map(actor=>[actor.id,currentAction(actor)])),snapshot=frame(nextActions),review=meta(snapshot);lastFrame=snapshot;lastMeta=review;
    return freeze({frame:snapshot,events,meta:review});
  }
  function inspect(){const snapshot=lastFrame??frame(new Map()),review=lastMeta??meta(snapshot);return freeze({frame:snapshot,meta:review,events:lastEvents.slice(),trace:trace.slice()});}
  return Object.freeze({step,inspect});
}
