import {createReviewRoutes,renderReviewProbeLinks} from '@soul/shared-ui/review-shell';
const DEV=Object.freeze({rinne:'https://soul-lineage-rinne-dev.c-okamoto.workers.dev/',village:'https://soul-lineage-village-dev.c-okamoto.workers.dev/',demon:'https://soul-lineage-demon-dev.c-okamoto.workers.dev/',pulse:'https://rinne-ops.c-okamoto.workers.dev/',characters:'https://soul-lineage-character-studio-dev.c-okamoto.workers.dev/'});
const route=(base,path='')=>new URL(path,base).href;
const ROUTES=Object.freeze({...createReviewRoutes({rinneBase:DEV.rinne,charactersBase:DEV.characters}),motion:route(DEV.rinne,'review-motion'),equipment:route(DEV.rinne,'review-assets'),objects:route(DEV.rinne,'review-objects'),effects:route(DEV.rinne,'review-effects'),sounds:route(DEV.rinne,'review-sound'),battle:route(DEV.rinne,'review-battle'),battle2:new URL('./battle2.html',location.href).href,rinne:DEV.rinne,village:DEV.village,demon:DEV.demon,pulse:DEV.pulse});
const WARM_ORDER=Object.freeze(['effects','battle','battle2','motion','characters','equipment','objects','sounds']);
const VFX_WARM_ASSETS=Object.freeze(['simulator/assets/effekseer/effekseer.js','simulator/assets/effekseer/effekseer.wasm','simulator/assets/effekseer/samples/00_Basic/Simple_Ribbon_Sword.efkefc','simulator/assets/effekseer/samples/02_Tktk03/ToonHit.efkefc']);
const warmed=new Set(),connected=new Set();
function warmRoute(id,{eager=false}={}){
  const href=ROUTES[id];if(!href||warmed.has(href))return;
  const url=new URL(href);
  if(!connected.has(url.origin)){const preconnect=document.createElement('link');preconnect.rel='preconnect';preconnect.href=url.origin;preconnect.crossOrigin='anonymous';document.head.append(preconnect);connected.add(url.origin);}
  const prefetch=document.createElement('link');prefetch.rel='prefetch';prefetch.as='document';prefetch.href=href;prefetch.dataset.reviewWarm=id;if(eager)prefetch.fetchPriority='high';document.head.append(prefetch);warmed.add(href);
}
function warmVfxAssets(){
  for(const path of VFX_WARM_ASSETS){
    const href=route(DEV.rinne,path);if(warmed.has(href))continue;
    const prefetch=document.createElement('link');prefetch.rel='prefetch';prefetch.href=href;prefetch.fetchPriority='low';prefetch.dataset.reviewWarmAsset='vfx';document.head.append(prefetch);warmed.add(href);
  }
}
function startPriorityWarmup(){
  const schedule=globalThis.requestIdleCallback?callback=>requestIdleCallback(callback,{timeout:900}):callback=>setTimeout(callback,120);
  let index=0;
  const next=()=>{if(index>=WARM_ORDER.length)return;warmRoute(WARM_ORDER[index],{eager:index===0});index++;schedule(next);};
  warmRoute(WARM_ORDER[index++],{eager:true});warmVfxAssets();schedule(next);
}
renderReviewProbeLinks(document.querySelector('#probe-grid'),{routes:ROUTES});
for(const link of document.querySelectorAll('[data-route]')){const href=ROUTES[link.dataset.route];if(href){link.href=href;link.rel='noopener'}}
for(const link of document.querySelectorAll('#probe-grid a')){const id=WARM_ORDER.find(key=>ROUTES[key]===link.href);if(!id)continue;link.addEventListener('pointerenter',()=>warmRoute(id,{eager:true}),{passive:true});link.addEventListener('focus',()=>warmRoute(id,{eager:true}));link.addEventListener('touchstart',()=>warmRoute(id,{eager:true}),{passive:true});}
startPriorityWarmup();
const build=document.querySelector('[data-build]');if(build){const sha=String(__BUILD_INFO__?.commit||'').slice(0,12);build.textContent=sha?'source '+sha:'source unknown'}
