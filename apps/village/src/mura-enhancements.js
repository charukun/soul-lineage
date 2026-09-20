// Load post-entry Village enhancements in the established semantic order, while
// yielding between side-effect modules so the first playable village frame and
// user input are not trapped behind one monolithic evaluation task.
const ORDERED_ENHANCEMENTS=Object.freeze([
  './mura-world-systems.js',
  './mura-performance.js',
  './mura-experience.js',
  './mura-v2-ui.js',
  './mura-background-bgm.js',
  './mura-first-build.js',
  './mura-first-run-autoplay.js',
  './mura-onboarding-coherence.js',
  './mura-director-polish.js',
  './mura-director-touch-fix.js',
  './mura-playability-polish.js',
  './mura-code-share.js',
  './village-kaykit-detail-unity.js',
  // The legacy Shino MasterCharacter enhancement stays retired. The current
  // shared resident presentation remains authoritative until replacement.
  './mura-motion-crowd.js',
]);
const yieldToBrowser=()=>new Promise(resolve=>setTimeout(resolve,0));
let pending=null;
export let MURA_ENHANCEMENTS_READY=false;

export function loadMuraEnhancements(){
  return pending??=(async()=>{
    for(const modulePath of ORDERED_ENHANCEMENTS){
      await import(modulePath);
      await yieldToBrowser();
    }
    MURA_ENHANCEMENTS_READY=true;
    return true;
  })();
}
