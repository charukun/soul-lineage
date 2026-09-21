import { audioURLs } from '@soul/audio/urls';
import { webAudioActivation } from '@soul/platform-web/audio-activation';
import { relinquishMediaElement, restoreMediaElement } from '@soul/shared-ui/media-lifecycle';

let activeAudio=null;
export const unlockRinneAudio=()=>activeAudio?.unlock?.()??false;
export const selectRinneAudio=()=>activeAudio?.select?.();
export const confirmRinneAudio=()=>activeAudio?.commit?.();
export const presentRinneImpactAudio=options=>activeAudio?.impact?.(options);
export const clearRinneImpactAudio=()=>activeAudio?.clearImpact?.();
export const enterRinneGameplayAudio=()=>activeAudio?.enterGameplay?.();
export const prepareRinneTitleAudio=()=>activeAudio?.prepareTitle?.()??Promise.resolve(false);

export function createRinneAudio(){
  const BASE_MUSIC_VOLUME=.2,TITLE_MUSIC_VOLUME=1,TITLE_MUSIC_GAIN=1.25,musicURL=audioURLs.r01,titleMusicURL=audioURLs.r22,music=new Audio(musicURL),titleMusic=new Audio(titleMusicURL);music.loop=true;music.volume=BASE_MUSIC_VOLUME;music.preload='auto';titleMusic.loop=true;titleMusic.volume=TITLE_MUSIC_VOLUME;titleMusic.preload='auto';titleMusic.load();
  const doc=globalThis.document,win=globalThis.window,pageHidden=()=>Boolean(doc&&(doc.hidden||doc.visibilityState==='hidden'));
  let context=null,lastStep=0,disposed=false,unlocked=false,backgrounded=pageHidden(),duckTimer=0,musicDetached=false,musicPosition=0,brandPending=Boolean(win?.__SOUL_BRAND_BOOT_PENDING__),titleMode=false,titleSource=null,titleGain=null,titlePrepared=false,titlePreparePromise=null;

  const contextCanResume=()=>Boolean(context&&context.state!=='running'&&context.state!=='closed');
  const once=(target,event,timeout=4500)=>new Promise((resolve,reject)=>{let timer=0;const cleanup=()=>{target.removeEventListener(event,onEvent);target.removeEventListener('error',onError);clearTimeout(timer);};const onEvent=()=>{cleanup();resolve(true);};const onError=()=>{cleanup();reject(new Error(`Rinne title audio ${event} failed`));};target.addEventListener(event,onEvent,{once:true});target.addEventListener('error',onError,{once:true});timer=setTimeout(()=>{cleanup();reject(new Error(`Rinne title audio ${event} timeout`));},timeout);});
  function ensureTitleGraph(){
    if(!context||titleSource)return;
    try{titleSource=context.createMediaElementSource(titleMusic);titleGain=context.createGain();titleGain.gain.value=TITLE_MUSIC_GAIN;titleSource.connect(titleGain).connect(context.destination);}catch(error){console.warn('Rinne title gain unavailable',error);}
  }
  async function prepareTitle(){
    if(disposed)return false;
    if(titlePrepared)return true;
    if(titlePreparePromise)return titlePreparePromise;
    titlePreparePromise=(async()=>{
      try{
        if(titleMusic.readyState<1)await once(titleMusic,'loadedmetadata');
        titleMusic.pause();
        try{titleMusic.currentTime=0;}catch{}
        if(titleMusic.readyState<3)await once(titleMusic,'canplay');
        titlePrepared=true;return true;
      }catch(error){console.warn('Rinne title audio prepare failed',error);return false;}
    })();
    return titlePreparePromise;
  }
  function detachMusic(){
    if(musicDetached){relinquishMediaElement(music);return;}
    const state=relinquishMediaElement(music);musicPosition=state.position;musicDetached=state.hadSource;
  }
  function restoreMusicSource(){
    if(!musicDetached)return true;
    const restored=restoreMediaElement(music,{src:musicURL,position:musicPosition,loop:true});
    if(restored)musicDetached=false;
    return restored;
  }
  function clearImpact(){clearTimeout(duckTimer);duckTimer=0;if(!disposed)music.volume=BASE_MUSIC_VOLUME;}
  function suspendForBackground(){
    backgrounded=true;clearImpact();detachMusic();titleMusic.pause();
    if(context?.state==='running')void context.suspend().catch(error=>{console.warn('Rinne AudioContext suspend failed',error);});
  }
  async function resumePlayback(){
    if(disposed||backgrounded||pageHidden()||!unlocked||brandPending)return false;
    const resume=contextCanResume()?context.resume().catch(error=>{console.warn('Rinne AudioContext resume failed',error);}):Promise.resolve();
    if(titleMode){
      music.pause();ensureTitleGraph();
      const playback=titleMusic.paused?titleMusic.play().catch(error=>{console.warn('Rinne title music start failed',error);}):Promise.resolve();
      await Promise.allSettled([resume,playback]);
      if(disposed||backgrounded||pageHidden()){suspendForBackground();return false;}
      return Boolean(context?.state==='running'||!titleMusic.paused);
    }
    if(!restoreMusicSource())return false;
    titleMusic.pause();
    const playback=music.paused?music.play().catch(error=>{console.warn('Rinne music start failed',error);}):Promise.resolve();
    await Promise.allSettled([resume,playback]);
    if(disposed||backgrounded||pageHidden()){suspendForBackground();return false;}
    return Boolean(context?.state==='running'||!music.paused);
  }
  async function unlock(){
    if(disposed)return false;unlocked=true;
    if(pageHidden()){suspendForBackground();return false;}
    backgrounded=false;
    const C=globalThis.AudioContext||globalThis.webkitAudioContext;
    try{if(C&&!context)context=new C();}catch(error){console.warn('Rinne AudioContext creation failed',error);}
    if(titleMode)ensureTitleGraph();
    return resumePlayback();
  }
  function onVisibilityChange(){
    if(pageHidden()){suspendForBackground();return;}
    backgrounded=false;if(unlocked)void resumePlayback();
  }
  function recoverFromGesture(){
    if(!unlocked||disposed||backgrounded||pageHidden()||brandPending)return;
    if(music.paused||contextCanResume())void resumePlayback();
  }
  function onBrandEnter(){
    if(disposed)return;brandPending=false;titleMode=true;music.pause();titleMusic.volume=TITLE_MUSIC_VOLUME;
    const start=()=>{try{titleMusic.currentTime=0;}catch{}void unlock();};
    if(titlePrepared)start();else void prepareTitle().finally(start);
  }
  function enterGameplay(){
    if(disposed)return;titleMode=false;titleMusic.pause();music.volume=BASE_MUSIC_VOLUME;
    void resumePlayback();
  }
  doc?.addEventListener?.('visibilitychange',onVisibilityChange);
  win?.addEventListener?.('soul:brand-enter',onBrandEnter);
  win?.addEventListener?.('pagehide',suspendForBackground);
  win?.addEventListener?.('pageshow',onVisibilityChange);
  const unsubscribeAudioUnlock=webAudioActivation.subscribeUnlock(()=>unlock());

  function tone(freq,duration=.06,gain=.02,type='sine',delay=0){
    if(disposed||backgrounded||pageHidden()||!context)return;
    if(context.state!=='running'){if(context.state!=='closed')void context.resume().then(()=>{if(!backgrounded&&!pageHidden())tone(freq,duration,gain,type,delay);}).catch(()=>{});return;}
    const now=context.currentTime+Math.max(0,delay),osc=context.createOscillator(),amp=context.createGain();osc.type=type;osc.frequency.value=freq;amp.gain.setValueAtTime(.0001,now);amp.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),now+.006);amp.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(amp).connect(context.destination);osc.start(now);osc.stop(now+duration+.02);
  }
  function restoreMusic(delay=0){clearTimeout(duckTimer);duckTimer=setTimeout(()=>{if(!disposed&&!backgrounded&&!pageHidden())music.volume=BASE_MUSIC_VOLUME;},Math.max(0,delay));}
  function impact({energy=.5,prehit=false}={}){
    if(disposed||backgrounded||pageHidden())return;energy=Math.max(0,Math.min(1,Number(energy)||0));
    const duck=prehit?.16:.1,depth=prehit?.32:.18;music.volume=Math.max(.035,BASE_MUSIC_VOLUME*(1-depth*energy));restoreMusic(Math.round((duck+.05*energy)*1000));
    if(prehit){if(energy>.55)tone(74,.045,.006+.006*energy,'sine');return;}
    tone(82+42*(1-energy),.055+.065*energy,.014+.032*energy,'sawtooth');
    if(energy>.52)tone(46,.095+.045*energy,.012+.02*energy,'sine',.008);
    if(energy>.78)tone(760,.025,.006,'triangle',.002);
  }
  function select(){tone(520,.045,.014,'triangle');}
  function commit(){tone(390,.055,.018,'triangle');setTimeout(()=>tone(660,.07,.016,'triangle'),48);}
  const controller={
    unlock,select,commit,ui:select,impact,clearImpact,enterGameplay,prepareTitle,
    item(){tone(620,.08,.024,'triangle');setTimeout(()=>tone(840,.08,.018,'triangle'),55);},
    combat:()=>tone(128,.11,.032,'sawtooth'),rest:()=>tone(260,.14,.014),dash:()=>tone(170,.07,.022,'square'),
    step(now){if(now-lastStep<.25)return;lastStep=now;tone(92,.035,.012);},
    dispose(){if(disposed)return;disposed=true;clearTimeout(duckTimer);if(activeAudio===controller)activeAudio=null;doc?.removeEventListener?.('visibilitychange',onVisibilityChange);win?.removeEventListener?.('pagehide',suspendForBackground);win?.removeEventListener?.('pageshow',onVisibilityChange);win?.removeEventListener?.('soul:brand-enter',onBrandEnter);unsubscribeAudioUnlock();music.volume=BASE_MUSIC_VOLUME;titleMusic.pause();titleMusic.removeAttribute('src');titleMusic.load();detachMusic();void context?.close?.();context=null;}
  };
  activeAudio=controller;
  return controller;
}
