import { audioURLs } from '@soul/audio/urls';

export function createRinneAudio(){
  const music=new Audio(audioURLs.r01);music.loop=true;music.volume=.2;music.preload='auto';let context=null,lastStep=0,disposed=false;
  async function unlock(){
    if(disposed)return false;
    const C=globalThis.AudioContext||globalThis.webkitAudioContext;
    try{if(C&&!context)context=new C();if(context?.state==='suspended')await context.resume();}catch(error){console.warn('Rinne AudioContext resume failed',error);}
    try{if(music.paused)await music.play();}catch(error){console.warn('Rinne music start failed',error);}
    return Boolean(context?.state==='running'||!music.paused);
  }
  function tone(freq,duration=.06,gain=.02,type='sine'){
    if(disposed||!context||context.state!=='running')return;
    const now=context.currentTime,osc=context.createOscillator(),amp=context.createGain();osc.type=type;osc.frequency.value=freq;amp.gain.setValueAtTime(.0001,now);amp.gain.exponentialRampToValueAtTime(gain,now+.006);amp.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(amp).connect(context.destination);osc.start(now);osc.stop(now+duration+.02);
  }
  function select(){tone(520,.045,.014,'triangle');}
  function confirm(){tone(390,.055,.018,'triangle');setTimeout(()=>tone(660,.07,.016,'triangle'),48);}
  return{
    unlock,select,confirm,ui:select,
    item(){tone(620,.08,.024,'triangle');setTimeout(()=>tone(840,.08,.018,'triangle'),55);},
    combat:()=>tone(128,.11,.032,'sawtooth'),rest:()=>tone(260,.14,.014),dash:()=>tone(170,.07,.022,'square'),
    step(now){if(now-lastStep<.25)return;lastStep=now;tone(92,.035,.012);},
    dispose(){if(disposed)return;disposed=true;music.pause();music.src='';void context?.close?.();context=null;}
  };
}
