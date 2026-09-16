import { ensureProgression } from './gameplay-world.js';
import { SKILL_BY_ID } from './rebuild/skill-system.js';

const PHASES=Object.freeze([['jo','序'],['ha','破'],['kyu','急']]);
const BASIC_BY_WEAPON=Object.freeze({fist:'basic.fist',sword:'basic.sword',dagger:'basic.dagger',great:'basic.great',spear:'basic.spear',axe:'basic.axe',staff:'basic.staff'});
const BASIC_LABELS=Object.freeze({
  'basic.fist':'徒手の型','basic.sword':'剣の型','basic.dagger':'短剣の型','basic.great':'大剣の型',
  'basic.spear':'槍の型','basic.axe':'戦斧の型','basic.staff':'杖の型'
});
const EFFECT_LABELS=Object.freeze({damage:'威力',mitigation:'守り',evasion:'見切り',reach:'間合い',recovery:'回復',trainingGain:'習熟',actionSpark:'閃き'});
const haptic=pattern=>{try{globalThis.navigator?.vibrate?.(pattern);}catch{}};

function skillMeta(id){
  const row=SKILL_BY_ID[id];
  if(row)return{id,name:row.name,type:row.type==='action'?'技':'心得',effects:row.effects||{}};
  return{id,name:BASIC_LABELS[id]||id,type:'型',effects:{}};
}
function effectSummary(id){
  const labels=[],effects=skillMeta(id).effects;
  for(const [key,label] of Object.entries(EFFECT_LABELS))if(Number(effects[key])>0)labels.push(`${label}↑`);
  if(Number(effects.staminaCost)<0)labels.push('息持ち↑');else if(Number(effects.staminaCost)>0)labels.push('消耗↑');
  return labels.slice(0,3).join('・')||'基礎の型';
}
function currentPhaseSkill(model,phase){
  const state=model.getState(),entries=Object.entries(state?.skillWeights?.[phase]||{}).filter(([,weight])=>Number(weight)>0).sort((a,b)=>Number(b[1])-Number(a[1]));
  return entries[0]?.[0]||BASIC_BY_WEAPON[state?.equipment?.weapon]||'basic.fist';
}
function phasesForSkill(model,id){return PHASES.filter(([phase])=>currentPhaseSkill(model,phase)===id).map(([,label])=>label);}
function updateBadge(model){
  const count=model.unseen.size;model.ui.techBadge.textContent=String(count);model.ui.techBadge.hidden=count===0;
  model.ui.techniques.setAttribute('aria-label',count?`兵法帖。未確認の閃き ${count}件`:'兵法帖');
}
function resetLife(model,nextId,current){
  const hadLife=model.lifeId!==null;model.lifeId=nextId;model.knownSnapshot=current;model.unseen.clear();model.latestDiscoveries=[];model.selectedSkill=null;model.lastCommit='';
  clearTimeout(model.sparkTimer);model.ui.spark.hidden=true;updateBadge(model);return hadLife;
}
function discover(model,ids){
  const fresh=[...new Set(ids)].filter(id=>SKILL_BY_ID[id]);if(!fresh.length)return;
  model.latestDiscoveries=fresh;for(const id of fresh)model.unseen.add(id);model.selectedSkill=fresh[0];updateBadge(model);
  model.ui.sparkName.textContent=fresh.slice(0,2).map(id=>skillMeta(id).name).join('・')+(fresh.length>2?' ほか':'');model.ui.spark.hidden=false;
  clearTimeout(model.sparkTimer);model.sparkTimer=setTimeout(()=>{model.ui.spark.hidden=true;},7200);model.audio.item();haptic([18,28,12]);
  if(!model.ui.panel.hidden&&model.ui.panel.dataset.type==='skills')renderSkills(model,model.selectedSkill,{keepScroll:true});
}
function observeKnownSkills(model,next){
  const nextId=next?.id||null,current=new Set(next?.knownSkills||[]);
  if(model.lifeId!==nextId)return resetLife(model,nextId,current);
  if(model.knownSnapshot===null){model.knownSnapshot=current;return false;}
  const fresh=[...current].filter(id=>!model.knownSnapshot.has(id)&&SKILL_BY_ID[id]);model.knownSnapshot=current;if(fresh.length)discover(model,fresh);return false;
}
function renderEntry(model,id){
  const meta=skillMeta(id),slots=phasesForSkill(model,id),button=document.createElement('button');button.type='button';button.className='technique-entry';button.dataset.skillId=id;button.dataset.selected=String(id===model.selectedSkill);button.dataset.new=String(model.unseen.has(id));
  button.innerHTML='<i data-kind></i><span><strong data-skill-name></strong><small data-effect></small></span><em data-slots></em>';
  button.querySelector('[data-kind]').textContent=meta.type;button.querySelector('[data-skill-name]').textContent=meta.name;button.querySelector('[data-effect]').textContent=effectSummary(id);button.querySelector('[data-slots]').textContent=slots.length?slots.join('・'):'未装着';
  button.onclick=()=>{model.selectedSkill=id;model.audio.ui();haptic(8);renderSkills(model,id,{keepScroll:true});};return button;
}
function setTechnique(model,phase){
  const state=model.getState();if(!model.selectedSkill||!state?.knownSkills?.includes(model.selectedSkill))return;
  state.skillWeights??={jo:{},ha:{},kyu:{}};state.skillWeights[phase]={[model.selectedSkill]:100};model.unseen.delete(model.selectedSkill);updateBadge(model);
  const phaseLabel=PHASES.find(([id])=>id===phase)?.[1]||phase;model.lastCommit=`${skillMeta(model.selectedSkill).name} を「${phaseLabel}」へセット`;
  model.audio.item();haptic(18);renderSkills(model,model.selectedSkill,{keepScroll:true});
}
function renderSkills(model,focusId=null,{keepScroll=false}={}){
  const state=model.getState();if(!state)return;ensureProgression(state);const oldScroll=keepScroll?model.ui.panel.scrollTop:0,skills=state.knownSkills?.length?[...state.knownSkills]:['basic.fist'];
  if(focusId&&skills.includes(focusId))model.selectedSkill=focusId;if(!model.selectedSkill||!skills.includes(model.selectedSkill))model.selectedSkill=[...model.unseen][0]||currentPhaseSkill(model,'jo')||skills[0];
  skills.sort((a,b)=>Number(model.unseen.has(b))-Number(model.unseen.has(a))||({action:0,basic:1,support:2}[SKILL_BY_ID[a]?.type||'basic']??3)-({action:0,basic:1,support:2}[SKILL_BY_ID[b]?.type||'basic']??3)||skillMeta(a).name.localeCompare(skillMeta(b).name,'ja'));
  model.ui.title.textContent='兵法帖';model.ui.body.innerHTML='<div class="technique-intro"><span>一</span><p><strong>技を選ぶ</strong><small>次に、刻む位置を選ぶ</small></p></div>';
  const list=document.createElement('div');list.className='technique-list';for(const id of skills)list.append(renderEntry(model,id));model.ui.body.append(list);renderDock(model);
  if(keepScroll)requestAnimationFrame(()=>{model.ui.panel.scrollTop=oldScroll;});
}
function renderDock(model){
  const selected=skillMeta(model.selectedSkill),dock=document.createElement('section');dock.className='technique-phase-dock';dock.innerHTML='<div class="technique-selected"><span>選択中</span><strong></strong><small></small></div><div class="technique-phase-list"></div><p class="technique-commit" role="status" aria-live="polite"></p>';
  dock.querySelector('.technique-selected strong').textContent=selected.name;dock.querySelector('.technique-selected small').textContent=`${selected.type} · ${effectSummary(model.selectedSkill)}`;
  const list=dock.querySelector('.technique-phase-list');for(const [phase,label] of PHASES)list.append(renderPhase(model,phase,label));dock.querySelector('.technique-commit').textContent=model.lastCommit;model.ui.body.append(dock);
}
function renderPhase(model,phase,label){
  const current=currentPhaseSkill(model,phase),button=document.createElement('button');button.type='button';button.className='technique-phase';button.dataset.phase=phase;button.dataset.contains=String(current===model.selectedSkill);button.innerHTML='<b></b><span></span><small></small>';
  button.querySelector('b').textContent=label;button.querySelector('span').textContent=current===model.selectedSkill?'ここに装着中':'ここへセット';button.querySelector('small').textContent=skillMeta(current).name;button.onclick=()=>setTechnique(model,phase);return button;
}
function renderMind(model){
  const state=model.getState();if(!state)return;ensureProgression(state);model.ui.title.textContent='意識';model.ui.body.innerHTML='<p class="upgrade-panel-copy">いま戦いへ持ち込む序・破・急。札を押すと兵法帖で組み直せます。</p>';
  const seals=document.createElement('div');seals.className='mind-seals';for(const [phase,label] of PHASES)seals.append(renderMindSeal(model,phase,label));model.ui.body.append(seals);
}
function renderMindSeal(model,phase,label){
  const id=currentPhaseSkill(model,phase),meta=skillMeta(id),button=document.createElement('button');button.className='mind-seal';button.innerHTML='<b></b><span><strong></strong><small></small></span>';button.querySelector('b').textContent=label;button.querySelector('strong').textContent=meta.name;button.querySelector('small').textContent=`${meta.type} · ${effectSummary(id)}`;button.onclick=()=>model.openSkills?.(id);return button;
}
function bindGestures(model){
  const header=model.ui.panel.querySelector('header');
  header.addEventListener('pointerdown',event=>{if(model.ui.panel.dataset.type!=='skills'||event.target.closest('button'))return;model.sheetDrag={id:event.pointerId,startY:event.clientY,dy:0};header.setPointerCapture?.(event.pointerId);model.ui.panel.dataset.dragging='true';});
  header.addEventListener('pointermove',event=>{if(!model.sheetDrag||model.sheetDrag.id!==event.pointerId)return;model.sheetDrag.dy=Math.max(0,event.clientY-model.sheetDrag.startY);model.ui.panel.style.setProperty('--skill-sheet-drag',`${Math.min(120,model.sheetDrag.dy)}px`);event.preventDefault();});
  const finish=event=>{if(!model.sheetDrag||model.sheetDrag.id!==event.pointerId)return;const shouldClose=model.sheetDrag.dy>=64;model.sheetDrag=null;model.ui.panel.style.setProperty('--skill-sheet-drag','0px');delete model.ui.panel.dataset.dragging;if(shouldClose)model.close?.();};
  header.addEventListener('pointerup',finish);header.addEventListener('pointercancel',finish);
}

export function createSkillSetter({ui,audio,getState}){
  const model={ui,audio,getState,unseen:new Set(),lifeId:null,knownSnapshot:null,selectedSkill:null,latestDiscoveries:[],sparkTimer:0,sheetDrag:null,lastCommit:'',openSkills:null,close:null};
  updateBadge(model);bindGestures(model);
  ui.techniques.onclick=()=>model.openSkills?.([...model.unseen][0]||null);
  ui.sparkSet.onclick=()=>{clearTimeout(model.sparkTimer);ui.spark.hidden=true;model.openSkills?.(model.latestDiscoveries[0]||[...model.unseen][0]||null);};
  return{
    bindInteractions({openSkills,close}){model.openSkills=openSkills;model.close=close;},
    bindState(next){return observeKnownSkills(model,next);},
    renderMind(){renderMind(model);},renderSkills(skillId,options){renderSkills(model,skillId,options);},
    firstUnseen(){return[...model.unseen][0]||null;},discover(ids){discover(model,ids);},
    dispose(){clearTimeout(model.sparkTimer);}
  };
}
