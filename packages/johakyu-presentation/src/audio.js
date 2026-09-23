import {FATIGUE_BREATH_ASSET} from './fatigue.js';

// NOCTURNE's original synthesized hit/burst timbres, with owned browser lifecycle.
export function createNocturneSound(doc=document,{samples={}}={}){
  let audio=null,master=null,unlocked=false,disposed=false,notes=0,fatigueBuffer=null,fatiguePromise=null,samplePromise=null;
  const active=new Set(),fatigueVoices=new Map(),sampleBuffers=new Map();
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
  async function loadSamples(){
    if(disposed||!audio||samplePromise||!Object.keys(samples).length)return samplePromise;
    samplePromise=Promise.all(Object.entries(samples).map(async([role,url])=>{
      try{const response=await fetch(url,{credentials:'same-origin',cache:'force-cache'});if(!response.ok)throw new Error('Battle SFX HTTP '+response.status);const bytes=await response.arrayBuffer(),buffer=await audio.decodeAudioData(bytes.slice(0));sampleBuffers.set(role,buffer);}catch{/* Semantic oscillator fallback remains authoritative for availability. */}
    })).then(()=>sampleBuffers);return samplePromise;
  }
  function stereoSample(role,{pan=0,gain=1,rate=1}={}){
    if(disposed||!unlocked||doc.hidden||audio?.state!=='running')return false;const buffer=sampleBuffers.get(role);if(!buffer)return false;
    const source=audio.createBufferSource(),gainNode=audio.createGain(),panner=audio.createStereoPanner?.();source.buffer=buffer;source.playbackRate.value=Math.max(.55,Math.min(1.5,Number(rate)||1));gainNode.gain.value=Math.max(0,Math.min(1.6,Number(gain)||0));
    source.connect(gainNode);if(panner){panner.pan.value=Math.max(-1,Math.min(1,Number(pan)||0));gainNode.connect(panner);panner.connect(master);}else gainNode.connect(master);
    active.add(source);source.onended=()=>{active.delete(source);source.disconnect();gainNode.disconnect();panner?.disconnect();};source.start();notes++;return true;
  }
  function notePan(f,d,type='sine',volume=.3,pan=0){
    if(disposed||!unlocked||doc.hidden||audio?.state!=='running')return;const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain(),p=audio.createStereoPanner?.();o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,f*.45),t+d);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);if(p){p.pan.value=Math.max(-1,Math.min(1,Number(pan)||0));g.connect(p);p.connect(master);}else g.connect(master);active.add(o);o.onended=()=>{active.delete(o);o.disconnect();g.disconnect();p?.disconnect();};o.start(t);o.stop(t+d);notes++;
  }
  function swing({pan=0,gain=.66,rate=1}={}){if(!stereoSample('swing',{pan,gain,rate}))notePan(520,.08,'triangle',.11,pan);}
  function guard({pan=0,gain=.78,rate=.92}={}){if(!stereoSample('guard',{pan,gain,rate})){notePan(310,.12,'triangle',.28,pan);notePan(1200,.06,'square',.08,pan);}}
  function parry({pan=0,gain=1,rate=1.1}={}){if(!stereoSample('parry',{pan,gain,rate})){notePan(620,.1,'triangle',.34,pan);notePan(2500,.05,'square',.1,pan);}}
  function impact({pan=0,heavy=false,counter=false,gain=null,rate=1}={}){const role=counter?'counter':'impact',amp=gain??(counter?1.08:heavy?.94:.78);if(!stereoSample(role,{pan,gain:amp,rate:counter?.92:rate}))notePan(counter||heavy?120:230,counter||heavy?.2:.11,'triangle',counter||heavy?.72:.3,pan);}
  function footstep({pan=0,gain=.34,rate=1}={}){if(!stereoSample('footstep',{pan,gain,rate}))notePan(95,.055,'triangle',.08,pan);}

  async function unlock(event){
    if(disposed||doc.hidden||event?.isTrusted===false)return;
    try{
      if(!audio){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;audio=new Context();master=audio.createGain();master.gain.value=.13;master.connect(audio.destination);}
      await audio.resume();unlocked=audio.state==='running';if(unlocked){loadFatigue();void loadSamples();}
    }catch{/* Audio permission or asset decode never blocks the visual battle. */}
    return unlocked;
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
    unlock,note,swing,guard,parry,impact,footstep,hit(big=false,options={}){impact({heavy:Boolean(big),...options});if(!sampleBuffers.size)note(big?1800:2700,.055,'sawtooth',.10);},fatigue,pause,
    metrics:()=>({unlocked,state:audio?.state||'locked',notes,activeVoices:active.size,fatigueVoices:fatigueVoices.size,fatigueAssetReady:Boolean(fatigueBuffer),samplesReady:sampleBuffers.size,samplesConfigured:Object.keys(samples).length}),
    destroy(){if(disposed)return;disposed=true;doc.removeEventListener('pointerdown',unlock);doc.removeEventListener('keydown',unlock);doc.removeEventListener('visibilitychange',visibility);for(const id of [...fatigueVoices.keys()])stopFatigue(id);for(const o of active){try{o.stop();}catch{}}active.clear();sampleBuffers.clear();audio?.close().catch(()=>{});}
  });
}
