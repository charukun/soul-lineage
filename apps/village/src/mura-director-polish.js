import {nextVillageGoal,nextVillageGuidance} from './game/director-guidance.js';
import {defs,unlocked} from './game/core.js';

const village=window.village;
if(!village)throw new Error('宝満叡智 director polish requires a booted village');
const {world,view}=village;
const $=id=>document.getElementById(id);
const shortestAngle=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));

const css=document.createElement('style');
css.dataset.muraDirectorPolish='1';
css.textContent=`
#muraVillageGoal{grid-column:1/-1;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:7px;min-width:0;margin-top:3px;padding:7px 7px 6px;border-top:1px solid rgba(82,100,76,.12);color:#536458;line-height:1.35;letter-spacing:.015em}
#muraVillageGoal[hidden]{display:none!important}#muraVillageGoal>div{min-width:0}#muraVillageGoal>b{align-self:start;padding-top:2px;white-space:nowrap;font-size:7px;letter-spacing:.09em;color:#72806f}#muraVillageGoal strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;color:#405247}#muraVillageGoal small{display:block;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:7.5px;color:#718077}#muraVillageGoal button{min-width:44px;min-height:36px;padding:5px 8px;border-radius:10px;border:1px solid rgba(83,101,76,.16);background:rgba(225,232,209,.76);color:#405247;font-size:8px;font-weight:800;box-shadow:inset 0 1px 0 #fff8}#muraVillageGoal button[hidden]{display:none!important}#muraVillageGoal[data-action=true] strong{color:#344b3d}#muraVillageGoal[data-action=true] button{animation:muraVillageHint 2.8s ease-in-out infinite}@keyframes muraVillageHint{0%,70%,100%{box-shadow:inset 0 1px 0 #fff8,0 0 0 0 rgba(116,145,96,0)}82%{box-shadow:inset 0 1px 0 #fff8,0 0 0 4px rgba(116,145,96,.10)}}
#muraObservationBar{position:fixed;left:50%;bottom:max(72px,calc(env(safe-area-inset-bottom) + 64px));z-index:42;display:flex;align-items:center;gap:5px;max-width:calc(100vw - 20px);padding:6px;border:1px solid rgba(255,251,235,.62);border-radius:16px;background:linear-gradient(145deg,rgba(242,235,214,.88),rgba(215,226,199,.84));box-shadow:0 10px 28px rgba(35,50,38,.16),inset 0 1px 0 #fff9;backdrop-filter:blur(9px) saturate(.9);transform:translateX(-50%)}
#muraObservationBar[hidden]{display:none!important}#muraObservationBar button{min-width:44px;min-height:44px;padding:6px 8px;border-radius:11px;background:rgba(255,250,235,.44);border:1px solid rgba(83,101,76,.13);box-shadow:inset 0 1px 0 #fff8;color:#405247;font-size:9px;font-weight:800}#muraObservationBar button[aria-pressed=true]{background:#bdcdae;box-shadow:inset 0 2px 5px rgba(52,72,50,.13)}#muraObservationBar .muraObservationClose{color:#75554d;background:#e4d0c4}
.muraPersonCamera button{min-height:44px!important}
@media(max-width:420px){#muraObservationBar{gap:3px;padding:5px}#muraObservationBar button{min-width:43px;padding:5px;font-size:8px}#muraVillageGoal{gap:5px;padding-inline:5px}#muraVillageGoal strong{font-size:8.5px}#muraVillageGoal small{font-size:7px}}
@media(prefers-reduced-motion:reduce){#muraVillageGoal[data-action=true] button{animation:none}}
`;
document.head.append(css);

const observation={personId:null,mode:null,active:false};
const bar=document.createElement('div');
bar.id='muraObservationBar';bar.hidden=true;bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','住民を見る');
bar.innerHTML='<button type="button" data-observe="front">正面</button><button type="button" data-observe="side">横</button><button type="button" data-observe="back">背面</button><button type="button" data-observe="top">俯瞰</button><button type="button" class="muraObservationClose" data-observe="close">終了</button>';
document.body.append(bar);

function resident(id=observation.personId){return world.people.find(p=>p.id===id&&!p.dead)||null;}
function syncBar(){
 bar.hidden=!observation.active;
 for(const button of bar.querySelectorAll('[data-observe]'))button.setAttribute('aria-pressed',String(observation.active&&button.dataset.observe===observation.mode));
}
function stopObservation({restore=true}={}){
 const p=resident();observation.active=false;observation.personId=null;observation.mode=null;view.followId=null;view.cameraGoal=null;view.target.y=0;
 if(restore&&p){view.pitch=.72;view.focus(p.x,p.z,Math.max(28,Math.min(42,view.span*1.7)));}
 syncBar();
}
function beginObservation(id,mode='front'){
 const p=resident(id);if(!p)return false;
 if(p.insideId&&view.roomId!==p.insideId)village.enterRoom?.(p.insideId);
 observation.personId=p.id;observation.mode=['front','side','back','top'].includes(mode)?mode:'front';observation.active=true;
 view.followId=null;view.cameraGoal=null;
 $('dialog')?.close();syncBar();applyObservation(1);return true;
}
function targetFor(p,mode){
 const angle=Number(p.angle)||0;
 if(mode==='front')return{yaw:angle+Math.PI,pitch:.22,span:9};
 if(mode==='back')return{yaw:angle,pitch:.22,span:9};
 if(mode==='side')return{yaw:angle+Math.PI/2,pitch:.24,span:10};
 return{yaw:.63,pitch:.72,span:19};
}
function applyObservation(dt){
 if(!observation.active)return;
 const p=resident();if(!p){stopObservation({restore:false});return;}
 const goal=targetFor(p,observation.mode),t=1-Math.exp(-Math.max(.016,dt||.016)*8);
 view.target.x+=(p.x-view.target.x)*t;view.target.z+=(p.z-view.target.z)*t;view.target.y+=(1.05-view.target.y)*t;
 view.span+=(goal.span-view.span)*t;view.pitch+=(goal.pitch-view.pitch)*t;
 // Front/side/back are authored resident-relative views. Keep their yaw locked
 // to the resident's current facing while the framing itself continues to ease.
 if(observation.mode==='top')view.yaw+=shortestAngle(view.yaw,goal.yaw)*t;else view.yaw=goal.yaw;
 view.cameraGoal=null;view.followId=null;
 // View.render normally starts a slow orbit after inactivity. Observation is a
 // deliberate camera state, so keep it stationary while still following the resident.
 view.lastInteraction=performance.now();
}
const originalRender=view.render.bind(view);
view.render=(time,dt)=>{applyObservation(dt);return originalRender(time,dt);};
const originalTouch=view.touch.bind(view);
view.touch=()=>{if(observation.active)stopObservation({restore:false});return originalTouch();};
for(const button of bar.querySelectorAll('[data-observe]'))button.onclick=()=>button.dataset.observe==='close'?stopObservation():beginObservation(observation.personId,button.dataset.observe);

document.addEventListener('pointerdown',event=>{
 if(!observation.active||bar.contains(event.target))return;
 if(event.target.closest('#build,#leaveRoom,#muraSettingsButton,#more,#tutorial,#drawer,#placement'))stopObservation();
},{capture:true,passive:true});

function bindPersonDialog(){
 const host=$('dialogContent');if(!host)return;
 const name=host.querySelector('h2')?.textContent?.trim();if(!name)return;
 const p=world.people.find(person=>person.name===name&&!person.dead);if(!p)return;
 for(const button of host.querySelectorAll('[data-camera]')){
  button.dataset.directorCamera='1';
  button.onclick=()=>beginObservation(p.id,button.dataset.camera);
 }
 const follow=host.querySelector('#followPerson');if(follow){if(follow.textContent!=='追従して見る')follow.textContent='追従して見る';follow.onclick=()=>beginObservation(p.id,'top');}
}
const dialogHost=$('dialogContent');if(dialogHost){new MutationObserver(()=>queueMicrotask(bindPersonDialog)).observe(dialogHost,{childList:true,subtree:true});bindPersonDialog();}

function openGuidedBuild(next){
 const action=next?.action;if(action?.type!=='build'||!defs[action.kind])return false;
 if(!unlocked(world.state,action.kind)){village.toast('まだ利用できない施設です');return false;}
 if(observation.active)stopObservation({restore:false});
 if(view.roomId)village.exitRoom?.();
 village.ui.category=defs[action.kind].category;
 village.openDrawer(action.kind);
 view.endObservation();
 if(action.at)view.focus(action.at[0],action.at[1],46);
 requestAnimationFrame(()=>{
  const target=$('catalog')?.querySelector(`[data-kind="${CSS.escape(action.kind)}"]`);
  if(!target)return;
  target.classList.add('muraTutorialTarget','recommended');
  target.focus({preventScroll:true});
 });
 village.toast(`${defs[action.kind].label}を選んで、置く場所を決めましょう`,2600);
 return true;
}

function installGoal(){
 const hud=document.querySelector('.muraCompactHud');if(!hud||$('muraVillageGoal'))return;
 const node=document.createElement('div');node.id='muraVillageGoal';node.innerHTML='<b>村の気配</b><div><strong></strong><small></small></div><button type="button"></button>';hud.append(node);
 const title=node.querySelector('strong'),detail=node.querySelector('small'),action=node.querySelector('button');
 let current=null,previous='';
 const refresh=()=>{
  const next=nextVillageGuidance(world),blocked=!!world.tutorialStep?.();
  node.hidden=!next||blocked;
  if(!next)return;
  current=next;
  const signature=[next.id,next.title,next.text,next.action?.kind,next.action?.label].join('|');
  if(signature===previous)return;previous=signature;
  title.textContent=next.title;detail.textContent=next.text;
  action.hidden=!next.action;node.dataset.action=String(!!next.action);
  if(next.action){action.textContent=next.action.label||'見る';action.setAttribute('aria-label',`${next.title} ${next.action.label||'見る'}`);}
 };
 action.onclick=()=>openGuidedBuild(current);
 refresh();setInterval(refresh,900);
}
installGoal();

window.__MURA_DIRECTOR_POLISH__={version:2,beginObservation,stopObservation,get observation(){return{...observation};},villageGoal:()=>nextVillageGoal(world),villageGuidance:()=>nextVillageGuidance(world),openGuidedBuild};
