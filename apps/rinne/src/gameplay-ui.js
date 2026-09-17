import { ARMOR_LABELS, WEAPON_LABELS, ensureProgression } from './gameplay-world.js';
import { createConversationInput } from './rebuild/conversation-input.js';
import { rebirthPreview } from './rebuild/gameplay-contract.js';
import { createSkillSetter } from './skill-setter.js';
import { createHeartTechniqueBodyUI } from './heart-technique-body-ui.js';
import './rebuild/conversation-input.css';
import './skill-setter.css';
import './heart-technique-body.css';

const haptic=pattern=>{try{globalThis.navigator?.vibrate?.(pattern);}catch{}};
const PAGE_SIZE=6;

export function createGameplayUI(gameScreen,{stations,layout,audio,requestEquip}){
  const root=document.createElement('div');
  root.className='rinne-gameplay-upgrade';
  root.innerHTML=`
    <div class="rinne-player-strip"><span data-name>旅人</span><i></i><span data-equip>素手 · 旅装</span><span data-state>探索</span></div>
    <div data-phase class="combat-phase-indicator" hidden aria-label="現在の序破急">
      <span data-phase-id="jo">序</span><span data-phase-id="ha">破</span><span data-phase-id="kyu">急</span>
    </div>
    <nav class="rinne-bottom-controls" aria-label="プレイ計画">
      <button data-combat class="upgrade-control is-combat"><span>戦技</span><small>心・技・体</small></button>
      <button data-items class="upgrade-control"><span>具</span><small>身支度</small></button>
      <button data-map class="upgrade-control"><span>図</span><small>地図</small></button>
      <button data-record class="upgrade-control"><span>記</span><small>人生・系譜</small></button>
    </nav>
    <button data-one-motion class="one-motion-control" type="button" hidden>
      <b>奥</b><span><strong data-one-motion-name>奥義</strong><small>大消耗 / 大きな隙</small></span>
    </button>
    <section data-panel class="upgrade-panel" hidden>
      <header><i class="upgrade-sheet-grip" aria-hidden="true"></i><strong data-title></strong><button data-close aria-label="閉じる">×</button></header>
      <div data-body></div>
    </section>
    <aside data-spark class="technique-spark" role="status" aria-live="polite" hidden>
      <div><span>記録</span><strong data-spark-name></strong><small>人生の記録へ残る</small></div>
      <button data-spark-set type="button">閉じる</button>
    </aside>
    <div data-rest class="upgrade-rest" hidden><span></span><strong>休憩中</strong><small>長押し中、息を整えている</small></div>
    <div data-training class="upgrade-training" hidden><strong>稽古態勢</strong><span data-training-name>かかし</span></div>`;
  gameScreen.append(root);

  const dash=document.createElement('button');dash.type='button';dash.hidden=true;
  const q=s=>root.querySelector(s),panel=q('[data-panel]'),ui={
    root,dash,combat:q('[data-combat]'),items:q('[data-items]'),map:q('[data-map]'),record:q('[data-record]'),phase:q('[data-phase]'),
    oneMotion:q('[data-one-motion]'),oneMotionName:q('[data-one-motion-name]'),panel,title:q('[data-title]'),body:panel.querySelector('[data-body]'),close:q('[data-close]'),spark:q('[data-spark]'),sparkName:q('[data-spark-name]'),sparkSet:q('[data-spark-set]'),
    rest:q('[data-rest]'),training:q('[data-training]'),trainingName:q('[data-training-name]'),name:q('[data-name]'),equip:q('[data-equip]'),state:q('[data-state]')
  };
  let state=null,sheetDrag=null,movementHelpTimer=0,toastTimer=0,guidance=null,inventoryKind='weapon',inventoryPages={weapon:0,armor:0,shield:0},recordPage=0,lastPhase='';
  const speech=createConversationInput({document,window,root:gameScreen,getState:()=>state});
  const tracker=createSkillSetter({ui,audio,getState:()=>state});
  const loadoutUI=createHeartTechniqueBodyUI({ui,audio,getState:()=>state,tracker});
  const moveHint=gameScreen.querySelector('#move-hint');
  const notify=text=>{const node=document.getElementById('toast');if(!node||!text)return;node.textContent=text;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{node.hidden=true;},2200);};
  const showMovementHelp=event=>{
    event.stopImmediatePropagation();
    notify(moveHint?.textContent?.includes('母')?'抱っこ中も画面をスワイプすると、母に抱かれたまま村を見て回れます。':'スワイプで移動。素早くフリックするとダッシュ、画面長押しで休憩して息を回復します。');
  };
  moveHint?.addEventListener('click',showMovementHelp,{capture:true});

  function pager(total,current,onChange){
    const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));if(pages<=1)return null;current=Math.min(Math.max(0,current),pages-1);const nav=document.createElement('nav');nav.className='panel-pager';const prev=document.createElement('button'),meta=document.createElement('span'),next=document.createElement('button');prev.type=next.type='button';prev.textContent='‹';next.textContent='›';prev.disabled=current<=0;next.disabled=current>=pages-1;meta.textContent=`${current+1} / ${pages}`;prev.onclick=()=>onChange(current-1);next.onclick=()=>onChange(current+1);nav.append(prev,meta,next);return nav;
  }
  function inventoryTabs(){const nav=document.createElement('nav');nav.className='inventory-tabs';for(const [kind,label] of [['weapon','武器'],['armor','防具'],['shield','盾']]){const button=document.createElement('button');button.type='button';button.dataset.active=String(inventoryKind===kind);button.textContent=label;button.onclick=()=>{inventoryKind=kind;audio.ui();inventory();};nav.append(button);}return nav;}
  function inventory(){
    ensureProgression(state);ui.title.textContent='具 · 身支度';ui.body.innerHTML='';ui.body.append(inventoryTabs());
    const config=inventoryKind==='weapon'?{title:'武器',items:state.inventory.weapons,active:state.equipment.weapon,label:value=>WEAPON_LABELS[value]||value}:inventoryKind==='armor'?{title:'防具',items:state.inventory.armors,active:state.equipment.armor,label:value=>ARMOR_LABELS[value]||value}:{title:'盾',items:state.inventory.shields,active:Boolean(state.equipment.shield),label:value=>value?'盾あり':'盾なし'};
    const status=document.createElement('p');status.className='upgrade-panel-copy';status.textContent='装備変更は7歳以降、村の武具置き場のそばで、非戦闘時だけ行えます。';ui.body.append(status);
    const section=document.createElement('section');section.className='inventory-group';section.innerHTML=`<h3>${config.title}</h3>`;const list=document.createElement('div');list.className='inventory-list';const pages=Math.max(1,Math.ceil(config.items.length/PAGE_SIZE)),page=Math.min(inventoryPages[inventoryKind]||0,pages-1);inventoryPages[inventoryKind]=page;
    for(const item of config.items.slice(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE)){const button=document.createElement('button');button.type='button';button.dataset.active=String(item===config.active);button.textContent=config.label(item);button.onclick=()=>{const result=requestEquip?.(inventoryKind,item)||{ok:false,reason:'身支度を変更できません。'};if(!result.ok){notify(result.reason);haptic(18);return;}if(result.changed){audio.item();haptic(10);notify(`${config.label(item)}に変更`);}inventory();};list.append(button);}section.append(list);ui.body.append(section);const nav=pager(config.items.length,page,next=>{inventoryPages[inventoryKind]=next;audio.ui();inventory();});if(nav)ui.body.append(nav);
  }
  function map(){
    ui.title.textContent='図 · 地図';const target=guidance?.navigation&&Number.isFinite(guidance.navigation.x)&&Number.isFinite(guidance.navigation.z)?guidance.navigation:null,rows=state.zone==='village'?stations.filter(row=>!row.interiorId&&!row.id.startsWith('rack.')&&!row.id.includes('dummy')).slice(0,20):[];
    const points=rows.map(row=>({x:row.x,z:row.z})).concat(state.position);if(target)points.push(target);const xs=points.map(row=>row.x),zs=points.map(row=>row.z),minX=Math.min(...xs)-6,maxX=Math.max(...xs)+6,minZ=Math.min(...zs)-6,maxZ=Math.max(...zs)+6,w=Math.max(1,maxX-minX),h=Math.max(1,maxZ-minZ),point=(x,z)=>({x:(x-minX)/w*100,y:(z-minZ)/h*100}),me=point(state.position.x,state.position.z);
    const marks=rows.map(row=>{const mark=point(row.x,row.z);return `<i class="map-mark" style="left:${mark.x}%;top:${mark.y}%" title="${String(row.label||row.id)}"><span>${String(row.label||row.id).slice(0,3)}</span></i>`;}).join('');let route='',targetMark='';if(target){const end=point(target.x,target.z),dx=end.x-me.x,dy=end.y-me.y,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)*180/Math.PI;route=`<i class="map-guide-line" style="left:${me.x}%;top:${me.y}%;width:${len}%;transform:rotate(${angle}deg)"></i>`;targetMark=`<b class="map-target" style="left:${end.x}%;top:${end.y}%"><span>${target.label}</span></b>`;}
    ui.body.innerHTML=`<div class="upgrade-map"><div class="map-grid"></div>${route}${marks}${targetMark}<b class="map-player" style="left:${me.x}%;top:${me.y}%"></b></div><p class="map-caption">${layout.name||'村'}${target?` · ${target.text}`:' · 現在地と主要施設'}</p>`;
  }
  function record(){
    ui.title.textContent='記 · 人生と系譜';ui.body.innerHTML='';const current=document.createElement('section');current.className='life-record-current';current.innerHTML='<span>現在の人生</span><strong></strong><small></small>';current.querySelector('strong').textContent=`${state.generation}代目 · ${Math.floor(state.ageYears||0)}歳`;current.querySelector('small').textContent=`撃破 ${state.defeats||0} · 凱旋 ${state.returns||0} · 故郷 ${state.homelands?.length||0}`;ui.body.append(current);
    const experiences=Object.entries(state.experiences||{}).sort((a,b)=>Number(b[1]?.score||0)-Number(a[1]?.score||0)).slice(0,4);if(experiences.length){const exp=document.createElement('section');exp.className='life-record-experience';exp.innerHTML='<h3>この生涯の経験</h3>';for(const [kind,row] of experiences){const item=document.createElement('p');item.innerHTML=`<strong>${kind}</strong><span>${Number(row?.score||0).toFixed(1)}</span>`;exp.append(item);}ui.body.append(exp);}
    const lineage=[...(state.lineage||[])].reverse(),pages=Math.max(1,Math.ceil(lineage.length/3));recordPage=Math.min(recordPage,pages-1);const list=document.createElement('section');list.className='lineage-list';list.innerHTML='<h3>一族の記録</h3>';const pageRows=lineage.slice(recordPage*3,recordPage*3+3);if(!pageRows.length){const empty=document.createElement('p');empty.className='loadout-empty';empty.textContent='まだ前世の記録はありません。';list.append(empty);}for(const row of pageRows){const card=document.createElement('article');card.className='lineage-card';card.innerHTML='<span></span><strong></strong><small></small>';card.querySelector('span').textContent=`${row.generation}代目`;card.querySelector('strong').textContent=`${row.name||'旅人'} · ${row.age||0}歳`;card.querySelector('small').textContent=`撃破 ${row.defeats||0}${row.returnedHome?' · 帰還済み':''}`;list.append(card);}ui.body.append(list);const nav=pager(lineage.length,recordPage,next=>{recordPage=next;audio.ui();record();});if(nav)ui.body.append(nav);
  }
  function markOpenControl(type){ui.combat.dataset.active=String(['heart','technique','body'].includes(type));ui.items.dataset.active=String(type==='items');ui.map.dataset.active=String(type==='map');ui.record.dataset.active=String(type==='record');}
  function open(type,{skillId=null,silent=false}={}){
    if(!state)return;ui.panel.hidden=false;ui.panel.dataset.type=type;markOpenControl(type);
    if(type==='heart')loadoutUI.renderHeart(skillId);else if(type==='technique')loadoutUI.renderTechnique(skillId);else if(type==='body')loadoutUI.renderBody();else if(type==='items')inventory();else if(type==='record')record();else map();
    if(!silent)audio.ui();
  }
  function close(){ui.panel.hidden=true;delete ui.panel.dataset.type;ui.panel.style.removeProperty('--loadout-sheet-drag');delete ui.panel.dataset.dragging;markOpenControl('');audio.ui();}
  function bindState(next){state=next;const lifeChanged=tracker.bindState(next);if(lifeChanged){loadoutUI.reset();recordPage=0;inventoryPages={weapon:0,armor:0,shield:0};if(!ui.panel.hidden){ui.panel.hidden=true;delete ui.panel.dataset.type;markOpenControl('');}}}
  function refresh(){if(ui.panel.hidden||!state)return;open(ui.panel.dataset.type||'items',{silent:true});}
  function setGuidance(next){guidance=next;if(!ui.panel.hidden&&ui.panel.dataset.type==='map')map();}
  function summary(s,{dashing=false,resting=false,training=null}={}){
    state=s;speech.sync();loadoutUI.syncCombat(s);ui.name.textContent=`${s.name||'旅人'} · ${Math.floor(s.ageYears||0)}歳`;ui.equip.textContent=`${WEAPON_LABELS[s.equipment?.weapon]||'素手'} · ${ARMOR_LABELS[s.equipment?.armor]||'旅装'}`;
    ui.state.textContent=s.down?'救助待ち':resting?'休憩':dashing?'疾走':s.combat||training?.d<2.8?'戦闘態勢':'探索';ui.rest.hidden=!resting;ui.dash.dataset.active=String(dashing);const engaged=training?.d<2.8;ui.training.hidden=!engaged;if(engaged)ui.trainingName.textContent=training.label;
    const phase=s.combat&&!s.combat.training&&!s.down&&!s.ended?(s.combat.sharedPhase||s.combat.phase||''):'';ui.phase.hidden=!phase;for(const node of ui.phase.querySelectorAll('[data-phase-id]'))node.dataset.active=String(node.dataset.phaseId===phase);if(phase&&phase!==lastPhase){lastPhase=phase;haptic(8);audio.ui();}if(!phase)lastPhase='';
  }
  function bindSheetGesture(){
    const header=ui.panel.querySelector('header');header.addEventListener('pointerdown',event=>{if(!['heart','technique','body'].includes(ui.panel.dataset.type)||event.target.closest('button'))return;sheetDrag={id:event.pointerId,startY:event.clientY,dy:0};header.setPointerCapture?.(event.pointerId);ui.panel.dataset.dragging='true';});
    header.addEventListener('pointermove',event=>{if(!sheetDrag||sheetDrag.id!==event.pointerId)return;sheetDrag.dy=Math.max(0,event.clientY-sheetDrag.startY);ui.panel.style.setProperty('--loadout-sheet-drag',`${Math.min(120,sheetDrag.dy)}px`);event.preventDefault();});
    const finish=event=>{if(!sheetDrag||sheetDrag.id!==event.pointerId)return;const shouldClose=sheetDrag.dy>=64;sheetDrag=null;ui.panel.style.setProperty('--loadout-sheet-drag','0px');delete ui.panel.dataset.dragging;if(shouldClose)close();};header.addEventListener('pointerup',finish);header.addEventListener('pointercancel',finish);
  }
  function enhanceLifeEndDialog(dialog){
    if(!state||dialog.dataset.contractEnhanced==='true')return;const form=dialog.querySelector('form'),age=dialog.querySelector('#life-end-age'),name=dialog.querySelector('#life-end-name'),summaryNode=dialog.querySelector('.life-end-summary'),select=dialog.querySelector('#rebirth-village'),rebirth=dialog.querySelector('#rebirth');if(!form||!age||!name||!summaryNode||!select||!rebirth)return;dialog.dataset.contractEnhanced='true';const preview=rebirthPreview(state,{villageLabel:select.selectedOptions?.[0]?.textContent||'出生先'}),steps=[document.createElement('section'),document.createElement('section'),document.createElement('section')];steps.forEach((step,index)=>{step.className='life-end-step';step.dataset.step=String(index);});
    steps[0].append(age,name,summaryNode);const keep=document.createElement('div');keep.className='rebirth-contract';keep.innerHTML='<h3>次の人生へ残るもの</h3><ul data-keep></ul><h3>この生涯で手放すもの</h3><ul data-reset></ul>';for(const text of preview.preserved){const li=document.createElement('li');li.textContent=text;keep.querySelector('[data-keep]').append(li);}for(const text of preview.reset){const li=document.createElement('li');li.textContent=text;keep.querySelector('[data-reset]').append(li);}steps[1].append(keep);const label=document.createElement('label');label.textContent='次の出生';label.append(select);const help=document.createElement('p');help.className='life-end-help';help.textContent='決定するまで転生は発生しません。出生先を確認してから次の人生へ進みます。';steps[2].append(label,help);
    const nav=document.createElement('nav');nav.className='life-end-nav';const back=document.createElement('button'),next=document.createElement('button');back.type=next.type='button';back.textContent='戻る';next.textContent='次へ';nav.append(back,next);form.replaceChildren(...steps,nav,rebirth);let index=0;const sync=()=>{steps.forEach((step,i)=>step.hidden=i!==index);back.hidden=index===0;next.hidden=index===steps.length-1;rebirth.hidden=index!==steps.length-1;rebirth.textContent='次の人生へ';};back.onclick=()=>{index=Math.max(0,index-1);audio.ui();sync();};next.onclick=()=>{index=Math.min(steps.length-1,index+1);audio.ui();sync();};sync();
  }
  const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes){if(!(node instanceof Element))continue;const dialog=node.matches?.('.life-end-dialog')?node:node.querySelector?.('.life-end-dialog');if(dialog)enhanceLifeEndDialog(dialog);}});observer.observe(document.body,{childList:true,subtree:true});

  tracker.bindInteractions({openHeart:skillId=>open('heart',{skillId}),openTechnique:skillId=>open('technique',{skillId})});bindSheetGesture();
  ui.combat.onclick=()=>open('technique',{skillId:tracker.firstUnseen('technique')});ui.items.onclick=()=>open('items');ui.map.onclick=()=>open('map');ui.record.onclick=()=>open('record');ui.close.onclick=close;
  return{...ui,bindState,refresh,open,close,discover:ids=>tracker.discover(ids),summary,setGuidance,dispose(){clearTimeout(movementHelpTimer);clearTimeout(toastTimer);observer.disconnect();moveHint?.removeEventListener('click',showMovementHelp,{capture:true});loadoutUI.dispose();tracker.dispose();speech.dispose();root.remove();}};
}
