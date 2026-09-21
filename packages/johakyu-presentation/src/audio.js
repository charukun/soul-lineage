import {FATIGUE_BREATH_ASSET} from './fatigue.js';

// NOCTURNE's original synthesized hit/burst timbres, with owned browser lifecycle.
export function createNocturneSound(doc=document){
  let audio=null,master=null,unlocked=false,disposed=false,notes=0,fatigueBuffer=null,fatiguePromise=null;
  const active=new Set(),fatigueVoices=new Map();
  function fatigueUrl(){return new URL('/library/'+FATIGUE_BREATH_ASSET.path,doc.baseURI||window.location.href).href;}
  async function loadFatigue(){
    if(disposed||!audio)return null;
    if(fatigueBuffer)return fatigueBuffer;
    if(!fatiguePromise)fatiguePromise=(async()=>{
      const response=await fetch(fatigueUrl(),{credentials:'same-origin',cache:'force-cache'});
      if(!response.ok)throw new Error('Fatigue SFX HTTP '+response.status);
      const bytes=await response.arrayBuffer();
      if(bytes.byteLength!==FATIGUE_BREATH_ASSET.byteLength)throw new Error('Fatigue SFX byteLength mismatch');
      const head=new Uint8Array(bytes,0,12),riff=String.fromCharCode(...head.slice(0,4)),wave=String.fromCharCode(...head.slice(8,12));
      if(riff!=='RIFF'||wave!=='WAVE')throw new Error('Fatigue SFX is not PCM/WAVE');
      fatigueBuffer=await audio.decodeAudioData(bytes.slice(0));return fatigueBuffer;
    })().catch(()=>{fatiguePromise=null;return null;});
    return fatiguePromise;
  }
  function stopFatigue(id){
    const voice=fatigueVoices.get(id);if(!voice)return;
    fatigueVoices.delete(id);try{voice.source.stop();}catch{}voice.source.disconnect();voice.gain.disconnect();voice.panner.disconnect();
  }
  function positionPanner(panner,x,z){
    const t=audio?.currentTime||0;
    if(panner.positionX){panner.positionX.setTargetAtTime(Number(x)||0,t,.05);panner.positionY.setTargetAtTime(1.2,t,.05);panner.positionZ.setTargetAtTime(Number(z)||0,t,.05);}
    else panner.setPosition(Number(x)||0,1.2,Number(z)||0);
  }
  function fatigue(id,{active:enabled=false,gain=.2,rate=1,x=0,z=0}={}){
    if(disposed||!id)return;
    if(!enabled){stopFatigue(id);return;}
    if(!unlocked||doc.hidden||audio?.state!=='running')return;
    if(!fatigueBuffer){loadFatigue();return;}
    let voice=fatigueVoices.get(id);
    if(!voice){
      const source=audio.createBufferSource(),gainNode=audio.createGain(),panner=audio.createPanner();
      source.buffer=fatigueBuffer;source.loop=true;panner.panningModel='equalpower';panner.distanceModel='inverse';panner.refDistance=2;panner.maxDistance=24;panner.rolloffFactor=.7;
      source.connect(gainNode);gainNode.connect(panner);panner.connect(master);
      voice={source,gain:gainNode,panner};fatigueVoices.set(id,voice);source.onended=()=>{if(fatigueVoices.get(id)===voice)fatigueVoices.delete(id);};source.start();
    }
    voice.source.playbackRate.setTargetAtTime(Math.max(.65,Math.min(1.35,Number(rate)||1)),audio.currentTime,.08);
    voice.gain.gain.setTargetAtTime(Math.max(0,Math.min(.8,Number(gain)||0)),audio.currentTime,.08);positionPanner(voice.panner,x,z);
  }
  async function unlock(event){
    if(disposed||doc.hidden||event?.isTrusted===false)return;
    try{
      if(!audio){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;audio=new Context();master=audio.createGain();master.gain.value=.13;master.connect(audio.destination);}
      await audio.resume();unlocked=audio.state==='running';if(unlocked)loadFatigue();
    }catch{/* Audio permission or asset decode never blocks the visual battle. */}
  }
  function pause(){if(audio?.state==='running')audio.suspend().catch(()=>{});}
  function visibility(){if(doc.hidden)pause();else if(unlocked&&!disposed)audio?.resume().catch(()=>{});}
  function note(f,d,type='sine',volume=.3){
    if(disposed||!unlocked||doc.hidden||audio?.state!=='running')return;
    const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type=type;
    o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,f*.45),t+d);
    g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+d);
    o.connect(g);g.connect(master);active.add(o);o.onended=()=>{active.delete(o);o.disconnect();g.disconnect();};o.start(t);o.stop(t+d);notes++;
  }
  doc.addEventListener('pointerdown',unlock,{passive:true});doc.addEventListener('keydown',unlock);doc.addEventListener('visibilitychange',visibility);
  return Object.freeze({
    note,hit(big=false){note(big?110:240,big?.25:.11,'triangle',big?.8:.32);note(big?1800:2700,.055,'sawtooth',.10);},fatigue,pause,
    metrics:()=>({unlocked,state:audio?.state||'locked',notes,activeVoices:active.size,fatigueVoices:fatigueVoices.size,fatigueAssetReady:Boolean(fatigueBuffer)}),
    destroy(){if(disposed)return;disposed=true;doc.removeEventListener('pointerdown',unlock);doc.removeEventListener('keydown',unlock);doc.removeEventListener('visibilitychange',visibility);for(const id of [...fatigueVoices.keys()])stopFatigue(id);for(const o of active){try{o.stop();}catch{}}active.clear();audio?.close().catch(()=>{});}
  });
}
