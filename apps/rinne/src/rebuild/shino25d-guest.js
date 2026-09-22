import {shino25dGuestEnabled} from './shino25d-guest-policy.js';
import {createSprite25dActor} from '@soul/assets/sprite25d/three';
import {verifySprite25dBundle} from '@soul/assets/sprite25d/browser';

// Silent, session-only bridge from Visual Review Lab.
// It creates no controls, file picker, persistent draft, NPC state, combat state or save data.
export function installShino25dGuest(view,options={}){
  if(!shino25dGuestEnabled(location.search,options.environment))return view;
  if(!view?.scene||!view.THREE||!view.camera)return view;

  const transferToken=new URLSearchParams(location.search).get('spriteTransfer');
  if(!transferToken||!window.opener)return view;

  const abort=new AbortController();
  let actor=null,anchor=null,disposed=false,loading=false;
  const originalRender=view.renderState,originalDispose=view.dispose;

  async function install(bundle){
    const next=await createSprite25dActor(view.THREE,bundle,{shadow:true});
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

    actor.update({camera:view.camera,delta,yaw:0,moving:false});
  }

  view.renderState=function(state,delta=0,renderOptions){
    updateGuest(state,delta,renderOptions);
    return originalRender.call(this,state,delta,renderOptions);
  };

  const dispose=()=>{
    if(disposed)return;
    disposed=true;
    abort.abort();
    actor?.dispose();
  };

  view.dispose=function(...args){
    dispose();
    return originalDispose?.apply(this,args);
  };

  addEventListener('pagehide',dispose,{once:true,signal:abort.signal});
  return view;
}
