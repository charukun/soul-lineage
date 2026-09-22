const STAGES={
 arrival:{number:0,title:'新しい土地へ',text:'村長、護衛、木こり、大工の四人が村をつくる場所へ向かっています。',cue:''},
 welcome:{number:0,title:'最初の拠点をつくろう',text:'光る場所だけ追えばOK。',cue:''},
 build:{number:1,title:'「つくる」をタップ',text:'',cue:''},
 catalog:{number:2,title:'「空きテント」をタップ',text:'',cue:''},
 drag:{number:3,title:'指で場所を動かす',text:'',cue:''},
 place:{number:4,title:'ここでタップ',text:'',cue:''},
 done:{number:4,title:'開村。',text:'ここから先は、村の気配を見ながら育てていきます。',cue:''},
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
  <div class="muraFirstRunSpotlight" aria-hidden="true"></div><div class="muraFirstRunTrail" aria-hidden="true"><i></i></div>
  <div class="muraFirstRunFinger" aria-hidden="true"><i></i><b></b></div><div class="muraFirstRunRipple" aria-hidden="true"></div><div class="muraFirstRunDragStart" aria-hidden="true"></div><div class="muraFirstRunDragEnd" aria-hidden="true"></div>`;
 document.body.append(layer);
 return layer;
}

function targetFor(stage,canvas,kind){
 if(stage==='build')return document.getElementById('build');
 if(stage==='catalog')return document.querySelector(`#catalog .card[data-kind="${CSS.escape(kind||'tent')}"]`);
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

function focusRect(stage,element,canvas){
 if(stage==='drag'||stage==='place'){
  const rect=canvas.getBoundingClientRect(),width=Math.min(260,rect.width*.56),height=Math.min(180,rect.height*.28);
  return{left:rect.left+(rect.width-width)/2,top:rect.top+rect.height*.55-height/2,width,height,right:rect.left+(rect.width+width)/2,bottom:rect.top+rect.height*.55+height/2};
 }
 const rect=element?.getBoundingClientRect?.();
 return rect?{left:rect.left,top:rect.top,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom}:null;
}

function clamp(value,min,max){return Math.max(min,Math.min(max,value));}

function placeCoach(card,stage,rect){
 if(stage==='welcome'||stage==='done'||!rect){card.style.removeProperty('--mura-coach-left');card.style.removeProperty('--mura-coach-top');return;}
 const margin=12,cardRect=card.getBoundingClientRect(),viewportWidth=innerWidth,viewportHeight=innerHeight;
 const preferredAbove=rect.top-cardRect.height-18;
 const top=preferredAbove>=margin?preferredAbove:Math.min(viewportHeight-cardRect.height-margin,rect.bottom+18);
 const left=clamp(rect.left+rect.width/2-cardRect.width/2,margin,Math.max(margin,viewportWidth-cardRect.width-margin));
 card.style.setProperty('--mura-coach-left',`${Math.round(left)}px`);
 card.style.setProperty('--mura-coach-top',`${Math.round(Math.max(margin,top))}px`);
}

function placeSpotlight(node,rect){
 if(!rect){node.hidden=true;return;}
 node.hidden=false;
 node.style.left=`${Math.round(rect.left-8)}px`;
 node.style.top=`${Math.round(rect.top-8)}px`;
 node.style.width=`${Math.round(rect.width+16)}px`;
 node.style.height=`${Math.round(rect.height+16)}px`;
}

function animateTrail(node,from,to,reduced){
 if(!from||!to||reduced||Math.hypot(to.x-from.x,to.y-from.y)<36)return;
 node.hidden=false;placeMarker(node,from);
 const dx=to.x-from.x,dy=to.y-from.y;
 const animation=node.animate(
  [{opacity:0,transform:'translate(-50%,-50%) scale(.65)'},{opacity:.9,offset:.18},{opacity:.78,transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1)`,offset:.82},{opacity:0,transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.72)`}],
  {duration:520,easing:'cubic-bezier(.2,.72,.26,1)'}
 );
 animation.onfinish=()=>{node.hidden=true;};
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
  card:layer.querySelector('.muraFirstRunGuideCard'),title:layer.querySelector('#muraFirstRunGuideTitle'),text:layer.querySelector('#muraFirstRunGuideText'),cue:layer.querySelector('.muraFirstRunCue'),step:layer.querySelector('.muraFirstRunStep'),progress:layer.querySelector('.muraFirstRunProgress'),
  replay:layer.querySelector('.muraFirstRunReplay'),start:layer.querySelector('.muraFirstRunStart'),finish:layer.querySelector('.muraFirstRunFinish'),skip:layer.querySelector('.muraFirstRunSkip'),
  spotlight:layer.querySelector('.muraFirstRunSpotlight'),trail:layer.querySelector('.muraFirstRunTrail'),
  finger:layer.querySelector('.muraFirstRunFinger'),ripple:layer.querySelector('.muraFirstRunRipple'),dragStart:layer.querySelector('.muraFirstRunDragStart'),dragEnd:layer.querySelector('.muraFirstRunDragEnd'),
 };
 const demoNodes=[nodes.finger,nodes.ripple,nodes.dragStart,nodes.dragEnd];
 let stage='welcome',target=null,lastFocus=null,demoTimer=0,hintTimer=0,acceptTimer=0,demoVersion=0,destroyed=false,stepInfo={kind:'tent',label:'空きテント',index:1,total:1,text:''};

 function clearTarget(){
  target?.classList?.remove('mura-first-run-target');
  target=null;
  document.body.classList.remove('mura-first-run-canvas-target');
 }
 function updateTarget({transition=false}={}){
  clearTarget();
  target=targetFor(stage,canvas,stepInfo.kind);
  if(!target){nodes.spotlight.hidden=true;lastFocus=null;placeCoach(nodes.card,stage,null);return;}
  if(target===canvas)document.body.classList.add('mura-first-run-canvas-target');
  else{target.classList.add('mura-first-run-target');if(stage==='catalog')target.scrollIntoView({block:'nearest',inline:'nearest'});}
  requestAnimationFrame(()=>{
   if(destroyed)return;
   const rect=focusRect(stage,target,canvas);if(!rect)return;
   const focus={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
   if(transition)animateTrail(nodes.trail,lastFocus,focus,reduced);
   lastFocus=focus;placeSpotlight(nodes.spotlight,rect);placeCoach(nodes.card,stage,rect);
  });
 }
 function cancelDemo(){
  demoVersion++;
  clearTimeout(demoTimer);
  hideDemo(demoNodes);
 }
 async function playDemo({immediate=false}={}){
  cancelDemo();
  const version=demoVersion;
  if(stage==='arrival'||stage==='welcome'||stage==='done'||destroyed)return;
  updateTarget();
  await wait(immediate?90:timing.read);
  if(destroyed||version!==demoVersion)return;
  if(stage==='drag')await animateDrag({finger:nodes.finger,start:nodes.dragStart,end:nodes.dragEnd,canvas,timing,reduced});
  else await animateTap({finger:nodes.finger,ripple:nodes.ripple,element:targetFor(stage,canvas,stepInfo.kind),canvas,timing,reduced});
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
  layer.dataset.mode=next==='arrival'||next==='welcome'||next==='done'?'card':'coach';
  const config=STAGES[next];
  const dynamicTitle=next==='welcome'?stepInfo.label+'をつくる':next==='catalog'?`「${stepInfo.label}」をタップ`:next==='drag'?'場所を決める':next==='place'?'ここに置く':config.title;
  nodes.title.textContent=dynamicTitle;
  nodes.text.textContent=message||((next==='welcome'&&stepInfo.text)?stepInfo.text:config.text);
  nodes.cue.textContent=config.cue;
  nodes.cue.removeAttribute('data-state');
  if(next==='arrival'){nodes.progress.style.setProperty('--mura-first-run-progress','0%');nodes.step.textContent='到着';}else if(next==='done'){nodes.progress.style.setProperty('--mura-first-run-progress','100%');nodes.step.textContent='完了';}else{const total=Math.max(1,stepInfo.total),index=Math.max(1,stepInfo.index);nodes.progress.style.setProperty('--mura-first-run-progress',`${Math.min(100,index/total*100)}%`);nodes.step.textContent=`${index} / ${total}`;}
  nodes.start.hidden=next!=='welcome';
  nodes.finish.hidden=next!=='done';
  nodes.replay.hidden=true;
  nodes.cue.hidden=true;
  updateTarget({transition:true});
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
  setStage(next);
  cancelDemo();
  nodes.cue.hidden=false;
  nodes.cue.textContent='できた';
  nodes.cue.dataset.state='success';
  layer.classList.add('mura-first-run-accepted');
  acceptTimer=setTimeout(()=>{if(!destroyed&&stage===next){layer.classList.remove('mura-first-run-accepted');nodes.cue.removeAttribute('data-state');nodes.cue.hidden=true;scheduleDemo();}},duration);
 }
 function show(initialStage='welcome'){
  layer.hidden=false;
  document.body.classList.add('mura-first-run-active');
  setStage(initialStage);
  if(initialStage==='welcome')nodes.start.focus({preventScroll:true});
 }
 function setStep(step){stepInfo={kind:step.kind,label:step.label||step.title||step.kind,index:(step.index||0)+1,total:step.total||1,text:step.text||''};layer.dataset.kind=stepInfo.kind;}
 function destroy(){
  destroyed=true;
  cancelDemo();
  clearTimeout(hintTimer);clearTimeout(acceptTimer);
  clearTarget();
  nodes.trail.getAnimations?.().forEach(animation=>animation.cancel());
  document.body.classList.remove('mura-first-run-active');
  layer.remove();
 }
 function refreshTarget(){updateTarget();}

 setStage('welcome');
 return{layer,controls:{replay:nodes.replay,start:nodes.start,finish:nodes.finish,skip:nodes.skip},get stage(){return stage;},show,setStep,setStage,setHint,accept,playDemo,refreshTarget,destroy};
}
