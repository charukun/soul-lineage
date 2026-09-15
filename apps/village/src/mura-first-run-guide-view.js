const STAGES={
 welcome:{number:0,title:'ここからは、あなたの指で。',text:'最初の空きテントをひとつ置きながら、村の基本操作を覚えます。勝手には進みません。',cue:'まず流れを見る'},
 build:{number:1,title:'「つくる」を押す',text:'画面下の「つくる」を、短く1回タップしてください。',cue:'つくる をタップ'},
 catalog:{number:2,title:'空きテントを選ぶ',text:'住まいの一覧から「空きテント」を1回タップします。すると実際の配置モードに入ります。',cue:'空きテント をタップ'},
 drag:{number:3,title:'1本指で、場所を動かす',text:'画面を1本指でゆっくりなぞってください。指の動きと同じだけ地面が動き、中央のテント候補の場所が変わります。',cue:'1本指でなぞる'},
 place:{number:4,title:'短くタップして置く',text:'置きたい場所になったら、画面を短く1回タップ。いま見えている候補の位置へ、そのまま配置されます。',cue:'画面を短くタップ'},
 done:{number:4,title:'これで、村を自分で動かせます。',text:'「選ぶ → 指で場所を動かす → タップで置く」が基本です。ここから先は、あなたの村です。',cue:'完了'},
};

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function createLayer(hidden){
 const layer=document.createElement('div');
 layer.id='muraFirstRunGuide';
 layer.dataset.stage='welcome';
 layer.hidden=hidden;
 layer.innerHTML=`
  <section class="muraFirstRunGuideCard" aria-labelledby="muraFirstRunGuideTitle" aria-describedby="muraFirstRunGuideText">
   <div class="muraFirstRunGuideTop"><span class="muraFirstRunGuideEyebrow">はじめての村</span><button type="button" class="muraFirstRunSkip" aria-label="チュートリアルをスキップ">スキップ</button></div>
   <strong id="muraFirstRunGuideTitle"></strong><p id="muraFirstRunGuideText" aria-live="polite"></p>
   <div class="muraFirstRunGuideFooter"><div class="muraFirstRunProgress" aria-label="チュートリアル進行"></div><span class="muraFirstRunCue"></span><button type="button" class="muraFirstRunReplay">もう一度見る</button><button type="button" class="muraFirstRunStart">やってみる</button><button type="button" class="muraFirstRunFinish">村を始める</button></div>
  </section>
  <div class="muraFirstRunFinger" aria-hidden="true"><i></i><b></b></div><div class="muraFirstRunRipple" aria-hidden="true"></div><div class="muraFirstRunDragStart" aria-hidden="true"></div><div class="muraFirstRunDragEnd" aria-hidden="true"></div>`;
 document.body.append(layer);
 return layer;
}

function targetFor(stage,canvas){
 if(stage==='build')return document.getElementById('build');
 if(stage==='catalog')return document.querySelector('#catalog .card[data-kind="tent"]');
 return stage==='drag'||stage==='place'?canvas:null;
}

function centerOf(element,offset={x:0,y:0}){
 const rect=element?.getBoundingClientRect?.();
 if(!rect)return{x:innerWidth/2,y:innerHeight/2};
 return{x:rect.left+rect.width/2+offset.x,y:rect.top+rect.height/2+offset.y};
}

function placeMarker(node,point){
 node.style.left=`${Math.round(point.x)}px`;
 node.style.top=`${Math.round(point.y)}px`;
}

function setProgress(progress,stage,number){
 const marks=[1,2,3,4].map(index=>{
  const mark=document.createElement('i');
  mark.className=stage==='done'||index<number?'done':index===number?'current':'';
  mark.setAttribute('aria-hidden','true');
  return mark;
 });
 progress.replaceChildren(...marks);
 progress.setAttribute('aria-label',stage==='done'?'4 / 4 · 完了':number?`${number} / 4`:'導入');
}

function hideDemo(nodes){
 for(const node of nodes)node.hidden=true;
}

function tapAnimations(finger,ripple,timing,reduced){
 if(reduced){
  finger.animate([{opacity:0},{opacity:1},{opacity:1},{opacity:0}],{duration:timing.tap,easing:'ease-in-out'});
  ripple.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.7)'},{opacity:.75,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale(1.35)'}],{duration:timing.tap,easing:'ease-out'});
  return;
 }
 finger.animate([{opacity:0,transform:'translate(-50%,-50%) translateY(18px) scale(1.04)'},{opacity:1,transform:'translate(-50%,-50%) translateY(0) scale(1)',offset:.3},{opacity:1,transform:'translate(-50%,-50%) translateY(3px) scale(.9)',offset:.58},{opacity:1,transform:'translate(-50%,-50%) translateY(0) scale(1)',offset:.73},{opacity:0,transform:'translate(-50%,-50%) translateY(-5px) scale(1)',offset:1}],{duration:timing.tap,easing:'ease-in-out'});
 ripple.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.5)'},{opacity:0,transform:'translate(-50%,-50%) scale(.5)',offset:.5},{opacity:.85,transform:'translate(-50%,-50%) scale(.75)',offset:.58},{opacity:0,transform:'translate(-50%,-50%) scale(1.55)'}],{duration:timing.tap,easing:'ease-out'});
}

async function animateTap({finger,ripple,element,canvas,timing,reduced}){
 if(!element)return;
 const point=centerOf(element,element===canvas?{x:0,y:42}:{x:0,y:0});
 placeMarker(finger,{x:point.x+18,y:point.y+24});
 placeMarker(ripple,point);
 finger.hidden=false;
 ripple.hidden=false;
 tapAnimations(finger,ripple,timing,reduced);
 await wait(timing.tap);
}

function dragAnimations(finger,start,end,startPoint,endPoint,timing,reduced){
 if(reduced){
  finger.animate([{opacity:0},{opacity:1},{opacity:1},{opacity:0}],{duration:timing.drag,easing:'ease-in-out'});
  start.animate([{opacity:0},{opacity:.65},{opacity:.25}],{duration:timing.drag});
  end.animate([{opacity:0},{opacity:.2},{opacity:.75}],{duration:timing.drag});
  return;
 }
 const dx=endPoint.x-startPoint.x,dy=endPoint.y-startPoint.y;
 finger.animate([{opacity:0,transform:'translate(-50%,-50%) scale(1)'},{opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:.18},{opacity:1,transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.92)`,offset:.82},{opacity:0,transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1)`,offset:1}],{duration:timing.drag,easing:'cubic-bezier(.25,.68,.35,1)'});
 start.animate([{opacity:0},{opacity:.65,offset:.18},{opacity:0}],{duration:timing.drag});
 end.animate([{opacity:0},{opacity:0,offset:.55},{opacity:.75,offset:.82},{opacity:0}],{duration:timing.drag});
}

async function animateDrag({finger,start,end,canvas,timing,reduced}){
 const rect=canvas.getBoundingClientRect();
 const startPoint={x:rect.left+rect.width*.64,y:rect.top+rect.height*.58};
 const endPoint={x:rect.left+rect.width*.37,y:rect.top+rect.height*.43};
 placeMarker(finger,{x:startPoint.x+16,y:startPoint.y+22});
 placeMarker(start,startPoint);
 placeMarker(end,endPoint);
 finger.hidden=false;start.hidden=false;end.hidden=false;
 dragAnimations(finger,start,end,startPoint,endPoint,timing,reduced);
 await wait(timing.drag);
}

export function createFirstRunGuideView({canvas,initiallyHidden=false,reduced=false,timing}){
 const layer=createLayer(initiallyHidden);
 const nodes={
  title:layer.querySelector('#muraFirstRunGuideTitle'),text:layer.querySelector('#muraFirstRunGuideText'),cue:layer.querySelector('.muraFirstRunCue'),progress:layer.querySelector('.muraFirstRunProgress'),
  replay:layer.querySelector('.muraFirstRunReplay'),start:layer.querySelector('.muraFirstRunStart'),finish:layer.querySelector('.muraFirstRunFinish'),skip:layer.querySelector('.muraFirstRunSkip'),
  finger:layer.querySelector('.muraFirstRunFinger'),ripple:layer.querySelector('.muraFirstRunRipple'),dragStart:layer.querySelector('.muraFirstRunDragStart'),dragEnd:layer.querySelector('.muraFirstRunDragEnd'),
 };
 const demoNodes=[nodes.finger,nodes.ripple,nodes.dragStart,nodes.dragEnd];
 let stage='welcome',target=null,demoTimer=0,hintTimer=0,acceptTimer=0,demoVersion=0,destroyed=false;

 function clearTarget(){
  target?.classList?.remove('mura-first-run-target');
  target=null;
  document.body.classList.remove('mura-first-run-canvas-target');
 }
 function updateTarget(){
  clearTarget();
  target=targetFor(stage,canvas);
  if(!target)return;
  if(target===canvas)document.body.classList.add('mura-first-run-canvas-target');
  else{target.classList.add('mura-first-run-target');if(stage==='catalog')target.scrollIntoView({block:'nearest',inline:'nearest'});}
 }
 function cancelDemo(){
  demoVersion++;
  clearTimeout(demoTimer);
  hideDemo(demoNodes);
 }
 async function playDemo({immediate=false}={}){
  cancelDemo();
  const version=demoVersion;
  if(stage==='welcome'||stage==='done'||destroyed)return;
  updateTarget();
  await wait(immediate?120:timing.read);
  if(destroyed||version!==demoVersion)return;
  if(stage==='drag')await animateDrag({finger:nodes.finger,start:nodes.dragStart,end:nodes.dragEnd,canvas,timing,reduced});
  else await animateTap({finger:nodes.finger,ripple:nodes.ripple,element:targetFor(stage,canvas),canvas,timing,reduced});
  if(version===demoVersion)hideDemo(demoNodes);
 }
 function scheduleDemo(){
  cancelDemo();
  const version=demoVersion;
  demoTimer=setTimeout(()=>{if(!destroyed&&version===demoVersion)void playDemo();},80);
 }
 function setStage(next,{message=null}={}){
  if(destroyed)return;
  stage=next;
  layer.dataset.stage=next;
  const config=STAGES[next];
  nodes.title.textContent=config.title;
  nodes.text.textContent=message||config.text;
  nodes.cue.textContent=config.cue;
  setProgress(nodes.progress,next,config.number);
  nodes.start.hidden=next!=='welcome';
  nodes.finish.hidden=next!=='done';
  nodes.replay.hidden=next==='welcome'||next==='done';
  nodes.cue.hidden=next==='welcome'||next==='done';
  updateTarget();
  scheduleDemo();
 }
 function setHint(message,ms=3200){
  if(destroyed)return;
  clearTimeout(hintTimer);
  nodes.text.textContent=message;
  layer.classList.add('mura-first-run-hint');
  hintTimer=setTimeout(()=>{if(!destroyed){layer.classList.remove('mura-first-run-hint');nodes.text.textContent=STAGES[stage].text;}},ms);
 }
 function accept(next,message,duration){
  clearTimeout(acceptTimer);
  setStage(next,{message});
  layer.classList.add('mura-first-run-accepted');
  acceptTimer=setTimeout(()=>{if(!destroyed&&stage===next){layer.classList.remove('mura-first-run-accepted');nodes.text.textContent=STAGES[next].text;}},duration);
 }
 function show(){
  layer.hidden=false;
  document.body.classList.add('mura-first-run-active');
  setStage('welcome');
  nodes.start.focus({preventScroll:true});
 }
 function destroy(){
  destroyed=true;
  cancelDemo();
  clearTimeout(hintTimer);clearTimeout(acceptTimer);
  clearTarget();
  document.body.classList.remove('mura-first-run-active');
  layer.remove();
 }
 function refreshTarget(){updateTarget();}

 setStage('welcome');
 return{layer,controls:{replay:nodes.replay,start:nodes.start,finish:nodes.finish,skip:nodes.skip},get stage(){return stage;},show,setStage,setHint,accept,playDemo,refreshTarget,destroy};
}
