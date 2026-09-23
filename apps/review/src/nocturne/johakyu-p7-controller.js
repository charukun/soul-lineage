import {createDrivenBattleRuntime} from '@soul/johakyu-presentation';
import {createJohakyuP7ReviewScenario} from './johakyu-p7-review.js';
import {normalizeBattle2Loadout} from './battle2-loadout.js';

const PHASES=new Set(['jo','ha','kyu']);

export function createJohakyuP7Controller({world,effects,stage,sound,notify,signal,cameraPresentation=null,movementInput=null,onMeta=()=>{},shouldPause=()=>false,evidence=false,fixture=null,mode='duel',loadout=null,settings=null,learnedTechniqueIds=[]}){
  const driven=createDrivenBattleRuntime({world,effects,stage,sound,notify,signal,cameraPresentation});
  let reviewLoadout=normalizeBattle2Loadout(loadout||{}),reviewSettings={techniqueMode:settings?.techniqueMode==='random'?'random':'set',inspirationRate:settings?.inspirationRate==='high'?'high':'normal'},reviewLearned=[...new Set(Array.isArray(learnedTechniqueIds)?learnedTechniqueIds:[])];
  const scenarioOptions=()=>({mode,loadout:reviewLoadout,settings:reviewSettings,learnedTechniqueIds:reviewLearned});
  const makeScenario=()=>evidence&&fixture==='clash'?createJohakyuP7ReviewScenario({...scenarioOptions(),fixture:'clash',duelGap:1.7,heroStartPhase:'ha'}):evidence&&fixture==='parry'?createJohakyuP7ReviewScenario({...scenarioOptions(),duelGap:2.4,heroStartPhase:'kyu',heroStartTechniqueIndex:0,enemyLeadSeconds:.5}):evidence&&fixture==='downed'?createJohakyuP7ReviewScenario({...scenarioOptions(),duelGap:1.7,actorOverrides:{hero:{canAttack:false,readyDelay:0},'enemy-a':{hp:0,downed:true,incapacitated:true,spawnSeconds:0,readyDelay:0}}}):createJohakyuP7ReviewScenario({...scenarioOptions(),comboStyle:'composed',duelGap:mode==='duel'?3.9:4.25,enemyLeadSeconds:mode==='duel'?.16:0});
  let scenario=makeScenario(),presentationGeneration=0;
  let disposed=false,ready=false,started=false,raf=0,previous=0,current=null,trace=[],lastResumes=0,lastEncounter=1,physicalContacts=[],lastPresentationError='';
  function presentSafely(frame,dt,events=[]){
    try{
      const result=driven.present({...frame,battleId:`${frame.battleId}:view:${presentationGeneration}`},dt,events);lastPresentationError='';return result;
    }catch(error){
      const message=String(error?.message||error||'presentation error');
      if(message!==lastPresentationError){
        lastPresentationError=message;trace.push({type:'presentation-error',message,time:frame?.time??null});
        if(trace.length>100)trace=trace.slice(-100);
      }
      cameraPresentation?.cancelInspiration?.();
      physicalContacts=[];
      return {accepted:false,reason:'presentation-error',message};
    }
  }
  function render(dt){
    if(disposed)return null;
    const result=scenario.step(dt,physicalContacts,movementInput?.vector()??null);physicalContacts=[];current=result;
    const presented=presentSafely(result.frame,dt,result.events);
    if(presented?.accepted!==false)physicalContacts=driven.sampleContacts?.()??[];
    trace.push(...result.events.map(event=>({type:'impact',id:event.id,phase:event.phase,targetId:event.targetId})));
    if(result.meta.resumes>lastResumes){trace.push({type:'resume',epoch:result.meta.epoch,resumes:result.meta.resumes});lastResumes=result.meta.resumes;}
    if(result.meta.encounter!==lastEncounter){trace.push({type:'encounter-reset',epoch:result.meta.epoch,encounter:result.meta.encounter});lastEncounter=result.meta.encounter;}
    if(trace.length>100)trace=trace.slice(-100);onMeta(result.meta);return presented;
  }
  function loop(now){
    if(disposed||!started)return;
    const dt=previous?Math.min(.05,Math.max(0,(now-previous)/1000)):1/60;previous=now;
    // Death/rebirth cinematics own time. Do not advance respawn, combat, or audio-producing events behind them.
    if(!document.hidden&&!shouldPause())render(dt);
    raf=requestAnimationFrame(loop);
  }
  async function prepare(){
    await driven.prepare();if(disposed||signal.aborted)return;
    ready=true;current=scenario.inspect();const presented=presentSafely(current.frame,0,[]);if(presented?.accepted!==false)physicalContacts=driven.sampleContacts?.()??[];onMeta(current.meta);
  }
  function start(){
    if(disposed||!ready||started)return false;
    started=true;previous=0;if(!evidence)raf=requestAnimationFrame(loop);return true;
  }
  function resize(){
    if(disposed||!ready)return;
    driven.resize();if(!started||evidence)presentSafely(current.frame,0,[]);
  }
  function configureLoadout(next){
    reviewLoadout=normalizeBattle2Loadout(next||{});scenario=makeScenario();presentationGeneration++;current=scenario.inspect();lastResumes=0;lastEncounter=1;physicalContacts=[];cameraPresentation?.cancelInspiration?.();
    trace.push({type:'loadout-reset',loadout:reviewLoadout});if(trace.length>100)trace=trace.slice(-100);
    if(ready&&!disposed){presentSafely(current.frame,0,[]);onMeta(current.meta);}return reviewLoadout;
  }
  function configureSettings(next){
    reviewSettings={techniqueMode:next?.techniqueMode==='random'?'random':'set',inspirationRate:next?.inspirationRate==='high'?'high':'normal'};scenario=makeScenario();presentationGeneration++;current=scenario.inspect();lastResumes=0;lastEncounter=1;physicalContacts=[];cameraPresentation?.cancelInspiration?.();
    trace.push({type:'settings-reset',settings:{...reviewSettings}});if(trace.length>100)trace=trace.slice(-100);
    if(ready&&!disposed){presentSafely(current.frame,0,[]);onMeta(current.meta);}return {...reviewSettings};
  }
  function learnTechnique(id,phase=null){const raw=String(id||'');if(!raw)return false;let changed=false;if(!reviewLearned.includes(raw)){reviewLearned=[...reviewLearned,raw];changed=true;}if(PHASES.has(phase)){const next=normalizeBattle2Loadout({...reviewLoadout,technique:{...reviewLoadout.technique,[phase]:raw}});if(next.technique[phase]===raw){reviewLoadout=next;changed=true;}}if(changed){trace.push({type:'technique-learned',techniqueId:raw,phase:PHASES.has(phase)?phase:null,equipped:PHASES.has(phase)});if(trace.length>100)trace=trace.slice(-100);}return changed;}

  function advance(seconds){
    if(disposed||!ready||!started)throw new Error('Start the battle before evidence advancement');
    if(!Number.isFinite(seconds)||seconds<=0||seconds>30)throw new Error('Invalid evidence advancement');
    for(let i=0;i<Math.ceil(seconds*60);i++)render(1/60);
    return metrics();
  }
  function metrics(){return {...driven.metrics(),started,mode:'p7-canonical-review',physicalContactCount:physicalContacts.length,loadout:reviewLoadout,settings:{...reviewSettings},learnedTechniqueIds:reviewLearned.slice(),review:current?.meta??scenario.inspect().meta};}
  function destroy(){if(disposed)return;disposed=true;ready=false;started=false;if(raf)cancelAnimationFrame(raf);driven.dispose();}
  return Object.freeze({prepare,start,resize,configureLoadout,configureSettings,learnTechnique,metrics,advance,destroy,fail:destroy,
    inspectActors:()=>current?.frame.actors??scenario.inspect().frame.actors,
    inspectRenderedActors:()=>driven.inspectActors?.()??[],
    inspectBattle:()=>current?.frame??scenario.inspect().frame,
    footAnchor:()=>driven.footAnchor?.()??null,
    renderPlayerPortrait:canvas=>driven.renderSelfPortrait?.(canvas)??false,
    get exchangeTrace(){return scenario.inspect().trace;},
    get loadout(){return reviewLoadout;},
    get settings(){return {...reviewSettings};},
    get learnedTechniqueIds(){return reviewLearned.slice();},
    get trace(){return trace.slice();}});
}

