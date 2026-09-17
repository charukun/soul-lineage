import {
  applyCombatInjury,
  ensureCombatInjuryState,
  injuryEffects,
  recoverPersistentInjuries,
  stripCombatProgressionState,
} from './combat-injury.js';

export {applyCombatInjury,injuryEffects,recoverPersistentInjuries,stripCombatProgressionState};

/** @deprecated Compatibility alias. Combat history no longer creates progression. */
export function ensureCombatGrowthState(state){
  ensureCombatInjuryState(state);
  // Older callers expect this object to exist briefly. It is intentionally empty
  // and is stripped again by save validation / injury normalization.
  state.combatLegacy={forms:{},lessons:{}};
  return state;
}

/** @deprecated Defeat/hit history never unlocks or improves character abilities. */
export function recordCombatLesson(){return{recorded:false,unlocked:[],names:[]};}

/** @deprecated Technique use is not a progression counter. */
export function noteTechniqueUse(){return{tier:0,axis:null,rhythm:null,tempoScale:1,chargeBias:null,footworkBias:null};}

/** @deprecated Technique form is fixed by the selected loadout, not usage history. */
export function techniqueMutationFor(){return{tier:0,axis:null,rhythm:null,tempoScale:1,chargeBias:null,footworkBias:null};}

/** @deprecated Preserve the authored form unchanged. */
export function evolveTechniqueForm(_state,_skill,form){return{...form,kinds:[...(form?.kinds||[])],feet:[...(form?.feet||[])],charges:[...(form?.charges||[])]};}

/** @deprecated Kept only so legacy lineage records can be read without restoring power. */
export function combatLegacySnapshot(state){
  ensureCombatInjuryState(state);
  return{forms:{},lessons:{},injuries:Object.fromEntries(Object.entries(state.injuries||{}).map(([part,row])=>[part,Number(row?.severity)||0]))};
}
