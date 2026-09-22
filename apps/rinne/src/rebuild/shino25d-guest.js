import {shino25dGuestEnabled} from './shino25d-guest-policy.js';
import {createCharacter25dActor} from '@soul/assets/character25d/three';
import {verifySprite25dBundle} from '@soul/assets/sprite25d/browser';

// Silent, session-only bridge from Visual Review Lab.
// It creates no controls, file picker, persistent draft, NPC state, combat state or save data.
export function installShino25dGuest(view,options={}){
  if(!shino25dGuestEnabled(location.search,options.environment))return view;
  if(!view?.scene||!view.THREE||!view.camera)return view;

  const transferToken=new URLSearchParams(location.search).get('spriteTransfer');
  if(!transferToken||!window.opener)return view;

  const abort=new AbortController();
  let actor=null,anchor=null,disposed=false,loading=false,lastObservation=0,attackUntil=0;
  const originalRender=view.renderState,originalDispose=view.dispose;
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-training-strike]'))attackUntil=performance.now()+650;},{signal:abort.signal});

  async function install(bundle){
    const next=await createCharacter25dActor(view.THREE,bundle,{shadow:true});
    if(disposed){next.dispose();return;}
    actor?.dispose();
    actor=next;
    actor.object.visible=false;
    view.scene.add(actor.object);
    anchor=null;
  }

  window.addEventListener('message',event=>{
    if(disposed||loading||event.source!==window.opener)return;
    if(event.data?.type!=='rinne.character25d.transfer'||event.data?.token!==transferToken)return;
    loading=true;
    void (async()=>{
      try{
        const bundle=await verifySprite25dBundle(event.data.bundle);
        await install(bundle);
        event.source.postMessage({type:'rinne.character25d.received',token:transferToken},event.origin);
      }catch(error){
        console.warn('Shino 2.5D transfer rejected:',error);
      }finally{
        loading=false;
      }
    })();
  },{signal:abort.signal});

  try{
    window.opener.postMessage({type:'rinne.character25d.ready',token:transferToken},'*');
  }catch(error){
    console.warn('Shino 2.5D transfer handshake unavailable:',error);
  }

  function updateGuest(state,delta,renderOptions){
    if(!actor)return;
    const visible=state?.zone==='village'&&!state.interior&&!state.ended&&!renderOptions?.titlePreview;
    actor.object.visible=visible;
    if(!visible){anchor=null;return;}

    const player=view.scene.getObjectByName('Player');
    if(!player){actor.object.visible=false;return;}

    if(!anchor){
      const x=Number(state.position?.x),z=Number(state.position?.z);
      if(!Number.isFinite(x)||!Number.isFinite(z)){actor.object.visible=false;return;}
      for(const [dx,dz] of [[1.15,.75],[-1.15,.75],[0,1.4],[0,-1.4],[1.6,0],[-1.6,0]]){
        if(!view.canMoveTo||view.canMoveTo(x+dx,z+dz,.22,'village',null)){
          anchor={x:x+dx,z:z+dz,y:Number(state.position?.y)||0};
          break;
        }
      }
      if(!anchor){actor.object.visible=false;return;}
      actor.object.position.set(anchor.x,anchor.y,anchor.z);
    }

    const dt=Math.min(.05,Math.max(0,Number(delta)||0)),x=Number(state.position?.x),z=Number(state.position?.z);
    const dx=x+1.15-actor.object.position.x,dz=z+.75-actor.object.position.z,distance=Math.hypot(dx,dz);
    const speed=distance>2.5?3.4:1.3,moving=distance>.25,step=Math.min(distance,speed*dt);
    if(moving){
      const nx=actor.object.position.x+dx/distance*step,nz=actor.object.position.z+dz/distance*step;
      if(!view.canMoveTo||view.canMoveTo(nx,nz,.22,'village',null))actor.object.position.set(nx,Number(state.position?.y)||0,nz);
    }
    actor.setEquipment(state.equipment?.weapon&&state.equipment.weapon!=='fist'?state.equipment:{weapon:'sword',shield:true});
    actor.update({camera:view.camera,delta:dt,yaw:moving?Math.atan2(dx,dz):Number(state.yaw)||0,moving,speed,
      attacking:performance.now()<attackUntil||Boolean(state.attacking||state.combat?.tidebreakPose?.attack),hit:Number(state.flash)>0,resting:Boolean(state.resting)});
    // Observation only: no gameplay, save, attack or equipment authority is added.
    if(performance.now()-lastObservation>200){
      lastObservation=performance.now();const canvas=document.querySelector('#game');
      if(canvas)canvas.dataset.character25d=JSON.stringify(actor.snapshot());
    }
  }

  view.renderState=function(state,delta=0,renderOptions){
    updateGuest(state,delta,renderOptions);
    return originalRender.call(this,state,delta,renderOptions);
  };

  const dispose=()=>{
    if(disposed)return;
    disposed=true;
    abort.abort();
    actor?.dispose();const canvas=document.querySelector('#game');if(canvas)delete canvas.dataset.character25d;
  };

  view.dispose=function(...args){
    dispose();
    return originalDispose?.apply(this,args);
  };

  addEventListener('pagehide',dispose,{once:true,signal:abort.signal});
  return view;
}

