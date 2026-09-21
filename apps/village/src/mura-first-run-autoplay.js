import './mura-first-run-guide.css';
import {consumeFreshVillageLoad} from './game/save-store.js';
import {FIRST_RUN_AUTOPLAY_VERSION,hasFirstRunAutoplayAfterReset,consumeFirstRunAutoplayAfterReset,markFirstRunAutoplaySeen,markFirstRunAutoplayStarted,shouldRecoverFirstRunAutoplay,shouldRunFirstRunAutoplay} from './game/first-run-onboarding.js';
import {GUIDE_KIND,startFirstRunGuide} from './mura-first-run-guide-controller.js';

function persist(village,label){
 void village.save().then(saved=>{
  if(saved===false)console.warn(`${label} could not be persisted`);
 }).catch(error=>console.warn(`${label} could not be persisted`,error));
}
function install(){
 const village=window.village;if(!village)return;
 const environment=village.info.environment;
 // Do not consume the reset request until the real guide has been installed.
 const resetReplay=hasFirstRunAutoplayAfterReset(environment);
 const freshLoad=consumeFreshVillageLoad()||resetReplay;
 const previousGuide=village.world.state?.onboarding?.firstRunAutoplay;
 if(!shouldRunFirstRunAutoplay(village.world.state,{freshLoad,resetReplay}))return;
 const canvas=village.view.canvas||document.getElementById('game');if(!canvas)return;
 if(previousGuide?.seen&&previousGuide.version!==FIRST_RUN_AUTOPLAY_VERSION&&!village.world.state.tutorial?.completed){
  village.world.state.tutorial={...(village.world.state.tutorial||{}),dismissed:false};
 }
 const recoverCompletedPlacement=shouldRecoverFirstRunAutoplay(village.world.state,{
  resetReplay,
  guidePlaced:!!previousGuide?.placedId&&village.world.objects.some(object=>object.id===previousGuide.placedId&&object.kind===GUIDE_KIND),
 });
 if(recoverCompletedPlacement){
  markFirstRunAutoplaySeen(village.world.state);
  canvas.dataset.firstRunTutorial='seen';
  persist(village,'First-run tutorial recovery');return;
 }
 markFirstRunAutoplayStarted(village.world.state);
 startFirstRunGuide({village,canvas});
 consumeFirstRunAutoplayAfterReset(environment);
 persist(village,'First-run tutorial start');
}
install();
