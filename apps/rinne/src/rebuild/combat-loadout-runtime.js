import { bodyRuntime,combatSkillForPhase,ensureCombatLoadout,selectCombatCombo } from '../combat-loadout.js';

const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
export function beginCombatState(state,targetId){
  ensureCombatLoadout(state);const combat={targetId,phase:'jo',attackCooldown:0,comboCursor:0,comboId:null,zanshinSeconds:0,oneMotionQueued:null};selectCombatCombo(state,combat);return combat;
}
export function tickLoadoutCombatState(state,dt){
  ensureCombatLoadout(state);const combat=state.combat;if(!combat)return bodyRuntime(state);
  if(!combat.comboId)selectCombatCombo(state,combat);combat.zanshinSeconds=Math.max(0,(Number(combat.zanshinSeconds)||0)-dt);
  if(combat.oneMotionQueued){combat.oneMotionQueued.ttl-=dt;if(combat.oneMotionQueued.ttl<=0)combat.oneMotionQueued=null;}
  return bodyRuntime(state);
}
export function combatSkill(state,phase){ensureCombatLoadout(state);return combatSkillForPhase(state,state.combat,phase);}
export function advancePhase(state,phase){
  if(!state.combat)return;if(phase==='jo')state.combat.phase='ha';else if(phase==='ha')state.combat.phase='kyu';else{state.combat.phase='jo';selectCombatCombo(state,state.combat,{advance:true});}
}
export function oneMotionSpec(state,baseWeapon,distance,reach){
  const queued=state.combat?.oneMotionQueued;if(!queued||state.combat.attackCooldown>0||distance>reach+.58)return null;
  return{skill:queued.skill,cost:Math.max(22,baseWeapon.stamina*2.6),damageScale:1.78,recovery:1.65+baseWeapon.stamina/16};
}
export function completeOneMotion(state,spec){
  state.combat.oneMotionQueued=null;state.combat.phase='jo';selectCombatCombo(state,state.combat,{advance:true});state.combat.attackCooldown=spec.recovery;state.combat.zanshinSeconds=.95;
}
export function automaticRecovery(state,baseWeapon,phase){
  const body=bodyRuntime(state),phaseScale=phase==='kyu'?1.08:phase==='ha'?1.02:1;return(.62+baseWeapon.stamina/25)*phaseScale*body.zanshin.recoveryScale;
}
export function settleAutomaticAttack(state,baseWeapon,phase){
  const body=bodyRuntime(state),refund=Math.max(0,baseWeapon.stamina*(body.zanshin.staminaRefund||0));state.stamina=clamp(state.stamina+refund,0,state.staminaCap||100);state.combat.zanshinSeconds=phase==='kyu'?.58:.3;advancePhase(state,phase);
}
export function combatBody(state){return bodyRuntime(state);}
