export const COMBAT_SEQUENCE_PHASES=Object.freeze(['jo','ha','kyu']);
const PHASE_SET=new Set(COMBAT_SEQUENCE_PHASES);

export function combatSequenceState(phase=''){
  const current=PHASE_SET.has(phase)?phase:'';
  return Object.freeze({
    phase:current,
    active:Object.freeze(Object.fromEntries(COMBAT_SEQUENCE_PHASES.map(id=>[id,id===current]))),
    link:current==='jo'?'jo-ha':current==='ha'?'ha-kyu':''
  });
}

export function syncCombatSequence(root,phase='',{pulse=true}={}){
  if(!root)return combatSequenceState(phase);
  const state=combatSequenceState(phase),previous=root.dataset.combatSequencePhase||'';
  root.dataset.combatSequencePhase=state.phase||'idle';
  for(const node of root.querySelectorAll('[data-combat-phase]')){
    const active=Boolean(state.active[node.dataset.combatPhase]);
    node.dataset.active=String(active);
    node.classList.toggle('active',active);
    node.setAttribute('aria-current',active?'step':'false');
  }
  if(pulse&&state.phase&&state.phase!==previous){
    const link=root.querySelector(`[data-combat-link="${state.link}"]`);
    if(link){link.classList.remove('combat-sequence__pulse');void link.offsetWidth;link.classList.add('combat-sequence__pulse');}
  }
  return state;
}
