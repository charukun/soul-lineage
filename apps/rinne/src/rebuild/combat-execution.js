import {beginJohakyuStage,cancelJohakyuStage,johakyuEquippedTechniqueCapability,johakyuStageIsActive} from '@soul/johakyu-combat/execution-capability';
import {staminaMultiplierFor} from './domain.js';
import {executedTechniqueId} from './johakyu-technique-contract.js';

/** State adapter only: all equipment/body/cost rules belong to the shared layer. */
function requestFor(state,{recipeId=null,...stage},{projection=false}={}){
  const techniqueId=executedTechniqueId({execution:{recipeId}});
  // A non-body secondary session is an existing threat projection, not another
  // body spending the same stamina. Actual body-owned defense is NOT free.
  return {...stage,techniqueId,staminaMultiplier:projection?0:staminaMultiplierFor(state)};
}
export function rinneTechniqueCapability(state,phase,recipe,{fromStage=0}={}){
  const stages=recipe.steps.filter(step=>step?.kind&&step.kind!=='none');
  if(stages.length&&fromStage===stages.length)return Object.freeze({canStart:false,canContinue:true,blockedStageIndex:null,reason:null,remainingStamina:state.stamina,remainingStaminaCap:state.staminaCap,stages:Object.freeze([])});
  return johakyuEquippedTechniqueCapability(state,{...requestFor(state,{weapon:recipe.weapon,phase,recipeId:recipe.id}),stages,fromStage});
}
export function chargeAttackStamina(state,session,next,events){
  const execution=next.hero.execution,key=execution?String(execution.attackId):null;
  // Keep the pre-existing separately paid one-motion commitment boundary.
  if(session.oneMotionArmed){session.lastAttackKey=key;return true;}
  if(!execution){cancelJohakyuStage(session.stageAttempt);session.stageAttempt=null;session.lastAttackKey=null;return true;}
  if(key===session.lastAttackKey&&session.stageAttempt)return johakyuStageIsActive(session.stageAttempt);
  cancelJohakyuStage(session.stageAttempt);session.stageAttempt={id:key};session.lastAttackKey=key;
  const recipe=session.loadout?.[execution.phase]||session.loadout?.uke,step=recipe?.steps?.[execution.stepIndex]||{};
  const rawPhase=execution.phase||next.hero.slot||'jo',phase=rawPhase==='mind'?'uke':(['jo','ha','kyu','uke','one','finisher','enemy'].includes(rawPhase)?rawPhase:(state.combat?.phase||'jo'));
  const request=requestFor(state,{weapon:execution.weapon||state.equipment.weapon,phase,recipeId:execution.recipeId,
    kind:execution.kind||step.kind||'ready',footwork:execution.footwork||step.footwork||'stay',charge:execution.charge||step.charge||'none'},
    {projection:session.secondary&&state.combat?.bodyTargetId!==session.targetId});
  const receipt=beginJohakyuStage(state,session.stageAttempt,request);
  session.stageReceipt=receipt;
  if(!receipt.allowed){
    session.invalid=true;const capability=receipt.capability,reason=receipt.reason;
    const remaining=reason==='arm-injury'||reason==='leg-injury'?.85:.45;
    if(state.combat){state.combat.executionBlock={reason,remaining,phase,kind:capability?.kind||execution.kind||null,stageIndex:execution.stepIndex??null};state.combat.attackCooldown=Math.max(Number(state.combat.attackCooldown)||0,remaining);}
    events.push({type:'execution-blocked',reason,phase,kind:capability?.kind||execution.kind||null,stageIndex:execution.stepIndex??null,targetId:session.targetId,engine:'tidebreak',authority:'rinne-domain'});
  }
  return receipt.allowed;
}
