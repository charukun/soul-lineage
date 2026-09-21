// NOCTURNE's original synthesized hit/burst timbres, with owned browser lifecycle.
export function createNocturneSound(doc=document){
  let audio=null,master=null,unlocked=false,disposed=false,notes=0;
  const active=new Set();
  async function unlock(event){
    if(disposed||doc.hidden||event?.isTrusted===false)return;
    try{
      if(!audio){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;audio=new Context();master=audio.createGain();master.gain.value=.13;master.connect(audio.destination);}
      await audio.resume();unlocked=audio.state==='running';
    }catch{/* Audio permission never blocks the visual battle. A later gesture may retry. */}
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
    note,hit(big=false){note(big?110:240,big?.25:.11,'triangle',big?.8:.32);note(big?1800:2700,.055,'sawtooth',.10);},pause,
    metrics:()=>({unlocked,state:audio?.state||'locked',notes,activeVoices:active.size}),
    destroy(){if(disposed)return;disposed=true;doc.removeEventListener('pointerdown',unlock);doc.removeEventListener('keydown',unlock);doc.removeEventListener('visibilitychange',visibility);for(const o of active){try{o.stop();}catch{}}active.clear();audio?.close().catch(()=>{});}
  });
}
