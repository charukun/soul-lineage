import { installRinneGameplayUpgrade } from './gameplay-upgrade.js';
import { confirmRinneAudio, selectRinneAudio, unlockRinneAudio } from './gameplay-audio.js';
import { INTRO_VIDEO_URL, LIVING_VIDEO_URL, TITLE_POSTER_URL } from './title-cinematic-media.js';
import './native-ui-polish.js';
const info=typeof __BUILD_INFO__!=='undefined'?__BUILD_INFO__:{name:'100年生',app:'rinne',environment:'local',commit:'UNBUILT'};
document.title=`100年生 — 輪廻転焦${info.environment==='prod'?'':` | ${String(info.environment).toUpperCase()}`}`;
const $=id=>document.getElementById(id),app=$('app'),title=$('title-screen'),game=$('game-screen'),loading=$('loading-card'),retry=$('boot-retry');
const villageDialog=$('village-dialog'),settingsDialog=$('title-settings-dialog'),motionToggle=$('title-motion-toggle');
$('build-label').textContent=info.commit==='UNBUILT'?'LOCAL':`${String(info.environment).toUpperCase()} · ${String(info.commit).slice(0,7)}`;
const storageKey=`soul:v1:${info.environment}:rinne:local:life-v2`;
const motionKey=`soul:v1:${info.environment}:rinne:title-motion-v1`;
const rrpCaptureRequested=new URLSearchParams(location.search).has('rrpCapture');
if(rrpCaptureRequested)document.documentElement.dataset.rrpCapture='true';
const afterVisiblePaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
let runtimeModule=null,prepared=null,runtime=null,booting=false,launching=false,hasSave=false,lab=null,labClock=0,villageInstalled=false,coopMenu=null,rrpCapture=null,gameplayUpgrade=null,titleAudioReady=false,titleSelected=null,titleParallaxRaf=0,titleIntroPlayed=false,titleIntroTimers=[],titleIntroFrameRequest=0,titleLivingFailed=false,titleMediaDisposed=false,titleIntroTransitionHandler=null;

const titleCommands=[...title.querySelectorAll('.title-command')],introVideo=$('title-cinematic-intro'),livingVideo=$('title-living-still'),titleReducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
function unlockTitleAudio(){void Promise.resolve(unlockRinneAudio()).then(ok=>{titleAudioReady=Boolean(ok)||titleAudioReady;}).catch(()=>{});titleAudioReady=true;}
function selectTitleCommand(command,{sound=true}={}){
  if(!command)return;
  const changed=titleSelected!==command;
  for(const item of titleCommands)item.dataset.selected=String(item===command);
  titleSelected=command;
  if(changed&&sound&&titleAudioReady&&!title.hidden)selectRinneAudio();
}
for(const command of titleCommands){
  command.addEventListener('focus',()=>selectTitleCommand(command));
  command.addEventListener('pointerenter',()=>selectTitleCommand(command));
  command.addEventListener('pointerdown',()=>{unlockTitleAudio();selectTitleCommand(command);},{passive:true});
  command.addEventListener('click',()=>{unlockTitleAudio();confirmRinneAudio();});
}
title.addEventListener('pointerdown',unlockTitleAudio,{capture:true,passive:true});
title.addEventListener('keydown',event=>{
  if(villageDialog.open||settingsDialog.open||title.dataset.intro!=='idle'||title.dataset.ready!=='true')return;
  if(event.key!=='ArrowDown'&&event.key!=='ArrowUp'&&event.key!=='Enter')return;
  unlockTitleAudio();
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
function resetTitleParallax(){title.style.setProperty('--title-parallax-x','0px');title.style.setProperty('--title-parallax-y','0px');title.style.setProperty('--title-parallax-x-soft','0px');title.style.setProperty('--title-parallax-y-soft','0px');}
title.addEventListener('pointermove',event=>{
  if(title.dataset.motion!=='on'||event.pointerType==='touch')return;
  const rect=title.getBoundingClientRect(),nx=(event.clientX-rect.left)/Math.max(1,rect.width)*2-1,ny=(event.clientY-rect.top)/Math.max(1,rect.height)*2-1;
  cancelAnimationFrame(titleParallaxRaf);titleParallaxRaf=requestAnimationFrame(()=>{title.style.setProperty('--title-parallax-x',`${(-nx*10).toFixed(2)}px`);title.style.setProperty('--title-parallax-y',`${(-ny*6).toFixed(2)}px`);title.style.setProperty('--title-parallax-x-soft',`${(-nx*4).toFixed(2)}px`);title.style.setProperty('--title-parallax-y-soft',`${(-ny*2.5).toFixed(2)}px`);});
},{passive:true});
title.addEventListener('pointerleave',resetTitleParallax,{passive:true});

function prefersReducedTitleMotion(){return Boolean(titleReducedMotion?.matches);}
function clearTitleIntroTimers(){
  for(const timer of titleIntroTimers)clearTimeout(timer);titleIntroTimers=[];
  if(titleIntroTransitionHandler){title.querySelector('.title-lockup')?.removeEventListener('transitionend',titleIntroTransitionHandler);titleIntroTransitionHandler=null;}
}
function setTitleReady(ready,status=''){
  title.dataset.ready=ready?'true':'false';
  for(const command of titleCommands)command.disabled=!ready;
  if(status!==undefined)$('boot-status').textContent=status;
}
function pauseTitleMedia(){introVideo.pause();livingVideo.pause();}
function playLivingStill(){
  if(titleLivingFailed){title.dataset.media='fallback';prepared?.startTitlePreview?.({cinematic:false});return;}
  title.dataset.media='living';introVideo.pause();
  try{livingVideo.currentTime=0;}catch{}
  if(title.dataset.motion==='on'&&!prefersReducedTitleMotion()&&!title.hidden){
    const promise=livingVideo.play();promise?.catch?.(error=>{if(error?.name!=='AbortError'&&!title.hidden){console.warn('Living title video failed',error);titleLivingFailed=true;title.dataset.media='fallback';prepared?.startTitlePreview?.({cinematic:false});}});
  }else livingVideo.pause();
}
function settleTitleUi(){
  if(title.hidden)return;
  clearTitleIntroTimers();title.dataset.intro='settling';
  let complete=false;
  const finish=()=>{if(complete||title.hidden)return;complete=true;titleIntroTransitionHandler=null;title.dataset.intro='idle';};
  const lockup=title.querySelector('.title-lockup');
  titleIntroTransitionHandler=event=>{if(event.propertyName==='opacity'||event.propertyName==='transform')finish();};
  lockup?.addEventListener('transitionend',titleIntroTransitionHandler,{once:true});
  titleIntroTimers.push(setTimeout(finish,1500));
}
function activateTitleFallback(reason){
  if(reason)console.warn('Cinematic title fallback',reason);
  pauseTitleMedia();title.dataset.media='fallback';prepared?.startTitlePreview?.({cinematic:false});
  if(title.dataset.intro!=='idle')settleTitleUi();
}
function onTitleIntroEnded(){
  if(title.hidden)return;
  playLivingStill();settleTitleUi();
}
function onTitleIntroError(){if(!title.hidden)activateTitleFallback(introVideo.error||new Error('intro media error'));}
function onLivingError(){titleLivingFailed=true;if(title.dataset.media==='living'&&!title.hidden)activateTitleFallback(livingVideo.error||new Error('living media error'));}
function onTitleIntroLoaded(){title.dataset.videoReady='true';}
function onTitleIntroCanPlay(){
  title.dataset.videoReady='true';
  if(title.dataset.intro==='cinematic'&&!title.hidden&&introVideo.paused&&title.dataset.motion==='on'&&!prefersReducedTitleMotion()){
    const promise=introVideo.play();promise?.catch?.(error=>{if(error?.name!=='AbortError'&&!title.hidden)activateTitleFallback(error);});
  }
}
function beginTitleIntro(){
  if(titleIntroPlayed){
    title.dataset.intro='idle';playLivingStill();return;
  }
  titleIntroPlayed=true;clearTitleIntroTimers();
  if(title.dataset.motion!=='on'||prefersReducedTitleMotion()){title.dataset.intro='idle';playLivingStill();livingVideo.pause();return;}
  title.dataset.intro='cinematic';title.dataset.media='intro';
  try{introVideo.currentTime=0;}catch{}
  titleIntroTimers.push(setTimeout(()=>{if(!title.hidden&&title.dataset.intro==='cinematic'&&introVideo.readyState<2)activateTitleFallback(new Error('intro load timeout'));},3200));
  const promise=introVideo.play();
  promise?.then?.(()=>{
    if(typeof introVideo.requestVideoFrameCallback==='function'){
      titleIntroFrameRequest=introVideo.requestVideoFrameCallback(()=>{title.dataset.videoFrame='ready';titleIntroFrameRequest=0;});
    }
  }).catch?.(error=>{if(error?.name!=='AbortError'&&!title.hidden)activateTitleFallback(error);});
}
function syncTitleMediaMotion(){
  if(title.hidden)return;
  const allowed=title.dataset.motion==='on'&&!prefersReducedTitleMotion();
  if(!allowed){
    clearTitleIntroTimers();titleIntroPlayed=true;playLivingStill();livingVideo.pause();title.dataset.intro='idle';resetTitleParallax();return;
  }
  if(title.dataset.intro==='idle')playLivingStill();
}
function applyTitleMotion(enabled,persist=false){
  title.dataset.motion=enabled?'on':'off';
  motionToggle.setAttribute('aria-checked',String(enabled));
  const state=motionToggle.querySelector('.setting-switch-state');if(state)state.textContent=enabled?'入':'切';
  if(!enabled)resetTitleParallax();
  if(persist){try{localStorage.setItem(motionKey,enabled?'on':'off');}catch{}}
  syncTitleMediaMotion();
}
function initTitleMedia(){
  titleMediaDisposed=false;
  for(const video of [introVideo,livingVideo]){video.muted=true;video.playsInline=true;video.poster=TITLE_POSTER_URL;}
  introVideo.src=INTRO_VIDEO_URL;livingVideo.src=LIVING_VIDEO_URL;livingVideo.loop=true;
  introVideo.addEventListener('loadeddata',onTitleIntroLoaded);introVideo.addEventListener('canplay',onTitleIntroCanPlay);introVideo.addEventListener('ended',onTitleIntroEnded);introVideo.addEventListener('error',onTitleIntroError);livingVideo.addEventListener('error',onLivingError);
  titleReducedMotion?.addEventListener?.('change',syncTitleMediaMotion);
  introVideo.load();livingVideo.load();
}
function disposeTitleMedia(){
  if(titleMediaDisposed)return;titleMediaDisposed=true;clearTitleIntroTimers();pauseTitleMedia();
  if(titleIntroFrameRequest&&typeof introVideo.cancelVideoFrameCallback==='function')introVideo.cancelVideoFrameCallback(titleIntroFrameRequest);titleIntroFrameRequest=0;
  introVideo.removeEventListener('loadeddata',onTitleIntroLoaded);introVideo.removeEventListener('canplay',onTitleIntroCanPlay);introVideo.removeEventListener('ended',onTitleIntroEnded);introVideo.removeEventListener('error',onTitleIntroError);livingVideo.removeEventListener('error',onLivingError);
  titleReducedMotion?.removeEventListener?.('change',syncTitleMediaMotion);
}
let initialMotion=!prefersReducedTitleMotion();
try{const stored=localStorage.getItem(motionKey);if(!prefersReducedTitleMotion()&&(stored==='on'||stored==='off'))initialMotion=stored==='on';}catch{}
applyTitleMotion(initialMotion);
function refreshContinue(){
  let saved=null;try{saved=JSON.parse(localStorage.getItem(storageKey)||'null');}catch{}
  hasSave=Boolean(saved);const button=$('continue-life');
  button.hidden=false;button.setAttribute('aria-disabled',String(!saved));button.dataset.available=String(Boolean(saved));
  if(saved){
    const age=Math.max(0,Math.min(100,Math.floor(Number(saved.ageYears)||0)));
    button.setAttribute('aria-label',`続きから ${saved.name||'旅人'} ${age}歳 ${saved.generation||1}代目`);
  }else button.setAttribute('aria-label','続きから 保存データなし');
}
function setLoading(message,titleText='世界をつくっています'){
  $('loading-title').textContent=titleText;$('loading-message').textContent=message;retry.hidden=true;loading.hidden=false;
}
function showTitle(status=''){
  app.dataset.screen='title';game.classList.remove('is-loading');game.removeAttribute('aria-busy');game.hidden=true;loading.hidden=true;title.hidden=false;launching=false;booting=false;refreshContinue();selectTitleCommand($('new-life'),{sound:false});setTitleReady(Boolean(prepared),status);
  if(title.dataset.media==='fallback')prepared?.startTitlePreview?.({cinematic:false});
  beginTitleIntro();
}
function showBootFailure(error){
  console.error(error);app.dataset.screen='error';booting=false;launching=false;title.hidden=true;game.hidden=false;game.classList.add('is-loading');game.removeAttribute('aria-busy');
  $('loading-title').textContent='世界を開けませんでした';$('loading-message').textContent=error?.message||String(error);retry.hidden=false;loading.hidden=false;
}
function installGameplay(){gameplayUpgrade?.dispose?.();gameplayUpgrade=prepared?installRinneGameplayUpgrade({prepared,buildInfo:info}):null;titleAudioReady=false;}
function disposePrepared(){gameplayUpgrade?.dispose?.();gameplayUpgrade=null;prepared?.dispose?.();}

async function openCoopDialog(){
  try{
    if(!villageInstalled){
      const {installCoopMenu}=await import('./coop/menu.js');
      let performanceProbeFactory=null,semanticMeasurement=null;
      if(rrpCaptureRequested){
        const {installRrpPerformanceCapture}=await import('./coop/performance-capture.js');
        rrpCapture=installRrpPerformanceCapture({getSession:()=>coopMenu?.session,buildInfo:info});performanceProbeFactory=rrpCapture.performanceProbeFactory;semanticMeasurement=rrpCapture.semanticMeasurement;
      }
      coopMenu=installCoopMenu({container:document.getElementById('village-panel'),buildInfo:info,getPrepared:()=>prepared,getName:()=>$('life-name').value,onPlay:enterCoop,performanceProbeFactory,semanticMeasurement,captureWorkload:Boolean(rrpCapture),onLeave:async()=>{villageDialog.close();if(runtime)await $('back-title').onclick();else await coopMenu.leave();}});
      villageInstalled=true;
    }
    if(!villageDialog.open)villageDialog.showModal();
  }catch(error){console.error(error);$('boot-status').textContent=`村接続失敗：${error?.message||error}`;}
}

async function boot(){
  if(booting||prepared)return;
  booting=true;app.dataset.screen='loading';title.hidden=false;title.dataset.intro='pending';game.hidden=false;game.classList.add('is-loading');game.setAttribute('aria-busy','true');loading.hidden=true;
  refreshContinue();selectTitleCommand($('new-life'),{sound:false});setTitleReady(false,'世界を準備しています');beginTitleIntro();
  try{
    await afterVisiblePaint();
    runtimeModule=await import('./rebuild/runtime.js');
    prepared=await runtimeModule.prepareRuntime({buildInfo:info,onProgress:message=>{$('boot-status').textContent=message;}});
    installGameplay();
    game.dataset.runtime='prepared';showTitle();if(rrpCaptureRequested||new URLSearchParams(location.hash.slice(1)).has('rinne-coop'))void openCoopDialog();
  }catch(error){showBootFailure(error);}
}

async function enterCoop(coop){
  if(JSON.stringify(coop.layout)!==JSON.stringify(prepared.layout)){
    booting=true;setLoading('友達の村を開いています');
    try{disposePrepared();prepared=await runtimeModule.prepareRuntime({buildInfo:info,layoutOverride:coop.layout,onProgress:message=>setLoading(message)});installGameplay();}
    catch(error){showBootFailure(error);throw error;}finally{booting=false;}
  }
  return launch('coop',coop);
}
async function exitGame(coop){
  runtime=null;$('open-coop-game').hidden=true;
  try{await coopMenu?.leave();if(coop){disposePrepared();prepared=await runtimeModule.prepareRuntime({buildInfo:info,onProgress:message=>setLoading(message)});installGameplay();}game.dataset.runtime='prepared';showTitle();}
  catch(error){showBootFailure(error);}
}

async function launch(mode,coop=null){
  if(runtime)throw Error('いったんタイトルへ戻ってから参加してください。');
  if(!coop&&coopMenu?.session)await coopMenu.leave();
  if(launching||booting||!prepared||!runtimeModule)return;launching=true;app.dataset.screen='game';pauseTitleMedia();title.hidden=true;game.hidden=false;game.classList.remove('is-loading');game.removeAttribute('aria-busy');loading.hidden=true;
  try{
    runtime=await runtimeModule.startRuntime({mode,buildInfo:info,name:$('life-name').value,prepared,coop,onExit:()=>exitGame(coop)});
    $('open-coop-game').hidden=!coop;villageDialog.close();game.dataset.runtime='active';launching=false;
  }catch(error){
    console.error(error);runtime?.dispose?.();runtime=null;if(coop){await coopMenu?.leave().catch(console.error);disposePrepared();prepared=null;launching=false;void boot();return;}game.dataset.runtime='prepared';showTitle(`開始できませんでした：${error?.message||error}`);
  }
}

refreshContinue();
retry.addEventListener('click',()=>location.reload());
$('new-life').addEventListener('click',()=>{void launch('new');});
$('continue-life').addEventListener('click',()=>{if(!hasSave){$('boot-status').textContent='続きから遊べる保存データがありません';return;}void launch('continue');});
$('open-settings').addEventListener('click',()=>settingsDialog.showModal());
motionToggle.addEventListener('click',()=>applyTitleMotion(motionToggle.getAttribute('aria-checked')!=='true',true));
initTitleMedia();
void boot();

document.getElementById('close-village').addEventListener('click',()=>villageDialog.close());
$('open-coop-game').addEventListener('click',()=>{void openCoopDialog();});
$('coop-leave').addEventListener('click',()=>{$('back-title').click();});
let movementHelpTimer=0;
$('move-hint').addEventListener('click',()=>{
  const held=$('move-hint').textContent.includes('母'),node=$('toast');
  node.textContent=held?'抱っこ中も画面をスワイプすると、母に抱かれたまま村を見て回れます。':'スワイプで移動。下の「走」を押しながら移動でダッシュ、画面長押しで休憩します。';
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

if(import.meta.hot)import.meta.hot.dispose(()=>{disposeTitleMedia();cancelAnimationFrame(titleParallaxRaf);runtime?.dispose?.();void coopMenu?.leave();rrpCapture?.dispose?.();gameplayUpgrade?.dispose?.();prepared?.dispose?.();cancelAnimationFrame(labClock);Promise.resolve(lab).then(link=>link?.dispose?.()).catch(()=>{});});