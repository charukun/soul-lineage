import {defs,RESOURCE_NAMES,capacityOf,ready} from './game/core.js';

const village=window.village;
if(!village)throw new Error('MURAAAAAAA housing UI polish requires a booted village');
const {world,sim,view,ui}=village;
const $=id=>document.getElementById(id);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

const css=document.createElement('style');
css.dataset.muraHousingUiPolish='1';
css.textContent=`
/* Entry screen now shares the same felt/glass language as the live village. */
#muraEntry{background:radial-gradient(circle at 50% 34%,rgba(247,238,203,.24),transparent 42%),linear-gradient(180deg,rgba(65,86,72,.14),rgba(48,67,58,.28))!important;backdrop-filter:blur(5px) saturate(.86)!important;color:#35473d!important}
#muraEntryCard{width:min(470px,calc(100vw - 30px))!important;padding:27px 24px 24px!important;border:1px solid rgba(255,252,235,.60)!important;border-radius:24px!important;background-color:rgba(239,232,210,.72)!important;background-image:radial-gradient(circle at 22% 20%,#fff8 0 1px,transparent 1.4px),radial-gradient(circle at 76% 62%,#6e5c4010 0 .8px,transparent 1.4px),linear-gradient(145deg,rgba(249,242,223,.84),rgba(219,226,199,.64))!important;background-size:9px 9px,11px 11px,100% 100%!important;box-shadow:0 24px 66px rgba(38,55,44,.20),inset 0 1px 0 #fff8!important;backdrop-filter:blur(16px) saturate(.92)!important}
#muraEntryCard .muraEntryMark{width:46px!important;height:46px!important;margin-bottom:13px!important;border-color:rgba(92,107,76,.23)!important;color:#526348!important;background:rgba(255,250,231,.36)!important;box-shadow:inset 0 1px 0 #fff8!important}
#muraEntryCard h2{font-family:system-ui,-apple-system,"Noto Sans JP",sans-serif!important;font-size:clamp(28px,8vw,44px)!important;font-weight:950!important;letter-spacing:.075em!important;text-indent:.075em!important;background:linear-gradient(92deg,#cf7f78 0 13%,#d9a965 18% 31%,#bbc36f 36% 47%,#7eb491 51% 64%,#72a7c5 68% 80%,#9a86ba 84% 92%,#c77f9d 97%)!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important;text-shadow:0 1px 0 #fff7!important}
#muraEntryCard .muraEntryLead{margin:10px auto 15px!important;font-family:system-ui,-apple-system,"Noto Sans JP",sans-serif!important;font-size:10px!important;line-height:1.7!important;letter-spacing:.035em!important;color:#556359!important}
#muraEntryFacts{gap:5px!important;margin-bottom:17px!important}#muraEntryFacts span{min-width:76px!important;padding:6px 8px!important;border-radius:10px!important;background:rgba(255,250,231,.28)!important;border-color:rgba(94,108,77,.10)!important;color:#738073!important}#muraEntryFacts b{font-family:system-ui,-apple-system,"Noto Sans JP",sans-serif!important;font-size:11px!important;font-weight:800!important;color:#425448!important}
#muraEnterVillage{min-width:190px!important;min-height:44px!important;border-radius:22px!important;background:#c3d3af!important;color:#34483b!important;box-shadow:0 8px 22px rgba(54,73,48,.13),inset 0 1px 0 #fff8!important;letter-spacing:.08em!important}
#muraEntryCard .muraEntryHint{margin-top:10px!important;font-size:8px!important;color:#798477!important}

/* Tutorial stays compact and readable. */
#tutorial{width:min(282px,calc(100vw - 20px))!important;max-width:min(282px,calc(100vw - 20px))!important;min-height:0!important;border-radius:14px!important;align-items:stretch!important}
#tutorialAction{min-height:34px!important;padding:5px 5px 5px 8px!important;gap:6px!important;grid-template-columns:auto minmax(0,1fr) auto!important;line-height:1.28!important}
#tutorialCount{font-size:7px!important;padding:2px 4px!important;border-radius:6px!important}#tutorialText{font-size:9px!important;line-height:1.28!important}#tutorial .tutorialArrow{font-size:15px!important}#dismissTutorial{flex:0 0 29px!important;width:29px!important;min-height:34px!important;font-size:14px!important;padding:2px!important}
@media(max-width:560px){#tutorial{width:min(258px,calc(100vw - 16px))!important;max-width:min(258px,calc(100vw - 16px))!important;left:8px!important}#tutorialText{font-size:8.5px!important}}

/* One control opens/closes the build drawer. The redundant title and X are gone. */
#drawer .drawerHeader{display:none!important}#drawer footer>small{display:none!important}#drawer footer{justify-content:flex-end!important;padding-top:5px!important;padding-bottom:5px!important}#build.muraBuildOpen{background:#c8d4b7!important}

/* Compact village status: translucent, icon-first and deliberately narrow. */
#idleStatus{width:auto!important;max-width:min(360px,calc(100vw - 16px))!important;right:8px!important;left:auto!important;padding:7px 8px!important;border-radius:16px!important;background:linear-gradient(145deg,rgba(247,243,225,.30),rgba(223,232,209,.22))!important;border:1px solid rgba(255,255,240,.44)!important;box-shadow:0 10px 28px rgba(36,52,39,.10),inset 0 1px 0 rgba(255,255,255,.34)!important;backdrop-filter:blur(9px) saturate(.82)!important}
#idleStatus>.eyebrow,#idleMood,#idleStatus>.idleFacts,#idleResources,#idleNote,#idleStatus>.muraNowHead,#idleStatus>.muraClimate,#idleStatus>.muraScaleLine{display:none!important}
.muraCompactHud{display:flex;align-items:center;gap:7px;min-width:0}.muraHudStats,.muraHudResources,.muraHudActions{display:flex;align-items:center;gap:4px;min-width:0}.muraHudResources{padding-left:6px;border-left:1px solid rgba(80,96,73,.14)}.muraHudActions{padding-left:3px}
.muraHudChip{display:inline-flex;align-items:center;gap:3px;height:25px;padding:3px 5px;border-radius:9px;background:rgba(255,250,234,.22);border:1px solid rgba(91,104,78,.09);color:#405247;font-size:9px;font-weight:800;white-space:nowrap}.muraHudChip svg,.muraHudResource svg{width:13px!important;height:13px!important;stroke:currentColor!important;fill:none!important;stroke-width:1.7!important;flex:none}.muraHudResource{display:inline-flex;align-items:center;gap:2px;height:23px;color:#526258;font-size:8px;font-weight:800;white-space:nowrap}.muraHudResource.empty{opacity:.62}
.muraHudActions button{position:static!important;min-height:25px!important;height:25px!important;padding:3px 5px!important;border-radius:9px!important;background:rgba(255,250,234,.18)!important;border:1px solid rgba(91,104,78,.09)!important;box-shadow:none!important;font-size:8px!important;gap:2px!important}.muraHudActions button>span:not(.muraButtonIcon){display:none!important}.muraHudActions .muraButtonIcon{width:13px!important;height:13px!important;margin-right:0!important}.muraHudActions svg{width:12px!important;height:12px!important}.muraHudActions #muraEventButton b{min-width:13px!important;height:13px!important;font-size:7px!important;padding:0 3px!important}
@media(max-width:560px){#idleStatus{max-width:calc(100vw - 16px)!important}.muraCompactHud{gap:5px}.muraHudStats{gap:3px}.muraHudChip{height:23px;padding:2px 4px;font-size:8px}.muraHudResources{max-width:38vw;overflow:hidden}.muraHudResource{font-size:7px}.muraHudResource svg{width:11px!important;height:11px!important}}

/* Unified village message rail for resident moments and major events. */
#idleMoment{display:none!important}#muraMessageRail{position:fixed;left:50%;bottom:max(84px,calc(env(safe-area-inset-bottom) + 72px));transform:translateX(-50%) translateY(5px);z-index:18;max-width:min(460px,calc(100vw - 28px));padding:7px 11px;border-radius:13px;background:linear-gradient(145deg,rgba(247,241,222,.50),rgba(231,235,214,.42));border:1px solid rgba(255,255,239,.48);box-shadow:0 8px 26px rgba(36,52,39,.11),inset 0 1px 0 rgba(255,255,255,.42);backdrop-filter:blur(8px) saturate(.85);color:#46574c;font-size:9px;line-height:1.45;letter-spacing:.02em;text-align:center;opacity:0;pointer-events:none;transition:opacity .28s ease,transform .28s ease}#muraMessageRail.visible{opacity:1;transform:translateX(-50%) translateY(0)}#muraMessageRail[data-type=threat]{border-color:rgba(161,99,65,.34);color:#714d3d}#muraMessageRail[data-type=loss]{border-color:rgba(143,79,74,.30);color:#744c49}#muraMessageRail[data-type=rescue]{border-color:rgba(80,126,83,.28);color:#45664a}
@media(max-width:560px){#muraMessageRail{bottom:max(76px,calc(env(safe-area-inset-bottom) + 66px));font-size:8.5px;padding:6px 9px;max-width:calc(100vw - 20px)}}

/* Speech: smaller at distance; at the farthest zoom it becomes a tiny bubble marker. */
#speechLayer.muraBubbleFar .speech{font-size:8px!important;padding:4px 6px!important;border-radius:10px!important;box-shadow:0 3px 9px #3f4d3916,inset 0 1px 0 #fff!important}
#speechLayer.muraBubbleMicro .speech{width:8px!important;height:6px!important;min-width:0!important;max-width:8px!important;padding:0!important;border-radius:6px!important;font-size:0!important;line-height:0!important;white-space:normal!important;overflow:visible!important;scale:1!important;background:#f4ead0d9!important;border:1px solid #7f725235!important;box-shadow:0 2px 6px #3f4d391c!important;color:transparent!important}
#speechLayer.muraBubbleMicro .speech:after{bottom:-3px!important;left:2px!important;border-left-width:2px!important;border-right-width:2px!important;border-top-width:3px!important}
`;
document.head.append(css);

const ICONS={
 facility:'<path d="M4 20V9l8-5 8 5v11M8 20v-6h8v6"/>',
 people:'<circle cx="12" cy="8" r="3"/><path d="M5 21c1-5 3-7 7-7s6 2 7 7"/>',
 homes:'<path d="m3 11 9-8 9 8M5 10v10h14V10M9 20v-6h6v6"/>',
 wood:'<path d="M4 7h16M4 12h16M4 17h16M7 5v4M17 10v4M9 15v4"/>',
 stone:'<path d="M6 6l6-3 6 4 2 8-6 6-8-2-2-7z"/>',
 plank:'<path d="M4 6h16v4H4zM4 14h16v4H4z"/>',
 clay:'<path d="M7 4h10l2 6-2 10H7L5 10z"/>',
 food:'<path d="M12 20V9M12 12c-3 0-5-2-5-5 3 0 5 2 5 5ZM12 15c3 0 5-2 5-5-3 0-5 2-5 5Z"/>',
 seed:'<path d="M12 21V11M12 13c-4 0-6-2-6-6 4 0 6 2 6 6ZM12 16c4 0 6-2 6-6-4 0-6 2-6 6Z"/>',
 herb:'<path d="M12 21V9M12 13c-4-1-6-4-5-8 4 1 6 4 5 8ZM12 16c4-1 6-4 5-8-4 1-6 4-5 8Z"/>',
 ore:'<path d="M5 8l4-4h7l4 5-2 8-6 4-7-4-1-5z"/>',
 metal:'<path d="M5 7h14v10H5zM8 4h8M8 20h8"/>',
 cloth:'<path d="M6 4h12l-2 5 2 5-2 6H8l-2-6 2-5z"/>',
 leather:'<path d="M7 4c3 2 7 2 10 0l2 6-2 10H7L5 10z"/>',
 medicine:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
 knowledge:'<path d="M4 5c3-1 6 0 8 2v13c-2-2-5-3-8-2zM20 5c-3-1-6 0-8 2v13c2-2 5-3 8-2z"/>',
 crystal:'<path d="m12 3 6 6-6 12L6 9z"/>',
 charm:'<path d="m12 3 2.2 5.2L20 9l-4 4 1 6-5-2.7L7 19l1-6-4-4 5.8-.8z"/>',
 gear:'<path d="M12 3l2 3 4-1 1 4 3 2-2 3 1 4-4 1-2 3-3-2-3 2-2-3-4-1 1-4-2-3 3-2 1-4 4 1z"/>',
 furnishing:'<path d="M6 11h12v7H6zM8 7h8v4M8 18v3M16 18v3"/>',
 generic:'<circle cx="12" cy="12" r="7"/>'
};
const svg=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||ICONS.generic}</svg>`;

function installBuildToggle(){
 const button=$('build'),label=button?.querySelector('span');
 if(!button||!label)return;
 const sync=()=>{const open=button.getAttribute('aria-expanded')==='true';label.textContent=open?'閉じる':'つくる';button.setAttribute('aria-label',open?'つくるメニューを閉じる':'つくるメニューを開く');button.classList.toggle('muraBuildOpen',open);};
 new MutationObserver(sync).observe(button,{attributes:true,attributeFilter:['aria-expanded']});
 sync();
}

function installCompactHud(){
 const panel=$('idleStatus');if(!panel)return;
 const hud=document.createElement('div');hud.className='muraCompactHud';hud.innerHTML='<div class="muraHudStats"></div><div class="muraHudResources"></div><div class="muraHudActions"></div>';
 panel.append(hud);
 const stats=hud.querySelector('.muraHudStats'),resources=hud.querySelector('.muraHudResources'),actions=hud.querySelector('.muraHudActions');
 for(const id of ['muraFollowMayor','muraEventButton']){const node=$(id);if(node)actions.append(node);}
 let signature='';
 const render=()=>{
  const built=world.objects.filter(o=>ready(o)&&defs[o.kind]?.building),homes=built.filter(o=>capacityOf(o)>0),pop=world.population();
  const keys=world.state.known.filter(k=>(world.state.stock[k]||0)>=1).slice(0,6);
  const next=[built.length,pop.people,homes.length,...keys.map(k=>`${k}:${Math.floor(world.state.stock[k])}`)].join('|');
  if(next===signature)return;signature=next;
  stats.innerHTML=`<span class="muraHudChip" title="施設 ${built.length}">${svg('facility')}<b>${built.length}</b></span><span class="muraHudChip" title="人口 ${pop.people}">${svg('people')}<b>${pop.people}</b></span><span class="muraHudChip" title="住宅 ${homes.length}">${svg('homes')}<b>${homes.length}</b></span>`;
  resources.innerHTML=keys.length?keys.map(k=>`<span class="muraHudResource" title="${RESOURCE_NAMES[k]||k} ${Math.floor(world.state.stock[k])}">${svg(k)}<b>${Math.floor(world.state.stock[k])}</b></span>`).join(''):`<span class="muraHudResource empty" title="保有素材 0">${svg('generic')}<b>0</b></span>`;
 };
 render();setInterval(render,350);
}

function installUnifiedMessageRail(){
 const old=$('idleMoment');if(!old)return;
 const rail=document.createElement('div');rail.id='muraMessageRail';rail.setAttribute('role','status');rail.setAttribute('aria-live','polite');old.after(rail);
 let eventUntil=0,eventType='',eventText='';
 const previous=sim.onEvent;
 sim.onEvent=(text,type)=>{
  previous?.(text,type);
  if(!['threat','loss','rescue','voyage','arrival','discovery'].includes(type))return;
  eventUntil=performance.now()+5200;eventType=type;eventText=String(text||'').trim();
  const toast=$('toast');if(toast)toast.hidden=true;
 };
 const refresh=()=>{
  const now=performance.now();
  if(now<eventUntil&&eventText){rail.textContent=eventText;rail.dataset.type=eventType;rail.classList.add('visible');return;}
  delete rail.dataset.type;
  const moment=world.state.moments?.[0]?.text;
  if(ui.idle&&moment){rail.textContent=moment;rail.classList.add('visible');}
  else rail.classList.remove('visible');
 };
 setInterval(refresh,180);refresh();
}

function installBubbleLod(){
 const layer=$('speechLayer');if(!layer)return;
 const loop=()=>{
  const span=Number(view.span)||46;
  const scale=clamp(1.02+(46-span)*.016,.54,1.18);
  layer.style.setProperty('--mura-bubble-scale',scale.toFixed(3));
  layer.classList.toggle('muraBubbleFar',span>=52&&span<66);
  layer.classList.toggle('muraBubbleMicro',span>=66);
  requestAnimationFrame(loop);
 };
 requestAnimationFrame(loop);
}

installBuildToggle();
installCompactHud();
installUnifiedMessageRail();
installBubbleLod();

window.__MURA_HOUSING_UI_POLISH__={version:1};
