import { ARMOR_LABELS, WEAPON_LABELS, ensureProgression } from './gameplay-world.js';
import { createGameplayViewModel } from './gameplay-view-model.js';
import { equipmentAccess, requestEquip } from './rebuild/gameplay-commands.js';
import { createConversationInput } from './rebuild/conversation-input.js';
import { createSkillSetter } from './skill-setter.js';
import { createHeartTechniqueBodyUI } from './heart-technique-body-ui.js';
import './rebuild/conversation-input.css';
import './skill-setter.css';
import './heart-technique-body.css';
import './gameplay-ui-alignment.css';

function mountPager(list,pageSize=5,label='項目'){
  const items=[...list.children];if(items.length<=pageSize)return null;let page=0;const pages=Math.ceil(items.length/pageSize),nav=document.createElement('nav');nav.className='inline-pager';nav.setAttribute('aria-label',`${label}のページ`);nav.innerHTML='<button type="button" data-prev>‹</button><span></span><button type="button" data-next>›</button>';
  const sync=()=>{items.forEach((item,index)=>item.hidden=Math.floor(index/pageSize)!==page);nav.querySelector('span').textContent=`${page+1} / ${pages}`;nav.querySelector('[data-prev]').disabled=page===0;nav.querySelector('[data-next]').disabled=page===pages-1;};nav.querySelector('[data-prev]').onclick=()=>{page=Math.max(0,page-1);sync();};nav.querySelector('[data-next]').onclick=()=>{page=Math.min(pages-1,page+1);sync();};list.after(nav);sync();return nav;
}
function routeStyle(from,to){const dx=to.x-from.x,dy=to.y-from.y;return`left:${from.x}%;top:${from.y}%;width:${Math.hypot(dx,dy)}%;transform:rotate(${Math.atan2(dy,dx)}rad)`;}

export function createGameplayUI(gameScreen,{stations,layout,audio}){
  const root=document.createElement('div');root.className='rinne-gameplay-upgrade';
  root.innerHTML=`
    <div class="rinne-player-strip"><span data-name>旅人</span><i></i><span data-equip>素手 · 旅装</span><span data-state>探索</span></div>
    <div data-phase-indicator class="rinne-phase-indicator" hidden aria-label="現在の序破急"><span data-phase="jo">序</span><span data-phase="ha">破</span><span data-phase="kyu">急</span></div>
    <nav class="rinne-bottom-controls" aria-label="プレイ操作">
      <button data-combat class="upgrade-control is-combat"><span>戦</span><small>戦技</small><em data-combat-badge hidden>0</em></button>
      <button data-items class="upgrade-control"><span>具</span><small>装備</small></button>
      <button data-map class="upgrade-control"><span>図</span><small>地図</small></button>
      <button data-record class="upgrade-control"><span>記</span><small>記録</small></button>
    </nav>
    <button data-one-motion class="one-motion-control" type="button" hidden>
      <b>奥</b><span><strong data-one-motion-name>奥義</strong><small>大消耗 / 大きな隙</small></span>
    </button>
    <section data-panel class="upgrade-panel" hidden>
      <header><i class="upgrade-sheet-grip" aria-hidden="true"></i><strong data-title></strong><button data-close aria-label="閉じる">×</button></header>
      <nav data-combat-tabs class="combat-panel-tabs" aria-label="戦技カテゴリ" hidden>
        <button data-heart type="button">心<em data-heart-badge hidden>0</em></button>
        <button data-techniques type="button">技<em data-tech-badge hidden>0</em></button>
        <button data-body-tab type="button">体</button>
      </nav>
      <div data-body></div>
    </section>
    <aside data-spark class="technique-spark" role="status" aria-live="polite" hidden>
      <div><span>閃き</span><strong data-spark-name></strong><small>新しい戦技が増えた</small></div>
      <button data-spark-set type="button">見る</button>
    </aside>
    <div data-rest class="upgrade-rest" hidden><span></span><strong>休憩中</strong><small>長押し中、息を整えている</small></div>
    <div data-training class="upgrade-training" hidden><strong>稽古態勢</strong><span data-training-name>かかし</span></div>`;
  gameScreen.append(root);

  const objective=gameScreen.querySelector('.objective-card'),targetHint=document.createElement('div');targetHint.className='objective-target';targetHint.hidden=true;objective?.append(targetHint);
  const dash=document.createElement('button');dash.type='button';dash.hidden=true;const debug=document.createElement('button');debug.type='button';debug.hidden=true;
  const q=s=>root.querySelector(s),panel=q('[data-panel]'),ui={
    root,dash,debug,combat:q('[data-combat]'),combatBadge:q('[data-combat-badge]'),heart:q('[data-heart]'),heartBadge:q('[data-heart-badge]'),techniques:q('[data-techniques]'),techBadge:q('[data-tech-badge]'),bodyButton:q('[data-body-tab]'),items:q('[data-items]'),map:q('[data-map]'),record:q('[data-record]'),combatTabs:q('[data-combat-tabs]'),phaseIndicator:q('[data-phase-indicator]'),
    oneMotion:q('[data-one-motion]'),oneMotionName:q('[data-one-motion-name]'),panel,title:q('[data-title]'),body:panel.querySelector('[data-body]'),close:q('[data-close]'),spark:q('[data-spark]'),sparkName:q('[data-spark-name]'),sparkSet:q('[data-spark-set]'),
    rest:q('[data-rest]'),training:q('[data-training]'),trainingName:q('[data-training-name]'),name:q('[data-name]'),equip:q('[data-equip]'),state:q('[data-state]')
  };
  let state=null,sheetDrag=null,movementHelpTimer=0,currentView=null,lastCombatType='heart',inventoryKind='weapon',lastPhase=null,lastToastText='',lastToastAt=0;
  const speech=createConversationInput({document,window,root:gameScreen,getState:()=>state});
  const tracker=createSkillSetter({ui,audio,getState:()=>state});
  const loadoutUI=createHeartTechniqueBodyUI({ui,audio,getState:()=>state,tracker});
  const moveHint=gameScreen.querySelector('#move-hint');
  const showToast=text=>{const node=document.getElementById('toast');if(!node||!text)return;node.textContent=text;node.hidden=false;clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>{node.hidden=true;},2600);};
  const toastNode=document.getElementById('toast');
  const toastObserver=toastNode?new MutationObserver(()=>{if(toastNode.hidden)return;const text=toastNode.textContent.trim();if(!text)return;const now=performance.now(),high=/行動不能|救助|生涯|凱旋|閃き|出航/.test(text);toastNode.dataset.priority=high?'high':'normal';if(!high&&text===lastToastText&&now-lastToastAt<500){toastNode.hidden=true;return;}lastToastText=text;lastToastAt=now;}):null;
  toastObserver?.observe(toastNode,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  const showMovementHelp=event=>{event.stopImmediatePropagation();showToast(moveHint?.textContent?.includes('母')?'抱っこ中も画面をスワイプすると、母に抱かれたまま村を見て回れます。':'スワイプで移動。素早くフリックするとダッシュ、画面長押しで休憩して息を回復します。');};
  moveHint?.addEventListener('click',showMovementHelp,{capture:true});

  function inventory(){
    ensureProgression(state);ui.title.textContent='具 · 装備';ui.body.innerHTML='';const access=equipmentAccess(state,stations),intro=document.createElement('div');intro.className='loadout-intro';intro.innerHTML='<strong>装備を整える</strong><small></small>';intro.querySelector('small').textContent=access.ok?`${access.station?.label||'武具置き場'} · 装備変更可`:access.reason;ui.body.append(intro);
    const tabs=document.createElement('nav');tabs.className='inventory-tabs';const defs=[['weapon','武器'],['armor','防具'],['shield','盾']];for(const [kind,label] of defs){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.active=String(kind===inventoryKind);b.onclick=()=>{inventoryKind=kind;audio.ui();inventory();};tabs.append(b);}ui.body.append(tabs);
    const data=inventoryKind==='weapon'?[state.inventory.weapons,state.equipment.weapon,value=>WEAPON_LABELS[value]||value]:inventoryKind==='armor'?[state.inventory.armors,state.equipment.armor,value=>ARMOR_LABELS[value]||value]:[state.inventory.shields,Boolean(state.equipment.shield),value=>value?'盾あり':'盾なし'];
    const list=document.createElement('div');list.className='inventory-list';for(const item of data[0]){const button=document.createElement('button');button.type='button';button.dataset.active=String(item===data[1]);button.disabled=!access.ok||item===data[1];button.innerHTML='<strong></strong><small></small>';button.querySelector('strong').textContent=data[2](item);button.querySelector('small').textContent=item===data[1]?'装備中':access.ok?'装備する':access.reason;button.onclick=()=>{const result=requestEquip(state,{kind:inventoryKind,value:item},stations);if(!result.ok){showToast(result.reason);return;}audio.item();showToast(`${data[2](item)} に変更`);inventory();};list.append(button);}ui.body.append(list);mountPager(list,6,'装備');
  }
  function map(){
    currentView=createGameplayViewModel(state,{stations});ui.title.textContent='図 · 地図';const target=currentView.target,rows=stations.filter(row=>!row.interiorId&&!row.id.startsWith('rack.')&&!row.id.includes('dummy')).slice(0,20),points=rows.concat([{x:state.position.x,z:state.position.z},...(target?[target]:[])]),xs=points.map(row=>row.x),zs=points.map(row=>row.z),minX=Math.min(...xs)-6,maxX=Math.max(...xs)+6,minZ=Math.min(...zs)-6,maxZ=Math.max(...zs)+6,w=Math.max(1,maxX-minX),h=Math.max(1,maxZ-minZ),point=(x,z)=>({x:(x-minX)/w*100,y:(z-minZ)/h*100}),me=point(state.position.x,state.position.z);
    const marks=rows.map(row=>{const mark=point(row.x,row.z),isTarget=target?.id===String(row.id);return `<i class="map-mark" data-target="${isTarget}" style="left:${mark.x}%;top:${mark.y}%" title="${String(row.label||row.id)}"><span>${String(row.label||row.id).slice(0,2)}</span></i>`;}).join(''),tp=target?point(target.x,target.z):null,route=tp?`<i class="map-route" style="${routeStyle(me,tp)}"></i>`:'',targetMark=tp&&!rows.some(row=>String(row.id)===target.id)?`<i class="map-objective" style="left:${tp.x}%;top:${tp.y}%">${target.arrow}</i>`:'';
    ui.body.innerHTML=`<div class="upgrade-map"><div class="map-grid"></div>${route}${marks}${targetMark}<b class="map-player" style="left:${me.x}%;top:${me.y}%"></b></div><p class="map-caption">${layout.name||'村'} · ${target?`${target.arrow} ${target.label} ${Math.round(target.distance)}m`:'現在地と主要施設'}</p>`;
  }
  function renderLineage(){
    const list=document.createElement('div');list.className='lineage-list';const rows=[...(state.lineage||[])].reverse();if(!rows.length){const empty=document.createElement('p');empty.className='loadout-empty';empty.textContent='まだ前世の記録はありません。';return empty;}
    for(const row of rows){const card=document.createElement('article');card.className='lineage-card';const weapon=WEAPON_LABELS[row.equipment?.weapon]||'素手';card.innerHTML='<header><strong></strong><span></span></header><p></p><small></small>';card.querySelector('strong').textContent=`${row.generation}代 · ${row.name||'旅人'}`;card.querySelector('span').textContent=`${row.age||0}歳`;card.querySelector('p').textContent=`討伐 ${row.defeats||0} · ${weapon} · 技 ${(row.skills||[]).length}`;card.querySelector('small').textContent=row.returnedHome?'故郷へ帰還済み':'帰還記録なし';list.append(card);}mountPager(list,3,'系譜');return list;
  }
  function record(){
    ui.title.textContent='記 · 生涯';ui.body.innerHTML='';const summary=document.createElement('section');summary.className='life-record-summary';summary.innerHTML='<header><strong></strong><span></span></header><p></p><div class="inheritance-contract"><b>次代へ残る</b><span>系譜・故郷・生涯記録</span><b>新生で戻る</b><span>能力・装備・戦技編成</span></div>';summary.querySelector('strong').textContent=`${state.generation}代目 · ${state.name||'旅人'}`;summary.querySelector('header span').textContent=`${Math.floor(state.ageYears||0)}歳`;summary.querySelector('p').textContent=`討伐 ${state.defeats||0} · 凱旋 ${state.returns||0} · 習得技 ${(state.knownSkills||[]).length}`;ui.body.append(summary);
    const time=document.createElement('section');time.className='time-rate-panel';time.innerHTML='<header><strong>世界時計</strong><small></small></header><div></div>';const clock=document.getElementById('clock-rate'),locked=Boolean(clock?.disabled);time.querySelector('small').textContent=locked?'共有世界では変更できません':'人生の時計だけを変更';const rates=[1,5,10,20];for(const rate of rates){const b=document.createElement('button');b.type='button';b.textContent=`${rate}×`;b.dataset.active=String(Number(state.clockRate)===rate);b.disabled=locked;b.onclick=()=>{if(!clock||locked)return;clock.value=String(rate);clock.textContent=`${rate}×`;clock.onchange?.({target:clock});audio.ui();record();};time.querySelector('div').append(b);}ui.body.append(time);
    const heading=document.createElement('h3');heading.className='record-heading';heading.textContent='系譜';ui.body.append(heading,renderLineage());
  }
  function markOpenControl(type){const combat=['heart','technique','body'].includes(type);ui.combat.dataset.active=String(combat);ui.items.dataset.active=String(type==='items');ui.map.dataset.active=String(type==='map');ui.record.dataset.active=String(type==='record');ui.heart.dataset.active=String(type==='heart');ui.techniques.dataset.active=String(type==='technique');ui.bodyButton.dataset.active=String(type==='body');ui.combatTabs.hidden=!combat;}
  function open(type,{skillId=null,silent=false}={}){
    if(!state)return;ui.panel.hidden=false;ui.panel.dataset.type=type;markOpenControl(type);if(['heart','technique','body'].includes(type))lastCombatType=type;
    if(type==='heart')loadoutUI.renderHeart(skillId);else if(type==='technique')loadoutUI.renderTechnique(skillId);else if(type==='body')loadoutUI.renderBody();else if(type==='items')inventory();else if(type==='map')map();else record();if(!silent)audio.ui();
  }
  function close(){ui.panel.hidden=true;delete ui.panel.dataset.type;ui.panel.style.removeProperty('--loadout-sheet-drag');delete ui.panel.dataset.dragging;markOpenControl('');audio.ui();}
  function bindState(next){state=next;const lifeChanged=tracker.bindState(next);if(lifeChanged){loadoutUI.reset();inventoryKind='weapon';lastCombatType='heart';if(!ui.panel.hidden){ui.panel.hidden=true;delete ui.panel.dataset.type;markOpenControl('');}}}
  function refresh(){if(ui.panel.hidden||!state)return;open(ui.panel.dataset.type||'items',{silent:true});}
  function summary(s,{dashing=false,resting=false,training=null}={}){
    state=s;speech.sync();loadoutUI.syncCombat(s);currentView=createGameplayViewModel(s,{stations});ui.name.textContent=`${s.name||'旅人'} · ${Math.floor(s.ageYears||0)}歳`;ui.equip.textContent=`${WEAPON_LABELS[s.equipment?.weapon]||'素手'} · ${ARMOR_LABELS[s.equipment?.armor]||'旅装'}`;
    ui.state.textContent=s.down?'救助待ち':resting?'休憩':dashing?'疾走':s.combat||training?.d<2.8?'戦闘態勢':'探索';ui.rest.hidden=!resting;ui.dash.dataset.active=String(dashing);const engaged=training?.d<2.8;ui.training.hidden=!engaged;if(engaged)ui.trainingName.textContent=training.label;
    if(currentView.activity){const badge=document.getElementById('objective-badge');if(badge)badge.textContent=currentView.activity.text;}
    if(currentView.target){targetHint.textContent=`${currentView.target.arrow} ${currentView.target.label} · ${Math.max(0,Math.round(currentView.target.distance))}m`;targetHint.hidden=false;}else targetHint.hidden=true;
    const phase=currentView.phase,phaseVisible=Boolean(s.combat&&['jo','ha','kyu'].includes(phase));ui.phaseIndicator.hidden=!phaseVisible;for(const node of ui.phaseIndicator.querySelectorAll('[data-phase]'))node.dataset.active=String(node.dataset.phase===phase);if(phaseVisible&&lastPhase&&lastPhase!==phase){try{navigator.vibrate?.(8);}catch{}audio.ui?.();}lastPhase=phaseVisible?phase:null;gameScreen.dataset.uiPriority=s.down?'rescue':s.combat?'combat':'explore';
    if(!ui.panel.hidden&&ui.panel.dataset.type==='record')for(const b of ui.body.querySelectorAll('.time-rate-panel button'))b.dataset.active=String(Number(s.clockRate)===Number(b.textContent.replace('×','')));
  }

  function enhanceLifeEndDialog(dialog){
    if(!dialog||dialog.dataset.uiAligned==='true')return;const form=dialog.querySelector('form');if(!form)return;dialog.dataset.uiAligned='true';
    const age=form.querySelector('#life-end-age'),name=form.querySelector('#life-end-name'),summary=form.querySelector('.life-end-summary'),birthLabel=form.querySelector('label'),help=form.querySelector('.life-end-help'),rebirth=form.querySelector('#rebirth');
    if(!age||!name||!summary||!birthLabel||!help||!rebirth)return;
    const steps=[document.createElement('section'),document.createElement('section'),document.createElement('section')];steps.forEach((step,index)=>{step.className='life-end-step';step.dataset.step=String(index+1);});
    steps[0].append(age,name,summary);const lead=document.createElement('p');lead.className='life-end-step-copy';lead.textContent='この人生を記録してから、次の自分へ進みます。';steps[0].append(lead);
    steps[1].innerHTML='<h3>次代へ渡るもの</h3><div class="life-end-contract"><b>残る</b><span>一族の系譜・帰還して刻んだ故郷・この生涯の記録</span><b>戻る</b><span>能力・装備・戦技編成・体力・現在地</span></div><p class="life-end-step-copy">前世の技や経験は記録として残りますが、新しい人生の習得状態へ自動では戻りません。</p>';
    steps[2].append(birthLabel,help,rebirth);
    const nav=document.createElement('nav');nav.className='life-end-step-nav';nav.setAttribute('aria-label','転生の確認');nav.innerHTML='<button type="button" data-back>戻る</button><span><i></i><i></i><i></i></span><button type="button" data-next>次へ</button>';
    form.replaceChildren(...steps,nav);let index=0;const back=nav.querySelector('[data-back]'),next=nav.querySelector('[data-next]'),dots=[...nav.querySelectorAll('i')];
    const sync=()=>{steps.forEach((step,i)=>step.hidden=i!==index);dots.forEach((dot,i)=>dot.dataset.active=String(i===index));back.hidden=index===0;next.hidden=index===steps.length-1;};back.onclick=()=>{index=Math.max(0,index-1);sync();};next.onclick=()=>{index=Math.min(steps.length-1,index+1);sync();};sync();
  }
  const lifeEndObserver=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes){if(!(node instanceof Element))continue;if(node.matches?.('dialog.life-end-dialog'))enhanceLifeEndDialog(node);for(const dialog of node.querySelectorAll?.('dialog.life-end-dialog')||[])enhanceLifeEndDialog(dialog);}});lifeEndObserver.observe(document.body,{childList:true,subtree:true});

  function bindSheetGesture(){
    const header=ui.panel.querySelector('header');header.addEventListener('pointerdown',event=>{if(!['heart','technique','body'].includes(ui.panel.dataset.type)||event.target.closest('button'))return;sheetDrag={id:event.pointerId,startY:event.clientY,dy:0};header.setPointerCapture?.(event.pointerId);ui.panel.dataset.dragging='true';});
    header.addEventListener('pointermove',event=>{if(!sheetDrag||sheetDrag.id!==event.pointerId)return;sheetDrag.dy=Math.max(0,event.clientY-sheetDrag.startY);ui.panel.style.setProperty('--loadout-sheet-drag',`${Math.min(120,sheetDrag.dy)}px`);event.preventDefault();});
    const finish=event=>{if(!sheetDrag||sheetDrag.id!==event.pointerId)return;const shouldClose=sheetDrag.dy>=64;sheetDrag=null;ui.panel.style.setProperty('--loadout-sheet-drag','0px');delete ui.panel.dataset.dragging;if(shouldClose)close();};header.addEventListener('pointerup',finish);header.addEventListener('pointercancel',finish);
  }

  tracker.bindInteractions({openHeart:skillId=>open('heart',{skillId}),openTechnique:skillId=>open('technique',{skillId})});bindSheetGesture();
  ui.combat.onclick=()=>open(lastCombatType,{skillId:tracker.firstUnseen(lastCombatType==='heart'?'heart':'technique')});ui.heart.onclick=()=>open('heart',{skillId:tracker.firstUnseen('heart')});ui.techniques.onclick=()=>open('technique',{skillId:tracker.firstUnseen('technique')});ui.bodyButton.onclick=()=>open('body');ui.items.onclick=()=>open('items');ui.map.onclick=()=>open('map');ui.record.onclick=()=>open('record');ui.close.onclick=close;
  return{...ui,bindState,refresh,open,close,discover:ids=>tracker.discover(ids),summary,dispose(){clearTimeout(movementHelpTimer);clearTimeout(showToast.timer);moveHint?.removeEventListener('click',showMovementHelp,{capture:true});loadoutUI.dispose();tracker.dispose();speech.dispose();toastObserver?.disconnect();lifeEndObserver.disconnect();targetHint.remove();root.remove();}};
}
