import {nextVillageGoal} from './game/director-guidance.js';

const village=window.village;
if(!village)throw new Error('MURAAAAAAA director polish requires a booted village');
const {world,view}=village;
const $=id=>document.getElementById(id);
const shortestAngle=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));

const css=document.createElement('style');
css.dataset.muraDirectorPolish='1';
css.textContent=`
#muraVillageGoal{grid-column:1/-1;display:flex;align-items:center;gap:6px;min-width:0;margin-top:2px;padding:4px 6px;border-top:1px solid rgba(82,100,76,.10);color:#536458;font-size:8px;line-height:1.35;letter-spacing:.015em}
#muraVillageGoal[hidden]{display:none!important}#muraVillageGoal b{flex:none;font-size:7px;letter-spacing:.08em;color:#72806f}#muraVillageGoal span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#muraObservationBar{position:fixed;left:50%;bottom:max(72px,calc(env(safe-area-inset-bottom) + 64px));z-index:42;display:flex;align-items:center;gap:5px;max-width:calc(100vw - 20px);padding:6px;border:1px solid rgba(255,251,235,.62);border-radius:16px;background:linear-gradient(145deg,rgba(242,235,214,.88),rgba(215,226,199,.84));box-shadow:0 10px 28px rgba(35,50,38,.16),inset 0 1px 0 #fff9;backdrop-filter:blur(9px) saturate(.9);transform:translateX(-50%)}
#muraObservationBar[hidden]{display:none!important}#muraObservationBar button{min-width:44px;min-height:44px;padding:6px 8px;border-radius:11px;background:rgba(255,250,235,.44);border:1px solid rgba(83,101,76,.13);box-shadow:inset 0 1px 0 #fff8;color:#405247;font-size:9px;font-weight:800}#muraObservationBar button[aria-pressed=true]{background:#bdcdae;box-shadow:inset 0 2px 5px rgba(52,72,50,.13)}#muraObservationBar .muraObservationClose{color:#75554d;background:#e4d0c4}
.muraPersonCamera button{min-height:44px!important}
@media(max-width:420px){#muraObservationBar{gap:3px;padding:5px}#muraObservationBar button{min-width:43px;padding:5px;font-size:8px}#muraVillageGoal{font-size:7.5px}}
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
 view.span+=(goal.span-view.span)*t;view.pitch+=(goal.pitch-view.pitch)*t;view.yaw+=shortestAngle(view.yaw,goal.yaw)*t;
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

function installGoal(){
 const hud=document.querySelector('.muraCompactHud');if(!hud||$('muraVillageGoal'))return;
 const node=document.createElement('div');node.id='muraVillageGoal';node.innerHTML='<b>次の一手</b><span></span>';hud.append(node);
 let previous='';const refresh=()=>{const text=nextVillageGoal(world);node.hidden=!text;if(!text||text===previous)return;previous=text;node.querySelector('span').textContent=text;};
 refresh();setInterval(refresh,900);
}
installGoal();

window.__MURA_DIRECTOR_POLISH__={version:1,beginObservation,stopObservation,get observation(){return{...observation};},villageGoal:()=>nextVillageGoal(world)};
