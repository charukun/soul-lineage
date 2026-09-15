import {markFirstRunAutoplaySeen} from './game/first-run-onboarding.js';
import {createFirstRunGuideView} from './mura-first-run-guide-view.js';

export const GUIDE_KIND='tent';
const DRAG_DISTANCE=32;
const TAP_DISTANCE=7;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function timingFor(reduced){
 return reduced?{read:420,tap:520,drag:760,confirm:320}:{read:1050,tap:900,drag:1650,confirm:800};
}

function accept(ctx,next,message){
 ctx.guide.accept(next,message,ctx.timing.confirm);
}

function catalogDetour(ctx,event,button){
 const card=event.target.closest?.('#catalog .card');
 if(card&&card.dataset.kind!==GUIDE_KIND){
  event.preventDefault();event.stopImmediatePropagation();
  ctx.guide.setHint('今回は「空きテント」を選びます。光っている住まいをタップしてください。');
  void ctx.guide.playDemo({immediate:true});
  return true;
 }
 if(button.matches('#tabs [data-category]')&&button.dataset.category!=='住まい'){
  event.preventDefault();event.stopImmediatePropagation();
  ctx.guide.setHint('最初は「住まい」のままで大丈夫です。光っている空きテントを選んでください。');
  void ctx.guide.playDemo({immediate:true});
  return true;
 }
 return false;
}

function handleBuildClick(ctx,button){
 if(ctx.guide.stage!=='build'||button.id!=='build')return false;
 requestAnimationFrame(()=>{if(ctx.active&&ctx.ui.drawer)accept(ctx,'catalog','そうです。次は、実際の住まいを選びます。');});
 return true;
}

function handleCatalogClick(ctx,button){
 if(ctx.guide.stage!=='catalog')return false;
 if(button.matches('#catalog .card[data-kind="tent"]')){
  requestAnimationFrame(()=>{if(ctx.active&&ctx.ui.pending?.kind===GUIDE_KIND)accept(ctx,'drag','配置モードに入りました。次は場所を自分の指で動かします。');});
  return true;
 }
 if(button.id==='build'||button.id==='closeDrawer'){
  requestAnimationFrame(()=>{if(ctx.active&&!ctx.ui.drawer)ctx.guide.setStage('build',{message:'閉じても大丈夫です。もう一度「つくる」から試せます。'});});
  return true;
 }
 return false;
}

function handlePlacementButton(ctx,event,button){
 const stage=ctx.guide.stage;
 if(stage!=='drag'&&stage!=='place')return false;
 if(button.id==='cancelPlace'){
  event.preventDefault();event.stopImmediatePropagation();
  const message=stage==='drag'?'まず1本指で画面をなぞって、テントの場所を動かしてみてください。':'今回は画面そのものを短くタップして置いてみましょう。';
  ctx.guide.setHint(message);void ctx.guide.playDemo({immediate:true});
  return true;
 }
 if(button.id==='muraCancelPlacement'){
  requestAnimationFrame(()=>{if(ctx.active&&!ctx.ui.pending)ctx.guide.setStage('build',{message:'配置をやめました。もう一度「つくる」から試せます。'});});
  return true;
 }
 return false;
}

function onClick(ctx,event){
 if(!ctx.active)return;
 const button=event.target.closest?.('button');
 if(!button||Object.values(ctx.guide.controls).includes(button))return;
 if(ctx.guide.stage==='catalog'&&catalogDetour(ctx,event,button))return;
 if(handleBuildClick(ctx,button))return;
 if(handleCatalogClick(ctx,button))return;
 handlePlacementButton(ctx,event,button);
}

function onPointerDown(ctx,event){
 const stage=ctx.guide.stage;
 if(!ctx.active||(stage!=='drag'&&stage!=='place')||ctx.ui.pending?.kind!==GUIDE_KIND||event.target!==ctx.canvas)return;
 if(event.button!==undefined&&event.button!==0)return;
 if(ctx.gesture){ctx.gesture.multi=true;return;}
 ctx.gesture={id:event.pointerId,start:{x:event.clientX,y:event.clientY},last:{x:event.clientX,y:event.clientY},max:0,multi:false,stage};
}

function onPointerMove(ctx,event){
 const gesture=ctx.gesture;
 if(!gesture||event.pointerId!==gesture.id)return;
 gesture.last={x:event.clientX,y:event.clientY};
 gesture.max=Math.max(gesture.max,distance(gesture.start,gesture.last));
}

function handleDragRelease(ctx,event,gesture){
 if(!gesture.multi&&gesture.max>=DRAG_DISTANCE&&ctx.active&&ctx.guide.stage==='drag'&&ctx.ui.pending?.kind===GUIDE_KIND){
  accept(ctx,'place','場所を動かせました。最後は、画面を短くタップして置きます。');
  return;
 }
 if(gesture.multi||!ctx.active||ctx.guide.stage!=='drag')return;
 if(gesture.max<TAP_DISTANCE){
  event.preventDefault();event.stopImmediatePropagation();
  ctx.guide.setHint('いまは置かずに、指を画面につけたまま少し大きくなぞってみてください。');
 }else ctx.guide.setHint('動かし方は合っています。もう少しだけ大きく、ゆっくりなぞってみてください。');
 void ctx.guide.playDemo({immediate:true});
}

function verifyPlacement(ctx){
 if(!ctx.active||ctx.guide.stage!=='place')return;
 const placed=ctx.world.objects.some(object=>object.kind===GUIDE_KIND);
 if(placed&&!ctx.ui.pending){ctx.guide.setStage('done');return;}
 if(ctx.ui.pending?.error){
  ctx.guide.setHint(`そこには置けません。「${ctx.ui.pending.error}」と出ているので、もう一度なぞって場所をずらしてから短くタップしてください。`,4300);
  return;
 }
 ctx.guide.setHint('短く1回だけタップすると、中央の候補をその場所へ置けます。');
}

function onPointerFinish(ctx,event){
 const gesture=ctx.gesture;
 if(!gesture||event.pointerId!==gesture.id)return;
 ctx.gesture=null;
 if(gesture.stage==='drag'){handleDragRelease(ctx,event,gesture);return;}
 if(gesture.stage==='place'&&!gesture.multi&&gesture.max<TAP_DISTANCE&&ctx.active&&ctx.guide.stage==='place')requestAnimationFrame(()=>requestAnimationFrame(()=>verifyPlacement(ctx)));
}

function removeListeners(ctx){
 const h=ctx.handlers;
 document.removeEventListener('click',h.click,true);
 document.removeEventListener('pointerdown',h.down,true);
 document.removeEventListener('pointermove',h.move,true);
 document.removeEventListener('pointerup',h.finish,true);
 document.removeEventListener('pointercancel',h.finish,true);
 document.removeEventListener('keydown',h.key,true);
 window.removeEventListener('resize',h.resize);
 if(ctx.entryListener)document.removeEventListener('click',ctx.entryListener,true);
}

function cleanup(ctx){
 removeListeners(ctx);
 ctx.view.autoOrbit=ctx.previousAutoOrbit;
 ctx.guide.destroy();
 ctx.village.activity();
 ctx.village.updateTutorial();
}

async function complete(ctx,skipped=false){
 if(ctx.finishing)return;
 ctx.finishing=true;ctx.active=false;
 if(skipped){
  if(ctx.ui.pending)ctx.village.cancelPlacement();
  if(ctx.ui.drawer)ctx.village.closeDrawer();
 }
 markFirstRunAutoplaySeen(ctx.world.state);
 try{await ctx.village.save();ctx.canvas.dataset.firstRunTutorial='seen';}
 catch(error){console.warn('First-run tutorial completion could not be persisted',error);ctx.canvas.dataset.firstRunTutorial='save-error';}
 cleanup(ctx);
}

function installListeners(ctx){
 const handlers={
  click:event=>onClick(ctx,event),down:event=>onPointerDown(ctx,event),move:event=>onPointerMove(ctx,event),finish:event=>onPointerFinish(ctx,event),
  key:event=>{if(ctx.active&&!ctx.guide.layer.hidden&&event.key==='Escape'){event.preventDefault();void complete(ctx,true);}},resize:()=>ctx.guide.refreshTarget(),
 };
 ctx.handlers=handlers;
 document.addEventListener('click',handlers.click,true);
 document.addEventListener('pointerdown',handlers.down,true);
 document.addEventListener('pointermove',handlers.move,true);
 document.addEventListener('pointerup',handlers.finish,true);
 document.addEventListener('pointercancel',handlers.finish,true);
 document.addEventListener('keydown',handlers.key,true);
 window.addEventListener('resize',handlers.resize,{passive:true});
}

function installControls(ctx){
 const {skip,replay,start,finish}=ctx.guide.controls;
 skip.onclick=()=>void complete(ctx,true);
 replay.onclick=()=>void ctx.guide.playDemo({immediate:true});
 start.onclick=()=>ctx.guide.setStage('build');
 finish.onclick=()=>void complete(ctx,false);
}

function beginAfterEntry(ctx){
 const begin=()=>{if(ctx.active)ctx.guide.show();};
 if(!ctx.ui.entryOpen){begin();return;}
 ctx.entryListener=event=>{
  if(!event.target.closest?.('#muraEnterVillage'))return;
  document.removeEventListener('click',ctx.entryListener,true);
  ctx.entryListener=null;
  requestAnimationFrame(()=>requestAnimationFrame(begin));
 };
 document.addEventListener('click',ctx.entryListener,true);
}

export function startFirstRunGuide({village,canvas}){
 const {world,view,ui}=village;
 const reduced=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const timing=timingFor(reduced);
 const previousAutoOrbit=view.autoOrbit;
 view.autoOrbit=false;
 canvas.dataset.firstRunTutorial='running';
 const guide=createFirstRunGuideView({canvas,initiallyHidden:ui.entryOpen,reduced,timing});
 const ctx={village,canvas,world,view,ui,guide,timing,previousAutoOrbit,active:true,finishing:false,gesture:null,entryListener:null,handlers:null};
 installListeners(ctx);
 installControls(ctx);
 beginAfterEntry(ctx);
 return ctx;
}
