import { ARMOR_LABELS, WEAPON_LABELS, ensureProgression } from './gameplay-world.js';
import { SKILL_BY_ID } from './rebuild/skill-system.js';
import { createConversationInput } from './rebuild/conversation-input.js';
import './rebuild/conversation-input.css';
import './skill-setter.css';

const PHASES=[['jo','序'],['ha','破'],['kyu','急']];
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
  const {effects}=skillMeta(id),labels=[];
  for(const [key,label] of Object.entries(EFFECT_LABELS))if(Number(effects[key])>0)labels.push(`${label}↑`);
  if(Number(effects.staminaCost)<0)labels.push('息持ち↑');
  else if(Number(effects.staminaCost)>0)labels.push('消耗↑');
  return labels.slice(0,3).join('・')||'基礎の型';
}

export function createGameplayUI(gameScreen,{stations,layout,audio}){
  const root=document.createElement('div');
  root.className='rinne-gameplay-upgrade';
  root.innerHTML=`
    <div class="rinne-player-strip"><span data-name>旅人</span><i></i><span data-equip>素手 · 旅装</span><span data-state>探索</span></div>
    <nav class="rinne-bottom-controls" aria-label="プレイ操作">
      <button data-dash class="upgrade-control is-action"><span>走</span><small>ダッシュ</small></button>
      <button data-techniques class="upgrade-control is-technique"><span>技</span><small>兵法帖</small><em data-tech-badge hidden>0</em></button>
      <button data-mind class="upgrade-control"><span>意</span><small>意識</small></button>
      <button data-items class="upgrade-control"><span>具</span><small>所持品</small></button>
      <button data-map class="upgrade-control"><span>図</span><small>地図</small></button>
      <button data-debug class="upgrade-control is-debug"><span>時</span><small>DEBUG 1×</small></button>
    </nav>
    <section data-panel class="upgrade-panel" hidden>
      <header><i class="upgrade-sheet-grip" aria-hidden="true"></i><strong data-title></strong><button data-close aria-label="閉じる">×</button></header>
      <div data-body></div>
    </section>
    <aside data-spark class="technique-spark" role="status" aria-live="polite" hidden>
      <div><span>閃き</span><strong data-spark-name></strong><small>兵法帖へ刻める</small></div>
      <button data-spark-set type="button">今セット</button>
    </aside>
    <div data-rest class="upgrade-rest" hidden><span></span><strong>休憩中</strong><small>長押し中、息を整えている</small></div>
    <div data-training class="upgrade-training" hidden><strong>稽古態勢</strong><span data-training-name>かかし</span></div>`;
  gameScreen.append(root);

  const q=s=>root.querySelector(s),ui={
    root,dash:q('[data-dash]'),techniques:q('[data-techniques]'),techBadge:q('[data-tech-badge]'),mind:q('[data-mind]'),items:q('[data-items]'),map:q('[data-map]'),debug:q('[data-debug]'),
    panel:q('[data-panel]'),title:q('[data-title]'),body:q('[data-body]'),close:q('[data-close]'),spark:q('[data-spark]'),sparkName:q('[data-spark-name]'),sparkSet:q('[data-spark-set]'),
    rest:q('[data-rest]'),training:q('[data-training]'),trainingName:q('[data-training-name]'),name:q('[data-name]'),equip:q('[data-equip]'),state:q('[data-state]')
  };
  let state=null,lifeId=null,knownSnapshot=null,selectedSkill=null,latestDiscoveries=[],sparkTimer=0,sheetDrag=null,lastCommit='';
  const unseen=new Set(),speech=createConversationInput({document,window,root:gameScreen,getState:()=>state});

  function currentPhaseSkill(phase){
    const entries=Object.entries(state?.skillWeights?.[phase]||{}).filter(([,weight])=>Number(weight)>0).sort((a,b)=>Number(b[1])-Number(a[1]));
    return entries[0]?.[0]||BASIC_BY_WEAPON[state?.equipment?.weapon]||'basic.fist';
  }
  function phasesForSkill(id){return PHASES.filter(([phase])=>currentPhaseSkill(phase)===id).map(([,label])=>label);}
  function updateTechniqueBadge(){
    const count=unseen.size;ui.techBadge.textContent=String(count);ui.techBadge.hidden=count===0;
    ui.techniques.setAttribute('aria-label',count?`兵法帖。未確認の閃き ${count}件`:'兵法帖');
  }
  function discover(ids){
    const fresh=[...new Set(ids)].filter(id=>SKILL_BY_ID[id]);if(!fresh.length)return;
    latestDiscoveries=fresh;for(const id of fresh)unseen.add(id);selectedSkill=fresh[0];updateTechniqueBadge();
    ui.sparkName.textContent=fresh.slice(0,2).map(id=>skillMeta(id).name).join('・')+(fresh.length>2?' ほか':'');ui.spark.hidden=false;
    clearTimeout(sparkTimer);sparkTimer=setTimeout(()=>{ui.spark.hidden=true;},7200);audio.item();haptic([18,28,12]);
    if(!ui.panel.hidden&&ui.panel.dataset.type==='skills')techniques(selectedSkill,{keepScroll:true});
  }
  function observeKnownSkills(next){
    const nextId=next?.id||null,current=new Set(next?.knownSkills||[]);
    if(lifeId!==nextId){
      const hadLife=lifeId!==null;lifeId=nextId;knownSnapshot=current;unseen.clear();latestDiscoveries=[];selectedSkill=null;lastCommit='';clearTimeout(sparkTimer);ui.spark.hidden=true;updateTechniqueBadge();
      if(hadLife&&!ui.panel.hidden&&['skills','mind'].includes(ui.panel.dataset.type)){ui.panel.hidden=true;markOpenControl('');}
      return;
    }
    if(knownSnapshot===null){knownSnapshot=current;return;}
    const fresh=[...current].filter(id=>!knownSnapshot.has(id)&&SKILL_BY_ID[id]);knownSnapshot=current;if(fresh.length)discover(fresh);
  }
  function bindState(next){state=next;observeKnownSkills(next);}

  function inventory(){
    ensureProgression(state);ui.title.textContent='所持品';ui.body.innerHTML='<p class="upgrade-panel-copy">施設で受け取った装備や、冒険で拾った装備を持ち替えます。</p>';
    const group=(title,items,active,set,label)=>{const s=document.createElement('section');s.className='inventory-group';s.innerHTML=`<h3>${title}</h3>`;const list=document.createElement('div');list.className='inventory-list';for(const item of items){const b=document.createElement('button');b.dataset.active=String(item===active);b.textContent=label(item);b.onclick=()=>{set(item);audio.item();inventory();};list.append(b);}s.append(list);ui.body.append(s);};
    group('武器',state.inventory.weapons,state.equipment.weapon,v=>state.equipment.weapon=v,v=>WEAPON_LABELS[v]||v);group('防具',state.inventory.armors,state.equipment.armor,v=>state.equipment.armor=v,v=>ARMOR_LABELS[v]||v);group('盾',state.inventory.shields,Boolean(state.equipment.shield),v=>state.equipment.shield=Boolean(v),v=>v?'盾あり':'盾なし');
  }

  function mind(){
    ensureProgression(state);ui.title.textContent='意識';ui.body.innerHTML='<p class="upgrade-panel-copy">いま戦いへ持ち込む序・破・急。札を押すと兵法帖で組み直せます。</p>';
    const seals=document.createElement('div');seals.className='mind-seals';
    for(const [phase,label] of PHASES){const id=currentPhaseSkill(phase),meta=skillMeta(id),button=document.createElement('button');button.className='mind-seal';button.innerHTML='<b></b><span><strong></strong><small></small></span>';button.querySelector('b').textContent=label;button.querySelector('strong').textContent=meta.name;button.querySelector('small').textContent=`${meta.type} · ${effectSummary(id)}`;button.onclick=()=>open('skills',{skillId:id});seals.append(button);}
    ui.body.append(seals);
  }

  function renderTechniqueEntry(id){
    const meta=skillMeta(id),slots=phasesForSkill(id),button=document.createElement('button');button.type='button';button.className='technique-entry';button.dataset.skillId=id;button.dataset.selected=String(id===selectedSkill);button.dataset.new=String(unseen.has(id));
    button.innerHTML='<i data-kind></i><span><strong data-skill-name></strong><small data-effect></small></span><em data-slots></em>';
    button.querySelector('[data-kind]').textContent=meta.type;button.querySelector('[data-skill-name]').textContent=meta.name;button.querySelector('[data-effect]').textContent=effectSummary(id);button.querySelector('[data-slots]').textContent=slots.length?slots.join('・'):'未装着';
    button.onclick=()=>{selectedSkill=id;audio.ui();haptic(8);techniques(id,{keepScroll:true});};return button;
  }

  function setTechnique(phase){
    if(!selectedSkill||!state?.knownSkills?.includes(selectedSkill))return;
    state.skillWeights??={jo:{},ha:{},kyu:{}};state.skillWeights[phase]={[selectedSkill]:100};unseen.delete(selectedSkill);updateTechniqueBadge();
    const phaseLabel=PHASES.find(([id])=>id===phase)?.[1]||phase,lastName=skillMeta(selectedSkill).name;lastCommit=`${lastName} を「${phaseLabel}」へセット`;
    audio.item();haptic(18);techniques(selectedSkill,{keepScroll:true});
  }

  function techniques(focusId=null,{keepScroll=false}={}){
    ensureProgression(state);const oldScroll=keepScroll?ui.panel.scrollTop:0,skills=state.knownSkills?.length?[...state.knownSkills]:['basic.fist'];
    if(focusId&&skills.includes(focusId))selectedSkill=focusId;if(!selectedSkill||!skills.includes(selectedSkill))selectedSkill=[...unseen][0]||currentPhaseSkill('jo')||skills[0];
    skills.sort((a,b)=>Number(unseen.has(b))-Number(unseen.has(a))||({action:0,basic:1,support:2}[SKILL_BY_ID[a]?.type||'basic']??3)-({action:0,basic:1,support:2}[SKILL_BY_ID[b]?.type||'basic']??3)||skillMeta(a).name.localeCompare(skillMeta(b).name,'ja'));
    ui.title.textContent='兵法帖';ui.body.innerHTML='';
    const intro=document.createElement('div');intro.className='technique-intro';intro.innerHTML='<span>一</span><p><strong>技を選ぶ</strong><small>次に、刻む位置を選ぶ</small></p>';ui.body.append(intro);
    const list=document.createElement('div');list.className='technique-list';for(const id of skills)list.append(renderTechniqueEntry(id));ui.body.append(list);
    const selected=skillMeta(selectedSkill),dock=document.createElement('section');dock.className='technique-phase-dock';dock.innerHTML=`<div class="technique-selected"><span>選択中</span><strong></strong><small></small></div><div class="technique-phase-list"></div><p class="technique-commit" role="status" aria-live="polite"></p>`;dock.querySelector('.technique-selected strong').textContent=selected.name;dock.querySelector('.technique-selected small').textContent=`${selected.type} · ${effectSummary(selectedSkill)}`;
    const phaseList=dock.querySelector('.technique-phase-list');for(const [phase,label] of PHASES){const current=currentPhaseSkill(phase),button=document.createElement('button');button.type='button';button.className='technique-phase';button.dataset.phase=phase;button.dataset.contains=String(current===selectedSkill);button.innerHTML='<b></b><span></span><small></small>';button.querySelector('b').textContent=label;button.querySelector('span').textContent=current===selectedSkill?'ここに装着中':'ここへセット';button.querySelector('small').textContent=skillMeta(current).name;button.onclick=()=>setTechnique(phase);phaseList.append(button);}dock.querySelector('.technique-commit').textContent=lastCommit;ui.body.append(dock);
    if(keepScroll)requestAnimationFrame(()=>{ui.panel.scrollTop=oldScroll;});
  }

  function map(){ui.title.textContent='地図';const rows=stations.filter(r=>!r.interiorId&&!r.id.startsWith('rack.')&&!r.id.includes('dummy')).slice(0,20),xs=rows.map(r=>r.x).concat(state.position.x),zs=rows.map(r=>r.z).concat(state.position.z),minX=Math.min(...xs)-6,maxX=Math.max(...xs)+6,minZ=Math.min(...zs)-6,maxZ=Math.max(...zs)+6,w=Math.max(1,maxX-minX),h=Math.max(1,maxZ-minZ),p=(x,z)=>({x:(x-minX)/w*100,y:(z-minZ)/h*100}),me=p(state.position.x,state.position.z),marks=rows.map(r=>{const m=p(r.x,r.z);return `<i class="map-mark" style="left:${m.x}%;top:${m.y}%"><span>${String(r.label||r.id).slice(0,3)}</span></i>`;}).join('');ui.body.innerHTML=`<div class="upgrade-map"><div class="map-grid"></div>${marks}<b class="map-player" style="left:${me.x}%;top:${me.y}%"></b></div><p class="map-caption">${layout.name||'村'} · 現在地と主要施設</p>`;}

  function markOpenControl(type){ui.techniques.dataset.active=String(type==='skills');ui.mind.dataset.active=String(type==='mind');ui.items.dataset.active=String(type==='items');ui.map.dataset.active=String(type==='map');}
  function open(type,{skillId=null,silent=false,keepScroll=false}={}){if(!state)return;ui.panel.hidden=false;ui.panel.dataset.type=type;markOpenControl(type);if(type==='skills')techniques(skillId,{keepScroll});else if(type==='mind')mind();else if(type==='items')inventory();else map();if(!silent)audio.ui();}
  function close(){ui.panel.hidden=true;delete ui.panel.dataset.type;ui.panel.style.removeProperty('--skill-sheet-drag');delete ui.panel.dataset.dragging;markOpenControl('');audio.ui();}

  ui.techniques.onclick=()=>open('skills',{skillId:[...unseen][0]||null});ui.mind.onclick=()=>open('mind');ui.items.onclick=()=>open('items');ui.map.onclick=()=>open('map');ui.close.onclick=close;
  ui.sparkSet.onclick=()=>{clearTimeout(sparkTimer);ui.spark.hidden=true;open('skills',{skillId:latestDiscoveries[0]||[...unseen][0]||null});};

  const panelHeader=ui.panel.querySelector('header');
  panelHeader.addEventListener('pointerdown',event=>{if(ui.panel.dataset.type!=='skills'||event.target.closest('button'))return;sheetDrag={id:event.pointerId,startY:event.clientY,dy:0};panelHeader.setPointerCapture?.(event.pointerId);ui.panel.dataset.dragging='true';});
  panelHeader.addEventListener('pointermove',event=>{if(!sheetDrag||sheetDrag.id!==event.pointerId)return;sheetDrag.dy=Math.max(0,event.clientY-sheetDrag.startY);ui.panel.style.setProperty('--skill-sheet-drag',`${Math.min(120,sheetDrag.dy)}px`);event.preventDefault();});
  const finishSheetDrag=event=>{if(!sheetDrag||sheetDrag.id!==event.pointerId)return;const shouldClose=sheetDrag.dy>=64;sheetDrag=null;ui.panel.style.setProperty('--skill-sheet-drag','0px');delete ui.panel.dataset.dragging;if(shouldClose)close();};
  panelHeader.addEventListener('pointerup',finishSheetDrag);panelHeader.addEventListener('pointercancel',finishSheetDrag);

  updateTechniqueBadge();
  return{
    ...ui,bindState,
    refresh(){if(ui.panel.hidden||!state)return;open(ui.panel.dataset.type||'items',{silent:true,keepScroll:true,skillId:selectedSkill});},open,close,discover,
    summary(s,{dashing=false,resting=false,training=null}={}){bindState(s);speech.sync();ui.name.textContent=`${s.name||'旅人'} · ${Math.floor(s.ageYears||0)}歳`;ui.equip.textContent=`${WEAPON_LABELS[s.equipment?.weapon]||'素手'} · ${ARMOR_LABELS[s.equipment?.armor]||'旅装'}`;ui.state.textContent=s.down?'行動不能':resting?'休憩':dashing?'疾走':s.combat||training?.d<2.8?'戦闘態勢':'探索';ui.rest.hidden=!resting;ui.dash.dataset.active=String(dashing);const engaged=training?.d<2.8;ui.training.hidden=!engaged;if(engaged)ui.trainingName.textContent=training.label;},
    dispose(){clearTimeout(sparkTimer);speech.dispose();root.remove();}
  };
}
