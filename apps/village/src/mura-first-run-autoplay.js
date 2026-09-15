import './mura-first-run-guide.css';
import {consumeFreshVillageLoad} from './game/save-store.js';
import {markFirstRunAutoplaySeen,markFirstRunAutoplayStarted,shouldRunFirstRunAutoplay} from './game/first-run-onboarding.js';
import {GUIDE_KIND,startFirstRunGuide} from './mura-first-run-guide-controller.js';

function persist(village,label){
 void village.save().catch(error=>console.warn(`${label} could not be persisted`,error));
}

function install(){
 const village=window.village;
 if(!village)return;
 const freshLoad=consumeFreshVillageLoad();
 if(!shouldRunFirstRunAutoplay(village.world.state,{freshLoad}))return;

 const canvas=village.view.canvas||document.getElementById('game');
 if(!canvas)return;

 markFirstRunAutoplayStarted(village.world.state);
 persist(village,'First-run tutorial start');

 // A reload can happen after the normal placement path succeeded but before
 // completion was saved. Do not force a second tutorial tent in that case.
 if(village.world.objects.some(object=>object.kind===GUIDE_KIND)){
  markFirstRunAutoplaySeen(village.world.state);
  persist(village,'First-run tutorial recovery');
  return;
 }

 startFirstRunGuide({village,canvas});
}

install();
