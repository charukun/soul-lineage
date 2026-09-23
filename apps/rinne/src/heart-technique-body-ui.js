import { SKILL_BY_ID, skillDefinition } from './rebuild/skill-system.js';
import {
  PHASES, MAX_COMBOS, HEART_SLOT_COUNT, ensureCombatLoadout, learnedHeartSkills, learnedTechniqueSkills, techniqueName,
  comboById, addCombo, removeCombo, setActiveCombo, setComboSkill, toggleFavored, setHeartSlot, phaseSelectionLabel, setPhaseSelection,
  setOneMotion, setBodyChoice, unlockedBodyOptions, requestOneMotion
} from './combat-loadout.js';
import { decorateSelectionDetail } from './selection-detail.js';
import {createRinneHeartComposition,createRinneLoadoutDetail,createRinneLoadoutGridItem,createRinneLoadoutGridSection,createRinneLoadoutSlot,createRinneLoadoutSlotRow,createRinneMenuLead,createRinneSwapHint,rinneSkillSigilKind,drawRinneTechniqueSelectionLink} from '@soul/shared-ui/rinne-loadout-menu';

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
function slot(label,value,{selected=false,empty=false,icon='empty',detail,onClick,onLongPress,swapMode=false,swapSource=false}={}){const button=createRinneLoadoutSlot({label,value,selected,empty,icon,meta:selected?'選択先':'タップして選択',onClick,onLongPress,swapMode,swapSource});if(detail)decorateSelectionDetail(button,detail);return button;}
function gridItem(label,meta,{active=false,focus=false,icon='empty',detail,onClick}={}){const button=createRinneLoadoutGridItem({label,meta,active,focus,icon,onClick});if(detail)decorateSelectionDetail(button,detail);return button;}
const gridSection=(title,copy)=>createRinneLoadoutGridSection(title,copy);
const topSlotRow=(swapMode,layout='')=>createRinneLoadoutSlotRow({swapMode,layout});
const detailSection=({icon,kicker,title,summary,status,note='',actionLabel,actionDisabled=false,onAction})=>createRinneLoadoutDetail({icon,kicker,title,summary,status,note,actionLabel,actionDisabled,onAction});
function techniqueDetail(state,selection,status='習得済み'){
  if(String(selection||'').startsWith('combo:')){
    const combo=comboById(state,String(selection).slice(6));
    return{icon:'flow',kicker:'連技',title:combo?.name||'連技',summary:combo?PHASES.map(([phase])=>techniqueName(combo.slots[phase])).join(' → '):'連技',status};
  }
  const row=skillDetail(selection,'戦技',status),definition=skillDefinition(selection);
  const motions=(definition?.steps||[]).map(step=>step?.kind).filter(Boolean).join(' → ');
  const explanation=[
    definition?.mechanic||'',
    motions?`動作: ${motions}`:'',
    definition?.tradeoff?`注意: ${definition.tradeoff}`:''
  ].filter(Boolean).join(' ');
  return{...row,summary:explanation||row.summary,icon:rinneSkillSigilKind(selection,SKILL_BY_ID[selection]?.effects)};
}
function clearSwap(model){model.swap=null;}

function renderHeart(model,focusId=null){
  const state=model.getState();if(!state)return;ensureCombatLoadout(state);model.section='heart';model.tracker.consume('heart');model.ui.title.textContent='心 · 心得';model.ui.body.innerHTML='';
  const ids=learnedHeartSkills(state),active=state.combatLoadout.heart.active,heartSlots=state.combatLoadout.heart.slots;model.heartTarget=Math.max(0,Math.min(HEART_SLOT_COUNT-1,model.heartTarget||0));if(focusId)model.heartPreview=focusId;if(!model.heartPreview)model.heartPreview=heartSlots[model.heartTarget]||ids[0]||null;
  const swapActive=model.swap?.section==='heart',slots=topSlotRow(swapActive,'pentagon');
  for(let index=0;index<HEART_SLOT_COUNT;index++){const id=heartSlots[index]||null;slots.append(slot('心得 '+(index+1),id?techniqueName(id):'空き',{selected:model.heartTarget===index,empty:!id,icon:rinneSkillSigilKind(id,SKILL_BY_ID[id]?.effects),swapMode:swapActive,swapSource:swapActive&&model.swap.source===index,detail:id?skillDetail(id,'心得','意識中'):null,onClick:()=>{if(swapActive){const source=model.swap.source,sourceId=heartSlots[source];if(source!==index&&sourceId)setHeartSlot(state,index,sourceId);clearSwap(model);model.heartTarget=index;model.audio.item();haptic(18);renderHeart(model,model.heartPreview);return;}model.heartTarget=index;model.heartPreview=id||model.heartPreview;model.audio.ui();renderHeart(model,model.heartPreview);},onLongPress:id?()=>{model.swap={section:'heart',source:index};model.audio.ui();haptic([18]);renderHeart(model,model.heartPreview);}:null}));}
  model.ui.body.append(createRinneHeartComposition(slots,heartSlots,id=>techniqueName(id)));if(swapActive)model.ui.body.append(createRinneSwapHint('入れ替える心得枠を選択'));
  const preview=model.heartPreview;if(preview){const current=heartSlots[model.heartTarget]===preview,row=skillDetail(preview,'心得',active.includes(preview)?'意識中':'習得済み');model.ui.body.append(detailSection({icon:rinneSkillSigilKind(preview,SKILL_BY_ID[preview]?.effects),...row,actionLabel:current?'設定済み':`心得${model.heartTarget+1}にセット`,actionDisabled:current,onAction:()=>{setHeartSlot(state,model.heartTarget,preview);model.audio.item();haptic(12);renderHeart(model,preview);}}));}
  if(preview){const index=ids.indexOf(preview);if(index>=0)model.pages.heart=Math.floor(index/GRID_PAGE_SIZE);}
  const library=gridSection('心得一覧','候補を選ぶと詳細を表示');library.classList.add('heart-learned-list');const list=library.querySelector('.loadout-grid'),page=pageRows(model,'heart',ids,()=>renderHeart(model,model.heartPreview));
  for(const id of page.rows){const item=gridItem(techniqueName(id),effectSummary(id),{active:heartSlots[model.heartTarget]===id,focus:id===preview,icon:rinneSkillSigilKind(id,SKILL_BY_ID[id]?.effects),detail:skillDetail(id,'心得',active.includes(id)?'意識中':'習得済み'),onClick:()=>{model.heartPreview=id;model.audio.ui();renderHeart(model,id);}});item.setAttribute('aria-label',techniqueName(id)+'。詳細を表示');list.append(item);}
  if(!page.rows.length){const empty=document.createElement('p');empty.className='loadout-empty';empty.textContent='まだ心得を習得していません。';list.append(empty);}model.ui.body.append(library);if(page.pager)model.ui.body.append(page.pager);
}

function renderComboList(model,state){
  if(model.techniqueTarget==='oneMotion')return;
  const rows=state.combatLoadout.technique.combos,selection=state.combatLoadout.technique.phaseSelections?.[model.techniqueTarget],library=gridSection('連技一覧','候補を選ぶと詳細を表示');library.classList.add('loadout-combo-grid');const list=library.querySelector('.loadout-grid');
  for(const combo of rows){const ref='combo:'+combo.id;list.append(gridItem(combo.name,'連技',{active:selection===ref,focus:model.techniquePreview===ref,icon:'flow',detail:{kicker:'連技',title:combo.name,summary:PHASES.map(([phase])=>techniqueName(combo.slots[phase])).join(' → '),status:selection===ref?'装着中':'習得済み'},onClick:()=>{model.comboId=combo.id;model.techniquePreview=ref;model.audio.ui();renderTechnique(model);}}));}
  model.ui.body.append(library);const actions=document.createElement('div');actions.className='loadout-combo-actions';
  if(rows.length<MAX_COMBOS){const add=document.createElement('button');add.type='button';add.textContent='＋ 連技';add.onclick=()=>{const made=addCombo(state);if(made){model.comboId=made.id;model.techniquePreview='combo:'+made.id;model.audio.item();haptic(12);renderTechnique(model);}};actions.append(add);}
  if(rows.length>1&&model.comboId&&rows.some(row=>row.id===model.comboId)){const remove=document.createElement('button');remove.type='button';remove.textContent='選択中を削除';remove.onclick=()=>{const removed='combo:'+model.comboId;removeCombo(state,model.comboId);model.comboId=null;if(model.techniquePreview===removed)model.techniquePreview=state.combatLoadout.technique.phaseSelections?.[model.techniqueTarget]||null;model.audio.ui();renderTechnique(model);};actions.append(remove);}
  if(actions.childElementCount)model.ui.body.append(actions);
}
function phaseSlot(model,state,phase,label){
  const selection=state.combatLoadout.technique.phaseSelections?.[phase],swapActive=model.swap?.section==='technique';
  return slot(label,phaseSelectionLabel(state,phase),{selected:model.techniqueTarget===phase,icon:String(selection).startsWith('combo:')?'flow':rinneSkillSigilKind(selection,SKILL_BY_ID[selection]?.effects),swapMode:swapActive,swapSource:swapActive&&model.swap.source===phase,detail:{kicker:label+'の選択枠',title:phaseSelectionLabel(state,phase),summary:String(selection).startsWith('combo:')?'連技':'基本技',status:model.techniqueTarget===phase?'選択先':'装着中'},onClick:()=>{if(swapActive){const source=model.swap.source,sourceSelection=state.combatLoadout.technique.phaseSelections?.[source];if(source!==phase&&sourceSelection){setPhaseSelection(state,source,selection);setPhaseSelection(state,phase,sourceSelection);}clearSwap(model);model.techniqueTarget=phase;model.techniquePreview=state.combatLoadout.technique.phaseSelections?.[phase]||selection;model.audio.item();haptic(18);renderTechnique(model);return;}model.techniqueTarget=phase;model.techniquePreview=selection;model.audio.ui();renderTechnique(model);},onLongPress:()=>{model.swap={section:'technique',source:phase};model.audio.ui();haptic([18]);renderTechnique(model);}});
}

function renderTechnique(model,focusId=null){
  const state=model.getState();if(!state)return;ensureCombatLoadout(state);model.section='technique';model.tracker.consume('technique');if(focusId){model.focusSkill=focusId;model.techniquePreview=focusId;}const combos=state.combatLoadout.technique.combos;if(model.comboId&&!combos.some(row=>row.id===model.comboId))model.comboId=null;
  model.ui.title.textContent='技 · 序破急';model.ui.body.innerHTML='';const swapActive=model.swap?.section==='technique',slots=topSlotRow(swapActive);for(const [phase,label] of PHASES)slots.append(phaseSlot(model,state,phase,label));model.ui.body.append(slots);if(swapActive)model.ui.body.append(createRinneSwapHint('入れ替える序破急枠を選択'));
  const current=model.techniqueTarget==='oneMotion'?state.combatLoadout.technique.oneMotion:state.combatLoadout.technique.phaseSelections?.[model.techniqueTarget]||null;if(!model.techniquePreview)model.techniquePreview=current;const preview=model.techniquePreview,previewIsCombo=String(preview||'').startsWith('combo:'),invalidOneMotion=model.techniqueTarget==='oneMotion'&&previewIsCombo;
  if(preview){const detail=techniqueDetail(state,preview,current===preview?'装着中':'習得済み'),phaseLabel=PHASES.find(([id])=>id===model.techniqueTarget)?.[1]||'奥義';model.ui.body.append(detailSection({...detail,actionLabel:invalidOneMotion?'奥義は基本技のみ':current===preview?'設定済み':`${phaseLabel}にセット`,actionDisabled:invalidOneMotion||current===preview,onAction:()=>{if(model.techniqueTarget==='oneMotion')setOneMotion(state,preview);else setPhaseSelection(state,model.techniqueTarget,preview);model.audio.item();haptic(12);renderTechnique(model,preview);}}));}
  renderComboList(model,state);const ids=learnedTechniqueSkills(state,{oneMotion:model.techniqueTarget==='oneMotion'});if(preview&&!previewIsCombo){const index=ids.indexOf(preview);if(index>=0)model.pages.technique=Math.floor(index/GRID_PAGE_SIZE);}const library=gridSection(model.techniqueTarget==='oneMotion'?'奥義候補':'基本技一覧','候補を選ぶと詳細を表示'),list=library.querySelector('.loadout-grid'),page=pageRows(model,'technique',ids,()=>renderTechnique(model));
  for(const id of page.rows){list.append(gridItem(techniqueName(id),effectSummary(id),{active:id===current,focus:id===preview,icon:rinneSkillSigilKind(id,SKILL_BY_ID[id]?.effects),detail:skillDetail(id,'戦技',id===current?'装着中':'習得済み'),onClick:()=>{model.techniquePreview=id;model.audio.ui();renderTechnique(model,id);}}));}model.ui.body.append(library);if(page.pager)model.ui.body.append(page.pager);
  const one=document.createElement('button');one.type='button';one.className='one-motion-card';one.dataset.active=String(model.techniqueTarget==='oneMotion');one.innerHTML='<div><span>手動奥義</span><strong></strong><small>戦闘態勢中のみ · 消耗と隙が大きい</small></div><b>選択</b>';one.querySelector('strong').textContent=state.combatLoadout.technique.oneMotion?techniqueName(state.combatLoadout.technique.oneMotion):'未設定';one.onclick=()=>{model.techniqueTarget=model.techniqueTarget==='oneMotion'?'jo':'oneMotion';clearSwap(model);model.techniquePreview=model.techniqueTarget==='oneMotion'?state.combatLoadout.technique.oneMotion:state.combatLoadout.technique.phaseSelections?.jo||null;model.audio.ui();renderTechnique(model);};model.ui.body.append(one);
  globalThis.requestAnimationFrame?.(()=>drawRinneTechniqueSelectionLink(model.ui.body));
}
function renderBody(model){
  const state=model.getState();if(!state)return;ensureCombatLoadout(state);model.section='body';model.bodyKind=model.bodyKind||'stance';model.ui.title.textContent='体 · 身法';model.ui.body.innerHTML='';model.ui.body.append(createRinneMenuLead('いまの身体に合う型を選ぶ'));const kinds=[['stance','構え','戦闘態勢の形'],['finisher','葬焉','ダウン後のトドメの型'],['zanshin','残心','決着後の戻り']],slots=topSlotRow(false);
  for(const [kind,label,meta] of kinds){const option=unlockedBodyOptions(state,kind).find(row=>row.id===state.combatLoadout.body[kind]);slots.append(slot(label,option?.label||'未設定',{selected:model.bodyKind===kind,icon:'stance',detail:{kicker:`${label}の装着枠`,title:option?.label||'未設定',summary:option?.description||meta,status:kind==='finisher'&&state.combatLoadout.heart.active.includes('skill.nonlethal')?'不殺の心得中 · 実行しない':(model.bodyKind===kind?'選択先':'装着中')},onClick:()=>{model.bodyKind=kind;model.bodyPreview=state.combatLoadout.body[kind]||null;model.pages.body=0;model.audio.ui();renderBody(model);}}));}model.ui.body.append(slots);
  const rows=unlockedBodyOptions(state,model.bodyKind),current=state.combatLoadout.body[model.bodyKind];if(!model.bodyPreview||!rows.some(row=>row.id===model.bodyPreview))model.bodyPreview=current||rows[0]?.id||null;const previewRow=rows.find(row=>row.id===model.bodyPreview);
  if(previewRow)model.ui.body.append(detailSection({icon:'stance',kicker:previewRow.familyMotion?'家伝の身体技':'身体技',title:previewRow.label,summary:previewRow.description,status:previewRow.id===current?'装着中':previewRow.familyMotion?'一族に継承済み':'習得済み',actionLabel:previewRow.id===current?'設定済み':`${kinds.find(([kind])=>kind===model.bodyKind)?.[1]||'身法'}にセット`,actionDisabled:previewRow.id===current,onAction:()=>{setBodyChoice(state,model.bodyKind,previewRow.id);model.audio.item();haptic(10);renderBody(model);}}));
  const library=gridSection('習得した身体技','候補を選ぶと詳細を表示'),list=library.querySelector('.loadout-grid'),page=pageRows(model,'body',rows,()=>renderBody(model));for(const option of page.rows)list.append(gridItem(option.label,option.description,{active:option.id===current,focus:option.id===model.bodyPreview,icon:'stance',detail:{kicker:'身体技',title:option.label,summary:option.description,status:option.id===current?'装着中':'習得済み'},onClick:()=>{model.bodyPreview=option.id;model.audio.ui();renderBody(model);}}));model.ui.body.append(library);if(page.pager)model.ui.body.append(page.pager);
}
function syncCombat(model,state){
  ensureCombatLoadout(state);const skill=state.combatLoadout.technique.oneMotion,ready=Boolean(state.combat&&!state.combat.training&&!state.down&&!state.ended&&skill);
  model.ui.oneMotion.hidden=!ready;if(ready){model.ui.oneMotionName.textContent=techniqueName(skill);model.ui.oneMotion.disabled=Boolean(state.combat?.oneMotionQueued||state.combat?.attackCooldown>1.15);}
}

export function createHeartTechniqueBodyUI({ui,audio,getState,tracker}){
  const model={ui,audio,getState,tracker,comboId:null,focusSkill:null,section:'technique',heartTarget:0,heartPreview:null,techniqueTarget:'jo',techniquePreview:null,bodyKind:'stance',bodyPreview:null,swap:null,pages:{heart:0,technique:0,body:0}};
  ui.oneMotion.onclick=()=>{const state=getState(),skill=requestOneMotion(state);if(!skill)return;audio.combat();haptic([24,28,14]);ui.oneMotion.dataset.queued='true';setTimeout(()=>{delete ui.oneMotion.dataset.queued;},500);};
  return{
    renderHeart:focus=>renderHeart(model,focus),
    renderTechnique:focus=>renderTechnique(model,focus),
    renderBody:()=>renderBody(model),
    syncCombat:state=>syncCombat(model,state),
    reset(){model.comboId=null;model.focusSkill=null;model.section='technique';model.heartTarget=0;model.heartPreview=null;model.techniqueTarget='jo';model.techniquePreview=null;model.bodyKind='stance';model.bodyPreview=null;model.swap=null;model.pages={heart:0,technique:0,body:0};},
    dispose(){}
  };
}
