import {audioURLs} from '@soul/audio/urls';
import {webAudioActivation} from '@soul/platform-web/audio-activation';

const TRACK='v01';
const AudioCtx=window.AudioContext||window.webkitAudioContext;
if(!AudioCtx||!audioURLs?.[TRACK]){
  window.__MURA_BACKGROUND_BGM__={state:'unsupported'};
}else{
  let context=null,gain=null,source=null,buffer=null,loading=null,started=false,manualOverride=false,disposed=false;
  const key=`soul.${__BUILD_INFO__.environment}.village.device.music.v1`;
  function volume(){
    try{const prefs=JSON.parse(localStorage.getItem(key));if(Number.isFinite(prefs?.volume))return Math.max(0,Math.min(1,prefs.volume));}catch{}
    return .4;
  }
  function ensureContext(){
    if(context)return context;
    context=new AudioCtx();gain=context.createGain();gain.gain.value=volume();gain.connect(context.destination);return context;
  }
  async function load(){
    if(buffer)return buffer;if(loading)return loading;
    loading=(async()=>{const response=await fetch(audioURLs[TRACK]);if(!response.ok)throw new Error(`BGM HTTP ${response.status}`);const bytes=await response.arrayBuffer();const ctx=ensureContext();buffer=await ctx.decodeAudioData(bytes.slice(0));return buffer;})();
    try{return await loading;}finally{loading=null;}
  }
  function stopSource(){if(source){try{source.stop();}catch{}try{source.disconnect();}catch{}source=null;}started=false;}
  async function play(){
    if(disposed||manualOverride)return false;
    try{
      // Create and resume while the trusted gesture is still active. Waiting for\n      // fetch/decode first can consume transient browser user activation.\n      const ctx=ensureContext();\n      if(ctx.state==='suspended')await ctx.resume();\n      const decoded=await load();if(disposed||manualOverride)return false;
      if(source){if(ctx.state==='suspended')await ctx.resume();started=true;return true;}
      const next=ctx.createBufferSource();next.buffer=decoded;next.loop=true;next.connect(gain);source=next;next.start(0);await ctx.resume();started=true;return true;
    }catch(error){console.warn('[叡智豊満 BGM] Web Audio playback failed',error);return false;}
  }
  async function pause(){if(!context)return;try{await context.suspend();}catch{}started=false;}
  async function resume(){if(disposed||manualOverride||!context||!source)return false;try{await context.resume();started=true;return true;}catch{return false;}}
  function setVolume(value){ensureContext();gain.gain.value=Math.max(0,Math.min(1,Number(value)||0));}
  const unsubscribeAudioUnlock=webAudioActivation.subscribeUnlock(()=>play());
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(started)void pause();}else if(source&&!manualOverride){void resume();}});
  const music=window.__SOUL_MUSIC__;
  if(music?.player){
    music.player.addEventListener('play',()=>{manualOverride=true;stopSource();void context?.suspend?.();});
  }
  const slider=music?.root?.querySelector?.('[data-volume]');
  slider?.addEventListener('input',e=>setVolume(e.target.value));
  window.__MURA_BACKGROUND_BGM__={
    state:'ready',track:TRACK,play,pause,resume,setVolume,
    stop(){manualOverride=true;stopSource();void context?.suspend?.();},
    get playing(){return started&&!manualOverride;},
    dispose(){disposed=true;unsubscribeAudioUnlock();stopSource();void context?.close?.();}
  };
}
