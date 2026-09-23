import './death-rebirth-cinematic.css';

export const DEATH_REBIRTH_TIMING=Object.freeze({
  down:520,
  blackout:780,
  watch:2200,
  release:680,
  recover:520,
});

const wait=(view,ms)=>new Promise(resolve=>view.setTimeout(resolve,ms));

function inertController(){
  const idle=()=>false;
  return Object.freeze({down:idle,recover:idle,reset:idle,dispose:idle,unlockAudio:async()=>false,playDeath:async()=>false,get phase(){return'idle';}});
}

export function createDeathRebirthCinematic(options={}){
  const doc=options.document??globalThis.document;
  const view=options.window??globalThis.window;
  const host=options.host??doc?.body;
  if(!doc||!view||!host)return inertController();

  const root=doc.createElement('div');
  root.className='soul-death-cinematic';
  root.dataset.phase='idle';
  root.dataset.scope=options.scope||((host===doc.body||host===doc.documentElement)?'viewport':'stage');
  root.hidden=true;
  root.setAttribute('aria-hidden','true');
  root.innerHTML='<div class="soul-death-cinematic__veil" aria-hidden="true"></div><div class="soul-death-cinematic__down-copy" aria-hidden="true"><span class="soul-death-cinematic__down-line"></span></div><div class="soul-death-cinematic__death-word" aria-hidden="true"><span class="soul-death-cinematic__kicker">葬焉</span><strong>DEAD</strong><span class="soul-death-cinematic__caption">因果は、次の刻へ</span></div><div class="soul-death-cinematic__watch-scene" aria-hidden="true"><div class="soul-death-cinematic__chain"></div><div class="soul-death-cinematic__watch"><span class="soul-death-cinematic__crown"></span><div class="soul-death-cinematic__dial"><span class="soul-death-cinematic__numeral soul-death-cinematic__numeral--12">XII</span><span class="soul-death-cinematic__numeral soul-death-cinematic__numeral--3">III</span><span class="soul-death-cinematic__numeral soul-death-cinematic__numeral--6">VI</span><span class="soul-death-cinematic__numeral soul-death-cinematic__numeral--9">IX</span><i class="soul-death-cinematic__hand soul-death-cinematic__hand--hour"></i><i class="soul-death-cinematic__hand soul-death-cinematic__hand--minute"></i><i class="soul-death-cinematic__hand soul-death-cinematic__hand--second"></i><i class="soul-death-cinematic__pin"></i></div></div><span class="soul-death-cinematic__watch-caption">時は血を継ぐ</span></div>';
  host.append(root);

  const downLine=root.querySelector('.soul-death-cinematic__down-line');
  const kicker=root.querySelector('.soul-death-cinematic__kicker');
  const title=root.querySelector('.soul-death-cinematic__death-word strong');
  const caption=root.querySelector('.soul-death-cinematic__caption');
  const watchCaption=root.querySelector('.soul-death-cinematic__watch-caption');
  let disposed=false,terminal=false,sequence=0,hideTimer=0,tickTimer=0,audioContext=null,deathPromise=null;

  function setPhase(next){
    if(disposed)return;
    root.hidden=false;
    root.setAttribute('aria-hidden','false');
    root.dataset.phase=next;
  }
  function clearHideTimer(){
    if(hideTimer){view.clearTimeout(hideTimer);hideTimer=0;}
  }
  function hide(){
    clearHideTimer();
    stopWatchSound();
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
    oscillator.start(now);oscillator.stop(now+duration+.02);
  }
  function mechanicalTick(context=audioContext){
    if(!context||context.state!=='running')return;
    tone(context,{frequency:2380,endFrequency:920,duration:.022,gain:.032,type:'square'});
    tone(context,{frequency:190,endFrequency:96,duration:.045,gain:.012,type:'triangle',delay:.004});
  }
  function watchChime(context=audioContext){
    if(!context||context.state!=='running')return;
    tone(context,{frequency:880,endFrequency:872,duration:.72,gain:.025,type:'sine'});
    tone(context,{frequency:1320,endFrequency:1308,duration:.9,gain:.014,type:'sine',delay:.035});
    tone(context,{frequency:1760,endFrequency:1735,duration:.52,gain:.007,type:'sine',delay:.06});
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
      watchChime(context);mechanicalTick(context);
      tickTimer=view.setInterval(()=>mechanicalTick(context),500);
    };
    if(context.state==='running')begin();
    else void context.resume().then(begin).catch(()=>{});
  }

  function down({caption:line='意識が遠のく'}={}){
    if(disposed||terminal)return false;
    clearHideTimer();stopWatchSound();sequence++;
    downLine.textContent=String(line||'');
    setPhase('down');
    return true;
  }
  function recover(){
    if(disposed||terminal||root.hidden)return false;
    const own=++sequence;
    clearHideTimer();stopWatchSound();setPhase('recover');
    hideTimer=view.setTimeout(()=>{if(!disposed&&!terminal&&sequence===own)hide();},DEATH_REBIRTH_TIMING.recover);
    return true;
  }
  function playDeath({kicker:nextKicker='葬焉',title:nextTitle='DEAD',caption:nextCaption='因果は、次の刻へ',watchCaption:nextWatchCaption='時は血を継ぐ'}={}){
    if(disposed)return Promise.resolve(false);
    if(deathPromise)return deathPromise;
    terminal=true;clearHideTimer();stopWatchSound();
    const own=++sequence;
    kicker.textContent=String(nextKicker||'');
    title.textContent=String(nextTitle||'DEAD');
    caption.textContent=String(nextCaption||'');
    watchCaption.textContent=String(nextWatchCaption||'');
    if(root.hidden||root.dataset.phase!=='down'){
      downLine.textContent='意識が遠のく';
      setPhase('down');
    }
    const task=(async()=>{
      await wait(view,DEATH_REBIRTH_TIMING.down);
      if(disposed||sequence!==own)return false;
      setPhase('blackout');
      await wait(view,DEATH_REBIRTH_TIMING.blackout);
      if(disposed||sequence!==own)return false;
      setPhase('watch');startWatchSound();
      await wait(view,DEATH_REBIRTH_TIMING.watch);
      if(disposed||sequence!==own)return false;
      stopWatchSound();setPhase('release');
      await wait(view,DEATH_REBIRTH_TIMING.release);
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
    sequence++;disposed=true;terminal=false;deathPromise=null;clearHideTimer();stopWatchSound();
    root.remove();
    if(audioContext&&audioContext.state!=='closed')void audioContext.close().catch(()=>{});
    audioContext=null;
  }

  return Object.freeze({
    down,recover,playDeath,reset,dispose,unlockAudio,
    get phase(){return root.dataset.phase||'idle';},
  });
}
