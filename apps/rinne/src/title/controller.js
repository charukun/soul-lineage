import {mountStory} from '../story/controller.js';
import {TitleWorld} from './world.js';
import {SoulParticles} from './particles.js';
import {TitleAudio} from './audio.js';
import {transition,normalizeEnvironment,normalizedSettings,acceptsReadyMessage,acceptsFrameOrigin} from './state.js';
import {LoadingUI} from './loading-ui.js';

/** All browser-specific navigation, storage, visibility and DOM stay in this adapter. */
export function mountTitle(buildInfo, options={}){
 const $=id=>document.getElementById(id),screen=$('title-screen'),shell=$('simulator-shell'),canvas=$('game');
 const environment=normalizeEnvironment(buildInfo.environment),base=new URL('.',options.baseURL||document.baseURI),media=matchMedia('(prefers-reduced-motion: reduce)'),abort=new AbortController(),signal=abort.signal;
 const storageKey=`rinne.title.${environment}.v1`;let saved=null;try{saved=JSON.parse(localStorage.getItem(storageKey));}catch{}
 let settings=normalizedSettings(saved,media.matches),state='intro',world,frame=null,requestToken='',introStart=performance.now(),raf=0,last=0,seconds=0,timeout=0,launchDelay=0,destroyed=false,visible=!document.hidden;
 let pointer=[0,0],drift=[0,0],gesture=false,launchAbort=null,experience='simulator',disposeStory=null,mountingStory=false;
 const loading=new LoadingUI($,(message,code)=>showError(message,code),options.loadingLimits);
 const assetRequests=new Set();
 const particles=new SoulParticles($('soul-particles')),audio=new TitleAudio();
 const version=buildInfo.commit==='UNBUILT'?'LOCAL · FIX 2':`${environment.toUpperCase()} · ${String(buildInfo.commit).slice(0,7)}`;
 $('version').textContent=version;$('simulator-version').textContent=version;document.title=`輪廻転焦${environment==='prod'?'':` | ${environment.toUpperCase()}`}`;
 canvas.dataset.app='rinne';canvas.dataset.environment=String(buildInfo.environment);canvas.dataset.platform='web';canvas.dataset.commit=String(buildInfo.commit);screen.dataset.experience='rinne-title';
 $('emblem').src=options.emblemURL||new URL('./title-assets/crest.svg',base).href;
 screen.style.setProperty('--world-small',`url("${options.worldSmallURL||new URL('./title-assets/world-small.webp',base).href}")`);
 const listen=(el,type,fn,opts={})=>el.addEventListener(type,fn,{...opts,signal});
 const status=text=>{$('status').textContent=text;};
 const isTitle=()=>state==='title'||state==='intro';
 const failure=error=>{canvas.dataset.renderer=canvas.dataset.renderer==='lost'?'lost':'unavailable';$('renderer-warning').hidden=false;status('WebGL2背景を表示できません。');console.error('Title renderer:',error);};
 try{world=new TitleWorld(canvas,options.worldURL||new URL('./title-assets/world.webp',base).href,failure);world.initialize().then(()=>{$('renderer-warning').hidden=true;$('status').dataset.state='ready';status('タイトル画面を開きました。');resume();}).catch(failure);}catch(error){failure(error);}
 function saveSettings(){saved={...settings};try{localStorage.setItem(storageKey,JSON.stringify(settings));}catch{status('このブラウザでは設定を保存できません。');}}
 function syncSettings(){document.body.classList.toggle('reduced-motion',settings.reducedMotion);$('sound-toggle').setAttribute('aria-pressed',String(settings.sound));$('sound-toggle').setAttribute('aria-label',settings.sound?'音をオフにする':'音をオンにする');$('sound-label').textContent=settings.sound?'音あり':'音なし';$('setting-sound').checked=settings.sound;$('setting-motion').checked=settings.reducedMotion;if(settings.reducedMotion&&state==='intro')reveal();audio.setActive(settings.sound&&gesture&&visible&&isTitle());resume();}
 function updateState(event){state=transition(state,event);screen.dataset.state=state;}
 function reveal(){if(state==='intro')updateState('reveal');screen.dataset.phase='title';$('skip-intro').hidden=true;$('start-simulator').disabled=false;}
 function tick(now){raf=0;if(destroyed||!visible||!isTitle())return;const interval=matchMedia('(pointer:coarse)').matches?32:16;if(now-last>=interval){const dt=Math.min((now-last)/1000,.05);last=now;seconds+=dt;drift=drift.map((v,i)=>v+(pointer[i]-v)*.035);const p=state==='intro'?Math.max(0,Math.min(1,(now-introStart)/3800)):1;if(state==='intro'&&p>.72){screen.dataset.phase='title';$('start-simulator').disabled=false;}if(state==='intro'&&p>=1)reveal();world?.draw(seconds,p,drift,settings.reducedMotion);particles.draw(seconds,p,settings.reducedMotion);}if(!settings.reducedMotion)raf=requestAnimationFrame(tick);}
 function resume(){if(!raf&&visible&&isTitle()&&!destroyed){last=performance.now();raf=requestAnimationFrame(tick);}}
 function pause(){if(raf)cancelAnimationFrame(raf);raf=0;}
 function removeFrame(){
  clearTimeout(timeout);clearTimeout(launchDelay);loading.stop();launchAbort?.abort();launchAbort=null;
  disposeStory?.();disposeStory=null;mountingStory=false;requestToken='';assetRequests.clear();frame?.remove();frame=null;$('frame-slot').replaceChildren();
 }
 function showError(message,code='BOOT_ERROR',detail=''){
  if(state!=='loading'&&state!=='playing')return;
  updateState('fail');loading.fail(message,code,detail);$('game-loading').hidden=false;$('game-loading').setAttribute('aria-busy','false');
  launchAbort?.abort();disposeStory?.();disposeStory=null;mountingStory=false;frame?.remove();frame=null;requestToken='';assetRequests.clear();
 }
 async function loadFrame(){
  if(destroyed||state!=='loading')return;
  screen.hidden=true;shell.hidden=false;pause();document.body.classList.add('paused');audio.setActive(false);
  $('game-loading').hidden=false;$('game-loading').setAttribute('aria-busy','true');
  launchAbort=new AbortController();const launchSignal=launchAbort.signal;loading.start();$('loading-heading').textContent=experience==='story'?'物語の中へ':'稽古場へ';$('experience-title').textContent=experience==='story'?'輪廻転焦 本編':'スキルシミュレーター';shell.setAttribute('aria-label',$('experience-title').textContent);
  requestToken=globalThis.crypto?.randomUUID?.()||(globalThis.crypto?.getRandomValues?Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join(''):`title-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
  const token=requestToken,iframe=document.createElement('iframe');frame=iframe;
  iframe.id='simulator-frame';iframe.title=experience==='story'?'輪廻転焦 本編':'Tidebreak Expanded スキルシミュレーター';iframe.allow='autoplay; fullscreen';
  try {
   if(options.simulatorHTML){
    const html=await options.simulatorHTML({signal:launchSignal,onProgress:data=>{if(token===requestToken)loading.update(data);}});
    if(launchSignal.aborted||destroyed||state!=='loading'||token!==requestToken)return;
    const config={token,environment,experience,hostOrigin:location.origin,offline:true};
    const bridgeConfig='<script>window.__RINNE_EMBED__='+JSON.stringify(config)+';window.__RINNE_EMBED_TOKEN__='+JSON.stringify(token)+';<\/script>';
    iframe.srcdoc=html.replace('<head>','<head>'+bridgeConfig);
   }else{
    const url=new URL('./simulator/index.html',base);url.searchParams.set('titleToken',token);url.searchParams.set('environment',environment);url.searchParams.set('experience',experience);iframe.src=url.href;
   }
   loading.update({stage:'engine',message:'ゲームのプログラムを起動しています'});
   $('frame-slot').replaceChildren(iframe);$('back-title').focus({preventScroll:true});
  }catch(error){if(!launchSignal.aborted&&token===requestToken)showError('起動データを開けませんでした。','PACKAGE_ERROR',String(error?.message||error));}
 }
 async function serveAsset(event){
  const data=event.data,token=requestToken,win=frame?.contentWindow,launchSignal=launchAbort?.signal;
  if(!options.readAsset||!win||!launchSignal||typeof data.id!=='string'||typeof data.requestId!=='string'||data.id.length>100||data.requestId.length>120||assetRequests.has(token+':'+data.requestId))return;
  if(assetRequests.size>=2)return;
  const requestKey=token+':'+data.requestId;assetRequests.add(requestKey);
  const target=/^https?:/.test(event.origin)?event.origin:'*';
  const send=(type,extra={},transfer=[])=>{if(requestToken===token&&frame?.contentWindow===win&&!launchSignal.aborted)win.postMessage({channel:'rinne-assets-v2',token,requestId:data.requestId,type,...extra},target,transfer);};
  try{
   const buffer=await options.readAsset(data.id,{signal:launchSignal,onProgress:p=>send('asset-progress',{progress:p})});
   send('asset-data',{buffer},[buffer]);
  }catch(error){if(!launchSignal.aborted)send('asset-error',{message:String(error?.message||error)});}
  finally{assetRequests.delete(requestKey);}
 }
 function enter({fromHistory=false,mode='simulator'}={}){
  if(!isTitle())return;experience=mode==='story'?'story':'simulator';if($('settings-dialog').open)$('settings-dialog').close();gesture=true;audio.chime();updateState('enter');$('start-simulator').disabled=true;screen.dataset.phase='leaving';$('skip-intro').hidden=true;
  if(!fromHistory&&location.hash!=='#'+experience){try{history.pushState({rinneTitle:true},'','#'+experience);}catch{}}
  // An explicit transition, not an arbitrary percentage loader.
  launchDelay=setTimeout(loadFrame,settings.reducedMotion?0:650);
 }
 function back({fromHistory=false}={}){
  removeFrame();updateState('back');screen.hidden=false;shell.hidden=true;screen.dataset.phase='title';$('skip-intro').hidden=true;$('start-simulator').disabled=false;document.body.classList.remove('paused');
  if(!fromHistory&&['#story','#simulator'].includes(location.hash)){try{if(history.state?.rinneTitle)history.back();else history.replaceState(null,'',location.href.split('#')[0]);}catch{}}
  audio.setActive(settings.sound&&gesture&&visible);world?.resize();particles.resize();resume();$('start-simulator').focus({preventScroll:true});status('タイトル画面に戻りました。');
 }
 listen($('start-story'),'click',()=>enter({mode:'story'}));listen($('start-simulator'),'click',()=>enter());listen($('back-title'),'click',()=>back());
 listen($('retry-load'),'click',()=>{if(state!=='error')return;removeFrame();updateState('retry');loadFrame();});
 listen(window,'message',async event=>{
  if(!frame||event.source!==frame.contentWindow||!acceptsFrameOrigin(event.origin,location.origin,location.protocol,Boolean(options.simulatorHTML))||!acceptsReadyMessage(event.data,requestToken))return;
  const data=event.data;
  if(data.type==='asset-request'){serveAsset(event);return;}
  if(data.type==='progress'&&state==='loading'){loading.update(data.progress);return;}
  if(data.type==='ready'&&state==='loading'){
   if(experience==='story'){
    if(mountingStory)return;mountingStory=true;const token=requestToken;
    try{const dispose=await mountStory(frame.contentWindow,environment,{signal:launchAbort.signal});if(token!==requestToken||state!=='loading'){dispose();return;}disposeStory=dispose;}
    catch(error){if(token===requestToken)showError('本編を開けませんでした。保存データはそのまま残しています。','STORY_BOOT_ERROR',String(error?.message||error));return;}
   }
   loading.update({stage:'ready',message:'準備ができました',loaded:1,total:1});loading.stop();updateState('ready');
   $('game-loading').hidden=true;$('game-loading').setAttribute('aria-busy','false');frame.removeAttribute('aria-hidden');frame.focus();
  }else if(data.type==='error'&&(state==='loading'||state==='playing'))showError(data.message||'稽古場を起動できませんでした。',data.code||'GAME_ERROR',data.detail||'');
 });
 listen(window,'popstate',()=>{if(['#simulator','#story'].includes(location.hash)){if(isTitle())enter({fromHistory:true,mode:location.hash.slice(1)});}else if(!isTitle())back({fromHistory:true});});
 listen($('skip-intro'),'click',reveal);listen($('replay-intro'),'click',()=>{if(!isTitle())return;if(settings.reducedMotion){status('演出を控えめにする設定が有効です。');return;}updateState('replay');introStart=performance.now();screen.dataset.phase='intro';$('skip-intro').hidden=false;$('start-simulator').disabled=true;});
 listen($('open-settings'),'click',()=>{$('settings-dialog').showModal();audio.chime();});
 listen($('sound-toggle'),'click',()=>{gesture=true;settings.sound=!settings.sound;saveSettings();syncSettings();});
 listen($('setting-sound'),'change',event=>{gesture=true;settings.sound=event.target.checked;saveSettings();syncSettings();});
 listen($('setting-motion'),'change',event=>{settings.reducedMotion=event.target.checked;saveSettings();syncSettings();});
 listen(media,'change',event=>{if(saved?.reducedMotion==null){settings.reducedMotion=event.matches;syncSettings();}});
 listen(document,'pointerdown',event=>{gesture=true;if(settings.sound&&isTitle()&&visible)audio.setActive(true);if(isTitle()&&!event.target.closest('button,dialog'))particles.touch(event.clientX,event.clientY,seconds);});
 listen(screen,'pointermove',event=>{pointer=[event.clientX/innerWidth*2-1,1-event.clientY/innerHeight*2];},{passive:true});listen(screen,'pointerleave',()=>{pointer=[0,0];});
 listen(window,'resize',()=>{world?.resize();particles.resize();});
 listen(document,'visibilitychange',()=>{visible=!document.hidden;loading.last=performance.now();document.body.classList.toggle('paused',!visible||!isTitle());if(!visible){pause();audio.setActive(false);}else{resume();audio.setActive(settings.sound&&gesture&&isTitle());}});
 listen(window,'pagehide',()=>{pause();audio.setActive(false);});listen(window,'pageshow',()=>{visible=!document.hidden;resume();});
 syncSettings();if(!settings.reducedMotion)$('start-simulator').disabled=true;resume();if(['#simulator','#story'].includes(location.hash)){reveal();enter({fromHistory:true,mode:location.hash.slice(1)});}
 // Read-only runtime diagnostics, used by real browser tests. No mocked renderer marker.
 window.__RINNE_TITLE__={snapshot:()=>({state,version,environment,renderer:canvas.dataset.renderer,frames:world?.frames||0,titleAnimating:!!raf,frameMounted:!!frame,settings:{...settings},audioActive:audio.active,loading:loading.snapshot()})};
 return()=>{destroyed=true;abort.abort();pause();removeFrame();world?.dispose();particles.dispose();audio.dispose();delete window.__RINNE_TITLE__;};
}
