import {createDrivenBattleRuntime} from '@soul/johakyu-presentation';
import {createJohakyuP7ReviewScenario} from './johakyu-p7-review.js';

export function createJohakyuP7Controller({world,effects,stage,sound,notify,signal,onMeta=()=>{},evidence=false,mode='duel'}){
  const driven=createDrivenBattleRuntime({world,effects,stage,sound,notify,signal});
  const scenario=createJohakyuP7ReviewScenario({mode,comboStyle:'burst'});
  let disposed=false,ready=false,started=false,raf=0,previous=0,current=null,trace=[],lastResumes=0,lastEncounter=1;
  function render(dt){
    if(disposed)return null;
    const result=scenario.step(dt);current=result;
    const presented=driven.present(result.frame,dt,result.events);
    trace.push(...result.events.map(event=>({type:'impact',id:event.id,phase:event.phase,targetId:event.targetId})));
    if(result.meta.resumes>lastResumes){trace.push({type:'resume',epoch:result.meta.epoch,resumes:result.meta.resumes});lastResumes=result.meta.resumes;}
    if(result.meta.encounter!==lastEncounter){trace.push({type:'encounter-reset',epoch:result.meta.epoch,encounter:result.meta.encounter});lastEncounter=result.meta.encounter;}
    if(trace.length>100)trace=trace.slice(-100);onMeta(result.meta);return presented;
  }
  function loop(now){
    if(disposed||!started)return;
    const dt=previous?Math.min(.05,Math.max(0,(now-previous)/1000)):1/60;previous=now;
    // A background tab must not consume the visible defeat/respawn interval.
    if(!document.hidden)render(dt);
    raf=requestAnimationFrame(loop);
  }
  async function prepare(){
    await driven.prepare();if(disposed||signal.aborted)return;
    ready=true;current=scenario.inspect();driven.present(current.frame,0,[]);onMeta(current.meta);
  }
  function start(){
    if(disposed||!ready||started)return false;
    started=true;previous=0;if(!evidence)raf=requestAnimationFrame(loop);return true;
  }
  function resize(){
    if(disposed||!ready)return;
    driven.resize();if(!started||evidence)driven.present(current.frame,0,[]);
  }
  function advance(seconds){
    if(disposed||!ready||!started)throw new Error('Start the battle before evidence advancement');
    if(!Number.isFinite(seconds)||seconds<=0||seconds>30)throw new Error('Invalid evidence advancement');
    for(let i=0;i<Math.ceil(seconds*60);i++)render(1/60);
    return metrics();
  }
  function metrics(){return {...driven.metrics(),started,mode:'p7-canonical-review',review:current?.meta??scenario.inspect().meta};}
  function destroy(){if(disposed)return;disposed=true;ready=false;started=false;if(raf)cancelAnimationFrame(raf);driven.dispose();}
  return Object.freeze({prepare,start,resize,metrics,advance,destroy,fail:destroy,
    inspectActors:()=>current?.frame.actors??scenario.inspect().frame.actors,
    inspectBattle:()=>current?.frame??scenario.inspect().frame,
    footAnchor:()=>driven.footAnchor?.()??null,
    get trace(){return trace.slice();}});
}
