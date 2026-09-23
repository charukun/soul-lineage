import './death-rebirth-cinematic.css';

export const DEATH_REBIRTH_TIMING=Object.freeze({
  down:720,
  downCommitted:90,
  cut:120,
  dead:1120,
  void:520,
  watch:2580,
  rewind:940,
  release:860,
  recover:640,
});

const wait=(view,ms)=>new Promise(resolve=>view.setTimeout(resolve,ms));
const nextFrame=view=>new Promise(resolve=>view.requestAnimationFrame(()=>resolve()));

function inertController(){
  const idle=()=>false;
  return Object.freeze({down:idle,recover:idle,reset:idle,dispose:idle,unlockAudio:async()=>false,playDeath:async()=>false,get phase(){return'idle';}});
}

export function createDeathRebirthCinematic(options={}){
  const doc=options.document??globalThis.document;
  const view=options.window??globalThis.window;
  const host=options.host??doc?.body;
  if(!doc||!view||!host)return inertController();

  const reducedMotion=Boolean(view.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  const duration=ms=>reducedMotion?Math.min(ms,220):ms;
  const root=doc.createElement('div');
  root.className='soul-death-cinematic';
  root.dataset.phase='idle';
  root.dataset.scope=options.scope||((host===doc.body||host===doc.documentElement)?'viewport':'stage');
  root.hidden=true;
  root.setAttribute('aria-hidden','true');

  const motes=Array.from({length:12},(_,index)=>{
    const angle=(index*137.508)%360;
    const radius=22+(index%5)*11;
    const x=50+Math.cos(angle*Math.PI/180)*radius*.62;
    const y=54+Math.sin(angle*Math.PI/180)*radius*.38;
    const drift=-18+(index%7)*6;
    const delay=(index%6)*-.41;
    const scale=.45+(index%4)*.18;
    return `<i style="--mote-x:${x.toFixed(2)}%;--mote-y:${y.toFixed(2)}%;--mote-drift:${drift}px;--mote-delay:${delay}s;--mote-scale:${scale.toFixed(2)}"></i>`;
  }).join('');

  root.innerHTML=`<div class="soul-death-cinematic__veil" aria-hidden="true"></div>
    <div class="soul-death-cinematic__fall" aria-hidden="true"></div>
    <div class="soul-death-cinematic__down-copy" aria-hidden="true"><span class="soul-death-cinematic__down-line"></span></div>
    <div class="soul-death-cinematic__death-word" aria-hidden="true">
      <span class="soul-death-cinematic__kicker">葬焉</span>
      <strong data-text="DEAD">DEAD</strong>
      <span class="soul-death-cinematic__caption">因果は、次の刻へ</span>
    </div>
    <div class="soul-death-cinematic__watch-scene" aria-hidden="true">
      <div class="soul-death-cinematic__motes">${motes}</div>
      <div class="soul-death-cinematic__halo"><i></i><i></i><i></i></div>
      <div class="soul-death-cinematic__watch-rig">
        <div class="soul-death-cinematic__chain"></div>
        <div class="soul-death-cinematic__watch">
          <span class="soul-death-cinematic__crown"></span>
          <span class="soul-death-cinematic__sheen"></span>
          <div class="soul-death-cinematic__dial">
            <span class="soul-death-cinematic__numeral soul-death-cinematic__numeral--12">XII</span>
            <span class="soul-death-cinematic__numeral soul-death-cinematic__numeral--3">III</span>
            <span class="soul-death-cinematic__numeral soul-death-cinematic__numeral--6">VI</span>
            <span class="soul-death-cinematic__numeral soul-death-cinematic__numeral--9">IX</span>
            <i class="soul-death-cinematic__hand soul-death-cinematic__hand--hour"></i>
            <i class="soul-death-cinematic__hand soul-death-cinematic__hand--minute"></i>
            <i class="soul-death-cinematic__hand soul-death-cinematic__hand--second"></i>
            <i class="soul-death-cinematic__pin"></i>
          </div>
        </div>
      </div>
      <span class="soul-death-cinematic__watch-caption">時は血を継ぐ</span>
    </div>
    <div class="soul-death-cinematic__rebirth-flare" aria-hidden="true"></div>`;
  host.append(root);

  const downLine=root.querySelector('.soul-death-cinematic__down-line');
  const kicker=root.querySelector('.soul-death-cinematic__kicker');
  const title=root.querySelector('.soul-death-cinematic__death-word strong');
  const caption=root.querySelector('.soul-death-cinematic__caption');
  const watchCaption=root.querySelector('.soul-death-cinematic__watch-caption');
  let disposed=false,terminal=false,sequence=0,hideTimer=0,tickTimer=0,audioContext=null,deathPromise=null,tickIndex=0;
  const audioTimers=new Set();

  function setPhase(next){
    if(disposed)return;
    root.hidden=false;
    root.setAttribute('aria-hidden','false');
    root.dataset.phase=next;
  }
  async function hold(next,ms){
    setPhase(next);
    await nextFrame(view);
    await wait(view,duration(ms));
  }
  function clearHideTimer(){
    if(hideTimer){view.clearTimeout(hideTimer);hideTimer=0;}
  }
  function clearAudioTimers(){
    for(const timer of audioTimers)view.clearTimeout(timer);
    audioTimers.clear();
  }
  function hide(){
    clearHideTimer();
    stopWatchSound();
    clearAudioTimers();
    root.dataset.phase='idle';
    root.hidden=true;
    root.setAttribute('aria-hidden','true');
  }
  function makeAudioContext(){
    if(audioContext&&audioContext.state!=='closed')return audioContext;
    const AudioContextClass=view.AudioContext||view.webkitAudioContext;
    if(!AudioContextClass)return null;
    try{audioContext=new AudioContextClass({latencyHint:'interactive'});}
    catch{try{audioContext=new AudioContextClass();}catch{return null;}}
    return audioContext;
  }
  async function unlockAudio(){
    const context=makeAudioContext();
    if(!context)return false;
    try{
      if(context.state==='suspended')await context.resume();
      if(context.state!=='running')return false;
      const oscillator=context.createOscillator(),gain=context.createGain(),now=context.currentTime;
      gain.gain.setValueAtTime(.00001,now);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);oscillator.stop(now+.01);
      return true;
    }catch{return false;}
  }
  function tone(context,{frequency,endFrequency=frequency,duration=.04,gain=.03,type='triangle',delay=0}){
    if(!context||context.state!=='running')return;
    const now=context.currentTime+delay,oscillator=context.createOscillator(),level=context.createGain();
    oscillator.type=type;
    oscillator.frequency.setValueAtTime(Math.max(30,frequency),now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30,endFrequency),now+duration);
    level.gain.setValueAtTime(Math.max(.0001,gain),now);
    level.gain.exponentialRampToValueAtTime(.0001,now+duration);
    oscillator.connect(level).connect(context.destination);
    oscillator.start(now);oscillator.stop(now+duration+.03);
  }
  function deathCut(context=audioContext){
    if(!context||context.state!=='running')return;
    tone(context,{frequency:2600,endFrequency:310,duration:.028,gain:.026,type:'square'});
    tone(context,{frequency:82,endFrequency:38,duration:.24,gain:.055,type:'triangle',delay:.005});
  }
  function mechanicalTick(context=audioContext){
    if(!context||context.state!=='running')return;
    const bright=tickIndex++%2===0;
    tone(context,{frequency:bright?2480:1980,endFrequency:bright?1120:840,duration:.018,gain:.027,type:'square'});
    tone(context,{frequency:bright?178:151,endFrequency:92,duration:.038,gain:.009,type:'triangle',delay:.004});
  }
  function watchChime(context=audioContext){
    if(!context||context.state!=='running')return;
    tone(context,{frequency:659.25,endFrequency:653,duration:1.35,gain:.021,type:'sine'});
    tone(context,{frequency:987.77,endFrequency:978,duration:1.55,gain:.012,type:'sine',delay:.045});
    tone(context,{frequency:1318.5,endFrequency:1302,duration:1.08,gain:.006,type:'sine',delay:.085});
  }
  function rewindChime(context=audioContext){
    if(!context||context.state!=='running')return;
    tone(context,{frequency:392,endFrequency:784,duration:.72,gain:.016,type:'sine'});
    tone(context,{frequency:523.25,endFrequency:1046.5,duration:.82,gain:.011,type:'sine',delay:.08});
    for(let index=0;index<7;index++){
      const timer=view.setTimeout(()=>{
        audioTimers.delete(timer);
        mechanicalTick(context);
      },Math.round(index*86-index*index*3.5));
      audioTimers.add(timer);
    }
  }
  function stopWatchSound(){
    if(tickTimer){view.clearInterval(tickTimer);tickTimer=0;}
  }
  function startWatchSound(){
    stopWatchSound();
    const context=makeAudioContext();
    if(!context)return;
    const begin=()=>{
      if(disposed||root.dataset.phase!=='watch'||context.state!=='running')return;
      tickIndex=0;watchChime(context);mechanicalTick(context);
      tickTimer=view.setInterval(()=>mechanicalTick(context),500);
    };
    if(context.state==='running')begin();
    else void context.resume().then(begin).catch(()=>{});
  }

  function down({caption:line='意識が遠のく'}={}){
    if(disposed||terminal)return false;
    clearHideTimer();stopWatchSound();clearAudioTimers();sequence++;
    downLine.textContent=String(line||'');
    setPhase('down');
    return true;
  }
  function recover(){
    if(disposed||terminal||root.hidden)return false;
    const own=++sequence;
    clearHideTimer();stopWatchSound();clearAudioTimers();setPhase('recover');
    hideTimer=view.setTimeout(()=>{if(!disposed&&!terminal&&sequence===own)hide();},duration(DEATH_REBIRTH_TIMING.recover));
    return true;
  }
  function playDeath({kicker:nextKicker='葬焉',title:nextTitle='DEAD',caption:nextCaption='因果は、次の刻へ',watchCaption:nextWatchCaption='時は血を継ぐ'}={}){
    if(disposed)return Promise.resolve(false);
    if(deathPromise)return deathPromise;
    const alreadyDown=!root.hidden&&root.dataset.phase==='down';
    terminal=true;clearHideTimer();stopWatchSound();clearAudioTimers();
    const own=++sequence;
    kicker.textContent=String(nextKicker||'');
    title.textContent=String(nextTitle||'DEAD');
    title.dataset.text=String(nextTitle||'DEAD');
    caption.textContent=String(nextCaption||'');
    watchCaption.textContent=String(nextWatchCaption||'');
    if(!alreadyDown){
      downLine.textContent='意識が遠のく';
      setPhase('down');
    }
    const task=(async()=>{
      await wait(view,duration(alreadyDown?DEATH_REBIRTH_TIMING.downCommitted:DEATH_REBIRTH_TIMING.down));
      if(disposed||sequence!==own)return false;
      setPhase('cut');deathCut();
      await nextFrame(view);await wait(view,duration(DEATH_REBIRTH_TIMING.cut));
      if(disposed||sequence!==own)return false;
      await hold('dead',DEATH_REBIRTH_TIMING.dead);
      if(disposed||sequence!==own)return false;
      await hold('void',DEATH_REBIRTH_TIMING.void);
      if(disposed||sequence!==own)return false;
      setPhase('watch');startWatchSound();
      await nextFrame(view);await wait(view,duration(DEATH_REBIRTH_TIMING.watch));
      if(disposed||sequence!==own)return false;
      stopWatchSound();setPhase('rewind');rewindChime();
      await nextFrame(view);await wait(view,duration(DEATH_REBIRTH_TIMING.rewind));
      if(disposed||sequence!==own)return false;
      await hold('release',DEATH_REBIRTH_TIMING.release);
      if(disposed||sequence!==own)return false;
      hide();return true;
    })();
    deathPromise=task;
    void task.finally(()=>{
      if(deathPromise===task)deathPromise=null;
      if(sequence===own)terminal=false;
    }).catch(()=>{});
    return task;
  }
  function reset(){
    if(disposed)return false;
    sequence++;terminal=false;deathPromise=null;clearHideTimer();hide();return true;
  }
  function dispose(){
    if(disposed)return;
    sequence++;disposed=true;terminal=false;deathPromise=null;clearHideTimer();stopWatchSound();clearAudioTimers();
    root.remove();
    if(audioContext&&audioContext.state!=='closed')void audioContext.close().catch(()=>{});
    audioContext=null;
  }

  return Object.freeze({
    down,recover,playDeath,reset,dispose,unlockAudio,
    get phase(){return root.dataset.phase||'idle';},
  });
}
