import {tidebreakWeaponFor,adaptKind,formForSkill} from '@soul/game-data/combat-forms';
export {tidebreakWeaponFor} from '@soul/game-data/combat-forms';
import { activeCombo, comboById, ensureCombatLoadout, techniqueName } from '../combat-loadout.js';
import { CAUSAL_ANSWER_BY_ID } from '@soul/game-data';
import { inspirationRecipe } from './inspiration-state.js';
import { applySkillComponents, directionalDefenseFor, staminaPolicyFor, tidebreakMindVectorFor, tidebreakMindsetFromVector } from './combat-tactics.js';

function phaseRecipe(state,phase,weapon,combo,target){
  let skill=combo?.slots?.[phase]||`basic.${state.equipment.weapon}`;
  const causal=inspirationRecipe(state,skill,phase,target?.id);
  if(causal){
    const steps=causal.steps.map(step=>({...step,kind:adaptKind(step.kind,weapon)}));
    // Tidebreak's wire recipe has three positions. Empty positions are not extra attacks.
    while(steps.length<3)steps.push({kind:'none',footwork:'none',charge:'none'});
    return{id:`rinne-${phase}-${causal.id}`,name:causal.name,type:'normal',weapon,element:'steel',rhythm:'flow',tempo:Math.max(.7,Math.min(1.3,staminaPolicyFor(state).tempoScale)),aura:'none',steps};
  }
  if(CAUSAL_ANSWER_BY_ID[skill]?.steps.length)skill=`basic.${state.equipment.weapon}`;
  const raw=applySkillComponents(state,skill,phase,formForSkill(skill,state.equipment.weapon)),kinds=raw.kinds.map(kind=>adaptKind(kind,weapon));
  return{id:`rinne-${phase}-${skill}`,name:techniqueName(skill,state),type:'normal',weapon,element:'steel',rhythm:raw.rhythm,tempo:raw.tempo,aura:'none',steps:kinds.map((kind,index)=>({kind,footwork:raw.feet[index]||'forward',charge:raw.charges[index]||'none'}))};
}
function reactionRecipe(state,weapon,target){const defense=target?directionalDefenseFor(state,target):{receive:'basic'},receive=defense.receive,counter=['backcounter','turncounter','thrustcounter','rising'].includes(receive);return{id:`rinne-uke-${receive}`,name:'受け',type:'reaction',weapon,element:'steel',rhythm:'flow',tempo:1,aura:'none',receive,steps:[{kind:counter?adaptKind('thrust',weapon):receive==='none'?'ready':'brace',footwork:counter?'chase':'stay',charge:'none'},{kind:counter?'guard':'retreat',footwork:'retreat',charge:'none'},{kind:'ready',footwork:'stay',charge:'none'}]};}
export function tidebreakLoadoutFor(state,comboId=state?.combat?.comboId,target=null){ensureCombatLoadout(state);const weapon=tidebreakWeaponFor(state.equipment.weapon),combo=comboById(state,comboId)||activeCombo(state);return{jo:phaseRecipe(state,'jo',weapon,combo,target),ha:phaseRecipe(state,'ha',weapon,combo,target),kyu:phaseRecipe(state,'kyu',weapon,combo,target),uke:reactionRecipe(state,weapon,target)};}
export function defensiveLoadoutFor(state,target){const weapon=tidebreakWeaponFor(state.equipment.weapon),uke=reactionRecipe(state,weapon,target),policy=staminaPolicyFor(state),kind=policy.band==='critical'?'retreat':'guard',hold={id:'rinne-threat-guard',name:'受勢',type:'normal',weapon,element:'steel',rhythm:'flow',tempo:policy.tempoScale,aura:'none',steps:[{kind,footwork:kind==='retreat'?'retreat':'stay',charge:'none'},{kind:'brace',footwork:'stay',charge:'none'},{kind:'ready',footwork:'stay',charge:'none'}]};return{jo:hold,ha:hold,kyu:hold,uke};}
export function passiveEnemyLoadout(weapon){const hold={id:'rinne-enemy-observe',name:'注視',type:'normal',weapon,element:'steel',rhythm:'flow',tempo:.8,aura:'none',steps:[{kind:'guard',footwork:'stay',charge:'none'},{kind:'ready',footwork:'stay',charge:'none'},{kind:'ready',footwork:'stay',charge:'none'}]};return{jo:hold,ha:hold,kyu:hold};}
export function tidebreakMindVector(state){return tidebreakMindVectorFor(state);}
export function tidebreakMindsetFor(state){return tidebreakMindsetFromVector(tidebreakMindVectorFor(state));}
