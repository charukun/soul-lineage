import {johakyuExchangeCue} from '@soul/johakyu-combat/exchange-policy';
const PHASES=Object.freeze(['jo','ha','kyu']);
const PHASE_SET=new Set(PHASES);
const FALLBACK_ACTIONS=Object.freeze({jo:'間合いを測る',ha:'攻めを組み立てる',kyu:'決めに入る'});

export function sequenceHudState({phase='',attack='',interrupted=false}={}){
  const current=PHASE_SET.has(phase)?phase:'',normalizedAttack=String(attack||'').trim();
  const key=current&&normalizedAttack?`${current}:${normalizedAttack}`:'';
  const comboActive=Boolean(key&&!interrupted),activePhase=comboActive?current:'',currentIndex=PHASES.indexOf(activePhase);
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

/** Main-game skin consumes the same hero-perspective meaning as /battle2. */
export function meleeSequenceHudState({combat,actorId,attack='',interrupted=false}={}){
  const exchange=combat?.exchange,phase=combat?.tidebreakPose?.slot??combat?.sharedPhase??combat?.phase??'';
  const reaction=Boolean(combat?.tidebreakPose?.transition||combat?.tidebreakPose?.reaction);
  const cue=johakyuExchangeCue(exchange,{actorId,phase:phase||null,reaction}),hudState=cue.hudState;
  const normal=['jo','ha','kyu'].includes(hudState);
  // Melee ownership, not a transient attack pose or the legacy hit animation,
  // keeps the phase lit between stages and through ordinary defended contacts.
  const sequence=sequenceHudState({phase:normal?hudState:'',attack:normal?(attack||FALLBACK_ACTIONS[hudState]):'',interrupted});
  return Object.freeze({...sequence,hudState,exchangeCue:cue.label,exchangeIntent:cue.intent,historyKey:cue.historyKey,action:normal?sequence.action:hudState==='zanshin'?'残心':'間合い'});
}
