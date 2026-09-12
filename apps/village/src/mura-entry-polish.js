import {LIMIT,DAYS_YEAR} from './game/core.js';

const village=window.village;
if(!village)throw new Error('MURAAAAAAA entry polish requires a booted village');
const {world,view,ui,activity}=village;
const $=id=>document.getElementById(id);

const css=document.createElement('style');css.dataset.muraEntryPolish='1';css.textContent=`
#muraEntry{position:fixed;inset:0;z-index:115;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 38%,rgba(249,240,205,.16),transparent 34%),linear-gradient(180deg,rgba(23,37,34,.18),rgba(17,28,28,.58));backdrop-filter:blur(2px);opacity:1;transition:opacity .55s ease,visibility .55s ease;color:#f8f2dd}
#muraEntry.leaving{opacity:0;visibility:hidden;pointer-events:none}
#muraEntryCard{width:min(520px,calc(100vw - 34px));padding:34px 30px 30px;border:1px solid rgba(255,245,215,.24);border-radius:28px;background:linear-gradient(145deg,rgba(32,47,42,.78),rgba(24,35,34,.61));box-shadow:0 28px 90px rgba(12,22,20,.38);backdrop-filter:blur(18px) saturate(.9);text-align:center}
#muraEntryCard .muraEntryMark{width:58px;height:58px;margin:0 auto 18px;border:1px solid rgba(240,216,157,.42);border-radius:50%;display:grid;place-items:center;font-family:serif;font-size:24px;color:#efdba7;background:rgba(255,244,211,.06);box-shadow:0 0 30px rgba(226,194,117,.12)}
#muraEntryCard h2{margin:0;font-family:"Yu Mincho","Hiragino Mincho ProN",serif;font-size:clamp(34px,9vw,58px);font-weight:500;letter-spacing:.14em;text-indent:.14em;color:#fff8e9;text-shadow:0 8px 35px rgba(0,0,0,.18)}
#muraEntryCard .muraEntryLead{margin:13px auto 19px;max-width:360px;font-family:serif;font-size:12px;line-height:1.95;letter-spacing:.07em;color:rgba(247,239,216,.82)}
#muraEntryFacts{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:0 auto 22px}
#muraEntryFacts span{min-width:86px;padding:8px 11px;border-radius:13px;background:rgba(255,249,229,.07);border:1px solid rgba(255,249,229,.10);font-size:9px;color:rgba(245,237,212,.62)}
#muraEntryFacts b{display:block;margin-top:3px;font-family:serif;font-size:13px;font-weight:500;color:#f5ebce}
#muraEnterVillage{min-width:210px;min-height:52px;border-radius:27px;background:rgba(231,218,169,.94);color:#34433b;font-weight:700;letter-spacing:.12em;box-shadow:0 10px 30px rgba(0,0,0,.20);display:inline-flex;align-items:center;justify-content:center;gap:9px}
#muraEnterVillage svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8}
#muraEntryCard .muraEntryHint{display:block;margin-top:14px;font-size:9px;color:rgba(247,239,216,.48);letter-spacing:.08em}
body.mura-entry-open #title,body.mura-entry-open #tutorial,body.mura-entry-open #build,body.mura-entry-open #context,body.mura-entry-open #placement,body.mura-entry-open #idleStatus,body.mura-entry-open #idleMoment{opacity:0!important;pointer-events:none!important}
/* Idle Village Now is genuinely idle-only and translucent. */
#idleStatus{right:12px!important;left:auto!important;top:max(12px,env(safe-area-inset-top))!important;width:min(330px,calc(100vw - 24px))!important;background:linear-gradient(145deg,rgba(249,245,229,.56),rgba(236,239,220,.45))!important;border:1px solid rgba(255,255,239,.58)!important;box-shadow:0 14px 44px rgba(43,55,39,.14)!important;backdrop-filter:blur(14px) saturate(.95)!important;opacity:0!important;transform:translateY(-7px) scale(.985)!important;pointer-events:none!important;transition:opacity .95s ease,transform .95s cubic-bezier(.2,.75,.2,1)!important}
#idleStatus.visible{opacity:1!important;transform:translateY(0) scale(1)!important;pointer-events:auto!important}
.muraNowHead{align-items:center!important}.muraNowActions{display:flex!important;flex-direction:row!important;gap:5px!important;align-items:center!important}.muraNowActions button{min-height:30px!important;padding:5px 8px!important;border-radius:12px!important;background:rgba(81,104,76,.10)!important;border:1px solid rgba(80,94,69,.11)!important;font-size:9px!important;white-space:nowrap}.muraNowActions .muraButtonIcon{margin-right:3px!important;width:14px!important}.muraNowActions svg{width:13px!important;height:13px!important}
/* Tutorial gets a stable text column instead of being squeezed into 47vw. */
#tutorial{left:12px!important;right:auto!important;top:max(82px,calc(env(safe-area-inset-top) + 72px))!important;bottom:auto!important;transform:none!important;width:min(360px,calc(100vw - 24px))!important;max-width:none!important;min-height:48px!important;border-radius:18px!important;white-space:normal!important;align-items:stretch!important;overflow:hidden!important;z-index:17!important}
#tutorialAction{flex:1!important;min-width:0!important;width:auto!important;display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;align-items:center!important;gap:9px!important;padding:8px 8px 8px 11px!important;white-space:normal!important;text-align:left!important;line-height:1.45!important}
#tutorialCount{white-space:nowrap!important;align-self:center!important}#tutorialText{min-width:0!important;overflow-wrap:anywhere!important;word-break:normal!important;font-size:11px!important}#tutorial .tutorialArrow{justify-self:end!important}#dismissTutorial{flex:0 0 36px!important;width:36px!important;padding:3px!important;border-left:1px solid rgba(103,111,82,.10)!important;border-radius:0!important}
@media(max-width:560px){#muraEntryCard{padding:28px 20px 25px;border-radius:24px}#muraEntryCard h2{font-size:36px}#muraEntryFacts{gap:5px}#muraEntryFacts span{min-width:75px;padding:7px 8px}#idleStatus{width:min(300px,calc(100vw - 16px))!important;right:8px!important}.muraClimate{grid-template-columns:repeat(3,1fr)!important}.muraClimate span{padding:5px!important}.muraScaleLine{display:flex!important;font-size:7px!important}#tutorial{width:calc(100vw - 24px)!important}}
@media(max-height:520px){#muraEntryCard{padding:19px 24px}#muraEntryCard .muraEntryMark{display:none}#muraEntryCard h2{font-size:31px}#muraEntryCard .muraEntryLead{margin:8px auto 10px;line-height:1.5}#muraEntryFacts{margin-bottom:10px}#tutorial{top:64px!important;width:min(330px,55vw)!important}}
@media(prefers-reduced-motion:reduce){#muraEntry,#idleStatus{transition:none!important}}
`;
document.head.append(css);

function seasonName(){
 const day=((world.state.clock%DAYS_YEAR)+DAYS_YEAR)%DAYS_YEAR,index=Math.min(3,Math.floor(day/(DAYS_YEAR/4)));
 return ['春','夏','秋','冬'][index];
}
function installEntryScreen(){
 document.body.classList.add('mura-entry-open');
 const entry=document.createElement('section');entry.id='muraEntry';entry.setAttribute('aria-label','ゲーム開始');
 const pop=world.population(),year=Math.floor(world.state.clock/DAYS_YEAR)+1;
 entry.innerHTML=`<div id="muraEntryCard"><div class="muraEntryMark" aria-hidden="true">村</div><h2>MURAAAAAAA</h2><p class="muraEntryLead">六年の光と季節のなかで、住人の暮らしと村の変化を見守る。</p><div id="muraEntryFacts"><span>村の人口<b>${pop.people}人</b></span><span>村の時間<b>${year}年目</b></span><span>季節<b>${seasonName()}</b></span></div><button type="button" id="muraEnterVillage"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 12 5l8 7M6 11v8h12v-8M10 19v-5h4v5"/></svg><span>村へ入る</span></button><small class="muraEntryHint">タップすると音と村の時間がひらきます</small></div>`;
 document.body.append(entry);
 const enter=entry.querySelector('#muraEnterVillage');
 const open=()=>{if(entry.classList.contains('leaving'))return;activity();entry.classList.add('leaving');document.body.classList.remove('mura-entry-open');setTimeout(()=>entry.remove(),620);};
 enter.addEventListener('click',open);enter.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
 requestAnimationFrame(()=>enter.focus({preventScroll:true}));
}

function installVillageNowActions(){
 const panel=$('idleStatus'),head=panel?.querySelector('.muraNowHead');if(!panel||!head)return;
 // v2 previously forced the panel visible. From here on, core updateIdle owns visibility.
 panel.classList.remove('visible');
 let actions=head.querySelector('.muraNowActions');if(!actions){actions=document.createElement('div');actions.className='muraNowActions';head.append(actions);}
 const event=$('muraEventButton');if(event)actions.append(event);
 const mayor=world.people.find(p=>p.role==='mayor');
 if(mayor&&!actions.querySelector('#muraFollowMayor')){
  const follow=document.createElement('button');follow.id='muraFollowMayor';follow.type='button';follow.innerHTML='<span class="muraButtonIcon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M5 21c1-5 3-7 7-7s6 2 7 7"/></svg></span><span>村長を追う</span>';
  // pointerdown fires even though global activity handling fades this idle-only panel.
  follow.addEventListener('pointerdown',e=>{e.preventDefault();view.focus(mayor.x,mayor.z,27);view.followId=mayor.id;activity();});
  follow.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();view.focus(mayor.x,mayor.z,27);view.followId=mayor.id;activity();}});
  actions.prepend(follow);
 }
}

function removeMayorFollowFromDialog(){
 const root=$('dialogContent'),mayor=world.people.find(p=>p.role==='mayor');if(!root||!mayor)return;
 if(root.querySelector('h2')?.textContent?.trim()===mayor.name)root.querySelector('#followPerson')?.remove();
}
const dialogObserver=new MutationObserver(()=>queueMicrotask(removeMayorFollowFromDialog));if($('dialogContent'))dialogObserver.observe($('dialogContent'),{childList:true,subtree:true});

function installCameraInertia(){
 const originalPan=view.pan.bind(view),originalRender=view.render.bind(view),originalFocus=view.focus.bind(view),originalTouch=view.touch.bind(view);
 let vx=0,vz=0,lastPanAt=0;
 const stop=()=>{vx=0;vz=0;};view.stopInertia=stop;
 view.touch=(...args)=>{if(performance.now()-lastPanAt>90)stop();return originalTouch(...args);};
 view.focus=(...args)=>{stop();return originalFocus(...args);};
 view.pan=(dx,dy)=>{
  const bx=view.target.x,bz=view.target.z,now=performance.now();originalPan(dx,dy);const dt=Math.max(.008,Math.min(.055,(now-(lastPanAt||now-16))/1000)),wx=view.target.x-bx,wz=view.target.z-bz;
  if(Number.isFinite(wx)&&Number.isFinite(wz)&&Math.hypot(wx,wz)>.0001){const mix=.52;vx=vx*(1-mix)+(wx/dt)*mix;vz=vz*(1-mix)+(wz/dt)*mix;const speed=Math.hypot(vx,vz),cap=150;if(speed>cap){vx=vx/speed*cap;vz=vz/speed*cap;}}
  lastPanAt=now;
 };
 view.render=(time,dt)=>{
  if(view.interacting||view.cameraGoal||view.followId){if(view.cameraGoal||view.followId)stop();}
  else if(Math.hypot(vx,vz)>.02){view.target.x=Math.max(-LIMIT,Math.min(LIMIT,view.target.x+vx*dt));view.target.z=Math.max(-LIMIT,Math.min(LIMIT,view.target.z+vz*dt));const decay=Math.exp(-4.35*Math.min(dt,.08));vx*=decay;vz*=decay;if(Math.hypot(vx,vz)<.025)stop();}
  return originalRender(time,dt);
 };
 window.__MURA_CAMERA_INERTIA__={stop,get velocity(){return{x:vx,z:vz};}};
}

installCameraInertia();
installVillageNowActions();
installEntryScreen();
removeMayorFollowFromDialog();
window.__MURA_ENTRY_POLISH__={version:1};
