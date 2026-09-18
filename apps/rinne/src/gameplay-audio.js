import { audioURLs } from '@soul/audio/urls';

let activeAudio=null;
export const unlockRinneAudio=()=>activeAudio?.unlock?.()??false;
export const selectRinneAudio=()=>activeAudio?.select?.();
export const confirmRinneAudio=()=>activeAudio?.commit?.();
export const presentRinneImpactAudio=options=>activeAudio?.impact?.(options);
export const clearRinneImpactAudio=()=>activeAudio?.clearImpact?.();

export function createRinneAudio(){
  const BASE_MUSIC_VOLUME=.2,music=new Audio(audioURLs.r01);music.loop=true;music.volume=BASE_MUSIC_VOLUME;music.preload='auto';
  const doc=globalThis.document,pageHidden=()=>Boolean(doc&&(doc.hidden||doc.visibilityState==='hidden'));
  let context=null,lastStep=0,disposed=false,unlocked=false,backgrounded=pageHidden(),duckTimer=0;

  const contextCanResume=()=>Boolean(context&&context.state!=='running'&&context.state!=='closed');
  function clearImpact(){clearTimeout(duckTimer);duckTimer=0;if(!disposed)music.volume=BASE_MUSIC_VOLUME;}
  function suspendForBackground(){
    backgrounded=true;clearImpact();music.pause();
    if(context?.state==='running')void context.suspend().catch(error=>{console.warn('Rinne AudioContext suspend failed',error);});
  }
  async function resumePlayback(){
    if(disposed||backgrounded||pageHidden()||!unlocked)return false;
    const resume=contextCanResume()?context.resume().catch(error=>{console.warn('Rinne AudioContext resume failed',error);}):Promise.resolve();
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
    return resumePlayback();
  }
  function onVisibilityChange(){
    if(pageHidden()){suspendForBackground();return;}
    backgrounded=false;if(unlocked)void resumePlayback();
  }
  function recoverFromGesture(){
    if(!unlocked||disposed||backgrounded||pageHidden())return;
    if(music.paused||contextCanResume())void resumePlayback();
  }
  doc?.addEventListener?.('visibilitychange',onVisibilityChange);
  doc?.addEventListener?.('pointerdown',recoverFromGesture,{capture:true});
  doc?.addEventListener?.('keydown',recoverFromGesture,{capture:true});

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
    unlock,select,commit,ui:select,impact,clearImpact,
    item(){tone(620,.08,.024,'triangle');setTimeout(()=>tone(840,.08,.018,'triangle'),55);},
    combat:()=>tone(128,.11,.032,'sawtooth'),rest:()=>tone(260,.14,.014),dash:()=>tone(170,.07,.022,'square'),
    step(now){if(now-lastStep<.25)return;lastStep=now;tone(92,.035,.012);},
    dispose(){if(disposed)return;disposed=true;clearTimeout(duckTimer);if(activeAudio===controller)activeAudio=null;doc?.removeEventListener?.('visibilitychange',onVisibilityChange);doc?.removeEventListener?.('pointerdown',recoverFromGesture,{capture:true});doc?.removeEventListener?.('keydown',recoverFromGesture,{capture:true});music.volume=BASE_MUSIC_VOLUME;music.pause();music.src='';void context?.close?.();context=null;}
  };
  activeAudio=controller;
  return controller;
}
