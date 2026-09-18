import {defs,ready,RESOURCE_NAMES,DAYS_YEAR} from '../game/core.js';
import {installEventChronicle} from './event-chronicle.js';
import {installPopulationHistory} from './population-history.js';

const ICONS={
 people:'<circle cx="7.5" cy="8" r="2.6"/><circle cx="16.5" cy="9" r="2.1"/><path d="M3 20v-1.7c0-3.3 2-5.2 4.5-5.2s4.5 1.9 4.5 5.2V20m2-6.1c3.8-.7 6.5 1.4 6.5 5.1v1"/>',
 bed:'<path d="M4 20V7m0 8h16v5M4 12h6a3 3 0 0 1 3 3M4 9h4a2 2 0 0 1 2 2v1m10 8v-8"/>',
 arrival:'<path d="M4 21V4h9v17M4 7h9"/><circle cx="8.5" cy="11" r="1.5"/><path d="M16 9v8m-3-3 3 3 3-3"/>',
 shield:'<path d="M12 3 20 6v6c0 4.6-3.1 7.7-8 9-4.9-1.3-8-4.4-8-9V6Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
 facility:'<path d="M3 21V11l6 3v-4l6 4V7h6v14ZM17 7V3h3v4M7 18h2m4 0h2m4 0h1"/>',
 settings:'<path d="m9 3-.8 3-2.8 1-.4 3-2 2 2 2 .4 3 2.8 1 .8 3h6l.8-3 2.8-1 .4-3 2-2-2-2-.4-3-2.8-1L15 3Z"/><circle cx="12" cy="12" r="3"/>',
 events:'<path d="M5 3h14v18H5ZM9 7h6m-6 5h6m-6 5h4"/>',
 mayor:'<circle cx="12" cy="9" r="3"/><path d="M5 21c0-9 14-9 14 0M7 5l2-3 3 2 3-2 2 3"/>',
 wood:'<path d="M5 7h11a4 4 0 0 1 0 8H5Z"/><ellipse cx="5" cy="11" rx="2.5" ry="4"/><path d="m13 8 5 9M9 15l5 4"/>',
 stone:'<path d="m4 15 3-7 5-4 6 3 3 8-5 5H8Z"/><path d="m7 8 5 4 6-5m-6 5-4 8"/>',
 plank:'<path d="M4 5h16v5H4Zm2 9h14v5H6Z"/><path d="M8 7h7m-5 9h6"/>',
 clay:'<path d="M8 6c1.8-2 6.2-2 8 0l2 13H6Z"/><path d="M7 12h10M9 6c0 1 1.3 2 3 2s3-1 3-2"/>',
 food:'<path d="M4 13h16c-.7 4.5-3.3 7-8 7s-7.3-2.5-8-7Z"/><path d="M8 10c-1.3-2 .2-4 2.2-5M13 10c-1.1-2.1.5-4.6 2.6-6M17 11c.8-1.2.6-2.4-.1-3.4"/>',
 seed:'<path d="M7 15c-3.5-1-4.2-5.2-.8-7.2 3.2.8 4.2 4.8.8 7.2Zm7-2c-2-3 .1-6.4 3.6-6.2 1.8 3-.2 6.2-3.6 6.2Z"/><path d="M12 21c0-4-1.7-6.8-5-8m5 8c0-3.7.9-6.3 3-8"/>',
 herb:'<path d="M12 21V7"/><path d="M12 11C7 11 5 8 5 5c4.4-.6 7 1.8 7 6Zm0 5c5 0 7-3 7-6-4.4-.6-7 1.8-7 6Z"/><path d="M9 19H5m10-1h4"/>',
 ore:'<path d="m4 15 3-7 6-4 6 4 2 7-5 5H8Z"/><path d="m9 9 3 2 3-3m-1 7 2 1m-8 0 2-2"/><path d="m19 3 .5 1.5L21 5l-1.5.5L19 7l-.5-1.5L17 5l1.5-.5Z"/>',
 metal:'<path d="M6 9h12l3 8H3Z"/><path d="m6 9 3-4h8l1 4m-9 4h6"/>',
 cloth:'<path d="M6 4h12v16H6Z"/><path d="M9 4v16m6-16v16M6 9c3 1.5 9 1.5 12 0m-12 6c3 1.5 9 1.5 12 0"/>',
 leather:'<path d="M9 3c1.3 1 4.7 1 6 0l2 4 4 2-2 4 1 5-5 3-3-2-3 2-5-3 1-5-2-4 4-2Z"/><path d="M9 8c1.8 1.2 4.2 1.2 6 0"/>',
 medicine:'<path d="M9 3h6v4l2 3v10H7V10l2-3Z"/><path d="M9 7h6m-3 5v5m-2.5-2.5h5"/>',
 knowledge:'<path d="M3 6c3-1 6-.6 9 1.5V20c-3-2-6-2.5-9-1.5Zm18 0c-3-1-6-.6-9 1.5V20c3-2 6-2.5 9-1.5Z"/><path d="M7 10h2m-2 3h2m6-3h2m-2 3h2"/>',
 crystal:'<path d="m12 3 7 6-4 11H9L5 9Z"/><path d="m5 9 7 3 7-3m-7 3-3 8m3-8 3 8m-3-8V3"/>',
 charm:'<path d="M12 3c-3 0-5 2-5 5s2 5 5 5 5-2 5-5-2-5-5-5Z"/><path d="M9 13 7 21l5-3 5 3-2-8"/><path d="M10 8h4m-2-2v4"/>',
 gear:'<path d="m5 19 12-12m-8-2 10 10M4 20l3-1-2-2Zm13-14 2-2 1 4Z"/><path d="M13 17c2.5-2.5 5.5-1 6 2-3 .5-4.5-1-6-2Z"/>',
 furnishing:'<path d="M7 4h10v8H7Zm1 8v8m8-8v8M5 15h14"/><path d="M10 7h4"/>',
 generic:'<path d="m12 2 9 5v10l-9 5-9-5V7Zm0 10L3 7m9 5 9-5m-9 5v10"/>'
};
const svg=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||ICONS.generic}</svg>`;
const hudIcon=name=>`<span class="muraHudIcon" data-icon="${name}">${svg(name)}</span>`;
const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};

/** Explicit views of game state. No polling that changes catalog or input state. */
export function installInterface(village){
 const {world,view,ui,more,observePerson,frameHooks}=village;
 const $=id=>document.getElementById(id);
 const hud=$('idleStatus');hud.setAttribute('aria-label','村の状況');
 hud.innerHTML=`<div class="muraHudMain"><button id="muraHudToggle" aria-expanded="false" aria-controls="muraHudDetails"><span class="muraHudKicker">村のようす</span><span class="muraHudClock"></span><span class="muraHudBrief"></span><span class="muraHudChevron" aria-hidden="true">⌄</span></button><div class="muraHudActions"><button id="muraFollowMayor" aria-label="村長を追う" title="村長">${svg('mayor')}</button><button id="muraEventButton" aria-label="出来事" title="出来事">${svg('events')}</button><button id="muraSettingsButton" aria-label="設定" title="設定">${svg('settings')}</button></div></div><div id="muraHudDetails" hidden><div class="muraHudTabs" role="tablist" aria-label="村情報"><button id="muraHudLifeTab" class="muraHudTab is-active" type="button" role="tab" aria-selected="true" aria-controls="muraHudLifePanel">暮らし</button><button id="muraHudResourceTab" class="muraHudTab" type="button" role="tab" aria-selected="false" aria-controls="muraHudResourcePanel">資材</button></div><section id="muraHudLifePanel" class="muraHudPage" role="tabpanel" aria-labelledby="muraHudLifeTab"><div class="muraHudSectionHead"><small class="muraHudCapacityHint"></small></div><dl class="muraHudStats"></dl></section><section id="muraHudResourcePanel" class="muraHudPage" role="tabpanel" aria-labelledby="muraHudResourceTab" hidden><div class="muraHudSectionHead"><small>いま使える在庫</small><span class="muraHudResourcePageLabel"></span></div><div class="muraHudResources"></div><div class="muraHudPager" hidden><button id="muraHudResourcePrev" type="button" aria-label="前の資材">‹</button><span class="muraHudPageDots" aria-hidden="true"></span><button id="muraHudResourceNext" type="button" aria-label="次の資材">›</button></div></section></div>`;
 const toggle=$('muraHudToggle'),details=$('muraHudDetails'),clock=hud.querySelector('.muraHudClock'),brief=hud.querySelector('.muraHudBrief'),capacityHint=hud.querySelector('.muraHudCapacityHint'),lifeTab=$('muraHudLifeTab'),resourceTab=$('muraHudResourceTab'),lifePanel=$('muraHudLifePanel'),resourcePanel=$('muraHudResourcePanel'),resourceList=hud.querySelector('.muraHudResources'),resourcePageLabel=hud.querySelector('.muraHudResourcePageLabel'),resourcePager=hud.querySelector('.muraHudPager'),resourcePrev=$('muraHudResourcePrev'),resourceNext=$('muraHudResourceNext'),resourceDots=hud.querySelector('.muraHudPageDots');
 const setExpanded=expanded=>{details.hidden=!expanded;toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-label',expanded?'村の状況を閉じる':'村の状況を詳しく見る');hud.classList.toggle('muraHudExpanded',expanded);};
 const setHudPage=page=>{const resources=page==='resources';lifePanel.hidden=resources;resourcePanel.hidden=!resources;lifeTab.classList.toggle('is-active',!resources);resourceTab.classList.toggle('is-active',resources);lifeTab.setAttribute('aria-selected',String(!resources));resourceTab.setAttribute('aria-selected',String(resources));lifeTab.tabIndex=resources?-1:0;resourceTab.tabIndex=resources?0:-1;};
 setHudPage('life');setExpanded(false);toggle.onclick=()=>setExpanded(details.hidden);lifeTab.onclick=()=>setHudPage('life');resourceTab.onclick=()=>setHudPage('resources');
 $('muraFollowMayor').onclick=()=>{const p=world.people.find(p=>p.role==='mayor');if(p)observePerson(p.id);};
 const chronicle=installEventChronicle({world,eventButton:$('muraEventButton')}),populationHistory=installPopulationHistory({world});
 const openSettings=()=>{more();populationHistory.attachSettings($('dialogContent'),openSettings);};
 $('muraSettingsButton').onclick=openSettings;
 $('muraEndObservation').onclick=()=>{view.endObservation();view.focus(view.target.x,view.target.z,Math.max(32,view.span));village.activity();};
 const modes=$('muraModeControls'),modeLabel=document.createElement('small');modeLabel.id='muraModeLabel';modes.prepend(modeLabel);
 // Put related surfaces in ordinary document flow. Header expansion moves
 // modes and tutorial in the same layout pass, without a one-frame overlap.
 const stack=document.createElement('div');stack.id='muraTopStack';document.body.append(stack);
 stack.append(hud,modes,$('tutorial'));
 const progress=document.createElement('div');progress.id='muraConstructionLayer';document.body.append(progress);
 const bars=new Map();let lastTick=0,resourceSignature=null,statsSignature='',lastRoom=null,lastObserved=null,resourcePage=0,resourceKeys=[];
 const RESOURCE_PAGE_SIZE=6;
 const renderResourcePage=()=>{
  const pageCount=Math.max(1,Math.ceil(resourceKeys.length/RESOURCE_PAGE_SIZE));resourcePage=Math.min(Math.max(0,resourcePage),pageCount-1);
  resourceList.replaceChildren();
  if(!resourceKeys.length){const empty=document.createElement('p');empty.className='muraHudEmpty';empty.textContent='まだ資材はありません';resourceList.append(empty);}
  else for(const k of resourceKeys.slice(resourcePage*RESOURCE_PAGE_SIZE,(resourcePage+1)*RESOURCE_PAGE_SIZE)){const chip=document.createElement('span'),value=Math.floor(world.state.stock[k]);chip.className='muraHudResource muraTone-'+k;chip.title=`${RESOURCE_NAMES[k]} ${value}`;chip.setAttribute('aria-label',`${RESOURCE_NAMES[k]} ${value}`);chip.innerHTML=hudIcon(k)+`<small>${RESOURCE_NAMES[k]}</small><b>${value}</b>`;resourceList.append(chip);}
  const paged=pageCount>1;resourcePager.hidden=!paged;resourcePageLabel.textContent=paged?`${resourcePage+1} / ${pageCount}`:'';resourcePrev.disabled=resourcePage===0;resourceNext.disabled=resourcePage>=pageCount-1;resourceDots.textContent=paged?Array.from({length:pageCount},(_,i)=>i===resourcePage?'●':'○').join(' '):'';resourcePanel.setAttribute('aria-label',`資材 ${resourcePage+1} / ${pageCount}`);
 };
 resourcePrev.onclick=()=>{if(resourcePage>0){resourcePage--;renderResourcePage();}};
 resourceNext.onclick=()=>{const pageCount=Math.max(1,Math.ceil(resourceKeys.length/RESOURCE_PAGE_SIZE));if(resourcePage<pageCount-1){resourcePage++;renderResourcePage();}};
 function statusTick(now){
  const climate=window.__MURAAAAAAA_V2_UI__?.currentClimate(),year=Math.floor(world.state.clock/DAYS_YEAR)+1,population=world.population();
  const seasons={spring:'春',summer:'夏',autumn:'秋',winter:'冬'},weather={clear:'晴',rain:'雨',cloudy:'曇',snow:'雪',wind:'風'};
  const hour=Math.floor(world.state.time),min=Math.floor((world.state.time-hour)*60);
  text(clock,`${seasons[climate?.season]||'春'} · ${weather[climate?.weather]||'晴'} · ${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`);
  text(brief,`${year}年目 · ${population.people}人暮らし`);
  const built=world.objects.filter(o=>ready(o)&&defs[o.kind]?.building),reception=Math.min(population.limit,population.openBeds),headroom=Math.max(0,reception-population.people);
  text(capacityHint,headroom>0?`あと${headroom}人迎えられます`:population.openBeds<=population.people?'寝床を増やすと次の住人を迎えられます':population.reason);
  const stats=[['people','住人',population.people,'人'],['bed','寝床',population.openBeds,'人分'],['arrival','受入目安',population.limit,'人'],['shield','守り',population.safety,''],['food','食事',population.food,''],['facility','施設',built.length,'棟']],statsSig=stats.map(([,label,value])=>`${label}:${value}`).join('|');
  if(statsSig!==statsSignature){statsSignature=statsSig;hud.querySelector('.muraHudStats').innerHTML=stats.map(([icon,label,value,unit])=>`<div class="muraHudStat muraTone-${icon}">${hudIcon(icon)}<dt>${label}</dt><dd><b>${value}</b>${unit?`<small>${unit}</small>`:''}</dd></div>`).join('');}
  const resources=world.state.known.filter(k=>world.state.stock[k]>=1),resourceSig=resources.map(k=>k+Math.floor(world.state.stock[k])).join();
  if(resourceSig!==resourceSignature){resourceSignature=resourceSig;resourceKeys=resources;const pageCount=Math.max(1,Math.ceil(resourceKeys.length/RESOURCE_PAGE_SIZE));resourcePage=Math.min(resourcePage,pageCount-1);renderResourcePage();}
  const observing=view.observation?.id||null;
  if(lastRoom!==view.roomId||lastObserved!==observing){
   lastRoom=view.roomId;lastObserved=observing;
   modes.hidden=!view.roomId&&!observing;
   $('leaveRoom').hidden=!view.roomId;$('muraEndObservation').hidden=!observing;
   text(modeLabel,view.roomId?defs[world.object(view.roomId)?.kind]?.label||'内装':world.people.find(p=>p.id===observing)?.name||'観察');
  }
  const chromeBlocked=ui.entryOpen||ui.drawer||ui.pending||ui.selected||ui.dialogPage||document.querySelector('dialog[open]')||view.observation;
  chronicle.sync(now,{blocked:!!chromeBlocked});
  const pending=world.objects.filter(o=>o.phase==='planned'||o.phase==='building'||o.upgrade),ids=new Set(pending.map(o=>o.id));
  for(const[id,node]of bars)if(!ids.has(id)){node.remove();bars.delete(id);}
  for(const o of pending.slice(0,12)){
   let node=bars.get(o.id);if(!node){node=document.createElement('div');node.className='muraConstructionBar';node.dataset.objectId=o.id;node.innerHTML='<small></small><progress max="1"></progress>';progress.append(node);bars.set(o.id,node);}
   const value=Math.max(0,Math.min(1,Number(o.upgrade?.progress??o.progress)||0));
   text(node.querySelector('small'),o.phase==='planned'?'建材待ち':`${o.upgrade?'増築':'建築'} ${Math.floor(value*100)}%`);
   node.querySelector('progress').value=value;node.querySelector('progress').setAttribute('aria-label',`${defs[o.kind].label} ${o.upgrade?'増築':'建築'}`);
  }
 }
 frameHooks.add((now)=>{
  if(now-lastTick>180){lastTick=now;statusTick(now);}
  const hudBottom=hud.getBoundingClientRect().bottom;
  for(const[id,node]of bars){const o=world.object(id);if(!o)continue;const p=view.project(o.x,4.5,o.z);node.hidden=ui.entryOpen||!!ui.pending||!!view.roomId||!!view.observation||p.x<25||p.x>view.w-25||p.y<hudBottom+12||p.y>view.h-95;node.style.left=p.x+'px';node.style.top=p.y+'px';}
 });
 modes.hidden=true;statusTick(performance.now());
 installUiFeedback(village);
}

function installUiFeedback({info}){
 let ctx=null,last=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const ping=kind=>{
  try{
   const A=window.AudioContext||window.webkitAudioContext;if(!A)return;ctx??=new A();void ctx.resume();
   let volume=.4;try{volume=JSON.parse(localStorage.getItem(`soul.${info.environment}.village.device.music.v1`))?.volume??.4;}catch{}
   const o=ctx.createOscillator(),g=ctx.createGain(),now=ctx.currentTime;
   o.type='sine';o.frequency.setValueAtTime(kind==='confirm'?660:440,now);o.frequency.exponentialRampToValueAtTime(kind==='confirm'?880:520,now+.065);
   g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(Math.max(.0001,volume*.09),now+.008);g.gain.exponentialRampToValueAtTime(.0001,now+.11);
   o.connect(g).connect(ctx.destination);o.onended=()=>{o.disconnect();g.disconnect();};o.start(now);o.stop(now+.12);
  }catch{/* Audio failure must not prevent a UI action. */}
 };
 document.addEventListener('click',e=>{
  const target=e.target.closest?.('button');if(!target||target.disabled||performance.now()-last<45)return;last=performance.now();
  ping(/配置|開始|入る|増築|初期化/.test(target.textContent||'')?'confirm':'tap');
  if(!reduced.matches)target.animate([{filter:'brightness(1.14)',scale:'.965'},{filter:'brightness(1)',scale:'1'}],{duration:210});
 },{capture:true});
 document.addEventListener('change',e=>{if(e.target.matches('input[type=range],select'))ping('tap');});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&ctx)void ctx.suspend();});
}
