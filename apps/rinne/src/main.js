const info=typeof __BUILD_INFO__!=='undefined'?__BUILD_INFO__:{name:'100年生',app:'rinne',environment:'local',commit:'UNBUILT'};
document.title=`100年生 — 輪廻転焦${info.environment==='prod'?'':` | ${String(info.environment).toUpperCase()}`}`;
const $=id=>document.getElementById(id),app=$('app'),title=$('title-screen'),game=$('game-screen'),loading=$('loading-card'),retry=$('boot-retry');
const replaceLifeDialog=$('replace-life-dialog'),villageDialog=$('village-dialog'),settingsDialog=$('title-settings-dialog'),motionToggle=$('title-motion-toggle');
$('build-label').textContent=info.commit==='UNBUILT'?'LOCAL':`${String(info.environment).toUpperCase()} · ${String(info.commit).slice(0,7)}`;
const storageKey=`soul:v1:${info.environment}:rinne:local:life-v2`;
const motionKey=`soul:v1:${info.environment}:rinne:title-motion-v1`;
const afterVisiblePaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
let runtimeModule=null,prepared=null,runtime=null,booting=false,launching=false,hasSave=false,lab=null,labClock=0,villageInstalled=false,coopMenu=null;

const titleCommands=[...title.querySelectorAll('.title-command')];
function selectTitleCommand(command){
  for(const item of titleCommands)item.dataset.selected=String(item===command);
}
for(const command of titleCommands){
  command.addEventListener('focus',()=>selectTitleCommand(command));
  command.addEventListener('pointerenter',()=>selectTitleCommand(command));
}
title.addEventListener('keydown',event=>{
  if(replaceLifeDialog.open||villageDialog.open||settingsDialog.open)return;
  if(event.key!=='ArrowDown'&&event.key!=='ArrowUp'&&event.key!=='Enter')return;
  const selected=titleCommands.findIndex(item=>item.dataset.selected==='true');
  const index=selected<0?0:selected;
  if(event.key==='Enter'){
    if(!titleCommands.includes(document.activeElement)){event.preventDefault();titleCommands[index].click();}
    return;
  }
  event.preventDefault();
  const delta=event.key==='ArrowDown'?1:-1;
  const next=(index+delta+titleCommands.length)%titleCommands.length;
  selectTitleCommand(titleCommands[next]);
  titleCommands[next].focus({preventScroll:true});
});

function applyTitleMotion(enabled,persist=false){
  title.dataset.motion=enabled?'on':'off';motionToggle.checked=enabled;
  if(persist){try{localStorage.setItem(motionKey,enabled?'on':'off');}catch{}}
}
let initialMotion=!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
try{const stored=localStorage.getItem(motionKey);if(stored==='on'||stored==='off')initialMotion=stored==='on';}catch{}
applyTitleMotion(initialMotion);

function refreshContinue(){
  let saved=null;try{saved=JSON.parse(localStorage.getItem(storageKey)||'null');}catch{}
  hasSave=Boolean(saved);const button=$('continue-life'),detail=$('continue-detail');
  button.hidden=false;button.setAttribute('aria-disabled',String(!saved));
  if(saved){
    const age=Math.max(0,Math.min(100,Math.floor(Number(saved.ageYears)||0)));
    detail.textContent=`${saved.name||'旅人'} · ${age}歳 · ${saved.generation||1}代目`;
    button.setAttribute('aria-label',`旅の記録 ${detail.textContent}`);
  }else{
    detail.textContent='記録はまだありません';button.setAttribute('aria-label','旅の記録 記録なし');
  }
}
function requestLifeReplacement(){
  return new Promise(resolve=>{
    replaceLifeDialog.returnValue='cancel';
    replaceLifeDialog.addEventListener('close',()=>resolve(replaceLifeDialog.returnValue==='replace'),{once:true});
    replaceLifeDialog.showModal();
  });
}
function setLoading(message,titleText='世界をつくっています'){
  $('loading-title').textContent=titleText;$('loading-message').textContent=message;retry.hidden=true;loading.hidden=false;
}
function showTitle(status=''){
  app.dataset.screen='title';game.classList.remove('is-loading');game.removeAttribute('aria-busy');game.hidden=true;loading.hidden=true;title.hidden=false;launching=false;booting=false;$('boot-status').textContent=status;refreshContinue();selectTitleCommand($('new-life'));
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
    game.dataset.runtime='prepared';showTitle();if(new URLSearchParams(location.hash.slice(1)).has('rinne-coop'))$('open-village').click();
  }catch(error){showBootFailure(error);}
}

async function enterCoop(coop){
  if(JSON.stringify(coop.layout)!==JSON.stringify(prepared.layout)){
    booting=true;setLoading('友達の村を開いています');
    try{prepared.dispose();prepared=await runtimeModule.prepareRuntime({buildInfo:info,layoutOverride:coop.layout,onProgress:message=>setLoading(message)});}
    catch(error){showBootFailure(error);throw error;}finally{booting=false;}
  }
  return launch('coop',coop);
}
async function exitGame(coop){
  runtime=null;$('open-coop-game').hidden=true;
  try{await coopMenu?.leave();if(coop){prepared.dispose();prepared=await runtimeModule.prepareRuntime({buildInfo:info,onProgress:message=>setLoading(message)});}game.dataset.runtime='prepared';showTitle();}
  catch(error){showBootFailure(error);}
}

async function launch(mode,coop=null){
  if(runtime)throw Error('いったんタイトルへ戻ってから参加してください。');
  if(!coop&&coopMenu?.session)await coopMenu.leave();
  if(launching||booting||!prepared||!runtimeModule)return;launching=true;app.dataset.screen='game';title.hidden=true;game.hidden=false;game.classList.remove('is-loading');game.removeAttribute('aria-busy');loading.hidden=true;
  try{
    runtime=await runtimeModule.startRuntime({
      mode,buildInfo:info,name:$('life-name').value,prepared,coop,
      onExit:()=>exitGame(coop),
    });
    $('open-coop-game').hidden=!coop;villageDialog.close();
    game.dataset.runtime='active';launching=false;
  }catch(error){
    console.error(error);runtime?.dispose?.();runtime=null;if(coop){await coopMenu?.leave().catch(console.error);prepared?.dispose();prepared=null;launching=false;void boot();return;}game.dataset.runtime='prepared';showTitle(`開始できませんでした：${error?.message||error}`);
  }
}

refreshContinue();
retry.addEventListener('click',()=>location.reload());
$('new-life').addEventListener('click',async()=>{if(hasSave&&!await requestLifeReplacement())return;void launch('new');});
$('continue-life').addEventListener('click',()=>{if(!hasSave){$('boot-status').textContent='旅の記録はまだありません';return;}void launch('continue');});
$('open-settings').addEventListener('click',()=>settingsDialog.showModal());
motionToggle.addEventListener('change',()=>applyTitleMotion(motionToggle.checked,true));
void boot();

document.getElementById('open-village').addEventListener('click',async()=>{
  try{
    if(!villageInstalled){
      const {installCoopMenu}=await import('./coop/menu.js');
      coopMenu=installCoopMenu({container:document.getElementById('village-panel'),buildInfo:info,getPrepared:()=>prepared,getName:()=>$('life-name').value,onPlay:enterCoop,onLeave:async()=>{villageDialog.close();if(runtime)await $('back-title').onclick();else await coopMenu.leave();}});
      villageInstalled=true;
    }
    villageDialog.showModal();
  }catch(error){console.error(error);$('boot-status').textContent=`村接続失敗：${error?.message||error}`;}
});
document.getElementById('close-village').addEventListener('click',()=>villageDialog.close());
$('open-coop-game').addEventListener('click',()=>villageDialog.showModal());
$('coop-leave').addEventListener('click',()=>{$('back-title').click();});
let movementHelpTimer=0;
$('move-hint').addEventListener('click',()=>{
  const held=$('move-hint').textContent.includes('母'),node=$('toast');
  node.textContent=held?'抱っこ中も画面をスワイプすると、母に抱かれたまま村を見て回れます。':'画面をスワイプすると、その方向へ移動します。';
  node.hidden=false;clearTimeout(movementHelpTimer);movementHelpTimer=setTimeout(()=>{node.hidden=true;},3200);
});

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
if(import.meta.hot)import.meta.hot.dispose(()=>{runtime?.dispose?.();void coopMenu?.leave();prepared?.dispose?.();cancelAnimationFrame(labClock);Promise.resolve(lab).then(link=>link?.dispose?.()).catch(()=>{});});