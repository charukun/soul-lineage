import {consumeFreshVillageLoad} from './game/save-store.js';
import {markFirstRunAutoplaySeen,markFirstRunAutoplayStarted,shouldRunFirstRunAutoplay} from './game/first-run-onboarding.js';

const STEPS=[
 {id:'b1',title:'まず、暮らしの中心を置きます',before:'「つくる」で施設を選び、置きたい場所へ運びます。',after:'村長の住まいができました。施設には、それぞれ役割があります。',span:34},
 {id:'b2',title:'次に、みんなが集まる灯り',before:'半透明の見本で場所を確かめてから、そこへ配置します。',after:'焚き火が灯りました。人が集まる場所が、村の中心になります。',span:30},
 {id:'b3',title:'最後に、暮らしを守る拠点',before:'住まいだけでなく、守りや仕事の施設も同じように配置できます。',after:'護衛の住まいができました。これで最初の暮らしを始められます。',span:34},
];

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const clamp01=value=>Math.max(0,Math.min(1,value));
const easeOut=value=>1-Math.pow(1-clamp01(value),3);

function install(){
 const village=window.village;
 if(!village)return;
 const freshLoad=consumeFreshVillageLoad();
 if(!shouldRunFirstRunAutoplay(village.world.state,{freshLoad}))return;
 const steps=STEPS.map(step=>({...step,object:village.world.object(step.id)})).filter(step=>step.object);
 if(!steps.length)return;

 const {world,view}=village;
 const canvas=document.getElementById('game');
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const timing=reduced?{settle:90,ghost:180,reveal:180,after:180,final:260}:{settle:360,ghost:760,reveal:620,after:780,final:1100};
 const hiddenIds=new Set(steps.map(step=>step.id));
 const previousAutoOrbit=view.autoOrbit;
 let active=true,finishing=false,lockFrame=0;

 const style=document.createElement('style');
 style.dataset.muraFirstRun='true';
 style.textContent=`
 body.mura-first-run-autoplay #tutorial{display:none!important}
 body.mura-first-run-autoplay #build{outline:2px solid rgba(255,225,154,.92);outline-offset:3px;box-shadow:0 0 0 5px rgba(83,54,28,.18),0 0 24px rgba(255,210,116,.34)}
 #muraFirstRunTutorial{position:fixed;inset:0;z-index:1200;display:flex;align-items:flex-end;justify-content:center;padding:12px 12px calc(14px + env(safe-area-inset-bottom));box-sizing:border-box;background:radial-gradient(circle at 50% 42%,rgba(21,31,25,0) 20%,rgba(15,20,17,.18) 58%,rgba(8,12,10,.52) 100%);pointer-events:auto}
 #muraFirstRunTutorial .mura-first-run-card{position:relative;width:min(560px,calc(100vw - 24px));min-height:132px;max-height:min(34dvh,250px);box-sizing:border-box;padding:15px 16px 14px;border:1px solid rgba(226,194,132,.62);border-radius:14px;background:linear-gradient(145deg,rgba(47,38,26,.96),rgba(24,29,24,.97));box-shadow:0 12px 40px rgba(0,0,0,.46),inset 0 0 0 3px rgba(255,239,195,.055);color:#fff4d7;overflow:hidden}
 #muraFirstRunTutorial .mura-first-run-card:before{content:'';position:absolute;inset:6px;border:1px solid rgba(255,225,164,.13);border-radius:9px;pointer-events:none}
 #muraFirstRunTutorial .eyebrow{display:block;margin:0 82px 4px 0;font-size:10px;letter-spacing:.16em;color:#d9bd84}
 #muraFirstRunTutorial strong{display:block;margin-right:68px;font:700 clamp(16px,4.4vw,20px)/1.3 ui-serif,serif;color:#fff8e8}
 #muraFirstRunTutorial p{margin:7px 0 10px;font-size:clamp(12px,3.3vw,14px);line-height:1.5;color:#e9dfc7}
 #muraFirstRunSkip{position:absolute;top:10px;right:10px;min-width:64px;min-height:40px;padding:7px 10px;border:1px solid rgba(238,211,158,.36);border-radius:999px;background:rgba(10,14,12,.42);color:#f4e8cc;font-size:11px}
 #muraFirstRunProgress{display:flex;align-items:center;gap:7px;min-height:18px;color:#cbb98f;font-size:10px}
 #muraFirstRunProgress i{display:block;width:7px;height:7px;border-radius:50%;background:rgba(246,222,170,.22);box-shadow:inset 0 0 0 1px rgba(246,222,170,.24)}
 #muraFirstRunProgress i.done{background:#f2d28f;box-shadow:0 0 10px rgba(242,210,143,.4)}
 #muraFirstRunProgress span{margin-left:3px}
 #build.mura-first-run-ready{animation:mura-first-run-ready 1.2s ease-in-out 4}
 @keyframes mura-first-run-ready{50%{transform:translateY(-2px) scale(1.035);filter:brightness(1.2)}}
 @media(max-height:520px){#muraFirstRunTutorial{padding-bottom:8px}#muraFirstRunTutorial .mura-first-run-card{min-height:110px;max-height:44dvh;padding:10px 13px}#muraFirstRunTutorial p{margin:4px 0 6px;line-height:1.35}}
 @media(prefers-reduced-motion:reduce){#build.mura-first-run-ready{animation:none}}
 `;
 document.head.append(style);

 const overlay=document.createElement('div');
 overlay.id='muraFirstRunTutorial';
 overlay.setAttribute('role','dialog');
 overlay.setAttribute('aria-modal','true');
 overlay.setAttribute('aria-labelledby','muraFirstRunTitle');
 overlay.innerHTML=`<section class="mura-first-run-card"><span class="eyebrow">はじめての村 · 自動案内</span><strong id="muraFirstRunTitle">何もない場所から、村を始めます</strong><p id="muraFirstRunText">最初の施設がどう置かれるかを、そのまま見てみましょう。</p><div id="muraFirstRunProgress" aria-label="導入の進行"></div><button id="muraFirstRunSkip" type="button">スキップ</button></section>`;
 document.body.append(overlay);
 document.body.classList.add('mura-first-run-autoplay');
 canvas?.setAttribute('data-first-run-tutorial','running');

 const title=overlay.querySelector('#muraFirstRunTitle');
 const text=overlay.querySelector('#muraFirstRunText');
 const progress=overlay.querySelector('#muraFirstRunProgress');
 const skip=overlay.querySelector('#muraFirstRunSkip');
 function progressAt(index,label='自動で進みます'){
  progress.innerHTML=steps.map((_,i)=>`<i class="${i<index?'done':''}" aria-hidden="true"></i>`).join('')+`<span>${Math.min(index+1,steps.length)} / ${steps.length} · ${label}</span>`;
 }
 progressAt(0);

 view.autoOrbit=false;
 view.clearGhost();
 for(const id of hiddenIds){const node=view.objectNodes.get(id);if(node)node.visible=false;}
 view.actors.visible=false;
 if(view.foundation)view.foundation.visible=false;

 function keepIntroHidden(){
  if(!active)return;
  for(const id of hiddenIds){const node=view.objectNodes.get(id);if(node)node.visible=false;}
  view.actors.visible=false;
  if(view.foundation)view.foundation.visible=false;
  lockFrame=requestAnimationFrame(keepIntroHidden);
 }
 lockFrame=requestAnimationFrame(keepIntroHidden);

 function blockKeys(event){
  if(!active)return;
  if(event.key==='Escape'){event.preventDefault();void finish(true);return;}
  if(event.key==='Tab'){event.preventDefault();skip.focus();}
 }
 document.addEventListener('keydown',blockKeys,true);
 skip.addEventListener('click',()=>void finish(true));
 skip.focus({preventScroll:true});

 markFirstRunAutoplayStarted(world.state);
 void village.save().catch(error=>console.warn('First-run tutorial start could not be persisted',error));

 async function animateObject(step){
  const object=step.object;
  title.textContent=step.title;
  text.textContent=step.before;
  view.focus(object.x,object.z,step.span);
  view.setGhost(object.kind,object.x,object.z,object.rot,true,object.material||'base');
  await wait(timing.ghost);
  if(!active)return false;
  view.clearGhost();
  hiddenIds.delete(object.id);
  let node=view.objectNodes.get(object.id);
  if(node){
   const baseY=node.position.y;
   node.visible=true;
   node.scale.setScalar(.06);
   node.position.y=baseY-.5;
   const start=performance.now();
   await new Promise(resolve=>{
    const frame=now=>{
     if(!active){node?.scale.setScalar(1);if(node)node.position.y=baseY;resolve();return;}
     const value=easeOut((now-start)/timing.reveal);
     const current=view.objectNodes.get(object.id);
     if(current!==node){node=current;if(!node){resolve();return;}}
     node.visible=true;
     node.scale.setScalar(.06+.94*value);
     node.position.y=baseY-.5*(1-value);
     if(value<.999)requestAnimationFrame(frame);else{node.scale.setScalar(1);node.position.y=baseY;resolve();}
    };
    requestAnimationFrame(frame);
   });
  }
  if(!active)return false;
  view.renderer.shadowMap.needsUpdate=true;
  text.textContent=step.after;
  return true;
 }

 function revealEverything(){
  hiddenIds.clear();
  for(const step of steps){const node=view.objectNodes.get(step.id);if(node){node.visible=true;node.scale.setScalar(1);}}
  view.actors.visible=true;
  if(view.foundation)view.foundation.visible=true;
  view.clearGhost();
  view.renderer.shadowMap.needsUpdate=true;
 }

 function cleanup(){
  cancelAnimationFrame(lockFrame);
  revealEverything();
  view.autoOrbit=previousAutoOrbit;
  document.removeEventListener('keydown',blockKeys,true);
  document.body.classList.remove('mura-first-run-autoplay');
  overlay.remove();
  const build=document.getElementById('build');
  build?.classList.add('mura-first-run-ready');
  const cleanupDelay=reduced?1000:5200;
  setTimeout(()=>{build?.classList.remove('mura-first-run-ready');style.remove();},cleanupDelay);
  village.activity();
  village.updateTutorial();
 }

 async function finish(skipped=false){
  if(finishing)return;
  finishing=true;
  active=false;
  cancelAnimationFrame(lockFrame);
  revealEverything();
  title.textContent=skipped?'案内を終わります':'できあがり。次はあなたの番です';
  text.textContent=skipped?'いつでも「つくる」から、施設や庭を増やせます。':'画面の「つくる」から施設を選び、場所を決めて村を育ててください。';
  progressAt(steps.length,skipped?'案内を終了':'ここから操作できます');
  markFirstRunAutoplaySeen(world.state);
  try{await village.save();canvas?.setAttribute('data-first-run-tutorial','seen');}
  catch(error){console.warn('First-run tutorial completion could not be persisted',error);canvas?.setAttribute('data-first-run-tutorial','save-error');}
  if(!skipped)await wait(timing.final);
  cleanup();
 }

 async function run(){
  await wait(timing.settle);
  for(let index=0;index<steps.length;index++){
   if(!active)return;
   progressAt(index);
   if(!await animateObject(steps[index]))return;
   await wait(timing.after);
  }
  if(!active)return;
  view.actors.visible=true;
  if(view.foundation)view.foundation.visible=true;
  view.focus(1,1,46);
  await finish(false);
 }
 void run().catch(error=>{console.error('First-run tutorial failed',error);void finish(true);});
}

install();
