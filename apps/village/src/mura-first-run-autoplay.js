import './mura-first-run-guide.css';
import {consumeFreshVillageLoad} from './game/save-store.js';
import {markFirstRunAutoplaySeen,markFirstRunAutoplayStarted,shouldRunFirstRunAutoplay} from './game/first-run-onboarding.js';

const GUIDE_KIND='tent';
const DRAG_DISTANCE=32;
const STAGES={
 welcome:{
  number:0,
  title:'ここからは、あなたの指で。',
  text:'最初の空きテントをひとつ置きながら、村の基本操作を覚えます。勝手には進みません。',
  cue:'まず流れを見る',
 },
 build:{
  number:1,
  title:'「つくる」を押す',
  text:'画面下の「つくる」を、短く1回タップしてください。',
  cue:'つくる をタップ',
 },
 catalog:{
  number:2,
  title:'空きテントを選ぶ',
  text:'住まいの一覧から「空きテント」を1回タップします。すると実際の配置モードに入ります。',
  cue:'空きテント をタップ',
 },
 drag:{
  number:3,
  title:'1本指で、場所を動かす',
  text:'画面を1本指でゆっくりなぞってください。指の動きと同じだけ地面が動き、中央のテント候補の場所が変わります。',
  cue:'1本指でなぞる',
 },
 place:{
  number:4,
  title:'短くタップして置く',
  text:'置きたい場所になったら、画面を短く1回タップ。いま見えている候補の位置へ、そのまま配置されます。',
  cue:'画面を短くタップ',
 },
 done:{
  number:4,
  title:'これで、村を自分で動かせます。',
  text:'「選ぶ → 指で場所を動かす → タップで置く」が基本です。ここから先は、あなたの村です。',
  cue:'完了',
 },
};

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function install(){
 const village=window.village;
 if(!village)return;
 const freshLoad=consumeFreshVillageLoad();
 if(!shouldRunFirstRunAutoplay(village.world.state,{freshLoad}))return;

 const {world,view,ui}=village;
 const canvas=view.canvas||document.getElementById('game');
 if(!canvas)return;

 markFirstRunAutoplayStarted(world.state);
 void village.save().catch(error=>console.warn('First-run tutorial start could not be persisted',error));

 // A reload can happen after the normal placement path succeeded but before the
 // tutorial completion marker was saved. Do not force the player to place a
 // second tutorial tent in that recovery case.
 if(world.objects.some(object=>object.kind===GUIDE_KIND)){
  markFirstRunAutoplaySeen(world.state);
  void village.save().catch(error=>console.warn('First-run tutorial recovery could not be persisted',error));
  return;
 }

 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const timing=reduced?{read:420,tap:520,drag:760,confirm:520}:{read:1050,tap:900,drag:1650,confirm:900};
 const previousAutoOrbit=view.autoOrbit;
 view.autoOrbit=false;

 const layer=document.createElement('div');
 layer.id='muraFirstRunGuide';
 layer.dataset.stage='welcome';
 layer.innerHTML=`
  <section class="muraFirstRunGuideCard" aria-labelledby="muraFirstRunGuideTitle" aria-describedby="muraFirstRunGuideText">
   <div class="muraFirstRunGuideTop">
    <span class="muraFirstRunGuideEyebrow">はじめての村</span>
    <button type="button" class="muraFirstRunSkip" aria-label="チュートリアルをスキップ">スキップ</button>
   </div>
   <strong id="muraFirstRunGuideTitle"></strong>
   <p id="muraFirstRunGuideText"></p>
   <div class="muraFirstRunGuideFooter">
    <div class="muraFirstRunProgress" aria-label="チュートリアル進行"></div>
    <span class="muraFirstRunCue"></span>
    <button type="button" class="muraFirstRunReplay">もう一度見る</button>
    <button type="button" class="muraFirstRunStart">やってみる</button>
    <button type="button" class="muraFirstRunFinish">村を始める</button>
   </div>
  </section>
  <div class="muraFirstRunFinger" aria-hidden="true"><i></i><b></b></div>
  <div class="muraFirstRunRipple" aria-hidden="true"></div>
  <div class="muraFirstRunDragStart" aria-hidden="true"></div>
  <div class="muraFirstRunDragEnd" aria-hidden="true"></div>`;
 layer.hidden=ui.entryOpen;
 document.body.append(layer);
 canvas.dataset.firstRunTutorial='running';

 const title=layer.querySelector('#muraFirstRunGuideTitle');
 const text=layer.querySelector('#muraFirstRunGuideText');
 const cue=layer.querySelector('.muraFirstRunCue');
 const progress=layer.querySelector('.muraFirstRunProgress');
 const replay=layer.querySelector('.muraFirstRunReplay');
 const start=layer.querySelector('.muraFirstRunStart');
 const finishButton=layer.querySelector('.muraFirstRunFinish');
 const skip=layer.querySelector('.muraFirstRunSkip');
 const finger=layer.querySelector('.muraFirstRunFinger');
 const ripple=layer.querySelector('.muraFirstRunRipple');
 const dragStart=layer.querySelector('.muraFirstRunDragStart');
 const dragEnd=layer.querySelector('.muraFirstRunDragEnd');

 let active=true;
 let finishing=false;
 let stage='welcome';
 let demoTimer=0;
 let demoRun=0;
 let transitionRun=0;
 let gesture=null;
 let hintTimer=0;
 let target=null;
 let entryListener=null;

 function setProgress(number){
  progress.replaceChildren(...[1,2,3,4].map(index=>{
   const mark=document.createElement('i');
   mark.className=stage==='done'||index<number?'done':index===number?'current':'';
   mark.setAttribute('aria-hidden','true');
   return mark;
  }));
  progress.setAttribute('aria-label',stage==='done'?'4 / 4 · 完了':number?`${number} / 4`:'導入');
 }

 function clearTarget(){
  target?.classList?.remove('mura-first-run-target');
  target=null;
  document.body.classList.remove('mura-first-run-canvas-target');
 }

 function resolveTarget(){
  if(stage==='build')return document.getElementById('build');
  if(stage==='catalog')return document.querySelector('#catalog .card[data-kind="tent"]');
  if(stage==='drag'||stage==='place')return canvas;
  return null;
 }

 function targetPoint(element,offset={x:0,y:0}){
  const rect=element?.getBoundingClientRect?.();
  if(!rect)return{x:innerWidth/2,y:innerHeight/2};
  return{x:rect.left+rect.width/2+offset.x,y:rect.top+rect.height/2+offset.y};
 }

 function positionMarker(node,point){
  node.style.left=`${Math.round(point.x)}px`;
  node.style.top=`${Math.round(point.y)}px`;
 }

 function updateTarget(){
  clearTarget();
  target=resolveTarget();
  if(!target)return;
  if(target===canvas)document.body.classList.add('mura-first-run-canvas-target');
  else{
   target.classList.add('mura-first-run-target');
   if(stage==='catalog')target.scrollIntoView({block:'nearest',inline:'nearest'});
  }
 }

 function setHint(message,ms=3200){
  if(!active)return;
  clearTimeout(hintTimer);
  text.textContent=message;
  layer.classList.add('mura-first-run-hint');
  hintTimer=setTimeout(()=>{
   if(!active)return;
   layer.classList.remove('mura-first-run-hint');
   text.textContent=STAGES[stage].text;
  },ms);
 }

 async function demoTap(element,token){
  if(!element||token!==demoRun||!active)return;
  const point=targetPoint(element,element===canvas?{x:0,y:42}:{x:0,y:0});
  positionMarker(finger,{x:point.x+18,y:point.y+24});
  positionMarker(ripple,point);
  finger.hidden=false;
  ripple.hidden=false;
  if(reduced){
   finger.animate([{opacity:0},{opacity:1},{opacity:1},{opacity:0}],{duration:timing.tap,easing:'ease-in-out'});
   ripple.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.7)'},{opacity:.75,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale(1.35)'}],{duration:timing.tap,easing:'ease-out'});
  }else{
   finger.animate([
    {opacity:0,transform:'translate(-50%,-50%) translateY(18px) scale(1.04)'},
    {opacity:1,transform:'translate(-50%,-50%) translateY(0) scale(1)',offset:.3},
    {opacity:1,transform:'translate(-50%,-50%) translateY(3px) scale(.9)',offset:.58},
    {opacity:1,transform:'translate(-50%,-50%) translateY(0) scale(1)',offset:.73},
    {opacity:0,transform:'translate(-50%,-50%) translateY(-5px) scale(1)',offset:1},
   ],{duration:timing.tap,easing:'ease-in-out'});
   ripple.animate([
    {opacity:0,transform:'translate(-50%,-50%) scale(.5)'},
    {opacity:0,transform:'translate(-50%,-50%) scale(.5)',offset:.5},
    {opacity:.85,transform:'translate(-50%,-50%) scale(.75)',offset:.58},
    {opacity:0,transform:'translate(-50%,-50%) scale(1.55)'},
   ],{duration:timing.tap,easing:'ease-out'});
  }
  await wait(timing.tap);
  if(token===demoRun){finger.hidden=true;ripple.hidden=true;}
 }

 async function demoDrag(token){
  if(token!==demoRun||!active)return;
  const rect=canvas.getBoundingClientRect();
  const startPoint={x:rect.left+rect.width*.64,y:rect.top+rect.height*.58};
  const endPoint={x:rect.left+rect.width*.37,y:rect.top+rect.height*.43};
  positionMarker(finger,{x:startPoint.x+16,y:startPoint.y+22});
  positionMarker(dragStart,startPoint);
  positionMarker(dragEnd,endPoint);
  finger.hidden=false;dragStart.hidden=false;dragEnd.hidden=false;
  if(reduced){
   finger.animate([{opacity:0},{opacity:1},{opacity:1},{opacity:0}],{duration:timing.drag,easing:'ease-in-out'});
   dragStart.animate([{opacity:0},{opacity:.65},{opacity:.25}],{duration:timing.drag});
   dragEnd.animate([{opacity:0},{opacity:.2},{opacity:.75}],{duration:timing.drag});
  }else{
   const dx=endPoint.x-startPoint.x,dy=endPoint.y-startPoint.y;
   finger.animate([
    {opacity:0,transform:'translate(-50%,-50%) scale(1)'},
    {opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:.18},
    {opacity:1,transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.92)`,offset:.82},
    {opacity:0,transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1)`,offset:1},
   ],{duration:timing.drag,easing:'cubic-bezier(.25,.68,.35,1)'});
   dragStart.animate([{opacity:0},{opacity:.65,offset:.18},{opacity:0}],{duration:timing.drag});
   dragEnd.animate([{opacity:0},{opacity:0,offset:.55},{opacity:.75,offset:.82},{opacity:0}],{duration:timing.drag});
  }
  await wait(timing.drag);
  if(token===demoRun){finger.hidden=true;dragStart.hidden=true;dragEnd.hidden=true;}
 }

 async function playDemo({immediate=false}={}){
  const token=++demoRun;
  clearTimeout(demoTimer);
  finger.hidden=true;ripple.hidden=true;dragStart.hidden=true;dragEnd.hidden=true;
  if(stage==='welcome'||stage==='done')return;
  updateTarget();
  await wait(immediate?120:timing.read);
  if(token!==demoRun||!active)return;
  if(stage==='drag')await demoDrag(token);
  else await demoTap(resolveTarget(),token);
 }

 function scheduleDemo(){
  clearTimeout(demoTimer);
  const token=++demoRun;
  demoTimer=setTimeout(()=>{
   if(token!==demoRun||!active)return;
   // playDemo increments the token once more so stale animation callbacks lose ownership.
   void playDemo();
  },80);
 }

 function setStage(next,{message=null}={}){
  if(!active)return;
  stage=next;
  layer.dataset.stage=next;
  const config=STAGES[next];
  title.textContent=config.title;
  text.textContent=message||config.text;
  cue.textContent=config.cue;
  setProgress(config.number);
  start.hidden=next!=='welcome';
  finishButton.hidden=next!=='done';
  replay.hidden=next==='welcome'||next==='done';
  cue.hidden=next==='welcome'||next==='done';
  updateTarget();
  scheduleDemo();
 }

 async function accept(next,message){
  if(!active)return;
  const token=++transitionRun;
  ++demoRun;
  clearTimeout(demoTimer);
  finger.hidden=true;ripple.hidden=true;dragStart.hidden=true;dragEnd.hidden=true;
  layer.classList.add('mura-first-run-accepted');
  if(message)text.textContent=message;
  await wait(timing.confirm);
  if(!active||token!==transitionRun)return;
  layer.classList.remove('mura-first-run-accepted');
  setStage(next);
 }

 function onClick(event){
  if(!active)return;
  const button=event.target.closest?.('button');
  if(!button)return;

  if(button===skip||button===replay||button===start||button===finishButton)return;

  if(stage==='catalog'){
   const card=event.target.closest?.('#catalog .card');
   if(card&&card.dataset.kind!==GUIDE_KIND){
    event.preventDefault();
    event.stopImmediatePropagation();
    setHint('今回は「空きテント」を選びます。光っている住まいをタップしてください。');
    void playDemo({immediate:true});
    return;
   }
  }

  if(stage==='build'&&button.id==='build'){
   requestAnimationFrame(()=>{
    if(active&&ui.drawer)void accept('catalog','そうです。次は、実際の住まいを選びます。');
   });
   return;
  }

  if(stage==='catalog'&&button.matches('#catalog .card[data-kind="tent"]')){
   requestAnimationFrame(()=>{
    if(active&&ui.pending?.kind===GUIDE_KIND)void accept('drag','配置モードに入りました。次は場所を自分の指で動かします。');
   });
   return;
  }

  if(stage==='catalog'&&button.id==='build'){
   requestAnimationFrame(()=>{
    if(active&&!ui.drawer)setStage('build',{message:'閉じても大丈夫です。もう一度「つくる」をタップしてください。'});
   });
   return;
  }

  if((stage==='drag'||stage==='place')&&button.id==='cancelPlace'){
   event.preventDefault();
   event.stopImmediatePropagation();
   setHint(stage==='drag'?'まず1本指で画面をなぞって、テントの場所を動かしてみてください。':'今回は画面そのものを短くタップして置いてみましょう。');
   void playDemo({immediate:true});
   return;
  }

  if((stage==='drag'||stage==='place')&&button.id==='muraCancelPlacement'){
   requestAnimationFrame(()=>{
    if(active&&!ui.pending)setStage('build',{message:'配置をやめました。もう一度「つくる」から試せます。'});
   });
  }
 }

 function onPointerDown(event){
  if(!active||!['drag','place'].includes(stage)||ui.pending?.kind!==GUIDE_KIND||event.target!==canvas)return;
  if(event.button!==undefined&&event.button!==0)return;
  if(gesture){gesture.multi=true;return;}
  gesture={id:event.pointerId,start:{x:event.clientX,y:event.clientY},last:{x:event.clientX,y:event.clientY},max:0,multi:false,stage};
 }

 function onPointerMove(event){
  if(!gesture||event.pointerId!==gesture.id)return;
  gesture.last={x:event.clientX,y:event.clientY};
  gesture.max=Math.max(gesture.max,distance(gesture.start,gesture.last));
 }

 function finishGesture(event){
  if(!gesture||event.pointerId!==gesture.id)return;
  const completed=gesture;
  gesture=null;

  if(completed.stage==='drag'){
   if(!completed.multi&&completed.max>=DRAG_DISTANCE&&active&&stage==='drag'&&ui.pending?.kind===GUIDE_KIND){
    void accept('place','場所を動かせました。最後は、画面を短くタップして置きます。');
    return;
   }
   if(!completed.multi&&completed.max<7&&active&&stage==='drag'){
    // The placement layer normally treats a short pointer release as commit.
    // During this one teaching step only, stop that release before it reaches
    // the normal handler. The next real drag remains completely native.
    event.preventDefault();
    event.stopImmediatePropagation();
    setHint('いまは置かずに、指を画面につけたまま少し大きくなぞってみてください。');
    void playDemo({immediate:true});
   }
   return;
  }

  if(completed.stage==='place'&&!completed.multi&&completed.max<7&&active&&stage==='place'){
   requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(!active||stage!=='place')return;
    const placed=world.objects.some(object=>object.kind===GUIDE_KIND);
    if(placed&&!ui.pending){
     setStage('done');
     return;
    }
    if(ui.pending?.error)setHint(`そこには置けません。「${ui.pending.error}」と出ているので、もう一度なぞって場所をずらしてから短くタップしてください。`,4300);
    else setHint('短く1回だけタップすると、中央の候補をその場所へ置けます。');
   }));
  }
 }

 function onKey(event){
  if(!active||layer.hidden)return;
  if(event.key==='Escape'){
   event.preventDefault();
   void complete(true);
  }
 }

 async function complete(skipped=false){
  if(finishing)return;
  finishing=true;
  active=false;
  ++demoRun;++transitionRun;
  clearTimeout(demoTimer);clearTimeout(hintTimer);
  if(skipped){
   if(ui.pending)village.cancelPlacement();
   if(ui.drawer)village.closeDrawer();
  }
  markFirstRunAutoplaySeen(world.state);
  try{
   await village.save();
   canvas.dataset.firstRunTutorial='seen';
  }catch(error){
   console.warn('First-run tutorial completion could not be persisted',error);
   canvas.dataset.firstRunTutorial='save-error';
  }
  cleanup();
 }

 function cleanup(){
  clearTarget();
  view.autoOrbit=previousAutoOrbit;
  document.body.classList.remove('mura-first-run-active');
  document.removeEventListener('click',onClick,true);
  document.removeEventListener('pointerdown',onPointerDown,true);
  document.removeEventListener('pointermove',onPointerMove,true);
  document.removeEventListener('pointerup',finishGesture,true);
  document.removeEventListener('pointercancel',finishGesture,true);
  document.removeEventListener('keydown',onKey,true);
  window.removeEventListener('resize',updateTarget);
  if(entryListener)document.removeEventListener('click',entryListener,true);
  layer.remove();
  village.activity();
  village.updateTutorial();
 }

 skip.onclick=()=>void complete(true);
 replay.onclick=()=>void playDemo({immediate:true});
 start.onclick=()=>setStage('build');
 finishButton.onclick=()=>void complete(false);

 document.addEventListener('click',onClick,true);
 document.addEventListener('pointerdown',onPointerDown,true);
 document.addEventListener('pointermove',onPointerMove,true);
 document.addEventListener('pointerup',finishGesture,true);
 document.addEventListener('pointercancel',finishGesture,true);
 document.addEventListener('keydown',onKey,true);
 window.addEventListener('resize',updateTarget,{passive:true});

 // The entry screen owns focus first. Start the hands-on guide only after the
 // player has entered the village, so two onboarding surfaces never compete.
 const begin=()=>{
  if(!active)return;
  layer.hidden=false;
  document.body.classList.add('mura-first-run-active');
  setStage('welcome');
  start.focus({preventScroll:true});
 };
 if(ui.entryOpen){
  entryListener=event=>{
   if(!event.target.closest?.('#muraEnterVillage'))return;
   document.removeEventListener('click',entryListener,true);
   entryListener=null;
   requestAnimationFrame(()=>requestAnimationFrame(begin));
  };
  document.addEventListener('click',entryListener,true);
 }else begin();
}

install();
