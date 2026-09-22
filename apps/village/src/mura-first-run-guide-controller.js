import {defs} from './game/core.js';
import {markFirstRunAutoplaySeen} from './game/first-run-onboarding.js';
import {bindFoundingPlacement,completeFounding,foundingArrivalComplete,markFoundingArrivalSeen} from './game/founding-onboarding.js';
import {createFirstRunGuideView} from './mura-first-run-guide-view.js';

const DRAG_DISTANCE=32;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function timingFor(reduced){
 return reduced?{read:280,tap:600,drag:760,confirm:260,hold:800,repeat:2200}:{read:700,tap:1150,drag:1800,confirm:520,hold:800,repeat:1500};
}
function currentStep(ctx){return ctx.world.tutorialStep();}
function prepareStep(ctx){
 const step=currentStep(ctx);ctx.step=step;
 if(!step){ctx.guide.setStage('done');return null;}
 ctx.ui.category=defs[step.kind]?.category||'住まい';
 ctx.guide.setStep({...step,label:defs[step.kind]?.label||step.title});
 ctx.guide.setStage('welcome');
 return step;
}
function accept(ctx,next,message){ctx.guide.accept(next,message,ctx.timing.confirm);}
function catalogDetour(ctx,event,button){
 const step=ctx.step;if(!step)return false;
 const card=event.target.closest?.('#catalog .card');
 if(card&&card.dataset.kind!==step.kind){event.preventDefault();event.stopImmediatePropagation();ctx.guide.setHint(`今回は「${defs[step.kind].label}」。光っているものを選んでください。`);void ctx.guide.playDemo({immediate:true});return true;}
 const tab=button.matches('#tabs [data-category]')?button:null;
 if(tab&&tab.dataset.category!==defs[step.kind].category){event.preventDefault();event.stopImmediatePropagation();ctx.guide.setHint(`「${defs[step.kind].category}」のままでOKです。`);return true;}
 return false;
}
function onClick(ctx,event){
 if(!ctx.active)return;
 const button=event.target.closest?.('button');if(!button||Object.values(ctx.guide.controls).includes(button))return;
 if(ctx.guide.stage==='catalog'&&catalogDetour(ctx,event,button))return;
 if(ctx.guide.stage==='build'&&button.id==='build'){
  requestAnimationFrame(()=>{if(ctx.active&&ctx.ui.drawer)accept(ctx,'catalog',`光っている「${defs[ctx.step.kind].label}」をタップ。`);});return;
 }
 if(ctx.guide.stage==='catalog'&&button.matches(`#catalog .card[data-kind="${CSS.escape(ctx.step.kind)}"]`)){
  requestAnimationFrame(()=>{if(ctx.active&&ctx.ui.pending?.kind===ctx.step.kind)accept(ctx,'drag','1本指で画面をなぞり、置く場所を決めます。');});return;
 }
 if((ctx.guide.stage==='drag'||ctx.guide.stage==='place')&&button.id==='cancelPlace'){requestAnimationFrame(()=>requestAnimationFrame(()=>verifyPlacement(ctx)));return;}
 if(button.id==='muraCancelPlacement')requestAnimationFrame(()=>{if(ctx.active&&!ctx.ui.pending)ctx.guide.setStage('build',{message:'配置をやめました。「つくる」から再開できます。'});});
}
function onPointerDown(ctx,event){
 const stage=ctx.guide.stage;if(!ctx.active||(stage!=='drag'&&stage!=='place')||ctx.ui.pending?.kind!==ctx.step?.kind||event.target!==ctx.canvas)return;
 if(event.button!==undefined&&event.button!==0)return;
 if(ctx.gesture){ctx.gesture.multi=true;return;}
 ctx.gesture={id:event.pointerId,start:{x:event.clientX,y:event.clientY},last:{x:event.clientX,y:event.clientY},max:0,multi:false,stage};
}
function onPointerMove(ctx,event){const g=ctx.gesture;if(!g||event.pointerId!==g.id)return;g.last={x:event.clientX,y:event.clientY};g.max=Math.max(g.max,distance(g.start,g.last));}
function onPointerFinish(ctx,event){
 const g=ctx.gesture;if(!g||event.pointerId!==g.id)return;ctx.gesture=null;
 if(g.multi||!ctx.active)return;
 if(g.stage==='drag'){
  if(g.max<DRAG_DISTANCE){ctx.guide.setHint('1本指で少し動かして、置く場所を決めます。');return;}
  if(ctx.ui.pending?.error){ctx.guide.setHint(`そこには置けません。「${ctx.ui.pending.error}」`,3600);return;}
  accept(ctx,'place','この位置でよければ、短く1回タップ。');return;
 }
 requestAnimationFrame(()=>requestAnimationFrame(()=>verifyPlacement(ctx)));
}
function verifyPlacement(ctx){
 const step=ctx.step;if(!step)return;
 const placed=ctx.world.objects.find(object=>object.kind===step.kind);
 if(placed&&!ctx.ui.pending){
  bindFoundingPlacement(ctx.world,step.kind,placed);
  void ctx.village.save();
  const next=currentStep(ctx);
  if(!next){ctx.guide.setStage('done');return;}
  ctx.step=next;ctx.ui.category=defs[next.kind]?.category||'住まい';ctx.guide.setStep({...next,label:defs[next.kind]?.label||next.title});
  ctx.guide.setStage('welcome',{message:next.text});
  return;
 }
 if(ctx.ui.pending?.error)ctx.guide.setHint(`そこには置けません。「${ctx.ui.pending.error}」`,3600);
 else ctx.guide.setHint('中央に見えている位置で、短く1回タップします。');
}
function installListeners(ctx){
 const h={click:e=>onClick(ctx,e),down:e=>onPointerDown(ctx,e),move:e=>onPointerMove(ctx,e),finish:e=>onPointerFinish(ctx,e),resize:()=>ctx.guide.refreshTarget()};
 ctx.handlers=h;document.addEventListener('click',h.click,true);document.addEventListener('pointerdown',h.down,true);document.addEventListener('pointermove',h.move,true);document.addEventListener('pointerup',h.finish,true);document.addEventListener('pointercancel',h.finish,true);window.addEventListener('resize',h.resize,{passive:true});
}
function removeListeners(ctx){const h=ctx.handlers;document.removeEventListener('click',h.click,true);document.removeEventListener('pointerdown',h.down,true);document.removeEventListener('pointermove',h.move,true);document.removeEventListener('pointerup',h.finish,true);document.removeEventListener('pointercancel',h.finish,true);window.removeEventListener('resize',h.resize);if(ctx.entryListener)document.removeEventListener('click',ctx.entryListener,true);if(ctx.arrivalFrame)cancelAnimationFrame(ctx.arrivalFrame);}
async function complete(ctx){
 if(ctx.finishing)return;ctx.finishing=true;ctx.active=false;
 completeFounding(ctx.world);markFirstRunAutoplaySeen(ctx.world.state);
 try{await ctx.village.save();ctx.canvas.dataset.firstRunTutorial='seen';}catch(error){console.warn('Founding tutorial completion could not be persisted',error);}
 removeListeners(ctx);ctx.view.autoOrbit=ctx.previousAutoOrbit;ctx.guide.destroy();ctx.village.activity();ctx.village.updateTutorial();
}
function startArrival(ctx){
 const members=ctx.world.people.filter(p=>['mayor-npc','guard-npc','logger-npc','carpenter-npc'].includes(p.id));
 const targets=[[-7,2],[-4,5],[-10,5],[-7,8]],starts=members.map(p=>({x:p.x,z:p.z}));
 const duration=ctx.reduced?650:4200,start=performance.now();ctx.guide.show('arrival');ctx.canvas.dataset.foundingArrival='walking';
 const tick=now=>{
  if(!ctx.active)return;const raw=Math.min(1,(now-start)/duration),t=1-Math.pow(1-raw,3);
  members.forEach((p,i)=>{p.x=starts[i].x+(targets[i][0]-starts[i].x)*t;p.z=starts[i].z+(targets[i][1]-starts[i].z)*t;p.angle=Math.atan2(targets[i][0]-starts[i].x,targets[i][1]-starts[i].z);p.moving=raw<1;p.status=raw<1?'新しい土地へ向かっています':'ここから村を始めます';});
  const cx=members.reduce((n,p)=>n+p.x,0)/members.length,cz=members.reduce((n,p)=>n+p.z,0)/members.length;ctx.view.focus(cx,cz,34);
  if(raw<1){ctx.arrivalFrame=requestAnimationFrame(tick);return;}
  ctx.canvas.dataset.foundingArrival='arrived';markFoundingArrivalSeen(ctx.world);void ctx.village.save();prepareStep(ctx);
 };
 ctx.arrivalFrame=requestAnimationFrame(tick);
}
function beginAfterEntry(ctx){
 const begin=()=>{if(!ctx.active)return;if(foundingArrivalComplete(ctx.world))prepareStep(ctx);else startArrival(ctx);};
 if(!ctx.ui.entryOpen){begin();return;}
 ctx.entryListener=event=>{if(!event.target.closest?.('#muraEnterVillage'))return;document.removeEventListener('click',ctx.entryListener,true);ctx.entryListener=null;requestAnimationFrame(()=>requestAnimationFrame(begin));};
 document.addEventListener('click',ctx.entryListener,true);
}
export function startFirstRunGuide({village,canvas}){
 const {world,view,ui}=village,reduced=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,timing=timingFor(reduced),previousAutoOrbit=view.autoOrbit;
 view.autoOrbit=false;canvas.dataset.firstRunTutorial='running';
 const guide=createFirstRunGuideView({canvas,initiallyHidden:ui.entryOpen,reduced,timing});
 const ctx={village,canvas,world,view,ui,guide,timing,reduced,previousAutoOrbit,active:true,finishing:false,gesture:null,entryListener:null,handlers:null,arrivalFrame:0,step:null};
 guide.controls.skip.hidden=true;guide.controls.replay.onclick=()=>void guide.playDemo({immediate:true});guide.controls.start.onclick=()=>guide.setStage('build');guide.controls.finish.onclick=()=>void complete(ctx);
 installListeners(ctx);beginAfterEntry(ctx);return ctx;
}
