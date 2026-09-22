import {combatSfxURLs} from './sfx-urls.js';

const noop=()=>{};
function makeClip(AudioCtor,url,volume){
  if(typeof AudioCtor!=='function')return null;
  const audio=new AudioCtor(url);audio.preload='auto';audio.volume=volume;return audio;
}
export function createCombatSfx({AudioCtor=globalThis.Audio,AudioContextCtor=globalThis.AudioContext||globalThis.webkitAudioContext,document=globalThis.document,volume=.58}={}){
  const slash=[makeClip(AudioCtor,combatSfxURLs.slashA,volume),makeClip(AudioCtor,combatSfxURLs.slashB,volume)].filter(Boolean);
  const draw=[makeClip(AudioCtor,combatSfxURLs.drawBlade,Math.min(1,volume*.72)),makeClip(AudioCtor,combatSfxURLs.drawBlade,Math.min(1,volume*.62))].filter(Boolean);
  let enabled=true,unlocked=false,cursor=0,drawCursor=0,disposed=false,context=null;
  const unlock=()=>{unlocked=true;if(typeof AudioContextCtor==='function'&&!context){try{context=new AudioContextCtor();}catch{context=null;}}if(context?.state==='suspended')context.resume?.().catch?.(noop);};
  document?.addEventListener?.('pointerdown',unlock,{passive:true});
  document?.addEventListener?.('keydown',unlock,{passive:true});
  const play=(clip,{rate=1,gain=1}={})=>{
    if(disposed||!enabled||!unlocked||!clip)return false;
    try{clip.currentTime=0;clip.playbackRate=Math.max(.5,Math.min(1.7,Number(rate)||1));clip.volume=Math.max(0,Math.min(1,volume*gain));const pending=clip.play?.();pending?.catch?.(noop);return true;}catch{return false;}
  };
  const tone=(frequency,duration=.08,gain=.04,type='sine',delay=0)=>{
    if(disposed||!enabled||!unlocked||!context||context.state==='closed')return false;
    try{const t=context.currentTime+Math.max(0,delay),osc=context.createOscillator(),amp=context.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,t);amp.gain.setValueAtTime(0,t);amp.gain.linearRampToValueAtTime(gain,t+.008);amp.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(amp);amp.connect(context.destination);osc.start(t);osc.stop(t+duration+.02);return true;}catch{return false;}
  };
  const swing=({weapon='sword',power=.6}={})=>{const heavy=['great','axe'].includes(weapon),light=['dagger','fist'].includes(weapon),clip=slash[cursor++%Math.max(1,slash.length)];return play(clip,{rate:heavy?.78:light?1.24:1,gain:.72+Math.min(.28,Math.max(0,Number(power)||0))});};
  const impact=({guard=false,power=.7}={})=>{power=Math.max(0,Math.min(1,Number(power)||0));if(guard){tone(520+power*140,.07,.045,'triangle');tone(930+power*180,.055,.025,'square',.012);return play(draw[drawCursor++%Math.max(1,draw.length)],{rate:1.08,gain:.7});}tone(82+power*46,.09,.05+.03*power,'sine');tone(150+power*70,.055,.025,'triangle',.006);return true;};
  const inspiration=(stage,profile={})=>{
    const key=String(stage||'spark'),pitch=Math.max(.72,Math.min(1.35,Number(profile?.pitch)||1)),gain=Math.max(.55,Math.min(1.25,Number(profile?.gain)||1));
    if(key==='spark'){tone(740*pitch,.12,.045*gain,'triangle');tone(1110*pitch,.16,.032*gain,'sine',.045);return play(draw[drawCursor++%Math.max(1,draw.length)],{rate:1.28*pitch,gain:.52*gain});}
    if(key==='camera'){tone(420*pitch,.09,.024*gain,'sine');return true;}
    if(key==='anticipation'){tone(520*pitch,.11,.035*gain,'triangle');tone(780*pitch,.12,.028*gain,'triangle',.055);return true;}
    if(key==='stagger'){tone(310*pitch,.08,.035*gain,'square');return true;}
    if(key==='reveal'){tone(660*pitch,.18,.05*gain,'triangle');tone(990*pitch,.22,.04*gain,'sine',.045);tone(1320*pitch,.24,.026*gain,'sine',.095);return true;}
    if(key==='execute'){swing({weapon:'sword',power:Math.min(1,.9*gain)});tone(880*pitch,.1,.03*gain,'triangle');tone(1175*pitch,.14,.024*gain,'triangle',.09);return true;}
    if(key==='impact'){tone(96*pitch,.11,.07*gain,'triangle');tone(210*pitch,.07,.035*gain,'square',.01);return true;}
    return false;
  };
  return Object.freeze({
    get enabled(){return enabled;},get unlocked(){return unlocked;},unlock,
    setEnabled(value){enabled=Boolean(value);if(enabled)unlock();return enabled;},
    toggle(){enabled=!enabled;if(enabled)unlock();return enabled;},
    slash(){if(!slash.length)return false;return play(slash[cursor++%slash.length]);},
    draw(){if(!draw.length)return false;return play(draw[drawCursor++%draw.length]);},
    swing,impact,inspiration,
    reset(){cursor=0;drawCursor=0;},
    dispose(){disposed=true;document?.removeEventListener?.('pointerdown',unlock);document?.removeEventListener?.('keydown',unlock);for(const clip of [...slash,...draw].filter(Boolean)){try{clip.pause?.();}catch{}}void context?.close?.().catch?.(noop);context=null;}
  });
}
