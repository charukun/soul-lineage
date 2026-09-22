import {resolveInspirationAnswer} from '@soul/game-data';
import {beginJohakyuStage,cancelJohakyuStage,johakyuEquippedTechniqueCapability,johakyuStageIsActive} from '@soul/johakyu-combat/execution-capability';
import {staminaMultiplierFor} from './domain.js';
import {executedTechniqueId} from './johakyu-technique-contract.js';

/** State adapter only: all equipment/body/cost rules belong to the shared layer. */
function requestFor(state,{recipeId=null,...stage},{secondary=false,prepaid=false}={}){
  const id=executedTechniqueId({execution:{recipeId}}),effort=Number(resolveInspirationAnswer(id)?.effort)||1;
  // Secondary sessions are the existing non-paying projections of one body;
  // one-motion commitment has its own existing prepayment, not a second debit.
  return {...stage,effort,staminaMultiplier:secondary||prepaid?0:staminaMultiplierFor(state)};
}
export function rinneTechniqueCapability(state,phase,recipe,{fromStage=0}={}){
  const stages=recipe.steps.filter(step=>step?.kind&&step.kind!=='none');
  return johakyuEquippedTechniqueCapability(state,{...requestFor(state,{weapon:recipe.weapon,phase,recipeId:recipe.id}),stages,fromStage});
}
export function chargeAttackStamina(state,session,next,events){
  const execution=next.hero.execution,key=execution?String(execution.attackId):null;
  if(!execution){cancelJohakyuStage(session.stageAttempt);session.stageAttempt=null;session.lastAttackKey=null;return true;}
  if(key===session.lastAttackKey&&session.stageAttempt)return johakyuStageIsActive(session.stageAttempt);
  cancelJohakyuStage(session.stageAttempt);session.stageAttempt={id:key};session.lastAttackKey=key;
  const recipe=session.loadout?.[execution.phase]||session.loadout?.uke,step=recipe?.steps?.[execution.stepIndex]||{};
  const rawPhase=execution.phase||next.hero.slot||'jo',phase=rawPhase==='mind'?'uke':(['jo','ha','kyu','uke','one','finisher','enemy'].includes(rawPhase)?rawPhase:(state.combat?.phase||'jo'));
  const request=requestFor(state,{weapon:execution.weapon||state.equipment.weapon,phase,recipeId:execution.recipeId,
    kind:execution.kind||step.kind||'ready',footwork:execution.footwork||step.footwork||'stay',charge:execution.charge||step.charge||'none'},
    {secondary:session.secondary,prepaid:Boolean(session.oneMotionArmed)});
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
