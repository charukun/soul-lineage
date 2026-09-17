import { SKILL_BY_ID } from './rebuild/skill-system.js';
import {
  ensureCombatLoadout,learnedHeartSkills,learnedTechniques,techniqueForSourceSkill,techniqueName,
  setTechniqueIntentSlot,setOneMotion,setBodyChoice,learnedBodySkills,bodyRuntime,requestOneMotion
} from './combat-loadout.js';

const haptic=pattern=>{try{globalThis.navigator?.vibrate?.(pattern);}catch{}};
const HEART_GLYPHS=Object.freeze({
  'skill.breath':'息','skill.observe':'観','skill.balance':'軸','skill.fall':'受','skill.focus':'集','skill.danger':'察','skill.repeat':'反','skill.distance':'間','skill.adapt':'環','skill.rhythm':'拍','skill.patience':'待','skill.care':'手','skill.step':'踏','skill.calm':'静','skill.read':'読','skill.edge':'刃','skill.trail':'追','skill.resolve':'退','skill.center':'芯','skill.soft-step':'抜','skill.peripheral':'周','skill.recovery-breath':'継','skill.grip':'握','skill.weapon-eye':'眼','skill.guard-sense':'守','skill.endure':'粘','skill.copy-form':'写','skill.flow-step':'流','skill.poise':'静','skill.tempo':'拍'
});
const EFFECT_LABELS=Object.freeze({damage:'威力',mitigation:'守り',evasion:'見切り',reach:'間合い',recovery:'回復',trainingGain:'習熟',actionSpark:'閃き',staminaCost:'消耗'});
const bodyKindLabel=Object.freeze({stance:'構え',style:'間合い',zanshin:'残心'});

function sectionHeader(text){const node=document.createElement('div');node.className='loadout-section-title';node.innerHTML='<i></i><strong></strong><i></i>';node.querySelector('strong').textContent=text;return node;}
function detailLinesForSkill(id){const row=SKILL_BY_ID[id],lines=[];for(const [key,value] of Object.entries(row?.effects||{})){if(!Number(value))continue;const label=EFFECT_LABELS[key]||key,sign=Number(value)>0?'＋':'';lines.push(`${label} ${sign}${Math.round(Number(value)*100)}%`);}return lines.length?lines:['会得済みの心得。'];}
function showDetail(model,{title,eyebrow='習得したスキル',lines=[],action=null}){
  model.ui.panel.querySelector('.loadout-detail-popover')?.remove();const node=document.createElement('aside');node.className='loadout-detail-popover';node.innerHTML='<div class="loadout-detail-card"><span></span><strong></strong><div class="loadout-detail-lines"></div><div class="loadout-detail-actions"></div><button class="loadout-detail-close" type="button">閉じる</button></div>';node.querySelector('span').textContent=eyebrow;node.querySelector('strong').textContent=title;const list=node.querySelector('.loadout-detail-lines');for(const line of lines){const p=document.createElement('p');p.textContent=line;list.append(p);}if(action){const button=document.createElement('button');button.type='button';button.className='loadout-detail-action';button.textContent=action.label;button.onclick=()=>{action.run();node.remove();};node.querySelector('.loadout-detail-actions').append(button);}node.querySelector('.loadout-detail-close').onclick=()=>node.remove();node.addEventListener('click',event=>{if(event.target===node)node.remove();});model.ui.panel.append(node);haptic(8);
}
function bindLongPress(button,run,{onTap=null}={}){let timer=0,fired=false,startX=0,startY=0;const clear=()=>{clearTimeout(timer);timer=0;};button.addEventListener('pointerdown',event=>{fired=false;startX=event.clientX;startY=event.clientY;clear();timer=setTimeout(()=>{fired=true;run();},480);});button.addEventListener('pointermove',event=>{if(Math.hypot(event.clientX-startX,event.clientY-startY)>10)clear();});button.addEventListener('pointerup',clear);button.addEventListener('pointercancel',clear);button.addEventListener('pointerleave',clear);button.addEventListener('click',event=>{if(fired){event.preventDefault();event.stopPropagation();fired=false;return;}onTap?.();});}
function card({glyph,label,badge='',badgeKind='',selected=false,highlight=false,onTap=null,onDetail}){const button=document.createElement('button');button.type='button';button.className='loadout-skill-card';button.dataset.selected=String(Boolean(selected));button.dataset.highlight=String(Boolean(highlight));button.innerHTML='<i></i><strong></strong><em></em>';button.querySelector('i').textContent=String(glyph||label||'・').slice(0,1);button.querySelector('strong').textContent=label;const badgeNode=button.querySelector('em');badgeNode.textContent=badge;if(!badge)badgeNode.hidden=true;else badgeNode.dataset.kind=badgeKind;bindLongPress(button,onDetail,{onTap});return button;}
function empty(text){const p=document.createElement('p');p.className='loadout-empty';p.textContent=text;return p;}

function renderHeart(model,focusId=null){
  const state=model.getState();if(!state)return;ensureCombatLoadout(state);model.tracker.consume('heart');model.ui.title.textContent='心';model.ui.body.innerHTML='';model.ui.body.append(sectionHeader('習得したスキル'));
  const ids=learnedHeartSkills(state),grid=document.createElement('div');grid.className='loadout-grid heart-list';
  if(!ids.length)grid.append(empty('まだ心得を習得していない。'));
  for(const id of ids){const row=SKILL_BY_ID[id];grid.append(card({glyph:HEART_GLYPHS[id]||row?.name?.slice(0,1),label:row?.name||id,highlight:id===focusId,onDetail:()=>showDetail(model,{title:row?.name||id,eyebrow:'心得',lines:detailLinesForSkill(id)})}));}
  model.ui.body.append(grid,sectionHeader('長押しで詳細'));
}

function techniqueDetail(model,state,row){const phaseLabels=['序','破','急'],lines=phaseLabels.map((phase,index)=>`${phase}　${techniqueName(row.slots[['jo','ha','kyu'][index]])}`);if(row.sourceSkill)lines.push(`閃き　${SKILL_BY_ID[row.sourceSkill]?.name||row.sourceSkill}`);showDetail(model,{title:row.name,eyebrow:'技',lines,action:row.sourceSkill?{label:'瞬に設定',run:()=>{setOneMotion(state,row.sourceSkill);model.audio.item();}}:null});}
function intentSlots(model,state,rows){const wrap=document.createElement('div');wrap.className='loadout-slot-grid technique-intent-slots';for(let index=0;index<3;index++){const id=state.combatLoadout.technique.intentSlots[index],row=rows.find(item=>item.id===id),button=document.createElement('button');button.type='button';button.className='loadout-slot-card';button.dataset.selected=String(model.techSlot===index);button.innerHTML='<span></span><i></i><strong></strong>';button.querySelector('span').textContent=`意識${['一','二','三'][index]}`;button.querySelector('i').textContent=row?.glyph||'空';button.querySelector('strong').textContent=row?.name||'未設定';button.onclick=()=>{model.techSlot=index;model.audio.ui();renderTechnique(model);};wrap.append(button);}return wrap;}
function renderTechnique(model,focusSkillId=null){
  const state=model.getState();if(!state)return;ensureCombatLoadout(state);model.tracker.consume('technique');model.ui.title.textContent='技';model.ui.body.innerHTML='';if(model.techSlot===null)model.techSlot=0;const rows=learnedTechniques(state),focusTechnique=focusSkillId?techniqueForSourceSkill(state,focusSkillId):null;
  model.ui.body.append(sectionHeader('意識スロット'),intentSlots(model,state,rows),sectionHeader('習得したスキル'));
  const grid=document.createElement('div');grid.className='loadout-grid technique-grid';if(!rows.length)grid.append(empty('まだ技を習得していない。'));
  for(const row of rows){const selected=state.combatLoadout.technique.intentSlots.includes(row.id);grid.append(card({glyph:row.glyph,label:row.name,selected,highlight:row.id===focusTechnique?.id,onTap:()=>{setTechniqueIntentSlot(state,model.techSlot,row.id);model.audio.item();haptic(14);renderTechnique(model);},onDetail:()=>techniqueDetail(model,state,row)}));}
  model.ui.body.append(grid,sectionHeader('長押しで詳細'));
}

function bodySlotRow(model,state){const runtime=bodyRuntime(state),items=[['stance','構え',runtime.stance],['style','間合い',runtime.style],['zanshin','残心',runtime.zanshin]],wrap=document.createElement('div');wrap.className='loadout-slot-grid body-selected-slots';for(const [kind,label,row] of items){const button=document.createElement('button');button.type='button';button.className='loadout-slot-card';button.dataset.selected=String(model.bodyFilter===kind);button.innerHTML='<span></span><i></i><strong></strong>';button.querySelector('span').textContent=label;button.querySelector('i').textContent=row.glyph||row.label.slice(0,1);button.querySelector('strong').textContent=row.label;button.onclick=()=>{model.bodyFilter=kind;model.audio.ui();renderBody(model);};wrap.append(button);}return wrap;}
function bodyFilters(model){const wrap=document.createElement('div');wrap.className='body-filter-tabs';for(const [id,label] of [['all','全て'],['stance','構え'],['style','間合い'],['zanshin','残心']]){const button=document.createElement('button');button.type='button';button.dataset.active=String(model.bodyFilter===id);button.textContent=label;button.onclick=()=>{model.bodyFilter=id;model.audio.ui();renderBody(model);};wrap.append(button);}return wrap;}
function renderBody(model){
  const state=model.getState();if(!state)return;ensureCombatLoadout(state);model.ui.title.textContent='体';model.ui.body.innerHTML='';if(!model.bodyFilter)model.bodyFilter='all';model.ui.body.append(bodySlotRow(model,state),bodyFilters(model),sectionHeader('習得したスキル'));
  const rows=learnedBodySkills(state,{kind:model.bodyFilter}),grid=document.createElement('div');grid.className='loadout-grid body-skill-grid';const body=state.combatLoadout.body;
  if(!rows.length)grid.append(empty('この分類の技はまだ習得していない。'));
  for(const row of rows){const selected=body[row.kind]===row.id;grid.append(card({glyph:row.glyph,label:row.label,badge:row.category,badgeKind:row.kind,selected,onTap:()=>{setBodyChoice(state,row.kind,row.id);model.audio.item();haptic(12);renderBody(model);},onDetail:()=>showDetail(model,{title:row.label,eyebrow:row.category,lines:[row.description]})}));}
  model.ui.body.append(grid,sectionHeader('長押しで詳細'));
}
function syncCombat(model,state){
  ensureCombatLoadout(state);const skill=state.combatLoadout.technique.oneMotion,ready=Boolean(state.combat&&!state.combat.training&&!state.down&&!state.ended&&skill);model.ui.oneMotion.hidden=!ready;
  if(ready){model.ui.oneMotionName.textContent=SKILL_BY_ID[skill]?.name||skill;model.ui.oneMotion.disabled=Boolean(state.combat?.oneMotionQueued||state.combat?.attackCooldown>1.15);}
}

export function createHeartTechniqueBodyUI({ui,audio,getState,tracker}){
  const model={ui,audio,getState,tracker,techSlot:null,bodyFilter:'all'};
  ui.oneMotion.onclick=()=>{const state=getState(),skill=requestOneMotion(state);if(!skill)return;audio.combat();haptic([24,28,14]);ui.oneMotion.dataset.queued='true';setTimeout(()=>{delete ui.oneMotion.dataset.queued;},500);};
  return{renderHeart:focus=>renderHeart(model,focus),renderTechnique:focus=>renderTechnique(model,focus),renderBody:()=>renderBody(model),syncCombat:state=>syncCombat(model,state),reset(){model.techSlot=null;model.bodyFilter='all';ui.panel.querySelector('.loadout-detail-popover')?.remove();},dispose(){ui.panel.querySelector('.loadout-detail-popover')?.remove();}};
}
