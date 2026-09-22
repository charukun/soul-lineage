import {COMBAT_BODY_PARTS} from '../../rebuild/combat-choreography.js';

// Review-only initial conditions, not a second injury authority. Every value
// enters the same reviewHeroBody used by native combat and combatBodySnapshot.
export function applyReviewBodyPreset(state,preset){
  const stages={head:0,torso:.2,leftArm:.5,rightArm:.72,leftLeg:.92,rightLeg:0};
  if(preset==='body-stages'){
    for(const part of COMBAT_BODY_PARTS)state.injuries[part]={severity:stages[part],at:state.ageSeconds||0};
  }else if(COMBAT_BODY_PARTS.includes(preset)){
    state.injuries[preset]={severity:.72,at:state.ageSeconds||0};
  }
  return state;
}
