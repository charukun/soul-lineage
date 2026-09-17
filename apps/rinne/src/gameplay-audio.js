import { audioURLs } from '@soul/audio/urls';

let activeAudio=null;
export const unlockRinneAudio=()=>activeAudio?.unlock?.()??false;
export const selectRinneAudio=()=>activeAudio?.select?.();
export const confirmRinneAudio=()=>activeAudio?.commit?.();
export const presentRinneImpactAudio=options=>activeAudio?.impact?.(options);
export const clearRinneImpactAudio=()=>activeAudio?.clearImpact?.();

export function createRinneAudio(){
  const BASE_MUSIC_VOLUME=.2,music=new Audio(audioURLs.r01);music.loop=true;music.volume=BASE_MUSIC_VOLUME;music.preload='auto';let context=null,lastStep=0,disposed=false,duckTimer=0;
  async function unlock(){
    if(disposed)return false;
    const C=globalThis.AudioContext||globalThis.webkitAudioContext;
    try{if(C&&!context)context=new C();}catch(error){console.warn('Rinne AudioContext creation failed',error);}
    const resume=context?.state==='suspended'?context.resume().catch(error=>{console.warn('Rinne AudioContext resume failed',error);}):Promise.resolve();
    const playback=music.paused?music.play().catch(error=>{console.warn('Rinne music start failed',error);}):Promise.resolve();
    await Promise.allSettled([resume,playback]);
    return Boolean(context?.state==='running'||!music.paused);
  }
  function tone(freq,duration=.06,gain=.02,type='sine',delay=0){
    if(disposed||!context)return;
    if(context.state==='suspended'){void context.resume().then(()=>tone(freq,duration,gain,type,delay)).catch(()=>{});return;}
    if(context.state!=='running')return;
    const now=context.currentTime+Math.max(0,delay),osc=context.createOscillator(),amp=context.createGain();osc.type=type;osc.frequency.value=freq;amp.gain.setValueAtTime(.0001,now);amp.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),now+.006);amp.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(amp).connect(context.destination);osc.start(now);osc.stop(now+duration+.02);
  }
  function restoreMusic(delay=0){clearTimeout(duckTimer);duckTimer=setTimeout(()=>{if(!disposed)music.volume=BASE_MUSIC_VOLUME;},Math.max(0,delay));}
  function clearImpact(){clearTimeout(duckTimer);duckTimer=0;if(!disposed)music.volume=BASE_MUSIC_VOLUME;}
  function impact({energy=.5,prehit=false}={}){
    if(disposed)return;energy=Math.max(0,Math.min(1,Number(energy)||0));
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
    dispose(){if(disposed)return;disposed=true;clearTimeout(duckTimer);if(activeAudio===controller)activeAudio=null;music.volume=BASE_MUSIC_VOLUME;music.pause();music.src='';void context?.close?.();context=null;}
  };
  activeAudio=controller;
  return controller;
}
