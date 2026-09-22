import './mura-first-run-guide.css';
import {consumeFreshVillageLoad} from './game/save-store.js';
import {consumeFirstRunAutoplayAfterReset,markFirstRunAutoplaySeen,markFirstRunAutoplayStarted,shouldRecoverFirstRunAutoplay,shouldRunFirstRunAutoplay} from './game/first-run-onboarding.js';
import {prepareFreshFoundingVillage} from './game/founding-onboarding.js';
import {startFirstRunGuide} from './mura-first-run-guide-controller.js';

function persist(village,label){void village.save().catch(error=>console.warn(`${label} could not be persisted`,error));}
function install(){
 const village=window.village;if(!village)return;
 const resetReplay=consumeFirstRunAutoplayAfterReset(village.info.environment),freshLoad=consumeFreshVillageLoad();
 if(!shouldRunFirstRunAutoplay(village.world.state,{freshLoad:freshLoad||resetReplay}))return;
 const canvas=village.view.canvas||document.getElementById('game');if(!canvas)return;
 if(freshLoad)prepareFreshFoundingVillage(village.world);
 markFirstRunAutoplayStarted(village.world.state);
 const foundingComplete=!!village.world.state?.onboarding?.founding?.completed;
 if(shouldRecoverFirstRunAutoplay(village.world.state,{resetReplay,foundingComplete})){
  markFirstRunAutoplaySeen(village.world.state);persist(village,'Founding tutorial recovery');return;
 }
 persist(village,'Founding tutorial start');
 startFirstRunGuide({village,canvas});
}
install();
