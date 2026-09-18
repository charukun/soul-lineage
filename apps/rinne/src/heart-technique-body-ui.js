import { SKILL_BY_ID } from './rebuild/skill-system.js';
import {
  PHASES, MAX_COMBOS, HEART_SLOT_COUNT, ensureCombatLoadout, learnedHeartSkills, learnedTechniqueSkills, techniqueName,
  comboById, setHeartSlot, addCombo, removeCombo, setActiveCombo, setComboSkill, toggleFavored,
  setOneMotion, setBodyChoice, unlockedBodyOptions, requestOneMotion
} from './combat-loadout.js';

const EFFECT_LABELS=Object.freeze({damage:'威力',mitigation:'守り',evasion:'見切り',reach:'間合い',recovery:'回復'});
const GRID_PAGE_SIZE=10;
const haptic=pattern=>{try{globalThis.navigator?.vibrate?.(pattern);}catch{}};

const SIGIL_PATHS=Object.freeze({
  breath:'<path d="M5 10c3-4 7-4 10-1M4 14c4-3 9-2 12 0M7 18c3-2 6-1 8 0"/>',
  eye:'<path d="M3 12c4-6 14-6 18 0-4 6-14 6-18 0Z"/><circle cx="12" cy="12" r="2.2"/>',
  guard:'<path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z"/><path d="M8.5 12h7"/>',
  step:'<path d="M7 18c2-1 3-3 4-6l2-6c.7-2 3-1.5 3 .5 0 3-1 6-2 8 2 0 4 .5 5 1.5-3 3-7 4-12 2Z"/>',
  focus:'<circle cx="12" cy="12" r="3"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
  blade:'<path d="M5 19 18 5l1-2 2 2-2 1L6 20 5 19Z"/><path d="m8 16 2 2M6 20l-2 1 1-2"/>',
  flow:'<path d="M6 8c2-3 7-4 10-2 2 1 3 3 3 5M18 16c-2 3-7 4-10 2-2-1-3-3-3-5"/><path d="m16 5 3 1-1 3M8 19l-3-1 1-3"/>',
  heal:'<path d="M12 20v-7M12 13c-4 0-6-2-6-6 4 0 6 2 6 6ZM12 16c4 0 6-2 6-6-4 0-6 2-6 6Z"/>',
  stance:'<circle cx="12" cy="6" r="2"/><path d="M12 8v5M7 11l5 2 5-2M9 20l3-7 3 7"/>',
  empty:'<path d="M7 12h10M12 7v10"/>'
});
function sigilKind(id,effects={}){
  const key=String(id||'');
  if(/breath|calm|recovery/.test(key))return'breath';
  if(/observe|read|danger|peripheral|weapon-eye/.test(key))return'eye';
  if(/guard|balance|fall|endure|resolve/.test(key))return'guard';
  if(/step|trail|distance|lunge|slip|circle/.test(key))return'step';
  if(/focus|center|precision|tempo|poise/.test(key))return'focus';
  if(/edge|grip|counter|finish|crash|draw|basic\.(sword|dagger|great|spear|axe)/.test(key))return'blade';
  if(/flow|rhythm|repeat|adapt|copy-form/.test(key))return'flow';
  if(/care|heal/.test(key)||Number(effects.recovery)>0)return'heal';
  if(key)return Number(effects.damage)>Number(effects.mitigation)?'blade':Number(effects.evasion)>0?'step':'flow';
  return'empty';
}
function sigilMarkup(kind='empty'){
  const safe=SIGIL_PATHS[kind]?kind:'empty';
  return `<i class="skill-sigil" data-sigil="${safe}" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${SIGIL_PATHS[safe]}</svg></i>`;
}

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
function slot(label,value,{selected=false,empty=false,icon='empty',onClick}={}){
  const button=document.createElement('button');button.type='button';button.className='loadout-slot';button.dataset.selected=String(selected);button.dataset.empty=String(empty);
  button.innerHTML=sigilMarkup(icon)+'<span></span><strong></strong><small></small>';button.querySelector('span').textContent=label;button.querySelector('strong').textContent=value||'空き';button.querySelector('small').textContent=selected?'選択先':'タップして選択';
  button.onclick=onClick;return button;
}
function gridItem(label,meta,{active=false,selected=false,icon='empty',onClick}={}){
  const button=document.createElement('button');button.type='button';button.className='loadout-grid-item';button.dataset.active=String(active);button.dataset.selected=String(selected);
  button.innerHTML=sigilMarkup(icon)+'<strong></strong><small></small>';button.querySelector('strong').textContent=label;button.querySelector('small').textContent=meta||'選択可';button.onclick=onClick;return button;
}
function gridSection(title,copy){
  const section=document.createElement('section');section.className='loadout-library';section.innerHTML='<header><strong></strong><small></small></header><div class="loadout-grid"></div>';
  section.querySelector('header strong').textContent=title;section.querySelector('header small').textContent=copy;return section;
}
function topSlotRow(){const section=document.createElement('section');section.className='loadout-slot-row';return section;}

function renderHeart(model,focusId=null){
  const state=model.getState();if(!state)return;ensureCombatLoadout(state);model.section='heart';model.tracker.consume('heart');model.ui.title.textContent='心 · 心得';model.ui.body.innerHTML='';
  const ids=learnedHeartSkills(state),active=[...state.combatLoadout.heart.active].slice(0,HEART_SLOT_COUNT);
  if(focusId){const index=ids.indexOf(focusId);if(index>=0)model.pages.heart=Math.floor(index/GRID_PAGE_SIZE);}
  model.ui.body.append(intro('心を三つまで携える','上段の三枠が戦闘へ持ち込む心得。下段はこの人生で使える心得の一覧。'));
  const slots=topSlotRow();
  for(let i=0;i<HEART_SLOT_COUNT;i++){
    const id=active[i]||null;
    slots.append(slot(`心${i+1}`,id?techniqueName(id):'空き',{selected:model.heartSlot===i,empty:!id,icon:sigilKind(id,SKILL_BY_ID[id]?.effects),onClick:()=>{model.heartSlot=i;model.audio.ui();renderHeart(model);}}));
  }
  model.ui.body.append(slots);
  const library=gridSection('習得した心得','選んだ上段スロットへ入れ替える');
  const list=library.querySelector('.loadout-grid'),page=pageRows(model,'heart',ids,()=>renderHeart(model,focusId));
  for(const id of page.rows){
    const index=active.indexOf(id);
    list.append(gridItem(techniqueName(id),effectSummary(id),{
      active:index>=0,selected:index===model.heartSlot,
      onClick:()=>{setHeartSlot(state,model.heartSlot,id);model.audio.item();haptic(10);renderHeart(model,id);}
    }));
  }
  if(!page.rows.length){const empty=document.createElement('p');empty.className='loadout-empty';empty.textContent='現在使える心得はありません。';list.append(empty);}
  model.ui.body.append(library);if(page.pager)model.ui.body.append(page.pager);
}

function renderComboContext(model,state,combo){
  const rows=state.combatLoadout.technique.combos,index=Math.max(0,rows.findIndex(row=>row.id===combo.id)),bar=document.createElement('nav');bar.className='loadout-context-bar';bar.setAttribute('aria-label','連技セット');
  const prev=document.createElement('button'),current=document.createElement('button'),next=document.createElement('button');prev.type=current.type=next.type='button';prev.textContent='‹';next.textContent='›';current.className='loadout-context-current';current.innerHTML='<strong></strong><small></small>';current.querySelector('strong').textContent=combo.name;current.querySelector('small').textContent=combo.id===state.combatLoadout.technique.activeComboId?'主軸':'予備';
  prev.disabled=next.disabled=rows.length<=1;prev.onclick=()=>{model.comboId=rows[(index-1+rows.length)%rows.length].id;model.audio.ui();renderTechnique(model);};next.onclick=()=>{model.comboId=rows[(index+1)%rows.length].id;model.audio.ui();renderTechnique(model);};
  bar.append(prev,current,next);
  if(rows.length<MAX_COMBOS){const add=document.createElement('button');add.type='button';add.textContent='＋';add.setAttribute('aria-label','連技を追加');add.onclick=()=>{const made=addCombo(state);if(made){model.comboId=made.id;model.audio.item();haptic(12);renderTechnique(model);}};bar.append(add);}
  const main=document.createElement('button');main.type='button';main.textContent=combo.id===state.combatLoadout.technique.activeComboId?'主軸中':'主軸';main.dataset.active=String(combo.id===state.combatLoadout.technique.activeComboId);main.onclick=()=>{setActiveCombo(state,combo.id);model.audio.item();renderTechnique(model);};bar.append(main);
  if(rows.length>1){const remove=document.createElement('button');remove.type='button';remove.textContent='−';remove.setAttribute('aria-label','この連技を削除');remove.onclick=()=>{removeCombo(state,combo.id);model.comboId=state.combatLoadout.technique.activeComboId;model.audio.ui();renderTechnique(model);};bar.append(remove);}
  return bar;
}
function phaseSlot(model,state,combo,phase,label){
  const cell=document.createElement('div');cell.className='loadout-slot-cell';cell.dataset.selected=String(model.techniqueTarget===phase);
  const activeId=combo.slots[phase];const button=slot(label,techniqueName(activeId),{selected:model.techniqueTarget===phase,icon:sigilKind(activeId,SKILL_BY_ID[activeId]?.effects),onClick:()=>{model.techniqueTarget=phase;model.audio.ui();renderTechnique(model);}});
  const favored=document.createElement('button');favored.type='button';favored.className='slot-favorite';favored.dataset.active=String(Boolean(combo.favored?.[phase]));favored.textContent=combo.favored?.[phase]?'得意技':'得意技にする';favored.onclick=()=>{toggleFavored(state,combo.id,phase);model.audio.ui();haptic(8);renderTechnique(model);};
  cell.append(button,favored);return cell;
}
function renderTechnique(model,focusId=null){
  const state=model.getState();if(!state)return;ensureCombatLoadout(state);model.section='technique';model.tracker.consume('technique');if(focusId)model.focusSkill=focusId;
  const combos=state.combatLoadout.technique.combos;if(!model.comboId||!combos.some(row=>row.id===model.comboId))model.comboId=state.combatLoadout.technique.activeComboId;const combo=comboById(state,model.comboId);
  model.ui.title.textContent='技 · 序破急';model.ui.body.innerHTML='';
  model.ui.body.append(intro('三手で連技を組む','上段の序・破・急から編集先を選び、下段の技一覧から差し替える。'),renderComboContext(model,state,combo));
  const slots=topSlotRow();for(const [phase,label] of PHASES)slots.append(phaseSlot(model,state,combo,phase,label));model.ui.body.append(slots);
  const one=document.createElement('button');one.type='button';one.className='one-motion-card';one.dataset.active=String(model.techniqueTarget==='oneMotion');one.innerHTML='<div><span>手動奥義</span><strong></strong><small>戦闘態勢中のみ · 消耗と隙が大きい</small></div><b>選択</b>';one.querySelector('strong').textContent=state.combatLoadout.technique.oneMotion?techniqueName(state.combatLoadout.technique.oneMotion):'未設定';one.onclick=()=>{model.techniqueTarget='oneMotion';model.audio.ui();renderTechnique(model);};
  const ids=learnedTechniqueSkills(state,{oneMotion:model.techniqueTarget==='oneMotion'});
  if(focusId){const index=ids.indexOf(focusId);if(index>=0)model.pages.technique=Math.floor(index/GRID_PAGE_SIZE);}
  const library=gridSection('習得した技',model.techniqueTarget==='oneMotion'?'手動奥義として使う技を選ぶ':`${PHASES.find(([id])=>id===model.techniqueTarget)?.[1]||'序'}へ入れる技を選ぶ`);
  const list=library.querySelector('.loadout-grid'),page=pageRows(model,'technique',ids,()=>renderTechnique(model,focusId));
  for(const id of page.rows){
    const current=model.techniqueTarget==='oneMotion'?state.combatLoadout.technique.oneMotion:combo.slots[model.techniqueTarget]||null;
    list.append(gridItem(techniqueName(id),effectSummary(id),{active:id===current,selected:id===focusId,icon:sigilKind(id,SKILL_BY_ID[id]?.effects),onClick:()=>{if(model.techniqueTarget==='oneMotion')setOneMotion(state,id);else setComboSkill(state,combo.id,model.techniqueTarget,id);model.audio.item();haptic(12);renderTechnique(model,id);}}));
  }
  model.ui.body.append(library);if(page.pager)model.ui.body.append(page.pager);model.ui.body.append(one);
}
function renderBody(model){
  const state=model.getState();if(!state)return;ensureCombatLoadout(state);model.section='body';model.bodyKind=model.bodyKind||'stance';model.ui.title.textContent='体 · 身法';model.ui.body.innerHTML='';
  model.ui.body.append(intro('身体の三要素','構え・戦法・残心を上段で選び、下段から身につけた型へ差し替える。'));
  const kinds=[['stance','構え','戦闘態勢の形'],['style','戦法','間合いと動き'],['zanshin','残心','攻撃後の戻り']],slots=topSlotRow();
  for(const [kind,label,meta] of kinds){
    const option=unlockedBodyOptions(state,kind).find(row=>row.id===state.combatLoadout.body[kind]);
    const button=slot(label,option?.label||'未設定',{selected:model.bodyKind===kind,icon:'stance',onClick:()=>{model.bodyKind=kind;model.pages.body=0;model.audio.ui();renderBody(model);}});
    button.querySelector('small').textContent=model.bodyKind===kind?'選択先':meta;slots.append(button);
  }
  model.ui.body.append(slots);
  const rows=unlockedBodyOptions(state,model.bodyKind),current=state.combatLoadout.body[model.bodyKind],library=gridSection('習得した身体技',kinds.find(([kind])=>kind===model.bodyKind)?.[2]||'選択する');
  const list=library.querySelector('.loadout-grid'),page=pageRows(model,'body',rows,()=>renderBody(model));
  for(const option of page.rows)list.append(gridItem(option.label,option.description,{active:option.id===current,icon:'stance',onClick:()=>{setBodyChoice(state,model.bodyKind,option.id);model.audio.item();haptic(10);renderBody(model);}}));
  model.ui.body.append(library);if(page.pager)model.ui.body.append(page.pager);
}
function syncCombat(model,state){
  ensureCombatLoadout(state);const skill=state.combatLoadout.technique.oneMotion,ready=Boolean(state.combat&&!state.combat.training&&!state.down&&!state.ended&&skill);
  model.ui.oneMotion.hidden=!ready;if(ready){model.ui.oneMotionName.textContent=techniqueName(skill);model.ui.oneMotion.disabled=Boolean(state.combat?.oneMotionQueued||state.combat?.attackCooldown>1.15);}
}

export function createHeartTechniqueBodyUI({ui,audio,getState,tracker}){
  const model={ui,audio,getState,tracker,comboId:null,focusSkill:null,section:'technique',heartSlot:0,techniqueTarget:'jo',bodyKind:'stance',pages:{heart:0,technique:0,body:0}};
  ui.oneMotion.onclick=()=>{const state=getState(),skill=requestOneMotion(state);if(!skill)return;audio.combat();haptic([24,28,14]);ui.oneMotion.dataset.queued='true';setTimeout(()=>{delete ui.oneMotion.dataset.queued;},500);};
  return{
    renderHeart:focus=>renderHeart(model,focus),
    renderTechnique:focus=>renderTechnique(model,focus),
    renderBody:()=>renderBody(model),
    syncCombat:state=>syncCombat(model,state),
    reset(){model.comboId=null;model.focusSkill=null;model.section='technique';model.heartSlot=0;model.techniqueTarget='jo';model.bodyKind='stance';model.pages={heart:0,technique:0,body:0};},
    dispose(){}
  };
}
