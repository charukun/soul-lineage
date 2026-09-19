const DEV=Object.freeze({
  rinne:'https://soul-lineage-rinne-dev.c-okamoto.workers.dev/',
  village:'https://soul-lineage-village-dev.c-okamoto.workers.dev/',
  demon:'https://soul-lineage-demon-dev.c-okamoto.workers.dev/',
  pulse:'https://rinne-ops.c-okamoto.workers.dev/',
  characters:'https://soul-lineage-character-studio-dev.c-okamoto.workers.dev/'
});
const route=(base,path='')=>new URL(path,base).href;
const ROUTES=Object.freeze({
  characters:DEV.characters,
  motion:route(DEV.rinne,'review-motion.html'),
  assets:route(DEV.rinne,'review-assets.html'),
  effects:route(DEV.rinne,'review-effects.html'),
  battle:route(DEV.rinne,'review-battle.html'),
  rinne:DEV.rinne,
  village:DEV.village,
  demon:DEV.demon,
  pulse:DEV.pulse
});

for(const link of document.querySelectorAll('[data-route]')){
  const href=ROUTES[link.dataset.route];
  if(!href)continue;
  link.href=href;
  link.rel='noopener';
}
const build=document.querySelector('[data-build]');
if(build){
  const sha=String(__BUILD_INFO__?.commit||'').slice(0,12);
  build.textContent=sha?'source '+sha:'source unknown';
}
