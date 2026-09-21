import {renderReviewProbeLinks} from '@soul/shared-ui/review-shell';
import {REVIEW_DEV,REVIEW_ROUTES,REVIEW_VFX_WARM_ASSETS,REVIEW_WARM_ORDER} from './review-lab-config.js';
import {decorateReviewMenuIcons} from './review-lab-icons.js';
import {createReviewWarmup} from './review-lab-warmup.js';

const probeGrid=document.querySelector('#probe-grid');
renderReviewProbeLinks(probeGrid,{routes:REVIEW_ROUTES});
decorateReviewMenuIcons({routes:REVIEW_ROUTES});

for(const link of document.querySelectorAll('[data-route]')){
  const href=REVIEW_ROUTES[link.dataset.route];
  if(href){link.href=href;link.rel='noopener'}
}

const warmup=createReviewWarmup({
  routes:REVIEW_ROUTES,
  assetBase:REVIEW_DEV.rinne,
  order:REVIEW_WARM_ORDER,
  assetPaths:REVIEW_VFX_WARM_ASSETS,
});

const warmIdsByHref=new Map(REVIEW_WARM_ORDER.map(id=>[REVIEW_ROUTES[id],id]));
for(const link of probeGrid?.querySelectorAll('a')||[]){
  const id=warmIdsByHref.get(link.href);
  if(!id)continue;
  link.addEventListener('pointerenter',()=>warmup.warmRoute(id,{eager:true}),{passive:true});
  link.addEventListener('focus',()=>warmup.warmRoute(id,{eager:true}));
  link.addEventListener('touchstart',()=>warmup.warmRoute(id,{eager:true}),{passive:true});
}
warmup.start();

const build=document.querySelector('[data-build]');
if(build){
  const sha=String(__BUILD_INFO__?.commit||'').slice(0,12);
  build.textContent=sha?'source '+sha:'source unknown';
}
