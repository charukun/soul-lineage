import {World,defs,worldToLocal} from './game/core.js';

const village=window.village;
if(!village)throw new Error('MURAAAAAAA mobile feedback fix requires a booted village');
const {world,sim,view,ui}=village;
const $=id=>document.getElementById(id);

const css=document.createElement('style');
css.dataset.muraMobileFeedbackFix='1';
css.textContent=`
/* Start screen: no redundant crest, larger round felt title, safe dev reset. */
#muraEntryCard .muraEntryMark{display:none!important}
#muraEntryCard{width:min(500px,calc(100vw - 26px))!important;padding:25px 22px 22px!important;border-radius:28px!important}
#muraEntryCard h2{margin:0 0 7px!important;font-family:ui-rounded,"Arial Rounded MT Bold","Hiragino Maru Gothic ProN",system-ui,sans-serif!important;font-size:clamp(42px,13vw,72px)!important;line-height:.96!important;font-weight:1000!important;letter-spacing:.035em!important;text-indent:.035em!important;background-image:radial-gradient(circle at 22% 28%,rgba(255,255,255,.72) 0 .65px,transparent .95px),radial-gradient(circle at 72% 68%,rgba(66,51,40,.17) 0 .55px,transparent .9px),linear-gradient(92deg,#d88379 0 13%,#e0ad67 18% 31%,#c3ca70 36% 47%,#80b995 51% 64%,#74acd0 68% 80%,#a08ac3 84% 92%,#ce84a4 97%)!important;background-size:5px 5px,7px 7px,100% 100%!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important;-webkit-text-stroke:.8px rgba(92,72,57,.24)!important;filter:drop-shadow(0 1px 0 rgba(255,255,255,.75)) drop-shadow(0 3px 1px rgba(81,65,52,.12))!important}
#muraEntryCard .muraEntryLead{margin:8px auto 13px!important;line-height:1.65!important}
#muraResetVillage{display:block;margin:8px auto 0!important;min-height:32px!important;padding:5px 12px!important;border-radius:15px!important;background:rgba(173,116,97,.10)!important;border:1px solid rgba(139,86,70,.18)!important;color:#77584f!important;font-size:9px!important;letter-spacing:.04em!important}
#muraEntryCard .muraEntryHint{margin-top:8px!important}

/* One persistent Village Now HUD; old title/calendar is folded into it. */
#title{display:none!important}
body:not(.mura-entry-open) #idleStatus{left:8px!important;right:auto!important;top:max(8px,env(safe-area-inset-top))!important;width:min(430px,calc(100vw - 16px))!important;max-width:calc(100vw - 16px)!important;padding:6px 7px!important;border-radius:15px!important;background:linear-gradient(145deg,rgba(247,243,225,.31),rgba(223,232,209,.22))!important;border:1px solid rgba(255,255,240,.44)!important;box-shadow:0 10px 28px rgba(36,52,39,.09),inset 0 1px 0 rgba(255,255,255,.34)!important;backdrop-filter:blur(9px) saturate(.82)!important;opacity:1!important;transform:none!important;pointer-events:auto!important;transition:none!important;z-index:22!important}
body.mura-entry-open #idleStatus{opacity:0!important;pointer-events:none!important}
.muraCompactHud{display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;grid-template-rows:auto auto!important;gap:2px 5px!important;align-items:center!important}.muraHudTop{grid-column:1/-1;display:flex;align-items:center;gap:6px;min-width:0}.muraHudLabel{font-size:7px;letter-spacing:.13em;color:#6d786d;white-space:nowrap}.muraHudClock{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px;font-weight:750;color:#475a4e;letter-spacing:.025em}.muraHudStats{grid-column:1;grid-row:2}.muraHudResources{grid-column:2;grid-row:2;overflow:hidden!important;max-width:none!important}.muraHudActions{grid-column:3;grid-row:2;margin-left:auto}.muraHudChip{height:22px!important;padding:2px 4px!important;font-size:8px!important}.muraHudChip svg,.muraHudResource svg{width:11px!important;height:11px!important}.muraHudResource{height:21px!important;font-size:7.5px!important}.muraHudActions button{min-height:22px!important;height:22px!important;padding:2px 4px!important}
@media(max-width:560px){body:not(.mura-entry-open) #idleStatus{width:calc(100vw - 16px)!important}.muraHudResource:nth-child(n+5){display:none!important}}

/* Idle detail floats below HUD; significant events use the same lane. */
#muraMessageRail{display:none!important}#muraIdleDetails{position:fixed;left:8px;top:max(64px,calc(env(safe-area-inset-top) + 56px));z-index:21;width:min(380px,calc(100vw - 16px));padding:7px 9px;border-radius:12px;background:linear-gradient(145deg,rgba(247,241,222,.43),rgba(231,235,214,.34));border:1px solid rgba(255,255,239,.42);box-shadow:0 8px 22px rgba(36,52,39,.08),inset 0 1px 0 rgba(255,255,255,.35);backdrop-filter:blur(8px) saturate(.82);color:#46574c;opacity:0;transform:translateY(-4px);pointer-events:none;transition:opacity .24s ease,transform .24s ease;text-align:left}.muraIdleDetailsVisible{opacity:1!important;transform:translateY(0)!important}.muraIdleDetailsLabel{display:block;font-size:7px;letter-spacing:.12em;opacity:.62;margin-bottom:2px}.muraIdleDetailsText{display:block;font-size:9px;line-height:1.42;font-weight:650}.muraIdleDetailsMeta{display:block;margin-top:3px;font-size:7px;opacity:.65}#muraIdleDetails[data-type=threat]{border-color:rgba(161,99,65,.32);color:#714d3d}#muraIdleDetails[data-type=loss]{border-color:rgba(143,79,74,.28);color:#744c49}#muraIdleDetails[data-type=rescue]{border-color:rgba(80,126,83,.26);color:#45664a}
@media(max-width:560px){#muraIdleDetails{top:max(62px,calc(env(safe-area-inset-top) + 54px));width:min(330px,calc(100vw - 16px));padding:6px 8px}.muraIdleDetailsText{font-size:8.5px}}

/* Tutorial remains compact and starts below the unified HUD/detail lane. */
#tutorial{width:min(270px,calc(100vw - 20px))!important;max-width:min(270px,calc(100vw - 20px))!important;min-height:0!important;border-radius:13px!important;top:max(113px,calc(env(safe-area-inset-top) + 105px))!important}
#tutorialAction{min-height:32px!important;padding:4px 5px 4px 7px!important;gap:5px!important;line-height:1.25!important}#tutorialCount{font-size:6.5px!important;padding:2px 4px!important}#tutorialText{font-size:8.5px!important;line-height:1.25!important}#dismissTutorial{flex:0 0 27px!important;width:27px!important;min-height:32px!important;font-size:13px!important}

/* Placement panel no longer covers the target area. Direction pad is redundant once camera pan works. */
#placement{left:8px!important;right:auto!important;bottom:max(70px,calc(env(safe-area-inset-bottom) + 62px))!important;transform:none!important;width:min(272px,calc(100vw - 96px))!important;padding:7px 8px!important;border-radius:14px!important;font-size:9px!important;line-height:1.3!important;background-color:rgba(242,235,216,.72)!important;backdrop-filter:blur(9px)!important;z-index:24!important}#placementText{display:block;font-size:9px!important;line-height:1.28!important;white-space:normal!important;overflow-wrap:anywhere!important}#materialChoices{gap:3px!important;margin-top:5px!important;flex-wrap:wrap!important}#materialChoices button{min-height:25px!important;padding:3px 7px!important;font-size:8px!important}#placementCost{font-size:7.5px!important;line-height:1.3!important;margin-top:4px!important}#placement>.actions{margin-top:5px!important;gap:4px!important}#placement>.actions #rotate{display:none!important}#placement>.actions #cancelPlace{min-height:28px!important;padding:3px 9px!important;font-size:8.5px!important}#muraPlacementTools{margin-top:5px!important;padding-top:5px!important;display:block!important}#muraPlacementTools .muraNudge{display:none!important}.muraRotateControl{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-rows:auto auto!important;gap:3px 6px!important;align-items:center!important}.muraRotateControl label{grid-column:1/-1!important;margin:0!important;font-size:7.5px!important}.muraRotateControl input{grid-column:1!important;width:100%!important;height:18px!important}.muraPlacementBottom{grid-column:2!important;margin:0!important;display:block!important}.muraPlacementBottom button{min-height:26px!important;padding:3px 7px!important;font-size:8px!important}
@media(max-width:560px){#placement{width:min(258px,calc(100vw - 86px))!important;bottom:max(66px,calc(env(safe-area-inset-bottom) + 58px))!important}}
`;
document.head.append(css);

const seasonLabel={spring:'春',summer:'夏',autumn:'秋',winter:'冬'};
const weatherLabel={clear:'晴れ',cloudy:'曇り',rain:'雨',snow:'雪',wind:'風'};

function stabilizeDialogHost(){
 const old=$('dialogContent');if(!old||old.dataset.stableHost==='1')return;
 const fresh=old.cloneNode(false);fresh.id='dialogContent';fresh.dataset.stableHost='1';old.replaceWith(fresh);
}

function installEntryReset(){
 const card=$('muraEntryCard'),enter=$('muraEnterVillage');if(!card||!enter)return;
 card.querySelector('.muraEntryMark')?.remove();if($('muraResetVillage'))return;
 const reset=document.createElement('button');reset.id='muraResetVillage';reset.type='button';reset.dataset.muraIcon='native';reset.textContent='村を初期化';enter.after(reset);
 reset.onclick=async()=>{if(!confirm('保存中の村を削除して最初からやり直します。よろしいですか？'))return;reset.disabled=true;reset.textContent='初期化しています…';try{await window.__VILLAGE_BOOT__?.recover?.();location.reload();}catch(error){reset.disabled=false;reset.textContent='村を初期化';alert(`初期化できませんでした: ${error?.message||error}`);}};
}

function installHammerIcon(){
 const button=$('build'),icon=button?.querySelector('svg');if(!button||!icon)return;
 icon.innerHTML='<path d="M13.8 4.2 20 10.4l-3.1 3.1-2.1-2.1-7.7 7.7-2.2-2.2 7.7-7.7-2-2z"/><path d="m15.9 6.3 1.8-1.8 2.2 2.2-1.8 1.8"/>';
}

function calendarText(){
 const climate=window.__MURAAAAAAA_V2_UI__?.currentClimate?.();const year=climate?.year??Math.floor(world.state.clock/12)+1,cycleYear=climate?.cycleYear??((year-1)%6)+1,cycleNo=Math.floor((year-1)/6)+1;
 const hour=Math.floor(world.state.time),minute=Math.floor((world.state.time-hour)*60);
 return `第${cycleNo}輪 ${cycleYear}/6年 · ${seasonLabel[climate?.season]||'季節'} · ${weatherLabel[climate?.weather]||'天気'} · ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
}

function extendHud(){
 const panel=$('idleStatus'),hud=panel?.querySelector('.muraCompactHud');if(!panel||!hud)return;panel.setAttribute('aria-label','村の今');
 let top=hud.querySelector('.muraHudTop');if(!top){top=document.createElement('div');top.className='muraHudTop';top.innerHTML='<small class="muraHudLabel">村の今</small><span class="muraHudClock"></span>';hud.prepend(top);}
 const clock=top.querySelector('.muraHudClock'),tick=()=>{clock.textContent=calendarText();};tick();setInterval(tick,500);
}

function detailState(){
 const state=world.state,pop=world.population();let text=state.moments?.[0]?.text||'住人たちは、それぞれの一日を過ごしています。';
 if(state.defense?.raid)text=state.defense.raid.phase==='warning'?'遠くに魔王軍の気配があります。警備の配置を確認しています。':'警備職が村を守っています。';
 else if(world.people.some(p=>p.downed))text='負傷した住人を救助しています。';else if(state.merchant?.present)text='旅商人が市場に滞在しています。';
 return{text,meta:`守り ${pop.safety} · 空き寝床 ${Math.max(0,pop.openBeds-pop.people)} · 村人 ${pop.people}`};
}

function installIdleDetails(){
 const detail=document.createElement('div');detail.id='muraIdleDetails';detail.setAttribute('role','status');detail.setAttribute('aria-live','polite');document.body.append(detail);
 let eventUntil=0,eventType='',eventText='',signature='';const previous=sim.onEvent;
 sim.onEvent=(text,type)=>{previous?.(text,type);if(!['threat','loss','rescue','voyage','arrival','discovery'].includes(type))return;eventUntil=performance.now()+5600;eventType=type;eventText=String(text||'').trim();const toast=$('toast');if(toast)toast.hidden=true;};
 const draw=(label,text,meta,type='')=>{const next=`${label}|${text}|${meta}|${type}`;if(next===signature)return;signature=next;detail.dataset.type=type;detail.replaceChildren();const a=document.createElement('small');a.className='muraIdleDetailsLabel';a.textContent=label;const b=document.createElement('span');b.className='muraIdleDetailsText';b.textContent=text;detail.append(a,b);if(meta){const c=document.createElement('small');c.className='muraIdleDetailsMeta';c.textContent=meta;detail.append(c);}};
 const refresh=()=>{if(performance.now()<eventUntil&&eventText){draw(eventType==='threat'?'襲来・村の出来事':'村の出来事',eventText,'',eventType);detail.classList.add('muraIdleDetailsVisible');return;}if(ui.idle){const d=detailState();draw('村人の様子',d.text,d.meta);detail.classList.add('muraIdleDetailsVisible');}else detail.classList.remove('muraIdleDetailsVisible');};setInterval(refresh,160);refresh();
}

function strengthenTiltShift(){
 const material=view.blurMaterial;if(!material||material.userData?.muraStrongerTilt)return;material.userData.muraStrongerTilt=true;
 const next=material.fragmentShader.replace('float r=band*strength*6.;','float r=band*strength*9.25;');if(next!==material.fragmentShader){material.fragmentShader=next;material.needsUpdate=true;}
}

function withEditableRoom(instance,roomId,fn){
 if(!roomId)return fn();const host=instance.object(roomId),definition=host&&defs[host.kind];if(!definition)return fn();const before=definition.clanOnly;definition.clanOnly=true;try{return fn();}finally{definition.clanOnly=before;}
}

function enableInteriorBuilding(){
 if(World.prototype.__muraInteriorUnlocked)return;World.prototype.__muraInteriorUnlocked=true;
 const add=World.prototype.add,move=World.prototype.move,remove=World.prototype.remove;
 World.prototype.add=function(kind,x,z,rot=0,roomId=null,options={}){return withEditableRoom(this,roomId,()=>add.call(this,kind,x,z,rot,roomId,options));};
 World.prototype.move=function(id,x,z,rot,roomId=null){return withEditableRoom(this,roomId,()=>move.call(this,id,x,z,rot,roomId));};
 World.prototype.remove=function(id,roomId=null){return withEditableRoom(this,roomId,()=>remove.call(this,id,roomId));};
 const originalRender=view.render.bind(view);view.render=(time,dt)=>{const result=originalRender(time,dt);if(view.roomId){const build=$('build');if(build)build.hidden=false;const mode=$('housingMode');if(mode){mode.hidden=false;mode.classList.remove('readonly');if($('housingModeTitle'))$('housingModeTitle').textContent='内装モード';if($('housingModeText'))$('housingModeText').textContent='家具を配置できます';}for(const card of document.querySelectorAll('#catalog .card')){const d=defs[card.dataset.kind];if(d?.furniture)card.hidden=!(d.unlock||[]).every(key=>world.state.known.includes(key));}}return result;};
}

function syncPlacementToCenter(){
 const p=ui.pending;if(!p)return;const ground=view.ground(innerWidth*.5,innerHeight*.5);if(!ground)return;let q=ground;if(p.roomId){const host=world.object(p.roomId);if(host)q=worldToLocal(host,ground.x,ground.z);}if(p.kind==='harbor'){q.x=166;p.rot=0;}p.x=q.x;p.z=q.z;p.error=world.canPlace(p.kind,q.x,q.z,p.rot,p.roomId,p.moveId);view.setGhost(p.kind,q.x,q.z,p.rot,!p.error,p.material);$('placement')?.classList.toggle('invalid',!!p.error);if($('placementText'))$('placementText').textContent=`${defs[p.kind]?.label||p.kind} · ${p.error||'ここに置けます'}`;
}

function enablePlacementCamera(){
 const canvas=$('game');if(!canvas)return;const pointers=new Map();let pendingRef=null;
 canvas.addEventListener('pointerdown',e=>{if(ui.pending)pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,panning:false});},{capture:true,passive:true});
 canvas.addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(!p||!ui.pending)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;if(pointers.size!==1)return;if(!p.panning&&Math.hypot(e.clientX-p.sx,e.clientY-p.sy)>7)p.panning=true;if(!p.panning)return;e.preventDefault();e.stopImmediatePropagation();view.followId=null;view.pan(dx,dy);syncPlacementToCenter();view.lastInteraction=performance.now();},{capture:true,passive:false});
 const end=e=>pointers.delete(e.pointerId);canvas.addEventListener('pointerup',end,{capture:true,passive:true});canvas.addEventListener('pointercancel',end,{capture:true,passive:true});
 const watch=()=>{if(ui.pending!==pendingRef){pendingRef=ui.pending;if(ui.pending)requestAnimationFrame(syncPlacementToCenter);}requestAnimationFrame(watch);};watch();
}

stabilizeDialogHost();
installEntryReset();
installHammerIcon();
extendHud();
installIdleDetails();
strengthenTiltShift();
enableInteriorBuilding();
enablePlacementCamera();

window.__MURA_MOBILE_FEEDBACK_FIX__={version:1,dialogStable:true,placementCamera:true,interiorBuilding:true};
