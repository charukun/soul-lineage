const stage=document.querySelector('[data-review-surface="battle2"]');
const status=document.getElementById('battle2-status');
const world=document.getElementById('world'),effects=document.getElementById('effects');
let runtime=null,sound=null,controller=null,sequence=0,disposed=false,prepared=false;
let state='BOOT',lastError=null;
function report(next,detail=''){
  if(disposed)return;
  if(next==='BATTLE'&&!prepared)return;
  state=next;stage.dataset.state=next;
  if(next==='ERROR'){lastError=String(detail);stage.dataset.error=lastError;status.hidden=false;status.setAttribute('role','alert');status.textContent='戦闘を読み込めませんでした。'+lastError+' 再読み込みで再試行できます。';}
  else{status.setAttribute('role','status');status.hidden=next==='BATTLE'||next==='RESETTING';status.textContent=next==='ASSET_LOADING'?'戦闘を読み込み中… '+detail:'戦闘を準備中…';}
}
function failed(error){report('ERROR',error?.message||String(error));sound?.pause();}
window.__BATTLE2__=Object.freeze({
  get state(){return state;},get lastError(){return lastError;},get sourceSha(){return __BUILD_INFO__.commit;},
  get metrics(){return runtime?.metrics()||{ready:false};},get actors(){return runtime?.inspectActors()||[];},get trace(){return runtime?.trace.slice()||[];},
  get observation(){return prepared?runtime?.inspectBattle(sequence)??null:null;},
  advance(seconds){if(!new URL(location.href).searchParams.has('evidence'))throw Error('Evidence mode required');return runtime.advance(seconds);}
});
async function boot(){
  const own=++sequence;prepared=false;controller?.abort();runtime?.destroy();sound?.destroy();runtime=null;sound=null;lastError=null;delete stage.dataset.error;
  controller=new AbortController();report('BOOT');
  try{
    const [{createBattleRuntime},{createNocturneSound}]=await Promise.all([import('./nocturne/runtime.js'),import('./nocturne/audio.js')]);
    if(disposed||own!==sequence)return;
    sound=createNocturneSound();
    const parameters=new URL(location.href).searchParams;
    const rules=parameters.get('johakyu')==='p2'?(await import('./nocturne/johakyu-rules.js')).createJohakyuReviewRules({mind:parameters.get('mind')||'balanced'}):null;
    if(disposed||own!==sequence)return;
    runtime=createBattleRuntime({world,effects,stage,sound,notify:report,signal:controller.signal,rules});
    await runtime.prepare();if(disposed||own!==sequence)return;prepared=true;report('BATTLE');
  }catch(error){if(!disposed&&own===sequence){controller.abort(error);runtime?.fail(error);failed(error);}}
}
const observer=new ResizeObserver(()=>runtime?.resize());observer.observe(stage);
world.addEventListener('webglcontextlost',event=>{event.preventDefault();prepared=false;controller?.abort();runtime?.fail(new Error('描画環境が中断されました。'));});
world.addEventListener('webglcontextrestored',()=>{if(!disposed)boot();});
window.addEventListener('error',event=>{if(event.error&&!disposed)failed(event.error);});
window.addEventListener('unhandledrejection',event=>{if(!disposed)failed(event.reason);});
window.addEventListener('pagehide',event=>{sound?.pause();if(event.persisted)return;disposed=true;sequence++;controller?.abort();observer.disconnect();runtime?.destroy();sound?.destroy();});
report('BOOT');boot();
