import {defs,ready,capacityOf,RESOURCE_NAMES,DAYS_YEAR} from '../game/core.js';

const ICONS={
 people:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 21v-3c0-6 12-6 12 0v3m1-8c4-1 7 1 7 5v3"/>',
 homes:'<path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/>',
 facility:'<path d="M3 21V9l7 3V7l7 5V3h4v18ZM7 17h1m4 0h1m4 0h1"/>',
 settings:'<path d="m9 3-.8 3-2.8 1-.4 3-2 2 2 2 .4 3 2.8 1 .8 3h6l.8-3 2.8-1 .4-3 2-2-2-2-.4-3-2.8-1L15 3Z"/><circle cx="12" cy="12" r="3"/>',
 events:'<path d="M5 3h14v18H5ZM9 7h6m-6 5h6m-6 5h4"/>',
 mayor:'<circle cx="12" cy="9" r="3"/><path d="M5 21c0-9 14-9 14 0M7 5l2-3 3 2 3-2 2 3"/>',
 wood:'<path d="m4 8 12-4 4 12-12 4Z"/><ellipse cx="7" cy="14" rx="3" ry="6" transform="rotate(-18 7 14)"/>',
 stone:'<path d="m4 8 5-5 10 4 3 9-8 5-11-4Z"/>',
 plank:'<path d="m3 7 14-4 4 14-14 4ZM7 8l3 10m2-12 3 10"/>',
 food:'<path d="M12 22V4m0 5C4 8 4 3 5 2c5 1 7 3 7 7m0 5c8-1 8-6 7-7-5 1-7 3-7 7m0 5c-8-1-8-6-7-7 5 1 7 3 7 7"/>',
 generic:'<path d="m12 2 9 5v10l-9 5-9-5V7Zm0 10L3 7m9 5 9-5m-9 5v10"/>'
};
const svg=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||ICONS.generic}</svg>`;
const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};

/** Explicit views of game state. No polling that changes catalog or input state. */
export function installInterface(village){
 const {world,view,ui,more,observePerson,toast,frameHooks,eventHooks}=village;
 const $=id=>document.getElementById(id);
 const hud=$('idleStatus');hud.setAttribute('aria-label','村の今');
 hud.innerHTML=`<div class="muraHudMain"><button id="muraHudToggle" aria-expanded="false" aria-controls="muraHudDetails"><span class="muraHudClock"></span><span class="muraHudBrief"></span><span class="muraHudChevron" aria-hidden="true">⌄</span></button><div class="muraHudActions"><button id="muraFollowMayor" aria-label="村長を追う" title="村長">${svg('mayor')}</button><button id="muraEventButton" aria-label="出来事" title="出来事">${svg('events')}</button><button id="muraSettingsButton" aria-label="設定" title="設定">${svg('settings')}</button></div></div><div id="muraHudDetails" hidden><div class="muraHudStats"></div><div class="muraHudResources"></div></div>`;
 const toggle=$('muraHudToggle'),details=$('muraHudDetails'),clock=hud.querySelector('.muraHudClock'),brief=hud.querySelector('.muraHudBrief');
 toggle.onclick=()=>{details.hidden=!details.hidden;toggle.setAttribute('aria-expanded',String(!details.hidden));hud.classList.toggle('muraHudExpanded',!details.hidden);};
 $('muraSettingsButton').onclick=more;
 $('muraFollowMayor').onclick=()=>{const p=world.people.find(p=>p.role==='mayor');if(p)observePerson(p.id);};
 $('muraEventButton').onclick=()=>{more();$('journal').click();};
 $('muraEndObservation').onclick=()=>{view.endObservation();view.focus(view.target.x,view.target.z,Math.max(32,view.span));village.activity();};
 const modes=$('muraModeControls'),modeLabel=document.createElement('small');modeLabel.id='muraModeLabel';modes.prepend(modeLabel);
 // Put related surfaces in ordinary document flow. Header expansion moves
 // modes and tutorial in the same layout pass, without a one-frame overlap.
 const stack=document.createElement('div');stack.id='muraTopStack';document.body.append(stack);
 stack.append(hud,modes,$('tutorial'));
 const moment=document.createElement('button');moment.type='button';moment.id='muraIdleDetails';moment.hidden=true;moment.setAttribute('aria-live','polite');
 moment.innerHTML='<small>村人の様子</small><span class="muraIdleDetailsText"></span>';
 document.body.append(moment);let currentPerson=null,event=null,eventUntil=0,lastMoment=null,momentUntil=0;
 moment.onclick=()=>{if(currentPerson)observePerson(currentPerson);};
 eventHooks.add((message,type)=>{
  if(!['threat','loss','rescue','voyage','arrival','discovery'].includes(type))return;
  event={text:message,type};eventUntil=performance.now()+4300;
  if(ui.pending||ui.drawer||ui.dialogPage||view.observation){toast(message,3500);eventUntil=0;}
 });
 const progress=document.createElement('div');progress.id='muraConstructionLayer';document.body.append(progress);
 const bars=new Map();let lastTick=0,resourceSignature='',statsSignature='',lastRoom=null,lastObserved=null;
 function statusTick(now){
  const climate=window.__MURAAAAAAA_V2_UI__?.currentClimate(),year=Math.floor(world.state.clock/DAYS_YEAR)+1;
  const seasons={spring:'春',summer:'夏',autumn:'秋',winter:'冬'},weather={clear:'晴',rain:'雨',cloudy:'曇',snow:'雪',wind:'風'};
  const hour=Math.floor(world.state.time),min=Math.floor((world.state.time-hour)*60);
  text(clock,`${seasons[climate?.season]||'春'} · ${weather[climate?.weather]||'晴'} · ${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`);
  text(brief,`${year}年 · ${world.population().people}人`);
  const built=world.objects.filter(o=>ready(o)&&defs[o.kind]?.building),counts=[built.length,world.population().people,built.filter(o=>capacityOf(o)).length];
  if(counts.join()!==statsSignature){statsSignature=counts.join();hud.querySelector('.muraHudStats').innerHTML=counts.map((n,i)=>`<span title="${['施設','人口','住宅'][i]}">${svg(['facility','people','homes'][i])}<b>${n}</b></span>`).join('');}
  const resources=world.state.known.filter(k=>world.state.stock[k]>=1),sig=resources.map(k=>k+Math.floor(world.state.stock[k])).join();
  if(sig!==resourceSignature){resourceSignature=sig;const list=hud.querySelector('.muraHudResources');list.replaceChildren(...resources.map(k=>{const chip=document.createElement('span');chip.title=RESOURCE_NAMES[k];chip.setAttribute('aria-label',`${RESOURCE_NAMES[k]} ${Math.floor(world.state.stock[k])}`);chip.innerHTML=svg(k)+`<b>${Math.floor(world.state.stock[k])}</b>`;return chip;}));}
  const observing=view.observation?.id||null;
  if(lastRoom!==view.roomId||lastObserved!==observing){
   lastRoom=view.roomId;lastObserved=observing;
   modes.hidden=!view.roomId&&!observing;
   $('leaveRoom').hidden=!view.roomId;$('muraEndObservation').hidden=!observing;
   text(modeLabel,view.roomId?defs[world.object(view.roomId)?.kind]?.label||'内装':world.people.find(p=>p.id===observing)?.name||'観察');
  }
  const blocked=ui.entryOpen||ui.drawer||ui.pending||ui.selected||ui.dialogPage||document.querySelector('dialog[open]')||view.observation;
  const m=world.state.moments?.[0];
  if(ui.idle&&m&&m.id!==lastMoment){lastMoment=m.id;momentUntil=now+3800;}
  const showEvent=now<eventUntil&&event,showMoment=ui.idle&&now<momentUntil&&m;
  moment.hidden=!!blocked||(!showEvent&&!showMoment);
  if(!moment.hidden){text(moment.querySelector('small'),showEvent?'村の出来事':'村人の様子');text(moment.querySelector('span'),(showEvent?event:m).text);currentPerson=showEvent?null:m.ids?.find(id=>world.people.some(p=>p.id===id));moment.disabled=!currentPerson;}
  else currentPerson=null;
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
