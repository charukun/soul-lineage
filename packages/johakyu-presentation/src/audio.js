// NOCTURNE battle audio with optional self-hosted samples and deterministic WebAudio fallbacks.
export function createNocturneSound(doc=document,{samples={}}={}){
  let audio=null,master=null,unlocked=false,disposed=false,notes=0,samplePromise=null;
  const active=new Set(),buffers=new Map(),clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,Number(n)||0));
  async function loadSamples(){
    if(samplePromise||disposed||!audio)return samplePromise;
    samplePromise=Promise.all(Object.entries(samples).map(async([role,url])=>{
      try{const response=await fetch(url,{cache:'force-cache'});if(!response.ok)throw Error(String(response.status));const bytes=await response.arrayBuffer(),buffer=await audio.decodeAudioData(bytes);buffers.set(role,buffer);}
      catch{/* Authored samples are enhancement only; semantic fallbacks remain available. */}
    })).then(()=>buffers);
    return samplePromise;
  }
  async function unlock(event){
    if(disposed||doc.hidden||event?.isTrusted===false)return;
    try{
      if(!audio){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;audio=new Context();master=audio.createGain();master.gain.value=.16;master.connect(audio.destination);}
      await audio.resume();unlocked=audio.state==='running';if(unlocked)void loadSamples();
    }catch{/* Audio permission never blocks the visual battle. A later gesture may retry. */}
  }
  function pause(){if(audio?.state==='running')audio.suspend().catch(()=>{});}
  function visibility(){if(doc.hidden)pause();else if(unlocked&&!disposed)audio?.resume().catch(()=>{});}
  function note(f,d,type='sine',volume=.3,{pan=0}={}){
    if(disposed||!unlocked||doc.hidden||audio?.state!=='running')return;
    const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain(),p=audio.createStereoPanner?.();o.type=type;
    o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,f*.45),t+d);
    g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+d);
    o.connect(g);if(p){p.pan.value=clamp(pan,-1,1);g.connect(p);p.connect(master);}else g.connect(master);
    active.add(o);o.onended=()=>{active.delete(o);o.disconnect();g.disconnect();p?.disconnect();};o.start(t);o.stop(t+d);notes++;
  }
  function sample(role,{pan=0,gain=1,rate=1}={}){
    if(disposed||!unlocked||doc.hidden||audio?.state!=='running')return false;
    const buffer=buffers.get(role);if(!buffer)return false;
    const source=audio.createBufferSource(),g=audio.createGain(),p=audio.createStereoPanner?.();source.buffer=buffer;source.playbackRate.value=Math.max(.5,Math.min(1.6,rate));g.gain.value=Math.max(0,Math.min(1.8,gain));
    source.connect(g);if(p){p.pan.value=clamp(pan,-1,1);g.connect(p);p.connect(master);}else g.connect(master);
    active.add(source);source.onended=()=>{active.delete(source);source.disconnect();g.disconnect();p?.disconnect();};source.start();notes++;return true;
  }
  function swing(options={}){if(!sample('swing',{gain:.66,...options}))note(520,.08,'triangle',.11,options);}
  function guard(options={}){if(!sample('guard',{gain:.78,rate:.92,...options})){note(310,.12,'triangle',.28,options);note(1200,.06,'square',.08,options);}}
  function parry(options={}){if(!sample('parry',{gain:1,rate:1.1,...options})){note(620,.1,'triangle',.34,options);note(2500,.05,'square',.1,options);}}
  function impact(options={}){const heavy=Boolean(options.heavy),role=heavy?'counter':'impact';if(!sample(role,{gain:heavy?1.05:.8,rate:heavy?.92:1,...options}))note(heavy?120:230,heavy?.2:.11,'triangle',heavy?.72:.3,options);}
  function footstep(options={}){if(!sample('footstep',{gain:.34,...options}))note(95,.055,'triangle',.08,options);}
  doc.addEventListener('pointerdown',unlock,{passive:true});doc.addEventListener('keydown',unlock);doc.addEventListener('visibilitychange',visibility);
  return Object.freeze({
    note,swing,guard,parry,impact,footstep,
    hit(big=false,options={}){impact({heavy:Boolean(big),...options});},
    pause,
    metrics:()=>({unlocked,state:audio?.state||'locked',notes,activeVoices:active.size,samplesReady:buffers.size,samplesConfigured:Object.keys(samples).length}),
    destroy(){if(disposed)return;disposed=true;doc.removeEventListener('pointerdown',unlock);doc.removeEventListener('keydown',unlock);doc.removeEventListener('visibilitychange',visibility);for(const source of active){try{source.stop();}catch{}}active.clear();buffers.clear();audio?.close().catch(()=>{});}
  });
}
