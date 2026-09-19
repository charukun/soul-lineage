import {createReviewRoutes,renderReviewProbeLinks} from '@soul/shared-ui/review-shell';
const DEV=Object.freeze({rinne:'https://soul-lineage-rinne-dev.c-okamoto.workers.dev/',village:'https://soul-lineage-village-dev.c-okamoto.workers.dev/',demon:'https://soul-lineage-demon-dev.c-okamoto.workers.dev/',pulse:'https://rinne-ops.c-okamoto.workers.dev/',characters:'https://soul-lineage-character-studio-dev.c-okamoto.workers.dev/'});
const route=(base,path='')=>new URL(path,base).href;
const ROUTES=Object.freeze({...createReviewRoutes({rinneBase:DEV.rinne,charactersBase:DEV.characters}),rinne:DEV.rinne,village:DEV.village,demon:DEV.demon,pulse:DEV.pulse});
renderReviewProbeLinks(document.querySelector('#probe-grid'),{routes:ROUTES});

const idle=globalThis.requestIdleCallback||((callback)=>setTimeout(()=>callback({timeRemaining:()=>8,didTimeout:false}),80));
const warmQueue=[
  ROUTES.effects,
  route(DEV.rinne,'simulator/assets/effekseer/effekseer.js'),
  route(DEV.rinne,'simulator/assets/effekseer/effekseer.wasm'),
  route(DEV.rinne,'simulator/assets/effekseer/samples/00_Basic/Simple_Ribbon_Sword.efkefc'),
  route(DEV.rinne,'simulator/assets/effekseer/samples/02_Tktk03/ToonHit.efkefc'),
  ROUTES.motion,ROUTES.battle,ROUTES.equipment,ROUTES.objects,ROUTES.sounds,
].filter(Boolean);
function warmNext(deadline){
  const url=warmQueue.shift();if(!url)return;
  void fetch(url,{mode:'no-cors',credentials:'omit',cache:'force-cache',priority:'low'}).catch(()=>{}).finally(()=>idle(warmNext,{timeout:1200}));
}
idle(warmNext,{timeout:400});
for(const link of document.querySelectorAll('[data-route]')){const href=ROUTES[link.dataset.route];if(href){link.href=href;link.rel='noopener'}}
const build=document.querySelector('[data-build]');if(build){const sha=String(__BUILD_INFO__?.commit||'').slice(0,12);build.textContent=sha?'source '+sha:'source unknown'}
