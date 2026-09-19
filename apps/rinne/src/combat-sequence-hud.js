const PHASES=Object.freeze(['jo','ha','kyu']);
const PHASE_SET=new Set(PHASES);
const FALLBACK_ACTIONS=Object.freeze({jo:'間合いを測る',ha:'攻めを組み立てる',kyu:'決めに入る'});

export function sequenceHudState({phase='',attack='',blockedKey=''}={}){
  const current=PHASE_SET.has(phase)?phase:'',normalizedAttack=String(attack||'').trim();
  const key=current&&normalizedAttack?`${current}:${normalizedAttack}`:'';
  const comboActive=Boolean(key&&key!==blockedKey),activePhase=comboActive?current:'',currentIndex=PHASES.indexOf(activePhase);
  const completed=Object.freeze(Object.fromEntries(PHASES.map((id,index)=>[id,comboActive&&index<currentIndex])));
  return Object.freeze({
    phase:current,
    attack:normalizedAttack,
    action:normalizedAttack||FALLBACK_ACTIONS[current]||'',
    key,
    comboActive,
    activePhase,
    completed
  });
}
