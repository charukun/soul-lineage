const stage=document.querySelector('[data-review-surface="battle2"]');
const status=document.getElementById('battle2-status');
const world=document.getElementById('world'),effects=document.getElementById('effects');
const readout=document.querySelector('[data-p7-readout]'),phaseNode=document.querySelector('[data-p7-phase]'),summaryNode=document.querySelector('[data-p7-summary]'),detailNode=document.querySelector('[data-p7-detail]');
let runtime=null,sound=null,controller=null,sequence=0,disposed=false,prepared=false,reviewMode='boot',reviewMeta=null;
let state='BOOT',lastError=null;
function report(next,detail=''){
  if(disposed)return;
  if(next==='BATTLE'&&!prepared)return;
  state=next;stage.dataset.state=next;
  if(next==='ERROR'){lastError=String(detail);stage.dataset.error=lastError;status.hidden=false;status.setAttribute('role','alert');status.textContent='戦闘を読み込めませんでした。'+lastError+' 再読み込みで再試行できます。';}
  else{status.setAttribute('role','status');status.hidden=next==='BATTLE'||next==='RESETTING';status.textContent=next==='ASSET_LOADING'?'戦闘を読み込み中… '+detail:'戦闘を準備中…';}
}
function updateP7Readout(meta){
  reviewMeta=meta;if(!readout||reviewMode!=='p7')return;
  readout.hidden=false;phaseNode.textContent=meta.phaseLabel;
  summaryNode.textContent=`P7 本編契約 · ${meta.party}対${meta.enemies} · 再開 ${meta.resumes}`;
  detailNode.textContent=`ST ${meta.stamina} · 傷 ${meta.injuryPart} ${meta.injuryPercent}% · encounter ${meta.encounter}`;
}
function failed(error){report('ERROR',error?.message||String(error));sound?.pause();}
window.__BATTLE2__=Object.freeze({
  get state(){return state;},get mode(){return reviewMode;},get lastError(){return lastError;},get sourceSha(){return __BUILD_INFO__.commit;},
  get metrics(){return runtime?.metrics()||{ready:false};},get actors(){return runtime?.inspectActors()||[];},get trace(){return runtime?.trace.slice()||[];},
  get observation(){return prepared?runtime?.inspectBattle(sequence)??null:null;},get review(){return reviewMeta;},
  advance(seconds){if(!new URL(location.href).searchParams.has('evidence'))throw Error('Evidence mode required');return runtime.advance(seconds);}
});
async function boot(){
  const own=++sequence;prepared=false;controller?.abort();runtime?.destroy();sound?.destroy();runtime=null;sound=null;lastError=null;reviewMeta=null;delete stage.dataset.error;
  controller=new AbortController();report('BOOT');
  try{
    const {createNocturneSound}=await import('./nocturne/audio.js');
    if(disposed||own!==sequence)return;
    sound=createNocturneSound();
    const parameters=new URL(location.href).searchParams,requested=parameters.get('johakyu'),legacyMode=['p2','p3','p4'].includes(requested);
    reviewMode=legacyMode?requested:'p7';stage.dataset.reviewMode=reviewMode;if(readout)readout.hidden=reviewMode!=='p7';
    if(legacyMode){
      const {createBattleRuntime}=await import('./nocturne/runtime.js');
      const rules=requested==='p4'?(await import('./nocturne/johakyu-catalog.js')).createJohakyuCatalogRules({mind:parameters.get('mind')||'balanced'}):requested==='p3'?(await import('./nocturne/johakyu-physiology.js')).createJohakyuPhysiologyRules({mind:parameters.get('mind')||'balanced'}):(await import('./nocturne/johakyu-rules.js')).createJohakyuReviewRules({mind:parameters.get('mind')||'balanced'});
      runtime=createBattleRuntime({world,effects,stage,sound,notify:report,signal:controller.signal,rules});
    }else{
      const {createJohakyuP7Controller}=await import('./nocturne/johakyu-p7-controller.js');
      runtime=createJohakyuP7Controller({world,effects,stage,sound,notify:report,signal:controller.signal,onMeta:updateP7Readout,evidence:parameters.has('evidence')});
    }
    if(disposed||own!==sequence)return;
    await runtime.prepare();if(disposed||own!==sequence)return;prepared=true;report('BATTLE');
  }catch(error){if(!disposed&&own===sequence){controller.abort(error);runtime?.fail?.(error);failed(error);}}
}
const observer=new ResizeObserver(()=>runtime?.resize());observer.observe(stage);
world.addEventListener('webglcontextlost',event=>{event.preventDefault();prepared=false;controller?.abort();runtime?.fail?.(new Error('描画環境が中断されました。'));});
world.addEventListener('webglcontextrestored',()=>{if(!disposed)boot();});
window.addEventListener('error',event=>{if(event.error&&!disposed)failed(event.error);});
window.addEventListener('unhandledrejection',event=>{if(!disposed)failed(event.reason);});
window.addEventListener('pagehide',event=>{sound?.pause();if(event.persisted)return;disposed=true;sequence++;controller?.abort();observer.disconnect();runtime?.destroy();sound?.destroy();});
report('BOOT');boot();
