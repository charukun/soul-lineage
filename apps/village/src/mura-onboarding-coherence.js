import {retireLegacyTutorialAfterFirstRun} from './game/onboarding-coherence.js';

const village=window.village,canvas=document.getElementById('game');
if(village&&canvas){
  let saving=false;
  const sync=async()=>{
    if(saving||canvas.dataset.firstRunTutorial!=='seen')return;
    if(!retireLegacyTutorialAfterFirstRun(village.world.state,{seen:true}))return;
    village.updateTutorial();
    saving=true;
    try{await village.save();}
    catch(error){console.warn('First-run tutorial coherence could not be persisted',error);}
    finally{saving=false;}
  };
  const observer=new MutationObserver(()=>void sync());
  observer.observe(canvas,{attributes:true,attributeFilter:['data-first-run-tutorial']});
  void sync();
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
}
