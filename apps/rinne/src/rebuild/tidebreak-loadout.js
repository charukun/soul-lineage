import {tidebreakWeaponFor,adaptKind,formForSkill} from '@soul/game-data/combat-forms';
export {tidebreakWeaponFor} from '@soul/game-data/combat-forms';
import { activeCombo, comboById, ensureCombatLoadout, techniqueName } from '../combat-loadout.js';
import { CAUSAL_ANSWER_BY_ID } from '@soul/game-data';
import { inspirationRecipe } from './inspiration-state.js';
import { applySkillComponents, directionalDefenseFor, staminaPolicyFor, tidebreakMindVectorFor, tidebreakMindsetFromVector } from './combat-tactics.js';
import {rinneTechniqueCapability} from './combat-execution.js';
import {WEAPONS} from './domain.js';

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
const COUNTER_KINDS=new Set(['parry','counter']);
const GUARD_KINDS=new Set(['guard','brace']);
const EVADE_KINDS=new Set(['slip','retreat']);
const CLOSING_FEET=new Set(['forward','chase','rush','cross','spiral']);
const SPACING_FEET=new Set(['retreat','sideL','sideR','orbitL','orbitR']);
const NON_OFFENSE_KINDS=new Set(['none','ready','guard','brace','parry','slip','retreat']);
function recipeSituationScore(state,recipe,target){
  const steps=recipe.steps.filter(step=>step?.kind&&step.kind!=='none'),mind=tidebreakMindVectorFor(state),base=WEAPONS[state.equipment.weapon]||WEAPONS.fist;
  const count=set=>steps.reduce((n,step)=>n+Number(set.has(step.kind)||set.has(step.footwork)),0);
  const counter=count(COUNTER_KINDS),guard=count(GUARD_KINDS),evade=count(EVADE_KINDS),closing=count(CLOSING_FEET),spacing=count(SPACING_FEET),offense=steps.filter(step=>!NON_OFFENSE_KINDS.has(step.kind)).length;
  const distance=Number.isFinite(target?.x)&&Number.isFinite(target?.z)?Math.hypot(target.x-state.position.x,target.z-state.position.z):null;
  const committed=Number(target?.attackWindow)>0,ready=Number(target?.cooldown)<=.12;
  let score=0;
  if(committed){
    score+=counter*(8+12*mind.counter)+guard*(4+9*mind.guard)+evade*(2+7*mind.mobility);
    score-=Math.max(0,offense-counter)*Math.max(0,3-2*mind.attack);
  }else if(ready){
    score+=counter*(3+6*mind.counter)+guard*(2+4*mind.guard)+spacing*(1+3*mind.spacing);
  }
  if(distance!==null){
    const far=distance>base.reach+.55,crowded=distance<Math.max(.72,base.reach*.68);
    if(far){score+=closing*(6+4*mind.attack)-spacing*4;}
    else if(crowded){score+=spacing*(5+5*mind.spacing)+counter*(2+3*mind.counter)-closing*3;}
    else score+=offense*(1.5+2.5*mind.attack)+counter*mind.counter*1.5;
  }
  return Number(score.toFixed(3));
}
function configuredComboScore(combo,index,{phase,preferredId,activeId}){
  return (combo.id===preferredId?12:0)+(combo.favored?.[phase]?4:0)+(combo.id===activeId?2:0)-index*.001;
}
export function selectCapableTidebreakCombo(state,{phase='jo',comboId=state?.combat?.comboId,target=null}={}){
  if(!['jo','ha','kyu'].includes(phase))throw new RangeError('Invalid capability selection phase');
  const loadout=ensureCombatLoadout(state),weapon=tidebreakWeaponFor(state.equipment.weapon),activeId=loadout.technique.activeComboId,attempts=[],candidates=[];
  // Only accepted runtime poses are published here by combat-core. Their current
  // stage has already paid; prediction concerns the remaining stages, not a replay.
  const execution=state.combat?.tidebreakPose?.execution;
  for(const [index,combo] of loadout.technique.combos.entries()){
    const skill=combo?.slots?.[phase]||`basic.${state.equipment.weapon}`,recipe=phaseRecipe(state,phase,weapon,combo,target);
    const continuing=execution?.recipeId===recipe.id&&execution.phase===phase&&Number.isInteger(execution.stepIndex);
    const fromStage=continuing?Math.min(recipe.steps.filter(step=>step.kind!=='none').length,execution.stepIndex+1):0;
    const capability=rinneTechniqueCapability(state,phase,recipe,{fromStage});
    const configuredScore=configuredComboScore(combo,index,{phase,preferredId:comboId,activeId}),situationScore=recipeSituationScore(state,recipe,target),score=configuredScore+situationScore;
    const attempt=Object.freeze({comboId:combo.id,techniqueId:skill,reason:capability.reason,canStart:capability.canStart,canContinue:capability.canContinue,configuredScore,situationScore,score});
    attempts.push(attempt);if(capability.canContinue)candidates.push({combo,skill,capability,score,index});
  }
  candidates.sort((a,b)=>b.score-a.score||a.index-b.index);
  const chosen=candidates[0];
  if(chosen)return Object.freeze({ok:true,comboId:chosen.combo.id,techniqueId:chosen.skill,adapted:chosen.combo.id!==comboId,capability:chosen.capability,attempts:Object.freeze(attempts)});
  return Object.freeze({ok:false,comboId:null,techniqueId:null,adapted:false,reason:attempts.find(row=>row.comboId===comboId)?.reason||attempts[0]?.reason||'no-capable-technique',attempts:Object.freeze(attempts)});
}
function reactionRecipe(state,weapon,target){const defense=target?directionalDefenseFor(state,target):{receive:'basic'},receive=defense.receive,counter=['backcounter','turncounter','thrustcounter','rising'].includes(receive);return{id:`rinne-uke-${receive}`,name:'受け',type:'reaction',weapon,element:'steel',rhythm:'flow',tempo:1,aura:'none',receive,steps:[{kind:counter?adaptKind('thrust',weapon):receive==='none'?'ready':'brace',footwork:counter?'chase':'stay',charge:'none'},{kind:counter?'guard':'retreat',footwork:'retreat',charge:'none'},{kind:'ready',footwork:'stay',charge:'none'}]};}
export function tidebreakLoadoutFor(state,comboId=state?.combat?.comboId,target=null){ensureCombatLoadout(state);const weapon=tidebreakWeaponFor(state.equipment.weapon),combo=comboById(state,comboId)||activeCombo(state);return{jo:phaseRecipe(state,'jo',weapon,combo,target),ha:phaseRecipe(state,'ha',weapon,combo,target),kyu:phaseRecipe(state,'kyu',weapon,combo,target),uke:reactionRecipe(state,weapon,target)};}
export function defensiveLoadoutFor(state,target){const weapon=tidebreakWeaponFor(state.equipment.weapon),uke=reactionRecipe(state,weapon,target),policy=staminaPolicyFor(state),kind=policy.band==='critical'?'retreat':'guard',hold={id:'rinne-threat-guard',name:'受勢',type:'normal',weapon,element:'steel',rhythm:'flow',tempo:policy.tempoScale,aura:'none',steps:[{kind,footwork:kind==='retreat'?'retreat':'stay',charge:'none'},{kind:'brace',footwork:'stay',charge:'none'},{kind:'ready',footwork:'stay',charge:'none'}]};return{jo:hold,ha:hold,kyu:hold,uke};}
export function passiveEnemyLoadout(weapon){const hold={id:'rinne-enemy-observe',name:'注視',type:'normal',weapon,element:'steel',rhythm:'flow',tempo:.8,aura:'none',steps:[{kind:'guard',footwork:'stay',charge:'none'},{kind:'ready',footwork:'stay',charge:'none'},{kind:'ready',footwork:'stay',charge:'none'}]};return{jo:hold,ha:hold,kyu:hold};}
export function tidebreakMindVector(state){return tidebreakMindVectorFor(state);}
export function tidebreakMindsetFor(state){return tidebreakMindsetFromVector(tidebreakMindVectorFor(state));}
