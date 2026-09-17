import { SKILL_BY_ID } from './rebuild/skill-system.js';

export const PHASES=Object.freeze([['jo','序'],['ha','破'],['kyu','急']]);
export const MAX_COMBOS=6;
const BASIC_BY_WEAPON=Object.freeze({fist:'basic.fist',sword:'basic.sword',dagger:'basic.dagger',great:'basic.great',spear:'basic.spear',axe:'basic.axe',staff:'basic.staff'});
const BASIC_LABELS=Object.freeze({'basic.fist':'徒手の型','basic.sword':'剣の型','basic.dagger':'短剣の型','basic.great':'大剣の型','basic.spear':'槍の型','basic.axe':'戦斧の型','basic.staff':'杖の型'});
const COMBO_NAMES=Object.freeze(['壱ノ連','弐ノ連','参ノ連','肆ノ連','伍ノ連','陸ノ連']);

export const TECHNIQUE_CATALOG=Object.freeze([
  {id:'tech.guard-flow',name:'受け流しの型',sourceSkill:'action.guard-step',glyph:'受',sequence:['basic','source','source']},
  {id:'tech.hien',name:'飛燕返し',sourceSkill:'action.slip',glyph:'燕',sequence:['source','basic','source']},
  {id:'tech.iwato',name:'岩戸崩し',sourceSkill:'action.lunge',glyph:'岩',sequence:['basic','source','source']},
  {id:'tech.asanagi',name:'朝凪',sourceSkill:'action.counter',glyph:'朝',sequence:['source','basic','source']},
  {id:'tech.tsukioi',name:'月追い',sourceSkill:'action.feint',glyph:'月',sequence:['basic','source','source']},
  {id:'tech.kazenagi',name:'風薙ぎ',sourceSkill:'action.flow',glyph:'風',sequence:['source','source','basic']},
  {id:'tech.kumozaki',name:'雲裂き',sourceSkill:'action.breakfall',glyph:'雲',sequence:['basic','source','source']},
  {id:'tech.kasumi',name:'霞渡り',sourceSkill:'action.finish',glyph:'霞',sequence:['source','basic','source']},
  {id:'tech.narukami',name:'鳴神',sourceSkill:'action.side-step',glyph:'雷',sequence:['basic','source','source']},
  {id:'tech.shiranami',name:'白波',sourceSkill:'action.circle',glyph:'波',sequence:['source','source','basic']},
  {id:'tech.tomoshibi',name:'灯火',sourceSkill:'action.crash',glyph:'灯',sequence:['basic','source','source']},
  {id:'tech.yamago-e',name:'山越え',sourceSkill:'action.draw',glyph:'山',sequence:['source','basic','source']},
  {id:'tech.kagenui',name:'影縫い',sourceSkill:'action.recover',glyph:'影',sequence:['basic','source','source']},
  {id:'tech.zansei',name:'斬星',sourceSkill:'action.precision',glyph:'星',sequence:['source','source','basic']},
]);
const TECHNIQUE_BY_ID=Object.freeze(Object.fromEntries(TECHNIQUE_CATALOG.map(row=>[row.id,row])));

export const BODY_STANCES=Object.freeze([
  {id:'seigan',label:'正眼',description:'隙のない基本構え。',requiresAny:[],reachScale:1,turnScale:1,guardBonus:0,glyph:'正'},
  {id:'chinshin',label:'沈身',description:'重心を落とし、受けに強い。',requiresAny:['skill.balance','skill.poise'],reachScale:.96,turnScale:.96,guardBonus:.035,glyph:'沈'},
  {id:'ryu',label:'流構え',description:'足を止めず角度を変える。',requiresAny:['skill.flow-step','skill.soft-step'],reachScale:1.04,turnScale:1.12,guardBonus:.01,glyph:'流'},
  {id:'kosei',label:'攻勢',description:'前へ圧を掛ける構え。',requiresAny:['skill.step','skill.resolve'],reachScale:1.07,turnScale:1.04,guardBonus:-.015,glyph:'攻'},
  {id:'hasso',label:'八相',description:'得物を立て、攻守の切替を早める。',requiresAny:['skill.grip','skill.weapon-eye'],reachScale:1.02,turnScale:1.08,guardBonus:.012,glyph:'八'},
  {id:'hanshin',label:'半身',description:'身体を細く見せ、正面の被弾を抑える。',requiresAny:['skill.soft-step','skill.peripheral'],reachScale:.99,turnScale:1.1,guardBonus:.018,glyph:'半'},
]);
export const BODY_STYLES=Object.freeze([
  {id:'balanced',label:'中庸',description:'近づき過ぎず離れ過ぎない。',requiresAny:[],distanceScale:1,advanceScale:1,retreatScale:1,orbitScale:1,glyph:'中'},
  {id:'distance',label:'間合い重視',description:'得物の先端を活かして距離を保つ。',requiresAny:['skill.distance'],distanceScale:1.22,advanceScale:.84,retreatScale:1.18,orbitScale:1.05,glyph:'間'},
  {id:'counter',label:'迎撃',description:'相手の踏み込みへ合わせる。',requiresAny:['skill.read','skill.danger','skill.peripheral'],distanceScale:1.03,advanceScale:.88,retreatScale:1.08,orbitScale:1.24,glyph:'迎'},
  {id:'pressure',label:'圧迫',description:'退かず前へ詰め続ける。',requiresAny:['skill.resolve','skill.step','skill.edge'],distanceScale:.78,advanceScale:1.2,retreatScale:.72,orbitScale:.82,glyph:'圧'},
  {id:'flow',label:'流動',description:'正面を外し続けて崩す。',requiresAny:['skill.flow-step','skill.soft-step'],distanceScale:1.04,advanceScale:.96,retreatScale:1.04,orbitScale:1.38,glyph:'流'},
  {id:'hikima',label:'引き間',description:'一歩引いた間を保ち、相手を誘う。',requiresAny:['skill.distance','skill.danger'],distanceScale:1.3,advanceScale:.78,retreatScale:1.24,orbitScale:1.06,glyph:'引'},
  {id:'kinshin',label:'近身',description:'懐へ入り、近距離の圧を維持する。',requiresAny:['skill.step','skill.resolve'],distanceScale:.7,advanceScale:1.28,retreatScale:.66,orbitScale:.9,glyph:'近'},
]);
export const BODY_ZANSHIN=Object.freeze([
  {id:'still',label:'静止残心',description:'打ち終わりを崩さず次へ備える。',requiresAny:[],recoveryScale:1,staminaRefund:0,guardBonus:0,glyph:'静'},
  {id:'breath',label:'呼吸残心',description:'一息で体勢を戻し消耗を抑える。',requiresAny:['skill.breath','skill.recovery-breath','skill.calm'],recoveryScale:.91,staminaRefund:.05,guardBonus:0,glyph:'呼'},
  {id:'pursuit',label:'追い残心',description:'斬り終わりから一歩だけ追う。',requiresAny:['skill.trail','skill.flow-step'],recoveryScale:.95,staminaRefund:0,guardBonus:.005,glyph:'追'},
  {id:'guard',label:'守り残心',description:'攻撃後すぐ守りへ戻る。',requiresAny:['skill.guard-sense','skill.endure','skill.balance'],recoveryScale:1.04,staminaRefund:.02,guardBonus:.045,glyph:'守'},
  {id:'receive',label:'受け残心',description:'打ち終わりから受けへ滑らかに繋ぐ。',requiresAny:['skill.guard-sense','skill.balance'],recoveryScale:.98,staminaRefund:.02,guardBonus:.032,glyph:'受'},
  {id:'flow',label:'流残心',description:'余勢を殺さず、そのまま次の角度へ流す。',requiresAny:['skill.flow-step','skill.trail'],recoveryScale:.9,staminaRefund:.025,guardBonus:.008,glyph:'流'},
]);

const knownSet=state=>new Set(state?.knownSkills||[]);
const basicSkill=state=>BASIC_BY_WEAPON[state?.equipment?.weapon]||'basic.fist';
const isAction=(state,id)=>id===basicSkill(state)||(SKILL_BY_ID[id]?.type==='action'&&knownSet(state).has(id));
const supportIds=state=>(state?.knownSkills||[]).filter(id=>SKILL_BY_ID[id]?.type==='support');
const actionIds=state=>[basicSkill(state),...(state?.knownSkills||[]).filter(id=>SKILL_BY_ID[id]?.type==='action')].filter((id,index,list)=>list.indexOf(id)===index);
const learned=row=>state=>!row.requiresAny.length||row.requiresAny.some(id=>knownSet(state).has(id));
function phaseFromLegacy(state,phase){const id=Object.entries(state?.skillWeights?.[phase]||{}).filter(([,value])=>Number(value)>0).sort((a,b)=>Number(b[1])-Number(a[1]))[0]?.[0];return isAction(state,id)?id:basicSkill(state);}
function makeLegacyCombo(state,index=0,source=null){
  const id=source?.id||`combo-${index+1}`;
  return{id,name:String(source?.name||COMBO_NAMES[index]||`第${index+1}連`).slice(0,12),glyph:String(source?.glyph||'技').slice(0,1),legacy:true,slots:{jo:isAction(state,source?.slots?.jo)?source.slots.jo:phaseFromLegacy(state,'jo'),ha:isAction(state,source?.slots?.ha)?source.slots.ha:phaseFromLegacy(state,'ha'),kyu:isAction(state,source?.slots?.kyu)?source.slots.kyu:phaseFromLegacy(state,'kyu')},favored:PHASES.map(([phase])=>phase).filter(phase=>Boolean(source?.favored?.[phase]||source?.favored?.includes?.(phase))).reduce((out,phase)=>(out[phase]=true,out),{})};
}
function materializeTechnique(state,row){const source=row.sourceSkill,basic=basicSkill(state),resolve=token=>token==='source'?source:basic;return{...row,legacy:false,slots:{jo:resolve(row.sequence[0]),ha:resolve(row.sequence[1]),kyu:resolve(row.sequence[2])}};}
function optionUnlocked(state,option){return learned(option)(state);}
function normalizeBody(state,body={}){const pick=(list,id,fallback)=>list.some(row=>row.id===id&&optionUnlocked(state,row))?id:fallback;return{stance:pick(BODY_STANCES,body.stance,'seigan'),style:pick(BODY_STYLES,body.style,'balanced'),zanshin:pick(BODY_ZANSHIN,body.zanshin,'still')};}
function techniqueLibraryUnsafe(state,technique){const known=knownSet(state),catalog=TECHNIQUE_CATALOG.filter(row=>known.has(row.sourceSkill)).map(row=>materializeTechnique(state,row)),legacy=(technique?.combos||[]).map((row,index)=>makeLegacyCombo(state,index,row));return[...catalog,...legacy].filter((row,index,list)=>list.findIndex(item=>item.id===row.id)===index);}
function fallbackCombo(state){const basic=basicSkill(state);return{id:'fallback-basic',name:'基礎連',glyph:'基',legacy:false,slots:{jo:basic,ha:basic,kyu:basic},favored:{}};}
function resolveTechniqueUnsafe(state,technique,id){return techniqueLibraryUnsafe(state,technique).find(row=>row.id===id)||null;}
function mirrorLegacy(state){const loadout=state.combatLoadout,combo=loadout?resolveTechniqueUnsafe(state,loadout.technique,loadout.technique.intentSlots?.[0]):null,fallback=combo||fallbackCombo(state);state.skillWeights??={};for(const [phase] of PHASES)state.skillWeights[phase]={[fallback.slots[phase]]:100};}

export function ensureCombatLoadout(state){
  if(!state)return null;const existing=state.combatLoadout&&typeof state.combatLoadout==='object'?state.combatLoadout:{},knownHeart=supportIds(state),heart=existing.heart&&typeof existing.heart==='object'?existing.heart:{};
  // Heart knowledge is passive. Keep the legacy array populated only for old-save compatibility.
  heart.active=[...knownHeart];
  const technique=existing.technique&&typeof existing.technique==='object'?existing.technique:{},rawCombos=Array.isArray(technique.combos)?technique.combos.slice(0,MAX_COMBOS):[];
  technique.combos=rawCombos.map((row,index)=>makeLegacyCombo(state,index,row));
  const library=techniqueLibraryUnsafe(state,technique),validIds=new Set(library.map(row=>row.id));
  let slots=Array.isArray(technique.intentSlots)?technique.intentSlots.slice(0,3).map(id=>validIds.has(id)?id:null):null;
  if(!slots){const preferred=[];if(validIds.has(technique.activeComboId))preferred.push(technique.activeComboId);for(const row of technique.combos)if(!preferred.includes(row.id))preferred.push(row.id);for(const row of library)if(!preferred.includes(row.id))preferred.push(row.id);slots=preferred.slice(0,3);}
  while(slots.length<3)slots.push(null);technique.intentSlots=slots;technique.activeComboId=slots[0]||null;
  if(!(SKILL_BY_ID[technique.oneMotion]?.type==='action'&&knownSet(state).has(technique.oneMotion)))technique.oneMotion=null;
  state.combatLoadout={heart,technique,body:normalizeBody(state,existing.body)};mirrorLegacy(state);return state.combatLoadout;
}
export function learnedHeartSkills(state){ensureCombatLoadout(state);return supportIds(state);}
export function learnedTechniqueSkills(state,{oneMotion=false}={}){ensureCombatLoadout(state);const ids=actionIds(state);return oneMotion?ids.filter(id=>SKILL_BY_ID[id]?.type==='action'):ids;}
export function learnedTechniques(state){const loadout=ensureCombatLoadout(state);return techniqueLibraryUnsafe(state,loadout.technique);}
export function techniqueForSourceSkill(state,skillId){return learnedTechniques(state).find(row=>row.sourceSkill===skillId)||null;}
export function techniqueName(id){return TECHNIQUE_BY_ID[id]?.name||SKILL_BY_ID[id]?.name||BASIC_LABELS[id]||id||'未設定';}
export function activeCombo(state){const loadout=ensureCombatLoadout(state),id=loadout.technique.intentSlots[0];return resolveTechniqueUnsafe(state,loadout.technique,id)||fallbackCombo(state);}
export function comboById(state,id){const loadout=ensureCombatLoadout(state);return resolveTechniqueUnsafe(state,loadout.technique,id)||activeCombo(state);}
export function setTechniqueIntentSlot(state,index,techniqueId){const loadout=ensureCombatLoadout(state);if(!Number.isInteger(index)||index<0||index>2)return false;if(techniqueId!==null&&!resolveTechniqueUnsafe(state,loadout.technique,techniqueId))return false;loadout.technique.intentSlots[index]=techniqueId;loadout.technique.activeComboId=loadout.technique.intentSlots[0]||null;mirrorLegacy(state);return true;}
export function setHeartActive(state,id){ensureCombatLoadout(state);return supportIds(state).includes(id);}
export function addCombo(state){const loadout=ensureCombatLoadout(state),rows=loadout.technique.combos;if(rows.length>=MAX_COMBOS)return null;const source=activeCombo(state),ids=new Set(rows.map(row=>row.id));let serial=1;while(ids.has(`combo-${serial}`))serial++;const combo=makeLegacyCombo(state,rows.length,{id:`combo-${serial}`,slots:{...source.slots},name:COMBO_NAMES[rows.length]});rows.push(combo);const empty=loadout.technique.intentSlots.findIndex(id=>id===null);if(empty>=0)loadout.technique.intentSlots[empty]=combo.id;mirrorLegacy(state);return combo;}
export function removeCombo(state,id){const loadout=ensureCombatLoadout(state),rows=loadout.technique.combos,index=rows.findIndex(row=>row.id===id);if(index<0)return false;rows.splice(index,1);loadout.technique.intentSlots=loadout.technique.intentSlots.map(row=>row===id?null:row);loadout.technique.activeComboId=loadout.technique.intentSlots[0]||null;mirrorLegacy(state);return true;}
export function setActiveCombo(state,id){return setTechniqueIntentSlot(state,0,id);}
export function setComboSkill(state,comboId,phase,skill){const loadout=ensureCombatLoadout(state),combo=loadout.technique.combos.find(row=>row.id===comboId);if(!combo||!PHASES.some(([id])=>id===phase)||!isAction(state,skill))return false;combo.slots[phase]=skill;mirrorLegacy(state);return true;}
export function toggleFavored(state,comboId,phase){const loadout=ensureCombatLoadout(state),combo=loadout.technique.combos.find(row=>row.id===comboId);if(!combo||!PHASES.some(([id])=>id===phase))return false;combo.favored[phase]=!combo.favored[phase];return combo.favored[phase];}
export function setOneMotion(state,skill){const loadout=ensureCombatLoadout(state);if(skill===null){loadout.technique.oneMotion=null;return true;}if(!(SKILL_BY_ID[skill]?.type==='action'&&knownSet(state).has(skill)))return false;loadout.technique.oneMotion=skill;return true;}
export function setBodyChoice(state,kind,id){const loadout=ensureCombatLoadout(state),map={stance:BODY_STANCES,style:BODY_STYLES,zanshin:BODY_ZANSHIN},list=map[kind];if(!list)return false;const row=list.find(item=>item.id===id);if(!row||!optionUnlocked(state,row))return false;loadout.body[kind]=id;return true;}
export function unlockedBodyOptions(state,kind){ensureCombatLoadout(state);const map={stance:BODY_STANCES,style:BODY_STYLES,zanshin:BODY_ZANSHIN};return(map[kind]||[]).filter(row=>optionUnlocked(state,row));}
export function learnedBodySkills(state,{kind='all'}={}){ensureCombatLoadout(state);const groups=[['stance','構え',BODY_STANCES],['style','間合い',BODY_STYLES],['zanshin','残心',BODY_ZANSHIN]],rows=[];for(const [id,category,list] of groups){if(kind!=='all'&&kind!==id)continue;for(const option of list)if(optionUnlocked(state,option))rows.push({...option,kind:id,category});}return rows;}
export function bodyRuntime(state){const loadout=ensureCombatLoadout(state),stance=BODY_STANCES.find(row=>row.id===loadout.body.stance)||BODY_STANCES[0],style=BODY_STYLES.find(row=>row.id===loadout.body.style)||BODY_STYLES[0],zanshin=BODY_ZANSHIN.find(row=>row.id===loadout.body.zanshin)||BODY_ZANSHIN[0];return{stance,style,zanshin,guardBonus:(stance.guardBonus||0)+(zanshin.guardBonus||0)};}
export function selectCombatCombo(state,combat,{advance=false}={}){const loadout=ensureCombatLoadout(state),rows=loadout.technique.intentSlots.map(id=>resolveTechniqueUnsafe(state,loadout.technique,id)).filter(Boolean);if(!rows.length)rows.push(fallbackCombo(state));if(!Number.isInteger(combat.comboCursor))combat.comboCursor=0;else if(advance)combat.comboCursor++;const combo=rows[combat.comboCursor%rows.length];combat.comboId=combo.id;return combo;}
export function combatSkillForPhase(state,combat,phase){const combo=comboById(state,combat?.comboId);return isAction(state,combo?.slots?.[phase])?combo.slots[phase]:basicSkill(state);}
export function requestOneMotion(state){const loadout=ensureCombatLoadout(state),skill=loadout.technique.oneMotion;if(!state?.combat||state.down||state.ended||!skill)return null;state.combat.oneMotionQueued={skill,ttl:1.15};return skill;}
