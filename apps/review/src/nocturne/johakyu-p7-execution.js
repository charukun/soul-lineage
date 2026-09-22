import {beginJohakyuStage,johakyuEquippedTechniqueCapability,johakyuStageIsActive} from '@soul/johakyu-combat/execution-capability';

/** The compiled canonical node is the only source of stage semantics. The
 * optional multiplier is a resolved life-domain value, never a lab formula. */
export function reviewTechniqueCapability(actor,node){
  return johakyuEquippedTechniqueCapability(actor,{weapon:node.stage.weapon,phase:node.phase,techniqueId:node.technique.id,
    staminaMultiplier:actor.staminaMultiplier??1,stages:node.technique.stages,fromStage:node.stage.index});
}
export function beginReviewStage(actor,attempt,node,reaction=null){
  const request=reaction
    ? {weapon:actor.equipment.weapon,phase:'uke',...reaction}
    : {weapon:node.stage.weapon,phase:node.phase,techniqueId:node.technique.id,...node.stage.step};
  return beginJohakyuStage(actor,attempt,{...request,staminaMultiplier:actor.staminaMultiplier??1});
}
/** Both contact and defense consume this same accepted, live attempt. */
export function reviewStageCanResolve(state,action=state){
  return Boolean(state&&state.id===action?.id&&!state.interrupted&&johakyuStageIsActive(state));
}
