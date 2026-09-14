import {defs,RESOURCE_NAMES,localToWorld,unlocked} from './game/core.js';
import {ENTRY_SEEN_KEY,feedbackTone,nearestProjectedObject,shouldCelebrate,shouldSkipEntry,tutorialReason} from './web/playability.js';

const village=window.village;
if(!village)throw new Error('MURAAAAAAA playability polish requires a booted village');
const {world,view,ui,sim,activity}=village,$=id=>document.getElementById(id);
document.body.classList.add('mura-playability-v1');

const css=document.createElement('style');css.dataset.muraPlayability='1';css.textContent=`
#muraMilestone{position:fixed;left:50%;top:max(72px,calc(env(safe-area-inset-top) + 62px));z-index:65;display:flex;align-items:center;gap:9px;max-width:min(520px,calc(100vw - 28px));padding:10px 14px;border:1px solid rgba(255,249,225,.72);border-radius:16px;background:linear-gradient(145deg,rgba(244,237,211,.94),rgba(213,225,197,.91));box-shadow:0 16px 48px rgba(35,50,38,.18),inset 0 1px 0 #fff9;backdrop-filter:blur(12px);color:#405247;transform:translate(-50%,-12px) scale(.97);opacity:0;pointer-events:none;transition:opacity .22s ease,transform .3s cubic-bezier(.2,.8,.2,1)}
#muraMilestone.visible{opacity:1;transform:translate(-50%,0) scale(1)}#muraMilestone b{font-family:serif;font-size:12px;font-weight:700;letter-spacing:.04em}#muraMilestone span{font-size:10px;line-height:1.45}
#muraMilestone[data-tone="unlock"]{background:linear-gradient(145deg,rgba(248,229,176,.96),rgba(224,204,146,.93));color:#5d4b2f}#muraMilestone[data-tone="danger"]{background:linear-gradient(145deg,rgba(103,47,43,.95),rgba(62,39,38,.94));border-color:rgba(255,224,207,.35);color:#fff1e6}#muraMilestone[data-tone="event"]{background:linear-gradient(145deg,rgba(205,225,226,.95),rgba(179,206,201,.93));color:#314e50}
#muraTutorialReason{grid-column:2/4;display:block;margin-top:-4px;padding-right:4px;font-size:8.5px;line-height:1.42;font-weight:500;color:rgba(65,78,61,.67);letter-spacing:.01em}#tutorialAction .tutorialArrow{grid-row:1/3;grid-column:3;align-self:center}
.muraResidentLife{margin:10px 0;padding:10px 11px;border:1px solid rgba(81,102,77,.13);border-radius:13px;background:rgba(113,139,99,.08)}.muraResidentLife b{display:block;margin-bottom:4px;font-size:9px;letter-spacing:.08em;color:#687967}.muraResidentLife span{font-family:serif;font-size:12px;color:#3f5246}.muraResidentLife small{display:block;margin-top:4px;color:#758176;font-size:9px;line-height:1.5}
body.mura-playability-v1 #context:not([hidden]){box-shadow:0 12px 36px rgba(36,52,39,.16),inset 0 1px 0 rgba(255,255,255,.58)}
body.mura-playability-v1 #placement:not([hidden]){box-shadow:0 16px 44px rgba(35,50,38,.18),inset 0 1px 0 rgba(255,255,255,.62)}
@media(max-width:560px){#muraMilestone{top:max(66px,calc(env(safe-area-inset-top) + 58px));max-width:calc(100vw - 18px);padding:9px 11px}#muraMilestone span{font-size:9px}#muraTutorialReason{font-size:8px}}
@media(prefers-reduced-motion:reduce){#muraMilestone{transition:none}}
`;
document.head.append(css);

function rememberEntry(){try{localStorage.setItem(ENTRY_SEEN_KEY,'1');}catch{}}
function installReturnFlow(){
 const entry=$('muraEntry');if(!entry)return;
 let seen=false;try{seen=shouldSkipEntry(localStorage.getItem(ENTRY_SEEN_KEY));}catch{}
 if(seen){entry.remove();document.body.classList.remove('mura-entry-open');activity();return;}
 const enter=$('muraEnterVillage');if(!enter)return;
 enter.addEventListener('click',rememberEntry,{capture:true,once:true});
 enter.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')rememberEntry();},{capture:true});
}

const milestone=document.createElement('div');milestone.id='muraMilestone';milestone.setAttribute('role','status');milestone.setAttribute('aria-live','polite');milestone.innerHTML='<b>村の変化</b><span></span>';document.body.append(milestone);
let milestoneTimer=0,lastMilestone='',lastMilestoneAt=0;
function announce(text,type='life',force=false){
 text=String(text||'').trim();if(!text||(!force&&!shouldCelebrate(text,type)))return;
 const now=performance.now();if(text===lastMilestone&&now-lastMilestoneAt<1800)return;lastMilestone=text;lastMilestoneAt=now;
 milestone.dataset.tone=feedbackTone(text,type);milestone.querySelector('span').textContent=text;milestone.classList.remove('visible');
 requestAnimationFrame(()=>milestone.classList.add('visible'));clearTimeout(milestoneTimer);milestoneTimer=setTimeout(()=>milestone.classList.remove('visible'),3600);
}

function installSelectionAssist(){
 const directPick=view.pick.bind(view);
 view.pick=(x,y,people=false)=>{
  const direct=directPick(x,y,people);if(direct||people)return direct;
  const roomId=view.roomId,host=roomId&&world.object(roomId),objects=world.list(roomId);
  return nearestProjectedObject({
   objects,defs,x,y,viewportWidth:view.w||innerWidth,viewportHeight:view.h||innerHeight,span:view.span,
   project:(px,py,pz)=>view.project(px,py,pz),
   resolvePosition:object=>host?localToWorld(host,object.x,object.z):object,
  });
 };
 const directPerson=view.pickPerson.bind(view);
 view.pickPerson=(x,y,radius)=>directPerson(x,y,radius??(innerWidth<700?31:24));
}

function installTutorialFlow(){
 const tutorial=$('tutorial'),action=$('tutorialAction'),text=$('tutorialText');if(!tutorial||!action||!text)return;
 let reason=$('muraTutorialReason');if(!reason){reason=document.createElement('small');reason.id='muraTutorialReason';text.after(reason);}
 const sync=()=>{const step=world.tutorialStep();reason.textContent=tutorialReason(step);reason.hidden=!step;};sync();
 const observer=new MutationObserver(sync);observer.observe(text,{childList:true,characterData:true,subtree:true});world.listeners.add(sync);
 const original=action.onclick;
 action.onclick=event=>{
  const step=world.tutorialStep();if(!step||!unlocked(world.state,step.kind)){original?.call(action,event);return;}
  ui.category=defs[step.kind].category;village.beginPlacement(step.kind);view.focus(step.at[0],step.at[1],step.kind==='tent'?40:46);
  requestAnimationFrame(()=>{
   const finder=$('muraFindPlacement');if(finder&&!finder.disabled){finder.click();finder.textContent='別の候補';}
   const confirm=$('cancelPlace');if(confirm)confirm.focus({preventScroll:true});
  });
 };
}

function taskLabel(person){
 const labels={work:'仕事中',home:'家でひと息',meal:'食事中',eat:'食事中',walk:'村を散歩中',wander:'村を散歩中',rest:'休憩中',sleep:'休息中',defending:'警備中',rescue:'救助へ向かっています'};
 return person.downed?'助けを待っています':labels[person.task]||person.status||'村で暮らしています';
}
function enrichPersonDialog(){
 const host=$('dialogContent');if(!host||host.querySelector('.muraResidentLife'))return;
 const name=host.querySelector('h2')?.textContent?.trim(),person=world.people.find(p=>p.name===name&&!p.dead);if(!person)return;
 const home=world.object(person.homeId),job=world.object(person.jobId),node=document.createElement('div');node.className='muraResidentLife';
 node.innerHTML=`<b>今日の暮らし</b><span>${taskLabel(person)}</span><small>${home?`住まい：${defs[home.kind]?.label||'住まい'}`:'住まいを探しています'}${job?` · 仕事：${defs[job.kind]?.label||'村の仕事'}`:''}</small>`;
 const status=host.querySelector('.personStatus');(status||host.querySelector('h2'))?.after(node);
}
function installResidentLife(){const host=$('dialogContent');if(!host)return;new MutationObserver(()=>queueMicrotask(enrichPersonDialog)).observe(host,{childList:true,subtree:true});enrichPersonDialog();}

function installFeedback(){
 if(typeof world.notify==='function'){
  const originalNotify=world.notify.bind(world);world.notify=(text,type='life')=>{const result=originalNotify(text,type);announce(text,type);return result;};
 }
 if(typeof world.gain==='function'){
  const originalGain=world.gain.bind(world);world.gain=(key,amount)=>{const known=world.state.known.includes(key),result=originalGain(key,amount);if(!known&&world.state.known.includes(key))announce(`${RESOURCE_NAMES[key]||key}を発見。新しい施設を確認できます。`,'unlock',true);return result;};
 }
 const originalEvent=sim.onEvent;sim.onEvent=(text,type)=>{originalEvent?.(text,type);if(['threat','loss','rescue','voyage'].includes(type))announce(text,type,true);};
}

function installReadableFocus(){
 const priorRender=view.render.bind(view);view.render=(time,dt)=>{
  const current=Number(world.state.settings.tilt),observation=window.__MURA_DIRECTOR_POLISH__?.observation?.active;
  const handsOn=!observation&&(!!ui.pending||!!ui.selected||ui.drawer||!!view.roomId||!$('context')?.hidden);
  if(Number.isFinite(current)&&handsOn)world.state.settings.tilt=Math.min(current,.46);
  try{return priorRender(time,dt);}finally{if(Number.isFinite(current))world.state.settings.tilt=current;}
 };
}

installReturnFlow();
installSelectionAssist();
installTutorialFlow();
installResidentLife();
installFeedback();
installReadableFocus();
window.__MURA_PLAYABILITY_POLISH__={version:1,announce,tutorialReason:()=>tutorialReason(world.tutorialStep()),entryKey:ENTRY_SEEN_KEY};
