const info=typeof __BUILD_INFO__!=='undefined'?__BUILD_INFO__:{name:'100年人生',app:'rinne',environment:'local',commit:'UNBUILT'};
document.title=`100年人生 — 輪廻転焦${info.environment==='prod'?'':` | ${String(info.environment).toUpperCase()}`}`;
const $=id=>document.getElementById(id), title=$('title-screen'), game=$('game-screen');
$('build-label').textContent=info.commit==='UNBUILT'?'LOCAL':`${String(info.environment).toUpperCase()} · ${String(info.commit).slice(0,7)}`;
const storageKey=`soul:v1:${info.environment}:rinne:local:life-v2`;
let runtime=null,launching=false,hasSave=false,lab=null,labClock=0,villageInstalled=false;
function refreshContinue(){
  let saved=null;try{saved=JSON.parse(localStorage.getItem(storageKey)||'null');}catch{}
  hasSave=Boolean(saved);const button=$('continue-life');button.hidden=!saved;
  if(saved){const age=Math.max(0,Math.min(100,Math.floor(Number(saved.ageYears)||0)));$('continue-detail').textContent=`${saved.name||'旅人'} · ${age}歳 · ${saved.generation||1}代目`;}
}
refreshContinue();
async function launch(mode){
  if(launching)return;launching=true;$('boot-status').textContent='起動中';
  try{
    const mod=await import('./rebuild/runtime.js');
    runtime=await mod.startRuntime({mode,buildInfo:info,name:$('life-name').value,onExit(){runtime=null;game.hidden=true;title.hidden=false;launching=false;$('boot-status').textContent='準備完了';refreshContinue();}});
    title.hidden=true;game.hidden=false;$('boot-status').textContent='';
  }catch(error){console.error(error);launching=false;$('boot-status').textContent=`起動失敗：${error?.message||error}`;game.hidden=true;title.hidden=false;}
}
$('new-life').addEventListener('click',()=>{if(hasSave&&!confirm('今の人生を終えて、0歳から新しく始めます。現在の100年人生の保存は置き換わります。続けますか？'))return;void launch('new');});
$('continue-life').addEventListener('click',()=>{void launch('continue');});

const villageDialog=document.getElementById('village-dialog');
document.getElementById('open-village').addEventListener('click',async()=>{
  try{
    if(!villageInstalled){
      const {installOnlinePlayer}=await import('./online.js');
      installOnlinePlayer(document.getElementById('village-panel'));
      villageInstalled=true;
    }
    villageDialog.showModal();
  }catch(error){console.error(error);$('boot-status').textContent=`村接続失敗：${error?.message||error}`;}
});
document.getElementById('close-village').addEventListener('click',()=>villageDialog.close());

if(new URLSearchParams(location.search).has('villageHostLab')){
  void (async()=>{
    const [{installVillageHostRehearsal},{createApp},{createWebPlatform}]=await Promise.all([
      import('./village-link.js'),import('./app.js'),import('@soul/platform-web'),
    ]);
    const app=createApp(createWebPlatform({gameId:'rinne',environment:info.environment}));
    const canvas=document.getElementById('game');
    let worldTimeMs=0,last=performance.now();
    const tick=now=>{if(!window.__VILLAGE_WORLD_PAUSED__)worldTimeMs+=Math.max(0,now-last);last=now;canvas.dataset.worldTimeMs=String(Math.round(worldTimeMs));labClock=requestAnimationFrame(tick);};
    labClock=requestAnimationFrame(tick);
    lab=installVillageHostRehearsal({capture:()=>({worldTimeMs:Math.round(worldTimeMs),world:app.world,characters:[],npcs:[],randomState:null}),apply:checkpoint=>{worldTimeMs=checkpoint.worldTimeMs;canvas.dataset.worldRevision=String(checkpoint.world?.revision??'');}});
    await lab;
  })().catch(error=>{console.error(error);$('boot-status').textContent=`村診断失敗：${error?.message||error}`;});
}

// The runtime owns pagehide persistence so a save cannot be cancelled by an eager dispose here.
if(import.meta.hot)import.meta.hot.dispose(()=>{runtime?.dispose?.();cancelAnimationFrame(labClock);Promise.resolve(lab).then(link=>link?.dispose?.()).catch(()=>{});});
