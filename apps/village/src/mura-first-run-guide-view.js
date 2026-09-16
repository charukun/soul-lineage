const STAGES={
 welcome:{number:0,title:'最初のテントを、一緒に置く。',text:'4つの操作だけ。あなたが動かしたときだけ、次へ進みます。',cue:'4ステップ'},
 build:{number:1,title:'① つくる',text:'画面下の「つくる」を1回タップ。',cue:'下のボタン'},
 catalog:{number:2,title:'② 空きテント',text:'光っている「空きテント」を1回タップ。',cue:'光っている住まい'},
 drag:{number:3,title:'③ 場所を動かす',text:'1本指で画面をなぞり、テントを置きたい場所へ。',cue:'1本指でなぞる'},
 place:{number:4,title:'④ ここに置く',text:'場所がよければ、画面を短く1回タップ。',cue:'短くタップ'},
 done:{number:4,title:'置けました。',text:'基本操作はこれで完了。必要なときだけ「つくる」から村を増やせます。',cue:'完了'},
};

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function createLayer(hidden){
 const layer=document.createElement('div');
 layer.id='muraFirstRunGuide';
 layer.dataset.stage='welcome';
 layer.dataset.mode='card';
 layer.hidden=hidden;
 layer.innerHTML=`
  <section class="muraFirstRunGuideCard" aria-labelledby="muraFirstRunGuideTitle" aria-describedby="muraFirstRunGuideText">
   <div class="muraFirstRunGuideTop"><span class="muraFirstRunGuideEyebrow">はじめての村</span><span class="muraFirstRunStep" aria-live="polite"></span><button type="button" class="muraFirstRunSkip" aria-label="チュートリアルをスキップ">スキップ</button></div>
   <strong id="muraFirstRunGuideTitle"></strong><p id="muraFirstRunGuideText" aria-live="polite"></p>
   <div class="muraFirstRunGuideFooter"><div class="muraFirstRunProgress" aria-label="チュートリアル進行"><i></i></div><span class="muraFirstRunCue" aria-live="polite"></span><button type="button" class="muraFirstRunReplay">もう一度見る</button><button type="button" class="muraFirstRunStart">やってみる</button><button type="button" class="muraFirstRunFinish">村を始める</button></div>
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

function setProgress(progress,step,stage,number){
 const value=stage==='done'?4:number;
 const percent=Math.max(0,Math.min(100,value/4*100));
 progress.style.setProperty('--mura-first-run-progress',`${percent}%`);
 progress.setAttribute('aria-label',stage==='done'?'4 / 4 · 完了':number?`${number} / 4`:'導入');
 step.textContent=stage==='welcome'?'4ステップ':stage==='done'?'完了':`${number} / 4`;
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
 finger.animate([{opacity:0,transform:'translate(-50%,-50%) translateY(14px) scale(1.02)'},{opacity:1,transform:'translate(-50%,-50%) translateY(0) scale(1)',offset:.28},{opacity:1,transform:'translate(-50%,-50%) translateY(3px) scale(.92)',offset:.58},{opacity:1,transform:'translate(-50%,-50%) translateY(0) scale(1)',offset:.74},{opacity:0,transform:'translate(-50%,-50%) translateY(-4px) scale(1)',offset:1}],{duration:timing.tap,easing:'ease-in-out'});
 ripple.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.5)'},{opacity:0,transform:'translate(-50%,-50%) scale(.5)',offset:.48},{opacity:.82,transform:'translate(-50%,-50%) scale(.76)',offset:.58},{opacity:0,transform:'translate(-50%,-50%) scale(1.48)'}],{duration:timing.tap,easing:'ease-out'});
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
  start.animate([{opacity:0},{opacity:.6},{opacity:.2}],{duration:timing.drag});
  end.animate([{opacity:0},{opacity:.2},{opacity:.7}],{duration:timing.drag});
  return;
 }
 const dx=endPoint.x-startPoint.x,dy=endPoint.y-startPoint.y;
 finger.animate([{opacity:0,transform:'translate(-50%,-50%) scale(1)'},{opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:.16},{opacity:1,transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.94)`,offset:.82},{opacity:0,transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1)`,offset:1}],{duration:timing.drag,easing:'cubic-bezier(.25,.68,.35,1)'});
 start.animate([{opacity:0},{opacity:.58,offset:.16},{opacity:0}],{duration:timing.drag});
 end.animate([{opacity:0},{opacity:0,offset:.55},{opacity:.72,offset:.82},{opacity:0}],{duration:timing.drag});
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
  title:layer.querySelector('#muraFirstRunGuideTitle'),text:layer.querySelector('#muraFirstRunGuideText'),cue:layer.querySelector('.muraFirstRunCue'),step:layer.querySelector('.muraFirstRunStep'),progress:layer.querySelector('.muraFirstRunProgress'),
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
  await wait(immediate?90:timing.read);
  if(destroyed||version!==demoVersion)return;
  if(stage==='drag')await animateDrag({finger:nodes.finger,start:nodes.dragStart,end:nodes.dragEnd,canvas,timing,reduced});
  else await animateTap({finger:nodes.finger,ripple:nodes.ripple,element:targetFor(stage,canvas),canvas,timing,reduced});
  if(version===demoVersion)hideDemo(demoNodes);
 }
 function scheduleDemo(){
  cancelDemo();
  const version=demoVersion;
  demoTimer=setTimeout(()=>{if(!destroyed&&version===demoVersion)void playDemo();},70);
 }
 function setStage(next,{message=null}={}){
  if(destroyed)return;
  stage=next;
  layer.dataset.stage=next;
  layer.dataset.mode=next==='welcome'||next==='done'?'card':'coach';
  const config=STAGES[next];
  nodes.title.textContent=config.title;
  nodes.text.textContent=message||config.text;
  nodes.cue.textContent=config.cue;
  nodes.cue.removeAttribute('data-state');
  setProgress(nodes.progress,nodes.step,next,config.number);
  nodes.start.hidden=next!=='welcome';
  nodes.finish.hidden=next!=='done';
  nodes.replay.hidden=next==='welcome'||next==='done';
  nodes.cue.hidden=next==='welcome'||next==='done';
  updateTarget();
  scheduleDemo();
 }
 function setHint(message,ms=2800){
  if(destroyed)return;
  clearTimeout(hintTimer);
  nodes.text.textContent=message;
  nodes.cue.hidden=false;
  nodes.cue.textContent='もう一度';
  nodes.cue.dataset.state='hint';
  layer.classList.add('mura-first-run-hint');
  const currentStage=stage;
  hintTimer=setTimeout(()=>{if(!destroyed&&stage===currentStage){layer.classList.remove('mura-first-run-hint');nodes.text.textContent=STAGES[stage].text;nodes.cue.textContent=STAGES[stage].cue;nodes.cue.removeAttribute('data-state');nodes.cue.hidden=stage==='welcome'||stage==='done';}},ms);
 }
 function accept(next,message,duration){
  clearTimeout(acceptTimer);
  setStage(next,{message});
  nodes.cue.hidden=false;
  nodes.cue.textContent='できた';
  nodes.cue.dataset.state='success';
  layer.classList.add('mura-first-run-accepted');
  acceptTimer=setTimeout(()=>{if(!destroyed&&stage===next){layer.classList.remove('mura-first-run-accepted');nodes.text.textContent=STAGES[next].text;nodes.cue.textContent=STAGES[next].cue;nodes.cue.removeAttribute('data-state');nodes.cue.hidden=next==='welcome'||next==='done';}},duration);
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
