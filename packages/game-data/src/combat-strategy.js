// The existing six-axis RINNE attention contract, shared without a browser owner.
const clamp=(n,lo=0,hi=1)=>Math.min(hi,Math.max(lo,Number(n)||0));
export const COMBAT_STRATEGY_PRESETS=Object.freeze({
  balanced:Object.freeze({attack:.52,guard:.52,spacing:.52,counter:.42,mobility:.48,survival:.42}),
  aggressive:Object.freeze({attack:.9,guard:.28,spacing:.34,counter:.28,mobility:.58,survival:.22}),
  patient:Object.freeze({attack:.28,guard:.66,spacing:.76,counter:.84,mobility:.38,survival:.52}),
  counter:Object.freeze({attack:.4,guard:.72,spacing:.56,counter:.95,mobility:.52,survival:.46}),
  evasive:Object.freeze({attack:.34,guard:.4,spacing:.78,counter:.54,mobility:.94,survival:.5})
});
export function normalizeCombatStrategy(value='balanced'){
  if(typeof value==='string')return Object.freeze({...COMBAT_STRATEGY_PRESETS[value]||COMBAT_STRATEGY_PRESETS.balanced});
  const fallback=COMBAT_STRATEGY_PRESETS.balanced,out={};
  for(const key of Object.keys(fallback))out[key]=clamp(value?.[key]??fallback[key]);
  return Object.freeze(out);
}
export function strategyForState(state){return normalizeCombatStrategy(state?.combatStrategy);}
