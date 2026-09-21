// Literal import expressions are required here: Vite must emit every lazy
// module into the production bundle. import(modulePath) leaves a source URL
// in the built runtime and prevents the guide from ever being installed.
const ORDERED_ENHANCEMENTS=Object.freeze([
  ['world-systems',()=>import('./mura-world-systems.js')],
  ['performance',()=>import('./mura-performance.js')],
  ['experience',()=>import('./mura-experience.js')],
  ['v2-ui',()=>import('./mura-v2-ui.js')],
  ['background-bgm',()=>import('./mura-background-bgm.js')],
  ['first-build',()=>import('./mura-first-build.js')],
  ['first-run-guide',()=>import('./mura-first-run-autoplay.js')],
  ['onboarding-coherence',()=>import('./mura-onboarding-coherence.js')],
  ['director-polish',()=>import('./mura-director-polish.js')],
  ['director-touch',()=>import('./mura-director-touch-fix.js')],
  ['playability',()=>import('./mura-playability-polish.js')],
  ['code-share',()=>import('./mura-code-share.js')],
  ['kaykit-detail',()=>import('./village-kaykit-detail-unity.js')],
  // Preserve the shared resident presentation; do not revive retired models.
  ['motion-crowd',()=>import('./mura-motion-crowd.js')],
]);
const yieldToBrowser=()=>new Promise(resolve=>setTimeout(resolve,0));
let pending=null;
export let MURA_ENHANCEMENTS_READY=false;

export async function loadOrderedEnhancements(loaders,yieldTurn=yieldToBrowser){
  for(const [name,load] of loaders){
    try{await load();}
    catch(cause){throw new Error(`Village enhancement failed: ${name}`,{cause});}
    await yieldTurn();
  }
}

export function loadMuraEnhancements(){
  return pending??=(async()=>{
    await loadOrderedEnhancements(ORDERED_ENHANCEMENTS);
    MURA_ENHANCEMENTS_READY=true;
    return true;
  })();
}
