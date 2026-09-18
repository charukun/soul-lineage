import {combatSfxURLs} from './sfx-urls.js';

const noop=()=>{};
function makeClip(AudioCtor,url,volume){
  if(typeof AudioCtor!=='function')return null;
  const audio=new AudioCtor(url);audio.preload='auto';audio.volume=volume;return audio;
}
export function createCombatSfx({AudioCtor=globalThis.Audio,document=globalThis.document,volume=.58}={}){
  const slash=[makeClip(AudioCtor,combatSfxURLs.slashA,volume),makeClip(AudioCtor,combatSfxURLs.slashB,volume)].filter(Boolean);
  const draw=makeClip(AudioCtor,combatSfxURLs.drawBlade,Math.min(1,volume*.72));
  let enabled=true,unlocked=false,cursor=0,disposed=false;
  const unlock=()=>{unlocked=true;};
  document?.addEventListener?.('pointerdown',unlock,{passive:true});
  document?.addEventListener?.('keydown',unlock,{passive:true});
  const play=clip=>{
    if(disposed||!enabled||!unlocked||!clip)return false;
    try{clip.currentTime=0;const pending=clip.play?.();pending?.catch?.(noop);return true;}catch{return false;}
  };
  return Object.freeze({
    get enabled(){return enabled;},
    get unlocked(){return unlocked;},
    unlock,
    setEnabled(value){enabled=Boolean(value);if(enabled)unlock();return enabled;},
    toggle(){enabled=!enabled;if(enabled)unlock();return enabled;},
    slash(){if(!slash.length)return false;const clip=slash[cursor++%slash.length];return play(clip);},
    draw(){return play(draw);},
    reset(){cursor=0;},
    dispose(){disposed=true;document?.removeEventListener?.('pointerdown',unlock);document?.removeEventListener?.('keydown',unlock);for(const clip of [...slash,draw].filter(Boolean)){try{clip.pause?.();}catch{}}}
  });
}
