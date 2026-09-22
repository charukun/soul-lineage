import { SKILL_BY_ID } from './rebuild/skill-system.js';
import {
  PHASES, MAX_COMBOS, ensureCombatLoadout, learnedHeartSkills, learnedTechniqueSkills, techniqueName,
  comboById, addCombo, removeCombo, setActiveCombo, setComboSkill, toggleFavored, setHeartSlot, phaseSelectionLabel, setPhaseSelection,
  setOneMotion, setBodyChoice, unlockedBodyOptions, requestOneMotion
} from './combat-loadout.js';
import { decorateSelectionDetail } from './selection-detail.js';
import {createRinneLoadoutGridItem,createRinneLoadoutGridSection,createRinneLoadoutSlot,createRinneLoadoutSlotRow,createRinneMenuLead,rinneSkillSigilKind} from '@soul/shared-ui/rinne-loadout-menu';

const EFFECT_LABELS=Object.freeze({damage:'威力',mitigation:'守り',evasion:'見切り',reach:'間合い',recovery:'回復'});
const GRID_PAGE_SIZE=12;
const haptic=pattern=>{try{globalThis.navigator?.vibrate?.(pattern);}catch{}};

function effectSummary(id){
  const effects=SKILL_BY_ID[id]?.effects||{},labels=[];
  for(const [key,label] of Object.entries(EFFECT_LABELS))if(Number(effects[key])>0)labels.push(`${label}↑`);
  if(Number(effects.staminaCost)<0)labels.push('息持ち↑');
  else if(Number(effects.staminaCost)>0)labels.push('消耗↑');
  return labels.slice(0,2).join('・')||'戦闘判断';
}
function intro(title,copy){
  const node=document.createElement('div');
  node.className='loadout-intro';
  node.innerHTML='<strong></strong><small></small>';
  node.querySelector('strong').textContent=title;
  node.querySelector('small').textContent=copy;
  return node;
}
function pager(model,key,total,rerender){
  const pages=Math.max(1,Math.ceil(total/GRID_PAGE_SIZE)),current=Math.min(Math.max(0,model.pages[key]||0),pages-1);
  model.pages[key]=current;
  if(pages<=1)return null;
  const nav=document.createElement('nav');
  nav.className='panel-pager';
  const prev=document.createElement('button'),meta=document.createElement('span'),next=document.createElement('button');
  prev.type=next.type='button';prev.textContent='‹';next.textContent='›';prev.disabled=current<=0;next.disabled=current>=pages-1;meta.textContent=`${current+1} / ${pages}`;
  prev.onclick=()=>{model.pages[key]=current-1;model.audio.ui();rerender();};
  next.onclick=()=>{model.pages[key]=current+1;model.audio.ui();rerender();};
  nav.append(prev,meta,next);return nav;
}
function pageRows(model,key,rows,rerender){
  const pages=Math.max(1,Math.ceil(rows.length/GRID_PAGE_SIZE)),current=Math.min(Math.max(0,model.pages[key]||0),pages-1);
  model.pages[key]=current;
  return{rows:rows.slice(current*GRID_PAGE_SIZE,current*GRID_PAGE_SIZE+GRID_PAGE_SIZE),pager:pager(model,key,rows.length,rerender)};
}
function skillDetail(id,kicker,status=''){
  const row=SKILL_BY_ID[id],needs=(row?.needs||[]).join('・');
  return{kicker,title:techniqueName(id),summary:effectSummary(id),status:status||'習得済み',note:needs?`由来: ${needs}`:'この人生で身につけた技'};
}
function slot(label,value,{selected=false,empty=false,icon='empty',detail,onClick}={}){const button=createRinneLoadoutSlot({label,value,selected,empty,icon,meta:selected?'選択先':'タップして選択',onClick});if(detail)decorateSelectionDetail(button,detail);return button;}
function gridItem(label,meta,{active=false,focus=false,icon='empty',detail,onClick}={}){const button=createRinneLoadoutGridItem({label,meta,active,focus,icon,onClick});if(detail)decorateSelectionDetail(button,detail);return button;}
const gridSection=(title,copy)=>createRinneLoadoutGridSection(title,copy);
const topSlotRow=()=>createRinneLoadoutSlotRow();

function renderHeart(model,focusId=null){
  const state=model.getState();if(!state)return;ensureCombatLoadout(state);model.section='heart';model.tracker.consume('heart');model.ui.title.textContent='心 · 心得';model.ui.body.innerHTML='';
  const ids=learnedHeartSkills(state),active=state.combatLoadout.heart.active;model.heartTarget=Math.max(0,Math.min(2,model.heartTarget||0));
  const slots=topSlotRow();for(let index=0;index<3;index++){const id=active[index]||null;slots.append(slot('心得 '+(index+1),id?techniqueName(id):'空き',{selected:model.heartTarget===index,empty:!id,icon:rinneSkillSigilKind(id,SKILL_BY_ID[id]?.effects),detail:id?skillDetail(id,'心得','意識中'):null,onClick:()=>{model.heartTarget=index;model.audio.ui();renderHeart(model,focusId);}}));}model.ui.body.append(slots);
  if(focusId){const index=ids.indexOf(focusId);if(index>=0)model.pages.heart=Math.floor(index/GRID_PAGE_SIZE);}
  const library=gridSection('心得一覧','選択中の心得枠で意識する');library.classList.add('heart-learned-list');
  const list=library.querySelector('.loadout-grid'),page=pageRows(model,'heart',ids,()=>renderHeart(model,focusId));
  for(const id of page.rows){const item=gridItem(techniqueName(id),effectSummary(id),{active:active[model.heartTarget]===id,focus:id===focusId,icon:rinneSkillSigilKind(id,SKILL_BY_ID[id]?.effects),detail:skillDetail(id,'心得',active.includes(id)?'意識中':'習得済み'),onClick:()=>{setHeartSlot(state,model.heartTarget,id);model.audio.item();haptic(10);renderHeart(model,id);}});item.setAttribute('aria-label',techniqueName(id)+'。選択中の心得枠で意識する');list.append(item);}
  if(!page.rows.length){const empty=document.createElement('p');empty.className='loadout-empty';empty.textContent='まだ心得を習得していません。';list.append(empty);}model.ui.body.append(library);if(page.pager)model.ui.body.append(page.pager);
}

function renderComboList(model,state){
  const rows=state.combatLoadout.technique.combos,selection=state.combatLoadout.technique.phaseSelections?.[model.techniqueTarget],library=gridSection('連技一覧','選択中の序破急スロットへセット'),list=library.querySelector('.loadout-grid');
  for(const combo of rows){const ref='combo:'+combo.id;list.append(gridItem(combo.name,'連技',{active:selection===ref,icon:'flow',detail:{kicker:'連技',title:combo.name,summary:PHASES.map(([phase])=>techniqueName(combo.slots[phase])).join(' → '),status:selection===ref?'装着中':'習得済み'},onClick:()=>{model.comboId=combo.id;setPhaseSelection(state,model.techniqueTarget,ref);model.audio.item();haptic(8);renderTechnique(model);}}));}
  model.ui.body.append(library);const actions=document.createElement('div');actions.className='loadout-combo-actions';
  if(rows.length<MAX_COMBOS){const add=document.createElement('button');add.type='button';add.textContent='＋ 連技';add.onclick=()=>{const made=addCombo(state);if(made){model.comboId=made.id;setPhaseSelection(state,model.techniqueTarget,'combo:'+made.id);model.audio.item();haptic(12);renderTechnique(model);}};actions.append(add);}
  if(rows.length>1&&model.comboId&&rows.some(row=>row.id===model.comboId)){const remove=document.createElement('button');remove.type='button';remove.textContent='選択中を削除';remove.onclick=()=>{removeCombo(state,model.comboId);model.comboId=null;model.audio.ui();renderTechnique(model);};actions.append(remove);}
  if(actions.childElementCount)model.ui.body.append(actions);
}
function phaseSlot(model,state,phase,label){
  const selection=state.combatLoadout.technique.phaseSelections?.[phase];return slot(label,phaseSelectionLabel(state,phase),{selected:model.techniqueTarget===phase,icon:String(selection).startsWith('combo:')?'flow':rinneSkillSigilKind(selection,SKILL_BY_ID[selection]?.effects),detail:{kicker:label+'の選択枠',title:phaseSelectionLabel(state,phase),summary:String(selection).startsWith('combo:')?'連技':'基本技',status:model.techniqueTarget===phase?'選択先':'装着中'},onClick:()=>{model.techniqueTarget=phase;model.audio.ui();renderTechnique(model);}});
}
function renderTechnique(model,focusId=null){
  const state=model.getState();if(!state)return;ensureCombatLoadout(state);model.section='technique';model.tracker.consume('technique');if(focusId)model.focusSkill=focusId;
  const combos=state.combatLoadout.technique.combos;if(model.comboId&&!combos.some(row=>row.id===model.comboId))model.comboId=null;
  model.ui.title.textContent='技 · 序破急';model.ui.body.innerHTML='';
  const slots=topSlotRow();for(const [phase,label] of PHASES)slots.append(phaseSlot(model,state,phase,label));model.ui.body.append(slots);
  renderComboList(model,state);
  const ids=learnedTechniqueSkills(state,{oneMotion:model.techniqueTarget==='oneMotion'});if(focusId){const index=ids.indexOf(focusId);if(index>=0)model.pages.technique=Math.floor(index/GRID_PAGE_SIZE);}
  const library=gridSection(model.techniqueTarget==='oneMotion'?'奥義候補':'基本技一覧',model.techniqueTarget==='oneMotion'?'手動奥義として使う技を選ぶ':(PHASES.find(([id])=>id===model.techniqueTarget)?.[1]||'序')+'へ入れる技を選ぶ'),list=library.querySelector('.loadout-grid'),page=pageRows(model,'technique',ids,()=>renderTechnique(model,focusId));
  for(const id of page.rows){const current=model.techniqueTarget==='oneMotion'?state.combatLoadout.technique.oneMotion:state.combatLoadout.technique.phaseSelections?.[model.techniqueTarget]||null;list.append(gridItem(techniqueName(id),effectSummary(id),{active:id===current,focus:id===focusId,icon:rinneSkillSigilKind(id,SKILL_BY_ID[id]?.effects),detail:skillDetail(id,'戦技',id===current?'装着中':'習得済み'),onClick:()=>{if(model.techniqueTarget==='oneMotion')setOneMotion(state,id);else setPhaseSelection(state,model.techniqueTarget,id);model.audio.item();haptic(12);renderTechnique(model,id);}}));}
  model.ui.body.append(library);if(page.pager)model.ui.body.append(page.pager);
  const one=document.createElement('button');one.type='button';one.className='one-motion-card';one.dataset.active=String(model.techniqueTarget==='oneMotion');one.innerHTML='<div><span>手動奥義</span><strong></strong><small>戦闘態勢中のみ · 消耗と隙が大きい</small></div><b>選択</b>';one.querySelector('strong').textContent=state.combatLoadout.technique.oneMotion?techniqueName(state.combatLoadout.technique.oneMotion):'未設定';one.onclick=()=>{model.techniqueTarget=model.techniqueTarget==='oneMotion'?'jo':'oneMotion';model.audio.ui();renderTechnique(model);};model.ui.body.append(one);
}

function renderBody(model){
  const state=model.getState();if(!state)return;ensureCombatLoadout(state);model.section='body';model.bodyKind=model.bodyKind||'stance';model.ui.title.textContent='体 · 身法';model.ui.body.innerHTML='';
  model.ui.body.append(createRinneMenuLead('いまの身体に合う型を選ぶ'));
  const kinds=[['stance','構え','戦闘態勢の形'],['finisher','葬焉','ダウン後のトドメの型'],['zanshin','残心','決着後の戻り']],slots=topSlotRow();
  for(const [kind,label,meta] of kinds){
    const option=unlockedBodyOptions(state,kind).find(row=>row.id===state.combatLoadout.body[kind]);
    const button=slot(label,option?.label||'未設定',{selected:model.bodyKind===kind,icon:'stance',detail:{kicker:`${label}の装着枠`,title:option?.label||'未設定',summary:option?.description||meta,status:model.bodyKind===kind?'選択先':'装着中'},onClick:()=>{model.bodyKind=kind;model.pages.body=0;model.audio.ui();renderBody(model);}});
    button.querySelector('small').textContent=kind==='finisher'&&state.combatLoadout.heart.active.includes('skill.nonlethal')?'不殺の心得中 · 実行しない':(model.bodyKind===kind?'選択先':meta);slots.append(button);
  }
  model.ui.body.append(slots);
  const rows=unlockedBodyOptions(state,model.bodyKind),current=state.combatLoadout.body[model.bodyKind],library=gridSection('習得した身体技',kinds.find(([kind])=>kind===model.bodyKind)?.[2]||'選択する');
  const list=library.querySelector('.loadout-grid'),page=pageRows(model,'body',rows,()=>renderBody(model));
  for(const option of page.rows)list.append(gridItem(option.label,option.description,{active:option.id===current,icon:'stance',detail:{kicker:'身体技',title:option.label,summary:option.description,status:option.id===current?'装着中':'習得済み'},onClick:()=>{setBodyChoice(state,model.bodyKind,option.id);model.audio.item();haptic(10);renderBody(model);}}));
  model.ui.body.append(library);if(page.pager)model.ui.body.append(page.pager);
}
function syncCombat(model,state){
  ensureCombatLoadout(state);const skill=state.combatLoadout.technique.oneMotion,ready=Boolean(state.combat&&!state.combat.training&&!state.down&&!state.ended&&skill);
  model.ui.oneMotion.hidden=!ready;if(ready){model.ui.oneMotionName.textContent=techniqueName(skill);model.ui.oneMotion.disabled=Boolean(state.combat?.oneMotionQueued||state.combat?.attackCooldown>1.15);}
}

export function createHeartTechniqueBodyUI({ui,audio,getState,tracker}){
  const model={ui,audio,getState,tracker,comboId:null,focusSkill:null,section:'technique',heartTarget:0,techniqueTarget:'jo',bodyKind:'stance',pages:{heart:0,technique:0,body:0}};
  ui.oneMotion.onclick=()=>{const state=getState(),skill=requestOneMotion(state);if(!skill)return;audio.combat();haptic([24,28,14]);ui.oneMotion.dataset.queued='true';setTimeout(()=>{delete ui.oneMotion.dataset.queued;},500);};
  return{
    renderHeart:focus=>renderHeart(model,focus),
    renderTechnique:focus=>renderTechnique(model,focus),
    renderBody:()=>renderBody(model),
    syncCombat:state=>syncCombat(model,state),
    reset(){model.comboId=null;model.focusSkill=null;model.section='technique';model.heartTarget=0;model.techniqueTarget='jo';model.bodyKind='stance';model.pages={heart:0,technique:0,body:0};},
    dispose(){}
  };
}
