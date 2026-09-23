import { ARMOR_LABELS, WEAPON_LABELS, ensureProgression } from './gameplay-world.js';
import { EXPERIENCES } from './rebuild/domain.js';
import { createConversationInput } from './rebuild/conversation-input.js';
import { rebirthPreview } from './rebuild/gameplay-contract.js';
import { createSkillSetter } from './skill-setter.js';
import { createHeartTechniqueBodyUI } from './heart-technique-body-ui.js';
import { decorateSelectionDetail, installSelectionDetail } from './selection-detail.js';
import {syncCombatSequence} from '@soul/shared-ui/combat-sequence';
import {rinnePrimaryFourMarkup} from '@soul/shared-ui/rinne-primary-four';
import {rinneLoadoutPanelMarkup} from '@soul/shared-ui/rinne-loadout-menu';
import {sequenceHudState,meleeSequenceHudState} from './combat-sequence-hud.js';
import {combatSkillForPhase,techniqueName} from './combat-loadout.js';
import {tidebreakMindVectorFor} from './rebuild/combat-tactics.js';
import './rebuild/conversation-input.css';
import './skill-setter.css';
import './heart-technique-body.css';
import '@soul/shared-ui/combat-sequence.css';
// Final gameplay skin: keep this last so runtime-imported UI styles cannot flatten the HUD.
import './dark-navy-hud.css';
import './playable-core-ui.css';
import './rinne-world-ui.css';
import '@soul/shared-ui/rinne-loadout-menu.css';
import './combat-exchange-cue.css';
import './johakyu-battle-hud.css';
import '@soul/shared-ui/rinne-primary-four.css';
import {RINNE_UI_VERSION} from './ui-version.js';
import {createRinnePlayerHud,rinnePlayerNameFromSeed} from '@soul/shared-ui/rinne-player-hud';
import '@soul/shared-ui/rinne-player-hud.css';
import {createCombatBodyHud} from './combat-body-hud.js';

const haptic=pattern=>{try{globalThis.navigator?.vibrate?.(pattern);}catch{}};
const PAGE_SIZE=6;
const GRID_PAGE_SIZE=12,RADAR_RANGE=28;
const esc=value=>String(value??'').replace(/[&<>\"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#39;"}[ch]));
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export function createGameplayUI(gameScreen,{stations,layout,audio,requestEquip}){
  const root=document.createElement('div');
  root.className='rinne-gameplay-upgrade';
  root.innerHTML=`
    <aside data-player-hud class="rinne-player-hud-host" aria-label="プレイヤー情報HUD"></aside>
    <aside data-combat-body-hud class="combat-body-hud-host" aria-label="身体部位HUD"></aside>
    <section class="rinne-player-strip rinne-player-ghost" data-player-info aria-label="プレイヤー情報">
      <div class="player-identity"><strong data-name>旅人</strong><small data-state>探索</small></div>
      <div class="player-equipment"><span>装</span><strong data-equip>素手 · 旅装</strong></div>
      <div data-talent-tags class="player-talent-tags" aria-label="人物タグ"></div>
    </section>
    <small class="gameplay-surface-version">UI ${RINNE_UI_VERSION}</small>
    <section data-vitals class="rinne-context-vitals" hidden aria-label="息"><div data-vital-breath class="context-vital is-breath"><span>息</span><i><b data-context-stamina></b></i></div></section>
    <aside data-mind class="rinne-mind-balance" hidden aria-label="現在の意識バランス"><span class="mind-title">意識</span><div class="mind-orbit" aria-hidden="true"><i data-axis="attack"><b>攻</b></i><i data-axis="guard"><b>守</b></i><i data-axis="spacing"><b>間</b></i><i data-axis="counter"><b>返</b></i><i data-axis="mobility"><b>機</b></i><i data-axis="survival"><b>生</b></i><em></em></div><strong data-mind-state>中庸</strong></aside>
    <div data-phase class="combat-phase-indicator battle-sequence-hud" data-combat-sequence data-combat-sequence-phase="idle" hidden aria-label="間合いから残心までの序破急">
      <div data-phase-techniques class="battle-sequence-techniques" aria-label="序破急で使用した技">
        <span class="battle-sequence-technique-lane" data-technique-phase="jo"></span>
        <span class="battle-sequence-technique-lane" data-technique-phase="ha"></span>
        <span class="battle-sequence-technique-lane" data-technique-phase="kyu"></span>
      </div>
      <aside class="battle-sequence-hud__phase combat-sequence combat-sequence--flat" data-phase-track data-phase="idle">
        <span class="battle-sequence-hud__edge battle-sequence-hud__edge--maai" aria-hidden="true"><svg viewBox="0 0 42 18"><path d="M1 9h6c2.2 0 2.8-2.2 4.1-2.2l2.6 6.7L17.2 2l3.7 14.1 3.5-9.7 2.7 4.2c1.1 1.7 2.4 2.4 4.3 2.4H41"/></svg></span>
        <span class="battle-sequence-hud__step combat-sequence__step" data-phase-id="jo" data-combat-phase="jo">序</span>
        <i class="battle-sequence-hud__wave combat-sequence__link" data-link="jo-ha" data-combat-link="jo-ha" aria-hidden="true"></i>
        <span class="battle-sequence-hud__step combat-sequence__step" data-phase-id="ha" data-combat-phase="ha">破</span>
        <i class="battle-sequence-hud__wave combat-sequence__link" data-link="ha-kyu" data-combat-link="ha-kyu" aria-hidden="true"></i>
        <span class="battle-sequence-hud__step combat-sequence__step" data-phase-id="kyu" data-combat-phase="kyu">急</span>
        <span class="battle-sequence-hud__edge battle-sequence-hud__edge--zanshin" aria-hidden="true"><svg viewBox="0 0 42 18"><path d="M1 9h5.5c2.1 0 2.7-1.8 4-1.8l2.5 5.6L16.3 4l3.4 10.9 3.4-7.7 2.8 3.6c1.2 1.5 2.6 2.2 4.6 2.2H41"/></svg></span>
      </aside>
      <span data-exchange-cue class="combat-exchange-cue" role="status" hidden></span>
      <strong data-phase-action class="combat-phase-action combat-sequence__action" hidden></strong>
      <div data-phase-history class="combat-phase-history combat-sequence__history" aria-live="polite"></div>
    </div>

    ${rinnePrimaryFourMarkup({ariaLabel:'主要操作'})}

    <button data-training-strike class="rinne-context-strike" type="button" hidden><i aria-hidden="true">打</i><span>稽古</span></button>
    <button data-menu class="rinne-record-toggle" type="button" aria-expanded="false" aria-label="地図と人生の記録を開く"><i aria-hidden="true">記</i><span>記録</span></button>

    <aside data-quick-menu class="rinne-quick-menu rinne-secondary-sheet" hidden aria-label="地図と人生の記録">
      <header><span>旅の記録</span><small>地図と一族</small></header>
      <div class="rinne-secondary-grid">
        <button data-map class="quick-menu-action quick-map is-map" type="button" aria-label="地図を開く"><b>図</b><span>地図</span><small data-radar-label>村</small><strong data-radar-distance>--</strong><span data-radar-places hidden></span><em data-radar-target hidden></em><i data-radar-player hidden></i></button>
        <button data-record class="quick-menu-action is-record" type="button" aria-label="人生と系譜を開く"><b>譜</b><span>人生</span><small>一族の記録</small></button>
      </div>
    </aside>

    <button data-one-motion class="one-motion-control" type="button" hidden><b>奥</b><span><strong data-one-motion-name>奥義</strong><small>消耗大 / 隙大</small></span></button>
    ${rinneLoadoutPanelMarkup()}
    <aside data-spark class="technique-spark" role="status" aria-live="polite" hidden><div><span>ひらめいた！</span><strong data-spark-name></strong><small>技として覚えた</small></div><button data-spark-set type="button">うれしい</button></aside>
    <div data-rest class="upgrade-rest" hidden><span></span><strong>ひとやすみ</strong><small>息を整えている</small></div>
    <div data-training class="upgrade-training" hidden><strong>かかし</strong><span data-training-name>稽古</span><small>近づくと稽古できる</small></div>`;
  gameScreen.append(root);

  const dash=document.createElement('button');dash.type='button';dash.hidden=true;
  const q=s=>root.querySelector(s),panel=q('[data-panel]'),playerHud=createRinnePlayerHud(q('[data-player-hud]')),combatBodyHud=createCombatBodyHud({root:q('[data-combat-body-hud]')}),ui={
    root,dash,
    heart:q('[data-heart]'),techniques:q('[data-techniques]'),trainingStrike:q('[data-training-strike]'),menu:q('[data-menu]'),quickMenu:q('[data-quick-menu]'),bodyButton:q('[data-body]'),items:q('[data-items]'),map:q('[data-map]'),record:q('[data-record]'),phase:q('[data-phase]'),phaseHistory:q('[data-phase-history]'),phaseAction:q('[data-phase-action]'),exchangeCue:q('[data-exchange-cue]'),phaseTrack:q('[data-phase-track]'),phaseTechniques:q('[data-phase-techniques]'),
    radarPlaces:q('[data-radar-places]'),radarTarget:q('[data-radar-target]'),radarPlayer:q('[data-radar-player]'),radarDistance:q('[data-radar-distance]'),radarLabel:q('[data-radar-label]'),
    oneMotion:q('[data-one-motion]'),oneMotionName:q('[data-one-motion-name]'),panel,title:q('[data-title]'),body:panel.querySelector('[data-body]'),close:q('[data-close]'),spark:q('[data-spark]'),sparkName:q('[data-spark-name]'),sparkSet:q('[data-spark-set]'),
    rest:q('[data-rest]'),training:q('[data-training]'),trainingName:q('[data-training-name]'),name:q('[data-name]'),equip:q('[data-equip]'),state:q('[data-state]'),talentTags:q('[data-talent-tags]'),
    vitals:q('[data-vitals]'),vitalBreath:q('[data-vital-breath]'),contextStamina:q('[data-context-stamina]'),
    mind:q('[data-mind]'),mindState:q('[data-mind-state]')
  };
  let state=null,sheetDrag=null,movementHelpTimer=0,toastTimer=0,interruptTimer=0,guidance=null,inventoryKind='weapon',inventoryPages={weapon:0,armor:0,shield:0},recordPage=0,recordSection='life',lastPhase='',lastAction='',phaseHistory=[],comboInterrupted=false,currentComboKey='',exchangeHistoryKey='',lastTechniqueKey='',techniqueTimer=0;
  let lastStamina=null,breathVisibleUntil=0,contextAnchorVisible=false,contextVitalsWanted=false;
  const speech=createConversationInput({document,window,root:gameScreen,getState:()=>state});
  const tracker=createSkillSetter({ui,audio,getState:()=>state});
  const loadoutUI=createHeartTechniqueBodyUI({ui,audio,getState:()=>state,tracker});
  const selectionDetail=installSelectionDetail({root,panel,audio});
  const moveHint=gameScreen.querySelector('#move-hint');
  const notify=text=>{const node=document.getElementById('toast');if(!node||!text)return;node.textContent=text;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{node.hidden=true;},2200);};
  const closeQuickMenu=()=>{if(!ui.quickMenu)return;ui.quickMenu.hidden=true;ui.menu.dataset.active='false';ui.menu.setAttribute('aria-expanded','false');root.dataset.hubOpen='false';};
  const toggleQuickMenu=()=>{const open=ui.quickMenu.hidden;ui.quickMenu.hidden=!open;ui.menu.dataset.active=String(open);ui.menu.setAttribute('aria-expanded',String(open));root.dataset.hubOpen=String(open);if(open)audio.ui();};
  const phaseLabel=phase=>({jo:'序',ha:'破',kyu:'急'})[phase]||'';
  function renderPhaseHistory(){
    if(!ui.phaseHistory)return;
    ui.phaseHistory.replaceChildren();
    phaseHistory.slice(0,2).forEach((row,index)=>{
      const item=document.createElement('span');item.dataset.age=String(index);item.dataset.motion=index===0?'incoming':'outgoing';item.dataset.kind=row.kind||'action';
      const label=phaseLabel(row.phase);if(label){const badge=document.createElement('b');badge.textContent=label;item.append(badge);}
      item.append(document.createTextNode(row.action));ui.phaseHistory.append(item);
    });
  }
  function pushPhaseHistory(row){
    const action=String(row?.action||'').trim();if(!action)return;
    const next={phase:row?.phase||'',action,kind:row?.kind||'action'},previous=phaseHistory[0];
    if(previous&&previous.phase===next.phase&&previous.action===next.action&&previous.kind===next.kind)return;
    phaseHistory=[next,...phaseHistory].slice(0,2);renderPhaseHistory();
  }
  function setCompletedPhases(completed={}){
    for(const node of ui.phase.querySelectorAll('[data-combat-phase]')){node.dataset.completed=String(Boolean(completed[node.dataset.combatPhase]));node.dataset.lit=String(node.dataset.active==='true'||completed[node.dataset.combatPhase]);}
    for(const node of ui.phase.querySelectorAll('[data-combat-link]')){const lit=node.dataset.combatLink==='jo-ha'?completed.ha:completed.kyu;node.dataset.lit=String(Boolean(lit));node.dataset.current=String(node.dataset.combatLink==='jo-ha'?ui.phase.dataset.phase==='jo':ui.phase.dataset.phase==='ha');}
  }
  function endInterruptionVisual(){
    if(!ui.phase)return;
    delete ui.phase.dataset.comboInterrupted;
    delete ui.phaseTrack.dataset.comboInterrupted;
    for(const node of ui.phase.querySelectorAll('.combat-sequence__interrupted'))node.classList.remove('combat-sequence__interrupted');
  }
  function interruptSequence(){
    if(!ui.phase)return;
    clearTimeout(interruptTimer);
    const highlighted=[...ui.phase.querySelectorAll('[data-combat-phase]')].filter(node=>node.dataset.active==='true'||node.dataset.completed==='true');
    for(const node of highlighted)node.classList.add('combat-sequence__interrupted');
    ui.phase.dataset.comboInterrupted='true';ui.phaseTrack.dataset.comboInterrupted='true';
    ui.phaseTechniques.replaceChildren();lastTechniqueKey='';ui.phase.dataset.comboActive='false';ui.phase.dataset.phase='idle';ui.phaseTrack.dataset.phase='idle';
    syncCombatSequence(ui.phase,'',{pulse:false});setCompletedPhases();
    interruptTimer=setTimeout(()=>{interruptTimer=0;comboInterrupted=false;endInterruptionVisual();},680);
  }
  const onCombatFeedback=event=>{
    if(event.detail?.type!=='enemy-hit')return;combatBodyHud?.flash(event.detail?.bodyPart);
    pushPhaseHistory({action:'攻撃を受けた',kind:'damage'});
    const exchange=event.detail.exchange||state?.combat?.exchange;
    const retaining=state?.combat?.engine==='tidebreak'&&exchange?.mode==='pressure'&&exchange.initiativeId===state.id;
    if(currentComboKey&&!retaining){comboInterrupted=true;interruptSequence();lastPhase='';haptic([18,28,12]);}
  };
  gameScreen.addEventListener('rinne:combat-feedback',onCombatFeedback);
  const showMovementHelp=event=>{
    event.stopImmediatePropagation();
    notify(moveHint?.textContent?.includes('母')?'抱っこ中も画面をスワイプすると、母に抱かれたまま村を見て回れます。':'スワイプで移動。素早くフリックするとダッシュ、画面長押しで休憩して息を回復します。');
  };
  moveHint?.addEventListener('click',showMovementHelp,{capture:true});

  function pager(total,current,onChange){
    const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));if(pages<=1)return null;current=Math.min(Math.max(0,current),pages-1);const nav=document.createElement('nav');nav.className='panel-pager';const prev=document.createElement('button'),meta=document.createElement('span'),next=document.createElement('button');prev.type=next.type='button';prev.textContent='‹';next.textContent='›';prev.disabled=current<=0;next.disabled=current>=pages-1;meta.textContent=`${current+1} / ${pages}`;prev.onclick=()=>onChange(current-1);next.onclick=()=>onChange(current+1);nav.append(prev,meta,next);return nav;
  }
  function inventoryConfig(kind){
    if(kind==='weapon')return{title:'武器',items:state.inventory.weapons,active:state.equipment.weapon,label:value=>WEAPON_LABELS[value]||value,meta:'得物'};
    if(kind==='armor')return{title:'防具',items:state.inventory.armors,active:state.equipment.armor,label:value=>ARMOR_LABELS[value]||value,meta:'身を守る'};
    return{title:'盾',items:state.inventory.shields,active:Boolean(state.equipment.shield),label:value=>value?'盾あり':'盾なし',meta:'受け'};
  }
  function inventory(){
    ensureProgression(state);ui.title.textContent='装 · 武具';ui.body.innerHTML='';
    const kinds=[['weapon','武器'],['armor','防具'],['shield','盾']],slots=document.createElement('section');slots.className='loadout-slot-row';
    for(const [kind,label] of kinds){const config=inventoryConfig(kind),button=document.createElement('button');button.type='button';button.className='loadout-slot';button.dataset.selected=String(inventoryKind===kind);button.dataset.choiceGlyph=kind==='weapon'?'武':kind==='armor'?'鎧':'盾';button.innerHTML='<span></span><strong></strong><small></small>';button.querySelector('span').textContent=label;button.querySelector('strong').textContent=config.label(config.active);button.querySelector('small').textContent=inventoryKind===kind?'選択先':config.meta;decorateSelectionDetail(button,{kicker:`${label}の装着枠`,title:config.label(config.active),summary:config.meta,status:inventoryKind===kind?'選択先':'装備中'});button.onclick=()=>{inventoryKind=kind;inventoryPages[kind]=inventoryPages[kind]||0;audio.ui();inventory();};slots.append(button);}
    ui.body.append(slots);
    const config=inventoryConfig(inventoryKind),library=document.createElement('section');library.className='loadout-library';library.innerHTML='<header><strong></strong><small></small></header><div class="loadout-grid"></div>';library.querySelector('header strong').textContent='所持している装備';library.querySelector('header small').textContent='7歳以降、村の武具置き場付近で変更';
    const list=library.querySelector('.loadout-grid'),pages=Math.max(1,Math.ceil(config.items.length/GRID_PAGE_SIZE)),page=Math.min(inventoryPages[inventoryKind]||0,pages-1);inventoryPages[inventoryKind]=page;
    for(const item of config.items.slice(page*GRID_PAGE_SIZE,page*GRID_PAGE_SIZE+GRID_PAGE_SIZE)){const button=document.createElement('button');button.type='button';button.className='loadout-grid-item';button.dataset.active=String(item===config.active);button.dataset.choiceGlyph=inventoryKind==='weapon'?'武':inventoryKind==='armor'?'鎧':'盾';button.innerHTML='<strong></strong><small></small>';button.querySelector('strong').textContent=config.label(item);button.querySelector('small').textContent=item===config.active?'装備中':'装備する';decorateSelectionDetail(button,{kicker:config.title,title:config.label(item),summary:config.meta,status:item===config.active?'装備中':'所持'});button.onclick=()=>{const result=requestEquip?.(inventoryKind,item)||{ok:false,reason:'身支度を変更できません。'};if(!result.ok){notify(result.reason);haptic(18);return;}if(result.changed){audio.item();haptic(10);notify(`${config.label(item)}に変更`);}inventory();};list.append(button);}
    if(!config.items.length){const empty=document.createElement('p');empty.className='loadout-empty';empty.textContent='所持品がありません。';list.append(empty);}
    ui.body.append(library);const nav=pager(config.items.length,page,next=>{inventoryPages[inventoryKind]=next;audio.ui();inventory();});if(nav)ui.body.append(nav);
  }
  function majorPlaces(){
    const seen=new Set(),rows=[];
    for(const row of stations){if(!row||row.interiorId||row.id?.startsWith('rack.')||row.id?.startsWith('room.')||row.id?.startsWith('exit.')||row.id?.startsWith('door.')||row.trainingDummy||!Number.isFinite(row.x)||!Number.isFinite(row.z))continue;const key=row.entityId||row.id;if(seen.has(key))continue;seen.add(key);rows.push(row);}
    return rows;
  }
  function placeCategory(row){
    const key=`${row?.id||''} ${row?.facilityKind||''}`;
    if(row?.port||/port|harbor/.test(key))return'port';
    if(/smith|weapon/.test(key))return'forge';
    if(/clinic/.test(key))return'heal';
    if(/dojo|training/.test(key))return'train';
    if(/school|library/.test(key))return'learn';
    if(/home|garden|campfire/.test(key))return'home';
    if(/chapel/.test(key))return'faith';
    return'place';
  }
  function placeGlyph(row){return({port:'港',forge:'鍛',heal:'治',train:'稽',learn:'学',home:'暮',faith:'祈',place:'地'})[placeCategory(row)]||'地';}
  function updateRadar(){
    if(!state||!ui.map)return;
    const places=majorPlaces(),near=places.map(row=>({...row,d:Math.hypot(row.x-state.position.x,row.z-state.position.z)})).filter(row=>row.d<=RADAR_RANGE).sort((a,b)=>a.d-b.d).slice(0,8);
    ui.radarPlaces.innerHTML=near.map(row=>{const dx=(row.x-state.position.x)/RADAR_RANGE*42,dz=(row.z-state.position.z)/RADAR_RANGE*42;return `<i data-category="${placeCategory(row)}" style="left:${50+clamp(dx,-42,42)}%;top:${50-clamp(dz,-42,42)}%" title="${esc(row.label||row.id)}"></i>`;}).join('');
    ui.radarPlayer.style.transform=`translate(-50%,-50%) rotate(${Number(state.yaw)||0}rad)`;
    const target=guidance?.navigation&&Number.isFinite(guidance.navigation.x)&&Number.isFinite(guidance.navigation.z)?guidance.navigation:null;
    if(target){const dx=target.x-state.position.x,dz=target.z-state.position.z,len=Math.max(.001,Math.hypot(dx,dz)),scale=Math.min(42,(len/RADAR_RANGE)*42);ui.radarTarget.hidden=false;ui.radarTarget.style.left=`${50+dx/len*scale}%`;ui.radarTarget.style.top=`${50-dz/len*scale}%`;ui.radarDistance.textContent=`${target.distance}m`;ui.radarLabel.textContent=target.label;ui.map.setAttribute('aria-label',`地図を開く。${target.label}まで${target.distance}m`);}
    else{ui.radarTarget.hidden=true;ui.radarDistance.textContent='MAP';ui.radarLabel.textContent=state.zone==='frontier'?'前線':'村';ui.map.setAttribute('aria-label','地図を開く');}
  }
  function map(){
    ui.title.textContent='地図 · 方位盤';
    const target=guidance?.navigation&&Number.isFinite(guidance.navigation.x)&&Number.isFinite(guidance.navigation.z)?guidance.navigation:null,rows=state.zone==='village'?majorPlaces():[];
    const points=rows.map(row=>({x:row.x,z:row.z})).concat(state.position);if(target)points.push(target);
    const xs=points.map(row=>row.x),zs=points.map(row=>row.z),minX=Math.min(...xs)-8,maxX=Math.max(...xs)+8,minZ=Math.min(...zs)-8,maxZ=Math.max(...zs)+8,w=Math.max(1,maxX-minX),h=Math.max(1,maxZ-minZ),point=(x,z)=>({x:(x-minX)/w*100,y:(maxZ-z)/h*100}),me=point(state.position.x,state.position.z);
    const marks=rows.map(row=>{const mark=point(row.x,row.z);return `<i class="map-feature" data-category="${placeCategory(row)}" style="left:${mark.x}%;top:${mark.y}%" title="${esc(row.label||row.id)}"><b>${placeGlyph(row)}</b><span>${esc(String(row.label||row.id).slice(0,7))}</span></i>`;}).join('');
    let route='',targetMark='';if(target){const end=point(target.x,target.z),dx=end.x-me.x,dy=end.y-me.y,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)*180/Math.PI;route=`<i class="map-guide-line" style="left:${me.x}%;top:${me.y}%;width:${len}%;transform:rotate(${angle}deg)"></i>`;targetMark=`<b class="map-target" style="left:${end.x}%;top:${end.y}%"><span>${esc(target.label)}</span></b>`;}
    const nearest=rows.map(row=>({...row,d:Math.hypot(row.x-state.position.x,row.z-state.position.z)})).sort((a,b)=>a.d-b.d).slice(0,5);
    ui.body.innerHTML=`<section class="map-rich-shell">
      <header class="map-status-ribbon"><span>${state.zone==='frontier'?'前線':'村'}</span><strong>${target?esc(target.text):'現在地を中心に表示'}</strong><small>北固定 · 矢印は向いている方向</small></header>
      <div class="upgrade-map map-rich"><div class="map-grid"></div><div class="map-compass"><b>N</b><i>E</i><em>S</em><u>W</u></div>${route}${marks}${targetMark}<b class="map-player" style="left:${me.x}%;top:${me.y}%;transform:translate(-50%,-50%) rotate(${Number(state.yaw)||0}rad)"></b><span class="map-scale">約 ${Math.max(10,Math.round(w/4))}m</span></div>
      <div class="map-legend"><span data-category="home">暮 暮らし</span><span data-category="learn">学 学び</span><span data-category="train">稽 稽古</span><span data-category="forge">鍛 武具</span><span data-category="port">港 遠征</span></div>
      <div class="map-nearby-grid">${nearest.map(row=>`<span><b>${placeGlyph(row)}</b><strong>${esc(String(row.label||row.id).slice(0,6))}</strong><small>${Math.round(row.d)}m</small></span>`).join('')||'<span><strong>周辺施設なし</strong></span>'}</div>
    </section>`;
  }
  function recordTabs(){const nav=document.createElement('nav');nav.className='record-tabs';nav.setAttribute('aria-label','人生記録の分類');for(const [section,label] of [['life','今生'],['lineage','系譜']]){const button=document.createElement('button');button.type='button';button.dataset.active=String(recordSection===section);button.textContent=label;button.onclick=()=>{recordSection=section;audio.ui();record();};nav.append(button);}return nav;}
  function timeRatePanel(){
    const clock=document.getElementById('clock-rate'),locked=Boolean(clock?.disabled),current=Number(clock?.value||state.clockRate)||1,section=document.createElement('section');section.className='time-rate-panel';section.innerHTML='<header><strong>世界時計</strong><small></small></header><div></div>';section.querySelector('small').textContent=locked?'共有世界では変更できません':'人生の時計だけを変更';
    for(const rate of [1,5,10,20]){const button=document.createElement('button');button.type='button';button.textContent=`${rate}×`;button.dataset.active=String(current===rate);button.disabled=!clock||locked;button.onclick=()=>{if(!clock||locked)return;clock.value=String(rate);clock.textContent=`${rate}×`;clock.onchange?.({target:clock});audio.ui();record();};section.querySelector('div').append(button);}return section;
  }
  function inheritanceBrief(){const preview=rebirthPreview(state),section=document.createElement('section');section.className='record-inheritance-brief';section.innerHTML='<h3>次の人生</h3><div><b>残る</b><span></span><b>新生で戻る</b><span></span></div>';section.querySelectorAll('span')[0].textContent='一族の記録・帰還して刻んだ故郷';section.querySelectorAll('span')[1].textContent='年齢・体力・装備・戦技編成・この生涯の経験';section.dataset.lifeYears=String(preview.lifeYears);return section;}
  function record(){
    ui.title.textContent='記 · 人生と系譜';ui.body.innerHTML='';ui.body.append(recordTabs());
    if(recordSection==='life'){
      const current=document.createElement('section');current.className='life-record-current';current.innerHTML='<span>現在の人生</span><strong></strong><small></small>';current.querySelector('strong').textContent=`${state.generation}代目 · ${Math.floor(state.ageYears||0)}歳`;current.querySelector('small').textContent=`撃破 ${state.defeats||0} · 凱旋 ${state.returns||0} · 故郷 ${state.homelands?.length||0}`;ui.body.append(current,timeRatePanel());
      const experiences=Object.entries(state.experiences||{}).sort((a,b)=>Number(b[1]?.score||0)-Number(a[1]?.score||0)).slice(0,4);if(experiences.length){const exp=document.createElement('section');exp.className='life-record-experience';exp.innerHTML='<h3>この生涯の経験</h3>';for(const [kind,row] of experiences){const item=document.createElement('p');item.innerHTML='<strong></strong><span></span>';item.querySelector('strong').textContent=EXPERIENCES[kind]||kind;item.querySelector('span').textContent=Number(row?.score||0).toFixed(1);exp.append(item);}ui.body.append(exp);}ui.body.append(inheritanceBrief());return;
    }
    const lineage=[...(state.lineage||[])].reverse(),pages=Math.max(1,Math.ceil(lineage.length/3));recordPage=Math.min(recordPage,pages-1);const list=document.createElement('section');list.className='lineage-list';list.innerHTML='<h3>一族の記録</h3>';const pageRows=lineage.slice(recordPage*3,recordPage*3+3);if(!pageRows.length){const empty=document.createElement('p');empty.className='loadout-empty';empty.textContent='まだ前世の記録はありません。';list.append(empty);}for(const row of pageRows){const card=document.createElement('article');card.className='lineage-card';card.innerHTML='<span></span><strong></strong><small></small>';card.querySelector('span').textContent=`${row.generation}代目`;card.querySelector('strong').textContent=`${row.name||'旅人'} · ${row.age||0}歳`;card.querySelector('small').textContent=`撃破 ${row.defeats||0}${row.returnedHome?' · 帰還済み':''}`;list.append(card);}ui.body.append(list);const nav=pager(lineage.length,recordPage,next=>{recordPage=next;audio.ui();record();});if(nav)ui.body.append(nav);
  }
  function markOpenControl(type){ui.heart.dataset.active=String(type==='heart');ui.techniques.dataset.active=String(type==='technique');ui.bodyButton.dataset.active=String(type==='body');ui.items.dataset.active=String(type==='items');ui.map.dataset.active=String(type==='map');ui.record.dataset.active=String(type==='record');}
  function open(type,{skillId=null,silent=false}={}){
    if(!state)return;closeQuickMenu();selectionDetail.close();ui.panel.hidden=false;ui.panel.dataset.type=type;root.dataset.panelOpen='true';gameScreen.dataset.archiveOpen='true';markOpenControl(type);
    if(type==='heart')loadoutUI.renderHeart(skillId);else if(type==='technique')loadoutUI.renderTechnique(skillId);else if(type==='body')loadoutUI.renderBody();else if(type==='items')inventory();else if(type==='record')record();else map();
    if(!silent)audio.ui();
  }
  function close(){selectionDetail.close();ui.panel.hidden=true;delete ui.panel.dataset.type;delete root.dataset.panelOpen;delete gameScreen.dataset.archiveOpen;ui.panel.style.removeProperty('--loadout-sheet-drag');delete ui.panel.dataset.dragging;markOpenControl('');audio.ui();}
  function toggle(type,options={}){if(!ui.panel.hidden&&ui.panel.dataset.type===type){close();return;}open(type,options);}
  function bindState(next){state=next;const lifeChanged=tracker.bindState(next);if(lifeChanged){loadoutUI.reset();recordPage=0;recordSection='life';inventoryPages={weapon:0,armor:0,shield:0};if(!ui.panel.hidden){ui.panel.hidden=true;delete ui.panel.dataset.type;delete root.dataset.panelOpen;delete gameScreen.dataset.archiveOpen;markOpenControl('');}}}
  function refresh(){if(ui.panel.hidden||!state)return;open(ui.panel.dataset.type||'items',{silent:true});}
  function setGuidance(next){guidance=next;updateRadar();if(!ui.panel.hidden&&ui.panel.dataset.type==='map')map();}
  function syncContextVitalsVisibility(){ui.vitals.hidden=!(contextVitalsWanted&&contextAnchorVisible);}
  function setContextAnchor({x=0,y=0,visible=true}={}){
    contextAnchorVisible=Boolean(visible&&Number.isFinite(x)&&Number.isFinite(y));
    if(contextAnchorVisible){ui.vitals.style.left=`${x}px`;ui.vitals.style.top=`${y}px`;}
    syncContextVitalsVisibility();
  }
  function updateContextVitals(s,{dashing=false,resting=false,training=null}={}){
    const now=performance.now(),stamina=Math.max(0,Number(s.stamina)||0),cap=Math.max(1,Number(s.staminaCap)||100);
    const staminaRatio=clamp(stamina/cap,0,1),staminaChanged=lastStamina!==null&&Math.abs(stamina-lastStamina)>.01,combat=Boolean((s.combat&&!s.combat.training)||training?.d<2.8);
    if(staminaChanged)breathVisibleUntil=now+1250;
    const showBreath=Boolean(resting||dashing||combat||staminaRatio<.55||now<breathVisibleUntil);
    contextVitalsWanted=showBreath;ui.vitalBreath.hidden=!showBreath;
    ui.contextStamina.style.width=`${Math.round(staminaRatio*100)}%`;ui.vitalBreath.dataset.low=String(staminaRatio<.22);
    ui.vitals.setAttribute('aria-label',`息 ${Math.round(stamina)}/${Math.round(cap)}`);
    lastStamina=stamina;syncContextVitalsVisibility();
  }
  function updateMindBalance(s,training=null){
    const active=Boolean(((s.combat&&!s.combat.training)||training?.d<2.8)&&!s.down&&!s.ended);ui.mind.hidden=!active;if(!active)return;
    const vector=tidebreakMindVectorFor(s),labels={attack:'攻め',guard:'守り',spacing:'間合い',counter:'返し',mobility:'機動',survival:'生存'};let dominant='attack',best=-1;
    for(const node of ui.mind.querySelectorAll('[data-axis]')){const key=node.dataset.axis,value=clamp(Number(vector?.[key]??.5),0,1);node.style.opacity=String(.3+value*.7);node.style.transform=`scale(${(.78+value*.26).toFixed(3)})`;node.dataset.strong=String(value>=.68);if(value>best){best=value;dominant=key;}}
    ui.mindState.textContent=labels[dominant]||'中庸';ui.mind.dataset.dominant=dominant;
  }
  function summary(s,{dashing=false,resting=false,training=null}={}){
    state=s;if(ui.panel&&!ui.panel.hidden&&!ui.panel.dataset.type)close();speech.sync();loadoutUI.syncCombat(s);const hudName=s.name&&s.name!=='旅人'?s.name:rinnePlayerNameFromSeed(s.seed);ui.name.textContent=hudName;playerHud?.update({name:hudName,age:s.ageYears});combatBodyHud?.update(s);ui.equip.textContent=`${WEAPON_LABELS[s.equipment?.weapon]||'素手'} · ${ARMOR_LABELS[s.equipment?.armor]||'旅装'}`;
    const talents=s.inspiration?.talents||[],tags=[];if(talents.includes('tenyo'))tags.push('天与');if(talents.includes('sui'))tags.push('彗');ui.talentTags.replaceChildren(...tags.map(label=>{const tag=document.createElement('span');tag.textContent=label;return tag;}));ui.talentTags.hidden=!tags.length;updateRadar();
    ui.state.textContent=s.down?'救助待ち':resting?'休憩':dashing?'疾走':s.combat||training?.d<2.8?'戦闘態勢':'探索';ui.rest.hidden=!resting;ui.dash.dataset.active=String(dashing);const engaged=training?.d<2.8;ui.training.hidden=!engaged;ui.trainingStrike.hidden=!engaged||s.down||s.ended;ui.trainingStrike.dataset.ready=String(engaged);if(engaged){ui.trainingName.textContent=training.label;ui.trainingStrike.setAttribute('aria-label',`${training.label}を打って稽古する`);}updateContextVitals(s,{dashing,resting,training});updateMindBalance(s,training);
    const phase=s.combat&&!s.combat.training&&!s.down&&!s.ended?(s.combat.sharedPhase||s.combat.phase||''):'';
    ui.phase.hidden=!(phase||(s.combat?.engine==='tidebreak'&&s.combat?.exchange&&!s.down&&!s.ended));
    const sharedAction=s.combat?.engine==='johakyu'?s.combat?.johakyuAction:null;
    const rawAction=phase?(sharedAction?String(sharedAction.name||''):s.combat?.engine==='johakyu'?'':gameScreen.dataset.sharedCombatAttack||s.combat?.tidebreakPose?.attack||''):'';
    const exchangeCombat=['tidebreak','johakyu'].includes(s.combat?.engine);
    const readSequence=()=>exchangeCombat?meleeSequenceHudState({combat:s.combat,actorId:s.id,attack:rawAction,interrupted:comboInterrupted}):sequenceHudState({phase,attack:rawAction,interrupted:comboInterrupted});
    let sequence=readSequence();
    ui.phase.dataset.battleEngine=exchangeCombat?s.combat.engine:'';
    if(sharedAction){ui.phase.dataset.techniqueId=sharedAction.techniqueId;ui.phase.dataset.stageIndex=String(sharedAction.stageIndex);ui.phase.dataset.stageLabel=sharedAction.stageLabel||'';}
    else{delete ui.phase.dataset.techniqueId;delete ui.phase.dataset.stageIndex;delete ui.phase.dataset.stageLabel;}
    ui.phase.dataset.exchangeState=sequence.hudState||'';
    ui.phase.dataset.exchangeIntent=sequence.exchangeIntent||'';
    const phaseTechnique=phase?String(sharedAction?.name||s.combat?.tidebreakPose?.skill||techniqueName(combatSkillForPhase(s,s.combat,phase),s)||'').trim():'';
    ui.exchangeCue.hidden=!phaseTechnique;if(ui.exchangeCue.textContent!==phaseTechnique)ui.exchangeCue.textContent=phaseTechnique;
    if(exchangeCombat&&sequence.historyKey!==exchangeHistoryKey){exchangeHistoryKey=sequence.historyKey;phaseHistory=[];lastAction='';lastPhase='';renderPhaseHistory();}
    
    if(sequence.comboActive&&ui.phase.dataset.comboInterrupted==='true'&&!comboInterrupted){clearTimeout(interruptTimer);interruptTimer=0;endInterruptionVisual();}
    currentComboKey=sequence.key;ui.phase.dataset.comboActive=String(sequence.comboActive);ui.phase.dataset.phase=sequence.comboActive?sequence.activePhase:'idle';ui.phaseTrack.dataset.phase=sequence.hudState||ui.phase.dataset.phase;
    syncCombatSequence(ui.phase,sequence.comboActive?sequence.activePhase:'',{pulse:sequence.comboActive});setCompletedPhases(sequence.completed);
    const action=rawAction;if(ui.phaseAction){ui.phaseAction.textContent='';ui.phaseAction.hidden=true;}
    if(sharedAction?.id&&sharedAction.stageIndex===0&&phase&&sequence.comboActive){
      const key=[sharedAction.id,phase,sharedAction.techniqueId].join(':');
      if(key!==lastTechniqueKey){lastTechniqueKey=key;const lane=ui.phaseTechniques.querySelector(`[data-technique-phase="${phase}"]`);if(lane){const name=document.createElement('span');name.className='battle-sequence-technique-name';name.dataset.phase=phase;name.textContent=phaseTechnique;lane.replaceChildren(name);clearTimeout(techniqueTimer);techniqueTimer=setTimeout(()=>name.remove(),2500);}}
    }
    if(sequence.comboActive&&sequence.activePhase!==lastPhase){lastPhase=sequence.activePhase;haptic(8);audio.ui();}else if(!sequence.comboActive)lastPhase='';
    if(action&&action!==lastAction){lastAction=action;if(sequence.comboActive)pushPhaseHistory({phase:sequence.activePhase,action});}
    if(!phase&&!exchangeCombat){lastPhase='';lastAction='';lastTechniqueKey='';ui.phaseTechniques.replaceChildren();clearTimeout(techniqueTimer);comboInterrupted=false;currentComboKey='';exchangeHistoryKey='';phaseHistory=[];renderPhaseHistory();endInterruptionVisual();}
  }
  function bindSheetGesture(){
    const header=ui.panel.querySelector('header');header.addEventListener('pointerdown',event=>{if(!['heart','technique','body','items'].includes(ui.panel.dataset.type)||event.target.closest('button'))return;sheetDrag={id:event.pointerId,startY:event.clientY,dy:0};header.setPointerCapture?.(event.pointerId);ui.panel.dataset.dragging='true';});
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
  ui.menu.onclick=()=>{if(!ui.panel.hidden)close();toggleQuickMenu();};ui.heart.onclick=()=>toggle('heart',{skillId:tracker.firstUnseen('heart')});ui.techniques.onclick=()=>toggle('technique',{skillId:tracker.firstUnseen('technique')});ui.bodyButton.onclick=()=>toggle('body');ui.items.onclick=()=>toggle('items');ui.trainingStrike.addEventListener('click',()=>{closeQuickMenu();if(!ui.panel.hidden)close();},{capture:true});ui.map.onclick=()=>toggle('map');ui.record.onclick=()=>toggle('record');ui.close.onclick=close;
  let lastModelPortraitAt=-Infinity;
  return{...ui,bindState,refresh,open,close,discover:ids=>tracker.discover(ids),summary,setGuidance,setContextAnchor,renderPlayerPortrait:render=>{if(!render||!playerHud)return false;const now=performance.now();if(now-lastModelPortraitAt<180)return true;const drawn=render(playerHud.canvas);if(drawn){lastModelPortraitAt=now;playerHud.markPortrait('model');}return drawn;},capturePlayerPortrait:(source,options)=>playerHud?.capture(source,options),dispose(){clearTimeout(movementHelpTimer);clearTimeout(toastTimer);clearTimeout(interruptTimer);observer.disconnect();gameScreen.removeEventListener('rinne:combat-feedback',onCombatFeedback);moveHint?.removeEventListener('click',showMovementHelp,{capture:true});selectionDetail.dispose();loadoutUI.dispose();combatBodyHud?.destroy();playerHud?.destroy();tracker.dispose();speech.dispose();root.remove();}};
}
