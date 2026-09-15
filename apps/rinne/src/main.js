const info=typeof __BUILD_INFO__!=='undefined'?__BUILD_INFO__:{name:'100年人生',app:'rinne',environment:'local',commit:'UNBUILT'};
document.title=`100年人生 — 輪廻転焦${info.environment==='prod'?'':` | ${String(info.environment).toUpperCase()}`}`;
const $=id=>document.getElementById(id),app=$('app'),title=$('title-screen'),game=$('game-screen'),loading=$('loading-card'),retry=$('boot-retry');
$('build-label').textContent=info.commit==='UNBUILT'?'LOCAL':`${String(info.environment).toUpperCase()} · ${String(info.commit).slice(0,7)}`;
const storageKey=`soul:v1:${info.environment}:rinne:local:life-v2`;
const afterVisiblePaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
let runtimeModule=null,prepared=null,runtime=null,booting=false,launching=false,hasSave=false,lab=null,labClock=0,villageInstalled=false;

function refreshContinue(){
  let saved=null;try{saved=JSON.parse(localStorage.getItem(storageKey)||'null');}catch{}
  hasSave=Boolean(saved);const button=$('continue-life');button.hidden=!saved;
  if(saved){const age=Math.max(0,Math.min(100,Math.floor(Number(saved.ageYears)||0)));$('continue-detail').textContent=`${saved.name||'旅人'} · ${age}歳 · ${saved.generation||1}代目`;}
}
function setLoading(message,titleText='世界をつくっています'){
  $('loading-title').textContent=titleText;$('loading-message').textContent=message;retry.hidden=true;loading.hidden=false;
}
function showTitle(status='準備完了'){
  app.dataset.screen='title';game.classList.remove('is-loading');game.removeAttribute('aria-busy');game.hidden=true;loading.hidden=true;title.hidden=false;launching=false;booting=false;$('boot-status').textContent=status;refreshContinue();
}
function showBootFailure(error){
  console.error(error);app.dataset.screen='error';booting=false;launching=false;title.hidden=true;game.hidden=false;game.classList.add('is-loading');game.removeAttribute('aria-busy');
  $('loading-title').textContent='世界を開けませんでした';$('loading-message').textContent=error?.message||String(error);retry.hidden=false;loading.hidden=false;
}

async function boot(){
  if(booting||prepared)return;booting=true;app.dataset.screen='loading';title.hidden=true;game.hidden=false;game.classList.add('is-loading');game.setAttribute('aria-busy','true');
  setLoading('世界のしくみを呼び出しています');
  try{
    await afterVisiblePaint();
    runtimeModule=await import('./rebuild/runtime.js');
    prepared=await runtimeModule.prepareRuntime({buildInfo:info,onProgress:message=>setLoading(message)});
    game.dataset.runtime='prepared';showTitle();
  }catch(error){showBootFailure(error);}
}

async function launch(mode){
  if(launching||booting||!prepared||!runtimeModule)return;launching=true;app.dataset.screen='game';title.hidden=true;game.hidden=false;game.classList.remove('is-loading');game.removeAttribute('aria-busy');loading.hidden=true;
  try{
    runtime=await runtimeModule.startRuntime({
      mode,buildInfo:info,name:$('life-name').value,prepared,
      onExit(){runtime=null;game.dataset.runtime='prepared';showTitle();},
    });
    game.dataset.runtime='active';launching=false;
  }catch(error){
    console.error(error);runtime?.dispose?.();runtime=null;game.dataset.runtime='prepared';showTitle(`開始できませんでした：${error?.message||error}`);
  }
}

refreshContinue();
retry.addEventListener('click',()=>location.reload());
$('new-life').addEventListener('click',()=>{if(hasSave&&!confirm('今の人生を終えて、0歳から新しく始めます。現在の100年人生の保存は置き換わります。続けますか？'))return;void launch('new');});
$('continue-life').addEventListener('click',()=>{void launch('continue');});
void boot();

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
    const labApp=createApp(createWebPlatform({gameId:'rinne',environment:info.environment}));
    const canvas=document.getElementById('game');
    let worldTimeMs=0,last=performance.now();
    const tick=now=>{if(!window.__VILLAGE_WORLD_PAUSED__)worldTimeMs+=Math.max(0,now-last);last=now;canvas.dataset.worldTimeMs=String(Math.round(worldTimeMs));labClock=requestAnimationFrame(tick);};
    labClock=requestAnimationFrame(tick);
    lab=installVillageHostRehearsal({capture:()=>({worldTimeMs:Math.round(worldTimeMs),world:labApp.world,characters:[],npcs:[],randomState:null}),apply:checkpoint=>{worldTimeMs=checkpoint.worldTimeMs;canvas.dataset.worldRevision=String(checkpoint.world?.revision??'');}});
    await lab;
  })().catch(error=>{console.error(error);$('boot-status').textContent=`村診断失敗：${error?.message||error}`;});
}

// Session disposal keeps the prebooted renderer/world alive. Only page/HMR teardown destroys it.
if(import.meta.hot)import.meta.hot.dispose(()=>{runtime?.dispose?.();prepared?.dispose?.();cancelAnimationFrame(labClock);Promise.resolve(lab).then(link=>link?.dispose?.()).catch(()=>{});});
