import { audioURLs } from '@soul/audio/urls';

export function createRinneAudio(){
  const music=new Audio(audioURLs.r01);music.loop=true;music.volume=.18;music.preload='auto';let context=null,unlocked=false,lastStep=0;
  function unlock(){if(unlocked)return;unlocked=true;const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)return;context=new C();void context.resume();void music.play().catch(()=>{});}
  function tone(freq,duration=.06,gain=.02,type='sine'){if(!context||context.state==='suspended')return;const now=context.currentTime,osc=context.createOscillator(),amp=context.createGain();osc.type=type;osc.frequency.value=freq;amp.gain.setValueAtTime(.0001,now);amp.gain.exponentialRampToValueAtTime(gain,now+.006);amp.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(amp).connect(context.destination);osc.start(now);osc.stop(now+duration+.02);}
  return{unlock,ui:()=>tone(420,.05,.016,'triangle'),item(){tone(620,.08,.024,'triangle');setTimeout(()=>tone(840,.08,.018,'triangle'),55);},combat:()=>tone(128,.11,.032,'sawtooth'),rest:()=>tone(260,.14,.014),dash:()=>tone(170,.07,.022,'square'),step(now){if(now-lastStep<.25)return;lastStep=now;tone(92,.035,.012);},dispose(){music.pause();music.src='';void context?.close?.();context=null;}};
}
