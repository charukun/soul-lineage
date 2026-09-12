import {initial} from './game/core.js';

const village=window.village;
if(!village)throw new Error('MURAAAAAAA mobile feedback fix 3 requires a booted village');
const {world,view,ui}=village;
const $=id=>document.getElementById(id);

const css=document.createElement('style');css.dataset.muraMobileFeedbackFix3='1';css.textContent=`
/* Event log gets the same felt/glass language as the rest of MURAAAAAAA. */
#muraEventLog{background-color:rgba(239,232,210,.90)!important;background-image:radial-gradient(circle at 24% 22%,#fff8 0 1px,transparent 1.5px),radial-gradient(circle at 72% 68%,#6c584315 0 .8px,transparent 1.4px),linear-gradient(145deg,rgba(250,243,223,.92),rgba(219,228,200,.82))!important;background-size:9px 9px,11px 11px,100% 100%!important;border:1px solid rgba(91,103,76,.22)!important;border-radius:20px!important;box-shadow:0 18px 48px rgba(39,55,43,.20),inset 0 1px 0 rgba(255,255,255,.62)!important;backdrop-filter:blur(14px) saturate(.9)!important;color:#405147!important}
#muraEventLog header{padding:10px 11px 7px!important;border-bottom:1px solid rgba(91,103,76,.12)!important}#muraEventLog header small{font-size:7px!important;letter-spacing:.12em!important;opacity:.58!important}#muraEventLog header b{font-size:13px!important;font-family:ui-rounded,"Hiragino Maru Gothic ProN",system-ui,sans-serif!important}#muraEventLog header button{background:rgba(255,250,233,.36)!important;border:1px solid rgba(93,105,79,.12)!important;border-radius:10px!important;box-shadow:inset 0 1px 0 #fff8!important}
#muraEventLog .eventList{padding:7px!important;display:grid!important;gap:6px!important}.eventItem{width:100%!important;text-align:left!important;padding:8px 9px!important;border-radius:12px!important;background-color:rgba(255,250,233,.32)!important;background-image:radial-gradient(circle at 25% 25%,#fff7 0 1px,transparent 1.5px)!important;background-size:8px 8px!important;border:1px solid rgba(89,102,75,.10)!important;box-shadow:inset 0 1px 0 #fff7,0 3px 9px rgba(47,61,45,.07)!important}.eventItem small{font-size:7px!important;opacity:.52!important}.eventItem span{font-size:9px!important;line-height:1.45!important}.eventItem em{font-size:7px!important;opacity:.62!important}.eventEmpty{font-size:8px!important;opacity:.62!important;padding:8px!important}

/* Settings and reset confirmations are in-world felt UI, not platform chrome. */
#dialog.muraSettingsDialog,#muraResetConfirm,#muraDeveloperDialog{background-color:rgba(239,232,210,.96)!important;background-image:radial-gradient(circle at 24% 22%,#fff8 0 1px,transparent 1.5px),radial-gradient(circle at 70% 66%,#6d5b4414 0 .8px,transparent 1.4px),linear-gradient(145deg,rgba(249,242,222,.95),rgba(220,228,202,.91))!important;background-size:9px 9px,11px 11px,100% 100%!important;border:1px solid rgba(91,103,76,.24)!important;border-radius:22px!important;box-shadow:0 22px 60px rgba(35,50,39,.25),inset 0 1px 0 rgba(255,255,255,.70)!important;color:#3f5046!important;backdrop-filter:blur(16px) saturate(.9)!important}#dialog.muraSettingsDialog::backdrop,#muraResetConfirm::backdrop,#muraDeveloperDialog::backdrop{background:rgba(28,38,31,.30)!important;backdrop-filter:blur(5px)!important}
#dialog.muraSettingsDialog button,#muraResetConfirm button,#muraDeveloperDialog button,#muraDeveloperDialog select,#muraDeveloperDialog input{background-color:rgba(218,229,202,.75)!important;background-image:radial-gradient(circle at 28% 26%,#fff7 0 1px,transparent 1.4px)!important;background-size:8px 8px!important;border:1px solid rgba(83,101,72,.18)!important;border-radius:12px!important;box-shadow:inset 0 1px 0 #fff8,0 3px 8px rgba(47,61,45,.07)!important;color:#435448!important}#muraResetConfirm .danger{background-color:rgba(222,191,177,.80)!important;color:#744d42!important;border-color:rgba(129,82,66,.20)!important}
#muraResetConfirm{width:min(360px,calc(100vw - 30px))!important;text-align:center!important}#muraResetConfirm h2{margin:2px 0 9px!important;font-size:18px!important}#muraResetConfirm p{font-size:10px!important;line-height:1.65!important}.muraResetActions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px!important;margin-top:12px!important}
#muraDeveloperDialog{width:min(430px,calc(100vw - 30px))!important}#muraDeveloperDialog h2{margin:0 0 12px!important;font-size:18px!important}#muraDeveloperDialog .row{display:grid!important;grid-template-columns:1fr auto!important;gap:8px!important;align-items:center!important;margin:10px 0!important}#muraDeveloperDialog label{font-size:10px!important}#muraDeveloperDialog input[type=range]{grid-column:1/-1!important;width:100%!important}

/* Keep secondary surfaces below the always-on HUD instead of hiding underneath it. */
:root{--mura-hud-bottom:72px}#muraIdleDetails{top:var(--mura-hud-bottom)!important}#muraEventLog{top:var(--mura-hud-bottom)!important;max-height:calc(100dvh - var(--mura-hud-bottom) - 16px)!important}#tutorial{top:calc(var(--mura-hud-bottom) + 48px)!important}

/* Help gets an actual back action; close remains available as a separate escape. */
#muraHelpBack{margin-bottom:8px!important;min-height:34px!important}
`;
document.head.append(css);

function keepHudClear(){
 const hud=$('idleStatus');if(!hud)return;const update=()=>{const r=hud.getBoundingClientRect();document.documentElement.style.setProperty('--mura-hud-bottom',`${Math.ceil(r.bottom+7)}px`);};update();new ResizeObserver(update).observe(hud);addEventListener('resize',update,{passive:true});
}

function installFeltReset(){
 const reset=$('muraResetVillage');if(!reset)return;
 let dialog=$('muraResetConfirm');if(!dialog){dialog=document.createElement('dialog');dialog.id='muraResetConfirm';dialog.innerHTML='<h2>村を初期化</h2><p>今の村を退避して、最初の村へ戻します。</p><div class="muraResetActions"><button type="button" data-cancel>戻る</button><button type="button" class="danger" data-reset>初期化</button></div>';document.body.append(dialog);}
 reset.onclick=()=>{if(!dialog.open)dialog.showModal();};
 dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
 dialog.querySelector('[data-reset]').onclick=async()=>{const go=dialog.querySelector('[data-reset]');go.disabled=true;go.textContent='初期化中';try{window.__MURA_RESETTING__=true;world.state=initial();view.followId=null;view.roomId=null;ui.pending=null;ui.selected=null;view.clearGhost?.();view.showTerrainHints?.(null);await window.__VILLAGE_BOOT__?.recover?.();location.reload();}catch(error){window.__MURA_RESETTING__=false;go.disabled=false;go.textContent='初期化';const p=dialog.querySelector('p');if(p)p.textContent=`初期化できませんでした: ${error?.message||error}`;}};
}

function repairTransparentResidents(){
 const repair=()=>{for(const p of world.people){let root=view.actorNodes?.get?.(p.id);if(!root)continue;let visibleMesh=false;root.visible=true;root.traverse?.(node=>{if(!node.isMesh)return;node.visible=true;const mats=Array.isArray(node.material)?node.material:[node.material];for(const m of mats){if(!m)continue;if('opacity'in m)m.opacity=1;m.transparent=false;if('depthWrite'in m)m.depthWrite=true;m.needsUpdate=true;}visibleMesh=true;});if(!visibleMesh&&view.removeActor&&view.syncActor){view.removeActor(p.id);root=view.syncActor(p,performance.now()/1000,false);root&&(root.visible=true);}}};
 repair();setInterval(repair,900);
}

function enhanceSettingsAndHelp(){
 const dialog=$('dialog'),host=$('dialogContent');if(!dialog||!host)return;
 const apply=()=>{const title=host.querySelector('h2')?.textContent?.trim()||'';dialog.classList.toggle('muraSettingsDialog',title==='村の手帖');if(title==='村の手帖'){
   host.querySelector('#speed')?.closest('.row')?.setAttribute('hidden','');host.querySelector('#tilt')?.closest('.row')?.setAttribute('hidden','');host.querySelector('#exportSave')?.setAttribute('hidden','');host.querySelector('#loadSave')?.setAttribute('hidden','');
   if(!host.querySelector('#muraDeveloperOpen')){const b=document.createElement('button');b.id='muraDeveloperOpen';b.type='button';b.className='wide';b.textContent='開発者';const anchor=host.querySelector('#help');anchor?.before(b);b.onclick=()=>{dialog.close();openDeveloper();};}
  }
  if(title==='暮らしを、見守る村。'&&!host.querySelector('#muraHelpBack')){const b=document.createElement('button');b.id='muraHelpBack';b.type='button';b.className='wide';b.textContent='戻る';host.prepend(b);b.onclick=()=>{$('more')?.click();};}
 };
 new MutationObserver(()=>queueMicrotask(apply)).observe(host,{childList:true,subtree:true});apply();
}

function openDeveloper(){
 let d=$('muraDeveloperDialog');if(!d){d=document.createElement('dialog');d.id='muraDeveloperDialog';d.innerHTML='<h2>開発者</h2><div class="row"><label for="muraDevSpeed">暮らしの速さ</label><select id="muraDevSpeed"><option value="0">停止</option><option value="1">1×</option><option value="5">5×</option><option value="20">20×</option></select></div><div class="row"><label for="muraDevTilt">チルトシフト</label><span id="muraDevTiltValue"></span><input id="muraDevTilt" type="range" min="0.2" max="1.6" step="0.05"></div><button type="button" data-back>戻る</button>';document.body.append(d);d.querySelector('[data-back]').onclick=()=>{d.close();$('more')?.click();};}
 const speed=d.querySelector('#muraDevSpeed'),tilt=d.querySelector('#muraDevTilt'),value=d.querySelector('#muraDevTiltValue');speed.value=String(world.state.settings.speed);tilt.value=String(world.state.settings.tilt);value.textContent=Number(world.state.settings.tilt).toFixed(2);speed.onchange=()=>{world.state.settings.speed=Number(speed.value);village.save?.();};tilt.oninput=()=>{world.state.settings.tilt=Number(tilt.value);value.textContent=Number(tilt.value).toFixed(2);};tilt.onchange=()=>village.save?.();if(!d.open)d.showModal();
}

function stabilizeFurniturePlacementRelease(){
 const canvas=$('game');if(!canvas)return;const originalGround=view.ground.bind(view);let gesture=null,locked=null,lockUntil=0;
 view.ground=(x,y)=>{if(locked&&performance.now()<lockUntil&&ui.pending)return{...locked};return originalGround(x,y);};
 addEventListener('pointerdown',e=>{if(!ui.pending)return;gesture={id:e.pointerId,sx:e.clientX,sy:e.clientY,moved:false,last:originalGround(e.clientX,e.clientY)};},{capture:true,passive:true});
 addEventListener('pointermove',e=>{if(!ui.pending||!gesture||gesture.id!==e.pointerId)return;if(Math.hypot(e.clientX-gesture.sx,e.clientY-gesture.sy)>7)gesture.moved=true;const g=originalGround(e.clientX,e.clientY);if(g&&!gesture.moved)gesture.last=g;},{capture:true,passive:true});
 addEventListener('pointerup',e=>{if(!ui.pending||!gesture||gesture.id!==e.pointerId){gesture=null;return;}if(!gesture.moved&&gesture.last){locked={...gesture.last};lockUntil=performance.now()+140;}gesture=null;},{capture:true,passive:true});
 addEventListener('pointercancel',()=>{gesture=null;},{capture:true,passive:true});
}

keepHudClear();
installFeltReset();
repairTransparentResidents();
enhanceSettingsAndHelp();
stabilizeFurniturePlacementRelease();

window.__MURA_MOBILE_FEEDBACK_FIX_3__={version:1};
