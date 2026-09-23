import {techniqueName as sharedTechniqueName} from '@soul/johakyu-battle';
import { ACTION_SKILLS, SUPPORT_SKILLS, SKILL_BY_ID, skillDefinition } from './rebuild/skill-system.js';
import { resolveInspirationAnswer, isGeneratedTechniqueId } from '@soul/game-data';
import { inspirationName } from './rebuild/inspiration-state.js';

export const PHASES=Object.freeze([['jo','序'],['ha','破'],['kyu','急']]);
export const MAX_COMBOS=6;
export const HEART_SLOT_COUNT=5;
const BASIC_BY_WEAPON=Object.freeze({fist:'basic.fist',sword:'basic.sword',dagger:'basic.dagger',great:'basic.great',spear:'basic.spear',axe:'basic.axe',staff:'basic.staff'});
const COMBO_NAMES=Object.freeze(['壱ノ連','弐ノ連','参ノ連','肆ノ連','伍ノ連','陸ノ連']);
export const BODY_STANCES=Object.freeze([
  {id:'seigan',label:'正眼',description:'癖のない基本構え。',requiresAny:[],reachScale:1,turnScale:1,guardBonus:0},
  {id:'chinshin',label:'沈身',description:'重心を落とし、受けに強い。',requiresAny:['skill.balance','skill.poise'],reachScale:.96,turnScale:.96,guardBonus:.035},
  {id:'ryu',label:'流構え',description:'足を止めず角度を変える。',requiresAny:['skill.flow-step','skill.soft-step'],reachScale:1.04,turnScale:1.12,guardBonus:.01},
  {id:'kosei',label:'攻勢',description:'前へ圧を掛ける構え。',requiresAny:['skill.step','skill.resolve','skill.grip'],reachScale:1.07,turnScale:1.04,guardBonus:-.015},
]);
export const BODY_FINISHERS=Object.freeze([
  {id:'kaishaku',label:'介錯',description:'迷いなく急所を断ち、確実にトドメを刺す。',requiresAny:[],durationScale:1,impactAt:.58},
  {id:'sokudan',label:'即断',description:'短い一手で終え、すぐ次の脅威へ意識を移す。',requiresAny:['skill.edge','skill.step','skill.resolve'],durationScale:.78,impactAt:.52},
  {id:'kakudan',label:'確断',description:'周囲を見切ってから、崩さず確実に終える。',requiresAny:['skill.observe','skill.danger','skill.patience'],durationScale:1.08,impactAt:.6},
  {id:'danzetsu',label:'断絶',description:'重い一撃で戦いを完全に終わらせる。',requiresAny:['skill.grip','skill.resolve'],durationScale:1.16,impactAt:.62},
]);
export const NONLETHAL_HEART_ID='skill.nonlethal';
export const BODY_ZANSHIN=Object.freeze([
  {id:'still',label:'静止残心',description:'打ち終わりを崩さず次へ備える。',requiresAny:[],recoveryScale:1,staminaRefund:0,guardBonus:0},
  {id:'breath',label:'呼吸残心',description:'一息で体勢を戻し消耗を抑える。',requiresAny:['skill.breath','skill.recovery-breath','skill.calm'],recoveryScale:.91,staminaRefund:.05,guardBonus:0},
  {id:'pursuit',label:'追い残心',description:'斬り終わりから一歩だけ追う。',requiresAny:['skill.trail','skill.flow-step'],recoveryScale:.95,staminaRefund:0,guardBonus:.005},
  {id:'guard',label:'守り残心',description:'攻撃後すぐ守りへ戻る。',requiresAny:['skill.guard-sense','skill.endure','skill.balance'],recoveryScale:1.04,staminaRefund:.02,guardBonus:.045},
]);
const basicSkill=state=>BASIC_BY_WEAPON[state?.equipment?.weapon]||'basic.fist';
const supportIds=()=>SUPPORT_SKILLS.map(row=>row.id);
const defaultCatalog=()=>[...supportIds(),...ACTION_SKILLS.map(row=>row.id).filter(id=>!id.startsWith('spark.'))];
function combatCatalog(state){
  if(!state)return new Set(defaultCatalog());
  if(state.inspiration?.version===1){
    const legacy=new Set(state.inspiration.legacySkills||[]),records=state.inspiration.records||{};
    state.combatCatalog=[...new Set((state.knownSkills||[]).filter(id=>skillDefinition(id)&&(legacy.has(id)||Object.hasOwn(records,id))&&!records[id]?.archived))];
  }else if(!Array.isArray(state.combatCatalog))state.combatCatalog=defaultCatalog();
  else state.combatCatalog=[...new Set(state.combatCatalog.filter(id=>skillDefinition(id)))];
  return new Set(state.combatCatalog);
}
const isAction=(state,id)=>id===basicSkill(state)||(combatCatalog(state).has(id)&&skillDefinition(id)?.type==='action');
const weaponCompatible=(state,id)=>{const weapons=resolveInspirationAnswer(id)?.weapons;return !weapons?.length||weapons.includes(state?.equipment?.weapon);};
const actionIds=state=>[basicSkill(state),...[...new Set([...ACTION_SKILLS.map(row=>row.id),...(state?.knownSkills||[])])].filter(id=>combatCatalog(state).has(id)&&skillDefinition(id)?.type==='action')];
function phaseFromLegacy(state,phase){const id=Object.entries(state?.skillWeights?.[phase]||{}).filter(([,value])=>Number(value)>0).sort((a,b)=>Number(b[1])-Number(a[1]))[0]?.[0];return isAction(state,id)&&weaponCompatible(state,id)?id:basicSkill(state);}
function makeCombo(state,index=0,source=null){
  const id=source?.id||`combo-${index+1}`;
  return{id,name:String(source?.name||COMBO_NAMES[index]||`第${index+1}連`).slice(0,24),slots:{jo:isAction(state,source?.slots?.jo)&&weaponCompatible(state,source?.slots?.jo)?source.slots.jo:phaseFromLegacy(state,'jo'),ha:isAction(state,source?.slots?.ha)&&weaponCompatible(state,source?.slots?.ha)?source.slots.ha:phaseFromLegacy(state,'ha'),kyu:isAction(state,source?.slots?.kyu)&&weaponCompatible(state,source?.slots?.kyu)?source.slots.kyu:phaseFromLegacy(state,'kyu')},favored:PHASES.map(([phase])=>phase).filter(phase=>Boolean(source?.favored?.[phase]||source?.favored?.includes?.(phase))).reduce((out,phase)=>(out[phase]=true,out),{})};
}
function optionUnlocked(state,option){const needs=Array.isArray(option?.requiresAny)?option.requiresAny:[];if(!needs.length)return true;const available=combatCatalog(state);return needs.some(id=>available.has(id));}
function normalizeBody(state,body={}){const pick=(list,id,fallback)=>list.some(row=>row.id===id&&optionUnlocked(state,row))?id:fallback;return{stance:pick(BODY_STANCES,body.stance,'seigan'),finisher:pick(BODY_FINISHERS,body.finisher,'kaishaku'),zanshin:pick(BODY_ZANSHIN,body.zanshin,'still')};}
const comboSelection=id=>'combo:'+id;
const comboSelectionId=selection=>String(selection||'').startsWith('combo:')?String(selection).slice(6):null;
function phaseSelectionSkill(state,phase,selection){const comboId=comboSelectionId(selection),combo=comboId?state.combatLoadout?.technique?.combos?.find(row=>row.id===comboId):null,candidate=combo?.slots?.[phase]||selection;return isAction(state,candidate)&&weaponCompatible(state,candidate)?candidate:basicSkill(state);}
function normalizePhaseSelections(state,technique){const raw=technique.phaseSelections&&typeof technique.phaseSelections==='object'?technique.phaseSelections:{},fallback=comboSelection(technique.activeComboId);return Object.fromEntries(PHASES.map(([phase])=>{const value=raw[phase],comboId=comboSelectionId(value),validCombo=comboId&&technique.combos.some(row=>row.id===comboId),validSkill=isAction(state,value)&&weaponCompatible(state,value);return[phase,validCombo||validSkill?value:fallback];}));}
function mirrorLegacy(state){if(!state?.combatLoadout?.technique)return;state.skillWeights??={};for(const [phase]of PHASES){const skill=phaseSelectionSkill(state,phase,state.combatLoadout.technique.phaseSelections?.[phase]);state.skillWeights[phase]={[skill]:100};}}
export function ensureCombatLoadout(state){
  if(!state)return null;const available=combatCatalog(state),existing=state.combatLoadout&&typeof state.combatLoadout==='object'?state.combatLoadout:{},heart=existing.heart&&typeof existing.heart==='object'?existing.heart:{},availableHeart=supportIds().filter(id=>available.has(id));
  const legacyActive=Array.isArray(heart.active)?[...new Set(heart.active.filter(id=>availableHeart.includes(id)))].slice(0,HEART_SLOT_COUNT):[];
  const rawSlots=Array.isArray(heart.slots)?heart.slots.slice(0,HEART_SLOT_COUNT):legacyActive;
  const seenHeart=new Set();heart.slots=Array.from({length:HEART_SLOT_COUNT},(_,index)=>{const id=rawSlots[index];if(!availableHeart.includes(id)||seenHeart.has(id))return null;seenHeart.add(id);return id;});heart.active=heart.slots.filter(Boolean);
  const technique=existing.technique&&typeof existing.technique==='object'?existing.technique:{},rawCombos=Array.isArray(technique.combos)?technique.combos.slice(0,MAX_COMBOS):[];
  technique.combos=(rawCombos.length?rawCombos:[null]).map((row,index)=>makeCombo(state,index,row));if(!technique.combos.some(row=>row.id===technique.activeComboId))technique.activeComboId=technique.combos[0].id;technique.phaseSelections=normalizePhaseSelections(state,technique);
  if(skillDefinition(technique.oneMotion)?.type!=='action'||!available.has(technique.oneMotion)||String(technique.oneMotion).startsWith('spark.')||isGeneratedTechniqueId(technique.oneMotion))technique.oneMotion=null;
  state.combatLoadout={heart,technique,body:normalizeBody(state,existing.body)};mirrorLegacy(state);return state.combatLoadout;
}
export function availableCombatSkills(state){ensureCombatLoadout(state);return[...combatCatalog(state)];}
export function learnedHeartSkills(state){ensureCombatLoadout(state);const available=combatCatalog(state);return supportIds().filter(id=>available.has(id));}
export function learnedTechniqueSkills(state,{oneMotion=false}={}){ensureCombatLoadout(state);const ids=actionIds(state);return oneMotion?ids.filter(id=>skillDefinition(id)?.type==='action'&&!id.startsWith('spark.')&&!isGeneratedTechniqueId(id)):ids;}
export function techniqueName(id,state=null){const fallback=sharedTechniqueName(id)||skillDefinition(id)?.name||id||'未設定';return state?inspirationName(state,id,fallback):fallback;}
export function activeCombo(state){const loadout=state?.combatLoadout||ensureCombatLoadout(state);return loadout?.technique?.combos?.find(row=>row.id===loadout.technique.activeComboId)||loadout?.technique?.combos?.[0]||null;}
export function comboById(state,id){ensureCombatLoadout(state);return state.combatLoadout.technique.combos.find(row=>row.id===id)||activeCombo(state);}
export function setHeartActive(state,id,active){
  const loadout=ensureCombatLoadout(state);if(!learnedHeartSkills(state).includes(id))return false;const slots=[...loadout.heart.slots],existing=slots.indexOf(id);
  if(active){if(existing>=0)return true;const open=slots.findIndex(value=>!value);if(open<0)return false;slots[open]=id;}else if(existing>=0)slots[existing]=null;
  loadout.heart.slots=slots;loadout.heart.active=slots.filter(Boolean);return true;
}
export function setHeartSlot(state,slot,id){
  const loadout=ensureCombatLoadout(state),slots=[...loadout.heart.slots],index=Math.max(0,Math.min(HEART_SLOT_COUNT-1,Number(slot)||0));
  if(id==null){slots[index]=null;loadout.heart.slots=slots;loadout.heart.active=slots.filter(Boolean);return true;}if(!learnedHeartSkills(state).includes(id))return false;
  const existing=slots.indexOf(id);if(existing===index)return true;const displaced=slots[index]||null;slots[index]=id;if(existing>=0)slots[existing]=displaced;
  loadout.heart.slots=slots;loadout.heart.active=slots.filter(Boolean);return true;
}
export function addCombo(state){const loadout=ensureCombatLoadout(state),rows=loadout.technique.combos;if(rows.length>=MAX_COMBOS)return null;const source=activeCombo(state),ids=new Set(rows.map(row=>row.id));let serial=1;while(ids.has(`combo-${serial}`))serial++;const combo=makeCombo(state,rows.length,{id:`combo-${serial}`,slots:{...source.slots}});rows.push(combo);return combo;}
export function removeCombo(state,id){const loadout=ensureCombatLoadout(state),rows=loadout.technique.combos;if(rows.length<=1)return false;const index=rows.findIndex(row=>row.id===id);if(index<0)return false;rows.splice(index,1);if(loadout.technique.activeComboId===id)loadout.technique.activeComboId=rows[0].id;for(const [phase]of PHASES)if(comboSelectionId(loadout.technique.phaseSelections?.[phase])===id)loadout.technique.phaseSelections[phase]=comboSelection(loadout.technique.activeComboId);mirrorLegacy(state);return true;}
export function setActiveCombo(state,id){const loadout=ensureCombatLoadout(state);if(!loadout.technique.combos.some(row=>row.id===id))return false;loadout.technique.activeComboId=id;mirrorLegacy(state);return true;}
export function setComboSkill(state,comboId,phase,skill){const combo=comboById(state,comboId);if(!combo||!PHASES.some(([id])=>id===phase)||!isAction(state,skill)||!weaponCompatible(state,skill))return false;combo.slots[phase]=skill;mirrorLegacy(state);return true;}
export function phaseSelectionLabel(state,phase){const loadout=ensureCombatLoadout(state),selection=loadout.technique.phaseSelections[phase],comboId=comboSelectionId(selection),combo=comboId?loadout.technique.combos.find(row=>row.id===comboId):null;return combo?.name||techniqueName(selection,state);}
export function setPhaseSelection(state,phase,selection){const loadout=ensureCombatLoadout(state);if(!PHASES.some(([id])=>id===phase))return false;const comboId=comboSelectionId(selection),validCombo=comboId&&loadout.technique.combos.some(row=>row.id===comboId),validSkill=isAction(state,selection)&&weaponCompatible(state,selection);if(!validCombo&&!validSkill)return false;loadout.technique.phaseSelections[phase]=selection;mirrorLegacy(state);return true;}
export function toggleFavored(state,comboId,phase){const combo=comboById(state,comboId);if(!combo||!PHASES.some(([id])=>id===phase))return false;combo.favored[phase]=!combo.favored[phase];return combo.favored[phase];}
export function setOneMotion(state,skill){const loadout=ensureCombatLoadout(state);if(skill===null){loadout.technique.oneMotion=null;return true;}if(skillDefinition(skill)?.type!=='action'||!combatCatalog(state).has(skill)||String(skill).startsWith('spark.')||isGeneratedTechniqueId(skill))return false;loadout.technique.oneMotion=skill;return true;}
export function setBodyChoice(state,kind,id){const loadout=ensureCombatLoadout(state),map={stance:BODY_STANCES,finisher:BODY_FINISHERS,zanshin:BODY_ZANSHIN},list=map[kind];if(!list)return false;const row=list.find(item=>item.id===id);if(!row||!optionUnlocked(state,row))return false;loadout.body[kind]=id;return true;}
export function unlockedBodyOptions(state,kind){ensureCombatLoadout(state);const map={stance:BODY_STANCES,finisher:BODY_FINISHERS,zanshin:BODY_ZANSHIN};return(map[kind]||[]).filter(row=>optionUnlocked(state,row));}
export function bodyRuntime(state){const loadout=ensureCombatLoadout(state),stance=BODY_STANCES.find(row=>row.id===loadout.body.stance)||BODY_STANCES[0],finisher=BODY_FINISHERS.find(row=>row.id===loadout.body.finisher)||BODY_FINISHERS[0],zanshin=BODY_ZANSHIN.find(row=>row.id===loadout.body.zanshin)||BODY_ZANSHIN[0];return{stance,finisher,zanshin,guardBonus:(stance.guardBonus||0)+(zanshin.guardBonus||0)};}
export function combatFinisherRuntime(state){const loadout=ensureCombatLoadout(state),finisher=BODY_FINISHERS.find(row=>row.id===loadout.body.finisher)||BODY_FINISHERS[0],nonlethal=loadout.heart.active.includes(NONLETHAL_HEART_ID);return Object.freeze({finisher,nonlethal,execute:!nonlethal});}
function weightedCombos(state){const loadout=ensureCombatLoadout(state),active=loadout.technique.activeComboId,ordered=[...loadout.technique.combos].sort((a,b)=>Number(b.id===active)-Number(a.id===active)),rows=[];for(const combo of ordered){const weight=1+Object.values(combo.favored||{}).filter(Boolean).length*2+(combo.id===active?2:0);for(let i=0;i<weight;i++)rows.push(combo);}return rows;}
export function selectCombatCombo(state,combat,{advance=false}={}){const rows=weightedCombos(state);if(!rows.length)return null;if(!Number.isInteger(combat.comboCursor))combat.comboCursor=0;else if(advance)combat.comboCursor++;const combo=rows[combat.comboCursor%rows.length];combat.comboId=combo.id;return combo;}
export function combatSkillForPhase(state,combat,phase){const loadout=ensureCombatLoadout(state),selection=loadout.technique.phaseSelections?.[phase];return phaseSelectionSkill(state,phase,selection);}
export function requestOneMotion(state){const loadout=ensureCombatLoadout(state),skill=loadout.technique.oneMotion;if(!state?.combat||state.down||state.ended||!skill)return null;state.combat.oneMotionQueued={skill,ttl:1.15};return skill;}

