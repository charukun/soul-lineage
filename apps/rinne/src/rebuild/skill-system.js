import { CAUSAL_ANSWERS, INSPIRATION_ATTRIBUTES, resolveInspirationAnswer } from '@soul/game-data';
import { SUPPORT_SKILLS as LEGACY_SUPPORT, ACTION_SKILLS as LEGACY_ACTIONS } from './legacy-skill-system.js';

const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const causalRow=row=>Object.freeze({...row,type:['technique','variant'].includes(row.kind)?'action':'support',needs:[],effects:row.effects||{}});
const support=new Map(LEGACY_SUPPORT.map(row=>[row.id,row]));
const actions=new Map(LEGACY_ACTIONS.map(row=>[row.id,row]));
for(const row of CAUSAL_ANSWERS){
  if(row.kind==='link'||row.executor)continue;
  (['technique','variant'].includes(row.kind)?actions:support).set(row.id,causalRow(row));
}
export const SUPPORT_SKILLS=Object.freeze([...support.values()]);
export const ACTION_SKILLS=Object.freeze([...actions.values()]);
export const DISCOVERIES=Object.freeze([...SUPPORT_SKILLS,...ACTION_SKILLS]);
export const SKILL_BY_ID=Object.freeze(Object.fromEntries(DISCOVERIES.map(row=>[row.id,row])));
export function skillDefinition(id){const known=SKILL_BY_ID[id];if(known)return known;const row=resolveInspirationAnswer(id);return row&&['technique','variant'].includes(row.kind)?causalRow(row):null;}

function selectedSkillIds(state){
  const ids=new Set(),loadout=state?.combatLoadout;
  const allowed=id=>!state?.inspiration||(state.knownSkills?.includes(id)&&!state.inspiration.records?.[id]?.archived);
  for(const id of loadout?.heart?.active||[])if(skillDefinition(id)?.type==='support'&&allowed(id))ids.add(id);
  const technique=loadout?.technique,combo=(technique?.combos||[]).find(row=>row.id===technique?.activeComboId)||technique?.combos?.[0];
  for(const phase of ['jo','ha','kyu']){const selection=technique?.phaseSelections?.[phase],comboId=String(selection||'').startsWith('combo:')?String(selection).slice(6):null,selectedCombo=comboId?(technique?.combos||[]).find(row=>row.id===comboId):null,id=selectedCombo?.slots?.[phase]||selection||combo?.slots?.[phase];if(skillDefinition(id)?.type==='action'&&allowed(id))ids.add(id);}
  if(SKILL_BY_ID[technique?.oneMotion]?.type==='action'&&allowed(technique.oneMotion))ids.add(technique.oneMotion);
  return ids;
}

export function faithProfile(state){
  const totals=Object.fromEntries(INSPIRATION_ATTRIBUTES.map(id=>[id,0])),ids=new Set(),inspiration=state?.inspiration;
  if(inspiration){
    for(const id of inspiration.legacySkills||[])ids.add(id);
    for(const [id,record] of Object.entries(inspiration.records||{}))if(record?.kind==='heart'||resolveInspirationAnswer(id)?.kind==='heart')ids.add(id);
  }else for(const id of state?.knownSkills||[])ids.add(id);
  for(const id of ids){
    const row=skillDefinition(id);if(row?.type!=='support')continue;
    for(const [attribute,value] of Object.entries(row.faith||{}))if(Object.hasOwn(totals,attribute)&&Number.isFinite(value)&&value>0)totals[attribute]+=value;
  }
  for(const attribute of INSPIRATION_ATTRIBUTES)totals[attribute]=Number(Math.min(3,totals[attribute]).toFixed(4));
  return totals;
}
export function skillEffects(state){
  const total={trainingGain:0,actionSpark:0,damage:0,mitigation:0,evasion:0,reach:0,staminaCost:0,recovery:0};
  for(const id of selectedSkillIds(state)){
    const row=SKILL_BY_ID[id];
    // Legacy values remain readable; no learning-rate or random-spark multiplier is executable.
    for(const [key,value] of Object.entries(row?.effects||{}))if(key!=='trainingGain'&&key!=='actionSpark'&&Number.isFinite(value))total[key]=(total[key]||0)+value;
  }
  total.damage=clamp(total.damage,0,.7);total.mitigation=clamp(total.mitigation,0,.58);total.evasion=clamp(total.evasion,0,.38);total.reach=clamp(total.reach,0,.35);total.staminaCost=clamp(total.staminaCost,-.38,.1);total.recovery=clamp(total.recovery,0,.5);
  return total;
}
/** Numeric legacy experience is never an acquisition route. Life episodes use inspiration-state. */
export function eligibleDiscoveries(){return [];}
export function skillName(id){return skillDefinition(id)?.name||resolveInspirationAnswer(id)?.name||id;}
