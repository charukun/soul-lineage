import { SKILL_BY_ID } from './rebuild/skill-system.js';
import {
  PHASES,MAX_COMBOS,ensureCombatLoadout,learnedHeartSkills,learnedTechniqueSkills,techniqueName,
  activeCombo,comboById,setHeartActive,addCombo,removeCombo,setActiveCombo,setComboSkill,toggleFavored,
  setOneMotion,setBodyChoice,unlockedBodyOptions,requestOneMotion
} from './combat-loadout.js';

const EFFECT_LABELS=Object.freeze({damage:'威力',mitigation:'守り',evasion:'見切り',reach:'間合い',recovery:'回復'});
const haptic=pattern=>{try{globalThis.navigator?.vibrate?.(pattern);}catch{}};
function effectSummary(id){
  const effects=SKILL_BY_ID[id]?.effects||{},labels=[];
  for(const [key,label] of Object.entries(EFFECT_LABELS))if(Number(effects[key])>0)labels.push(`${label}↑`);
  if(Number(effects.staminaCost)<0)labels.push('息持ち↑');else if(Number(effects.staminaCost)>0)labels.push('消耗↑');
  return labels.slice(0,3).join('・')||'判断傾向';
}
function sectionIntro(title,copy){const node=document.createElement('div');node.className='loadout-intro';node.innerHTML='<strong></strong><small></small>';node.querySelector('strong').textContent=title;node.querySelector('small').textContent=copy;return node;}
function skillButton(id,{active=false,highlight=false,onClick}={}){
  const row=SKILL_BY_ID[id],button=document.createElement('button');button.type='button';button.className='heart-skill';button.dataset.active=String(active);button.dataset.highlight=String(highlight);
  button.innerHTML='<i></i><span><strong></strong><small></small></span><em></em>';button.querySelector('i').textContent=row?.type==='support'?'心':'技';button.querySelector('strong').textContent=techniqueName(id);button.querySelector('small').textContent=effectSummary(id);button.querySelector('em').textContent=active?'セット中':'未セット';button.onclick=onClick;return button;
}

function renderHeart(model,focusId=null){
  const state=model.getState();if(!state)return;ensureCombatLoadout(state);model.tracker.consume('heart');model.ui.title.textContent='心 · 心得';model.ui.body.innerHTML='';
  model.ui.body.append(sectionIntro('心得を選ぶ','すべての心得から、今の戦いへ持ち込む判断傾向を選ぶ。'));
  const ids=learnedHeartSkills(state),list=document.createElement('div');list.className='heart-list';
  const active=new Set(state.combatLoadout.heart.active);
  for(const id of ids)list.append(skillButton(id,{active:active.has(id),highlight:id===focusId,onClick:()=>{setHeartActive(state,id,!active.has(id));model.audio.item();haptic(10);renderHeart(model,id);}}));
  model.ui.body.append(list);
}

function renderComboTabs(model,state){
  const wrap=document.createElement('div');wrap.className='combo-tabs';
  for(const combo of state.combatLoadout.technique.combos){const button=document.createElement('button');button.type='button';button.className='combo-tab';button.dataset.active=String(combo.id===model.comboId);button.innerHTML='<strong></strong><small></small>';button.querySelector('strong').textContent=combo.name;button.querySelector('small').textContent=combo.id===state.combatLoadout.technique.activeComboId?'主軸':'連技';button.onclick=()=>{model.comboId=combo.id;model.picker=null;model.audio.ui();renderTechnique(model);};wrap.append(button);}
  if(state.combatLoadout.technique.combos.length<MAX_COMBOS){const add=document.createElement('button');add.type='button';add.className='combo-tab combo-add';add.innerHTML='<strong>＋</strong><small>追加</small>';add.onclick=()=>{const combo=addCombo(state);if(combo){model.comboId=combo.id;model.audio.item();haptic(12);renderTechnique(model);}};wrap.append(add);}
  return wrap;
}
function renderFavored(model,state,combo,phase){
  const button=document.createElement('button');button.type='button';button.className='favored-tag';button.dataset.active=String(Boolean(combo.favored?.[phase]));button.textContent=combo.favored?.[phase]?'優先':'優先する';button.onclick=()=>{toggleFavored(state,combo.id,phase);model.audio.ui();haptic(8);renderTechnique(model);};return button;
}
function renderComboSlot(model,state,combo,phase,label){
  const row=document.createElement('div');row.className='combo-slot-row';const slot=document.createElement('button');slot.type='button';slot.className='combo-slot';slot.innerHTML='<b></b><span><strong></strong><small></small></span>';slot.querySelector('b').textContent=label;slot.querySelector('strong').textContent=techniqueName(combo.slots[phase]);slot.querySelector('small').textContent=effectSummary(combo.slots[phase]);slot.onclick=()=>{model.picker={kind:'slot',comboId:combo.id,phase};model.audio.ui();renderTechnique(model);};row.append(slot,renderFavored(model,state,combo,phase));return row;
}
function renderFocusedSpark(){return null;}
function renderPicker(model,state){
  if(!model.picker)return null;const one=model.picker.kind==='oneMotion',box=document.createElement('section');box.className='technique-picker';box.append(sectionIntro(one?'ワンモーションを選ぶ':'技を選ぶ',one?'手動発動は強い代わりに消耗と隙が大きい。':'選んだ技をこの序破急スロットへ設定する。'));
  const list=document.createElement('div');list.className='technique-picker-list';for(const id of learnedTechniqueSkills(state,{oneMotion:one})){const button=skillButton(id,{active:one?state.combatLoadout.technique.oneMotion===id:comboById(state,model.picker.comboId)?.slots?.[model.picker.phase]===id,onClick:()=>{if(one)setOneMotion(state,id);else setComboSkill(state,model.picker.comboId,model.picker.phase,id);model.picker=null;model.audio.item();haptic(16);renderTechnique(model);}});list.append(button);}box.append(list);return box;
}
function renderOneMotion(model,state){
  const box=document.createElement('section');box.className='one-motion-card';const current=state.combatLoadout.technique.oneMotion;box.innerHTML='<div><span>手動奥義</span><strong></strong><small>戦闘態勢中にタップ発動 · スタミナ大 / 隙大</small></div><div class="one-motion-actions"></div>';box.querySelector('strong').textContent=current?techniqueName(current):'未設定';const actions=box.querySelector('.one-motion-actions');
  const choose=document.createElement('button');choose.type='button';choose.textContent=current?'変更':'セット';choose.onclick=()=>{model.picker={kind:'oneMotion'};model.audio.ui();renderTechnique(model);};actions.append(choose);
  if(current){const clear=document.createElement('button');clear.type='button';clear.textContent='外す';clear.onclick=()=>{setOneMotion(state,null);model.audio.ui();renderTechnique(model);};actions.append(clear);}return box;
}
function renderTechnique(model,focusId=null){
  const state=model.getState();if(!state)return;ensureCombatLoadout(state);model.tracker.consume('technique');if(focusId)model.focusSkill=focusId;
  const combos=state.combatLoadout.technique.combos;if(!model.comboId||!combos.some(row=>row.id===model.comboId))model.comboId=state.combatLoadout.technique.activeComboId;const combo=comboById(state,model.comboId);
  model.ui.title.textContent='技 · 序破急';model.ui.body.innerHTML='';model.ui.body.append(sectionIntro('連技を組む','最初から使える技を序 → 破 → 急へ組み、今の戦い方を決める。'),renderComboTabs(model,state));
  const focus=renderFocusedSpark(model,state,combo);if(focus)model.ui.body.append(focus);
  const toolbar=document.createElement('div');toolbar.className='combo-toolbar';const main=document.createElement('button');main.type='button';main.dataset.active=String(combo.id===state.combatLoadout.technique.activeComboId);main.textContent=main.dataset.active==='true'?'主軸コンボ':'主軸にする';main.onclick=()=>{setActiveCombo(state,combo.id);model.audio.item();renderTechnique(model);};toolbar.append(main);
  if(combos.length>1){const remove=document.createElement('button');remove.type='button';remove.textContent='この連技を削除';remove.onclick=()=>{removeCombo(state,combo.id);model.comboId=state.combatLoadout.technique.activeComboId;model.audio.ui();renderTechnique(model);};toolbar.append(remove);}model.ui.body.append(toolbar);
  const slots=document.createElement('section');slots.className='combo-slots';for(const [phase,label] of PHASES)slots.append(renderComboSlot(model,state,combo,phase,label));model.ui.body.append(slots,renderOneMotion(model,state));const picker=renderPicker(model,state);if(picker)model.ui.body.append(picker);
}

function renderBodyGroup(model,state,kind,title,copy){
  const section=document.createElement('section');section.className='body-loadout-section';section.append(sectionIntro(title,copy));const list=document.createElement('div');list.className='body-option-list';const current=state.combatLoadout.body[kind];
  for(const option of unlockedBodyOptions(state,kind)){const button=document.createElement('button');button.type='button';button.className='body-option';button.dataset.active=String(option.id===current);button.innerHTML='<strong></strong><small></small><em></em>';button.querySelector('strong').textContent=option.label;button.querySelector('small').textContent=option.description;button.querySelector('em').textContent=option.id===current?'選択中':'選択可';button.onclick=()=>{setBodyChoice(state,kind,option.id);model.audio.item();haptic(10);renderBody(model);};list.append(button);}section.append(list);return section;
}
function renderBody(model){
  const state=model.getState();if(!state)return;ensureCombatLoadout(state);model.ui.title.textContent='体 · 構え';model.ui.body.innerHTML='';
  model.ui.body.append(renderBodyGroup(model,state,'stance','構えモーション','戦闘態勢で取る身体の形。'),renderBodyGroup(model,state,'style','心構え / 戦闘スタイル','間合い・接近・離脱・回り込みの方針を決める。'),renderBodyGroup(model,state,'zanshin','残心モーション','一撃のあと、どう次へつなぐかを決める。'));
}
function syncCombat(model,state){
  ensureCombatLoadout(state);const skill=state.combatLoadout.technique.oneMotion,ready=Boolean(state.combat&&!state.combat.training&&!state.down&&!state.ended&&skill);model.ui.oneMotion.hidden=!ready;
  if(ready){model.ui.oneMotionName.textContent=techniqueName(skill);model.ui.oneMotion.disabled=Boolean(state.combat?.oneMotionQueued||state.combat?.attackCooldown>1.15);}
}

export function createHeartTechniqueBodyUI({ui,audio,getState,tracker}){
  const model={ui,audio,getState,tracker,comboId:null,picker:null,focusSkill:null};
  ui.oneMotion.onclick=()=>{const state=getState(),skill=requestOneMotion(state);if(!skill)return;audio.combat();haptic([24,28,14]);ui.oneMotion.dataset.queued='true';setTimeout(()=>{delete ui.oneMotion.dataset.queued;},500);};
  return{renderHeart:focus=>renderHeart(model,focus),renderTechnique:focus=>renderTechnique(model,focus),renderBody:()=>renderBody(model),syncCombat:state=>syncCombat(model,state),reset(){model.comboId=null;model.picker=null;model.focusSkill=null;},dispose(){}};
}
