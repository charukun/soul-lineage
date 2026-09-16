import {NightView} from './web/view.js';
import {demonCombatCameraFrame} from './web/combat-camera-frame.js';

let installation=null;

export function installCombatCamera(){
  if(installation)return installation.dispose;
  const original=NightView.prototype.update;
  function patchedUpdate(game,dt,title=false){
    const frame=!title&&!this.characterPreview?demonCombatCameraFrame(game,{wide:(globalThis.innerWidth||0)/(globalThis.innerHeight||1)>1.3}):null;
    this.canvas.dataset.combatCamera=String(!!frame);
    if(!frame)return original.call(this,game,dt,title);
    const cameraPosition=this.camera.position,cameraLook=this.cameraLook,positionLerp=cameraPosition.lerp,lookLerp=cameraLook.lerp;
    cameraPosition.lerp=function(_target,alpha){return positionLerp.call(this,frame.camera,alpha);};
    cameraLook.lerp=function(_target,alpha){return lookLerp.call(this,frame.look,alpha);};
    try{return original.call(this,game,dt,title);}finally{cameraPosition.lerp=positionLerp;cameraLook.lerp=lookLerp;}
  }
  NightView.prototype.update=patchedUpdate;
  const dispose=()=>{if(NightView.prototype.update===patchedUpdate)NightView.prototype.update=original;installation=null;};installation={dispose};return dispose;
}
