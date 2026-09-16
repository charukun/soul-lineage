import { ARMOR_LABELS, WEAPON_LABELS, ensureProgression } from './gameplay-world.js';
import { createConversationInput } from './rebuild/conversation-input.js';
import { createSkillSetter } from './skill-setter.js';
import './rebuild/conversation-input.css';
import './skill-setter.css';

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
  let state=null;
  const speech=createConversationInput({document,window,root:gameScreen,getState:()=>state});
  const skillSetter=createSkillSetter({ui,audio,getState:()=>state});

  function inventory(){
    ensureProgression(state);ui.title.textContent='所持品';ui.body.innerHTML='<p class="upgrade-panel-copy">施設で受け取った装備や、冒険で拾った装備を持ち替えます。</p>';
    const group=(title,items,active,set,label)=>{const section=document.createElement('section');section.className='inventory-group';section.innerHTML=`<h3>${title}</h3>`;const list=document.createElement('div');list.className='inventory-list';for(const item of items){const button=document.createElement('button');button.dataset.active=String(item===active);button.textContent=label(item);button.onclick=()=>{set(item);audio.item();inventory();};list.append(button);}section.append(list);ui.body.append(section);};
    group('武器',state.inventory.weapons,state.equipment.weapon,value=>state.equipment.weapon=value,value=>WEAPON_LABELS[value]||value);
    group('防具',state.inventory.armors,state.equipment.armor,value=>state.equipment.armor=value,value=>ARMOR_LABELS[value]||value);
    group('盾',state.inventory.shields,Boolean(state.equipment.shield),value=>state.equipment.shield=Boolean(value),value=>value?'盾あり':'盾なし');
  }
  function map(){
    ui.title.textContent='地図';const rows=stations.filter(row=>!row.interiorId&&!row.id.startsWith('rack.')&&!row.id.includes('dummy')).slice(0,20),xs=rows.map(row=>row.x).concat(state.position.x),zs=rows.map(row=>row.z).concat(state.position.z),minX=Math.min(...xs)-6,maxX=Math.max(...xs)+6,minZ=Math.min(...zs)-6,maxZ=Math.max(...zs)+6,w=Math.max(1,maxX-minX),h=Math.max(1,maxZ-minZ),point=(x,z)=>({x:(x-minX)/w*100,y:(z-minZ)/h*100}),me=point(state.position.x,state.position.z);
    const marks=rows.map(row=>{const mark=point(row.x,row.z);return `<i class="map-mark" style="left:${mark.x}%;top:${mark.y}%"><span>${String(row.label||row.id).slice(0,3)}</span></i>`;}).join('');
    ui.body.innerHTML=`<div class="upgrade-map"><div class="map-grid"></div>${marks}<b class="map-player" style="left:${me.x}%;top:${me.y}%"></b></div><p class="map-caption">${layout.name||'村'} · 現在地と主要施設</p>`;
  }
  function markOpenControl(type){ui.techniques.dataset.active=String(type==='skills');ui.mind.dataset.active=String(type==='mind');ui.items.dataset.active=String(type==='items');ui.map.dataset.active=String(type==='map');}
  function open(type,{skillId=null,silent=false,keepScroll=false}={}){
    if(!state)return;ui.panel.hidden=false;ui.panel.dataset.type=type;markOpenControl(type);
    if(type==='skills')skillSetter.renderSkills(skillId,{keepScroll});else if(type==='mind')skillSetter.renderMind();else if(type==='items')inventory();else map();
    if(!silent)audio.ui();
  }
  function close(){ui.panel.hidden=true;delete ui.panel.dataset.type;ui.panel.style.removeProperty('--skill-sheet-drag');delete ui.panel.dataset.dragging;markOpenControl('');audio.ui();}
  function bindState(next){
    state=next;const lifeChanged=skillSetter.bindState(next);if(lifeChanged&&!ui.panel.hidden&&['skills','mind'].includes(ui.panel.dataset.type)){ui.panel.hidden=true;delete ui.panel.dataset.type;markOpenControl('');}
  }
  function refresh(){if(ui.panel.hidden||!state)return;open(ui.panel.dataset.type||'items',{silent:true,keepScroll:true,skillId:skillSetter.firstUnseen()});}
  function summary(s,{dashing=false,resting=false,training=null}={}){
    state=s;speech.sync();ui.name.textContent=`${s.name||'旅人'} · ${Math.floor(s.ageYears||0)}歳`;ui.equip.textContent=`${WEAPON_LABELS[s.equipment?.weapon]||'素手'} · ${ARMOR_LABELS[s.equipment?.armor]||'旅装'}`;
    ui.state.textContent=s.down?'行動不能':resting?'休憩':dashing?'疾走':s.combat||training?.d<2.8?'戦闘態勢':'探索';ui.rest.hidden=!resting;ui.dash.dataset.active=String(dashing);const engaged=training?.d<2.8;ui.training.hidden=!engaged;if(engaged)ui.trainingName.textContent=training.label;
  }

  skillSetter.bindInteractions({openSkills:skillId=>open('skills',{skillId}),close});
  ui.mind.onclick=()=>open('mind');ui.items.onclick=()=>open('items');ui.map.onclick=()=>open('map');ui.close.onclick=close;
  return{...ui,bindState,refresh,open,close,discover:ids=>skillSetter.discover(ids),summary,dispose(){skillSetter.dispose();speech.dispose();root.remove();}};
}
