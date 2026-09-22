const PHASES=Object.freeze(['jo','ha','kyu']);
const PHASE_SET=new Set(PHASES);
const FALLBACK_ACTIONS=Object.freeze({jo:'間合いを測る',ha:'攻めを組み立てる',kyu:'決めに入る'});

export function sequenceHudState({phase='',attack='',interrupted=false,exchangeHud=null}={}){
  // The host projects its canonical Exchange; presentation never advances a slot.
  const projected=exchangeHud!==null,current=PHASE_SET.has(projected?exchangeHud:phase)?(projected?exchangeHud:phase):'',normalizedAttack=String(attack||'').trim();
  const key=current&&(normalizedAttack||projected)?`${current}:${normalizedAttack||'pressure'}`:'';
  const comboActive=Boolean(key&&(projected||!interrupted)),activePhase=comboActive?current:'',currentIndex=PHASES.indexOf(activePhase);
  const completed=Object.freeze(Object.fromEntries(PHASES.map((id,index)=>[id,comboActive&&index<currentIndex])));
  return Object.freeze({
    phase:current,
    attack:normalizedAttack,
    action:projected&&!current?(exchangeHud==='zanshin'?'残心':'間合い'):normalizedAttack||FALLBACK_ACTIONS[current]||'',
    exchangeHud,
    key,
    comboActive,
    activePhase,
    completed
  });
}
