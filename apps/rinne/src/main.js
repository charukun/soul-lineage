const info=typeof __BUILD_INFO__!=='undefined'?__BUILD_INFO__:{name:'100年人生',app:'rinne',environment:'local',commit:'UNBUILT'};
document.title=`100年人生 — 輪廻転焦${info.environment==='prod'?'':` | ${String(info.environment).toUpperCase()}`}`;
const $=id=>document.getElementById(id), title=$('title-screen'), game=$('game-screen');
$('build-label').textContent=info.commit==='UNBUILT'?'LOCAL':`${String(info.environment).toUpperCase()} · ${String(info.commit).slice(0,7)}`;
const storageKey=`soul:v1:${info.environment}:rinne:local:life-v2`;
let runtime=null,launching=false,hasSave=false;
function refreshContinue(){
  let saved=null;try{saved=JSON.parse(localStorage.getItem(storageKey)||'null');}catch{}
  hasSave=Boolean(saved);const button=$('continue-life');button.hidden=!saved;
  if(saved){const age=Math.max(0,Math.min(100,Math.floor(Number(saved.ageYears)||0)));$('continue-detail').textContent=`${saved.name||'旅人'} · ${age}歳 · ${saved.generation||1}代目`;}
}
refreshContinue();
async function launch(mode){
  if(launching)return;launching=true;$('boot-status').textContent='世界を開いています…';
  try{
    const mod=await import('./rebuild/runtime.js');
    runtime=await mod.startRuntime({mode,buildInfo:info,name:$('life-name').value,onExit(){runtime=null;game.hidden=true;title.hidden=false;launching=false;$('boot-status').textContent='準備できています';refreshContinue();}});
    title.hidden=true;game.hidden=false;$('boot-status').textContent='';
  }catch(error){console.error(error);launching=false;$('boot-status').textContent=`開けませんでした：${error?.message||error}`;game.hidden=true;title.hidden=false;}
}
$('new-life').addEventListener('click',()=>{if(hasSave&&!confirm('今の人生を終えて、0歳から新しく始めます。現在の100年人生の保存は置き換わります。続けますか？'))return;void launch('new');});
$('continue-life').addEventListener('click',()=>{void launch('continue');});
// The runtime owns pagehide persistence so a save cannot be cancelled by an eager dispose here.
if(import.meta.hot)import.meta.hot.dispose(()=>runtime?.dispose?.());
