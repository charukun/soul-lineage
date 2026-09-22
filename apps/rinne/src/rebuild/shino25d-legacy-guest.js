import {shino25dGuestEnabled} from './shino25d-guest-policy.js';
import {createSprite25dActor} from '@soul/assets/sprite25d/three';
import {createCharacter25DActor} from '@soul/assets/character25d/three';
import {verifyCharacter25DBundle} from '@soul/assets/character25d/browser';
import {sweepAndSlide} from './locomotion.js';

const REVIEW_ORIGINS=new Set(['https://soul-lineage-review-dev.c-okamoto.workers.dev','https://rinne-visual-review.c-okamoto.workers.dev']);
const GUEST_INSTALLED=Symbol.for('rinne.character25d.guest');
function trustedOrigin(origin) {
  if(REVIEW_ORIGINS.has(origin))return true;
  try{const url=new URL(origin);return ['localhost','127.0.0.1'].includes(location.hostname)&&url.hostname===location.hostname&&url.protocol===location.protocol&&['5176','5276'].includes(url.port);}catch{return false;}
}
// Compatibility entrypoint name retained for the existing renderer bootstrap.
// This render-only companion never enters NPC, combat, family or save authority.
export function installShino25dGuest(view,options={}){
  if(view?.[GUEST_INSTALLED])return view;
  if(!shino25dGuestEnabled(location.search,options.environment))return view;
  if(!view?.scene||!view.THREE||!view.camera)return view;
  const transferToken=new URLSearchParams(location.search).get('spriteTransfer');
  if(!transferToken||!window.opener)return view;
  view[GUEST_INSTALLED]=true;
  const abort=new AbortController(),velocity={x:0,z:0};
  let actor=null,anchor=null,disposed=false,loading=false,received=false,lifeKey='';
  let frames=0,lastDelta=0;
  // The opt-in guest mirrors the existing training action for presentation only.
  // It never emits a strike, damage event or equipment mutation of its own.
  document.addEventListener('rinne:training-impact',()=>actor?.play?.('attack'),{capture:true,signal:abort.signal});
  const originalRender=view.renderState,originalDispose=view.dispose;
  async function install(bundle){
    const next=await (bundle.schema==='rinne.character25d/v2'?createCharacter25DActor(view.THREE,bundle,{
      canMoveTo:(x,z,r)=>view.canMoveTo(x,z,r,'village',null),sampleGround:view.sampleActorGround,
      sweep:(position,dx,dz,canMoveTo,radius)=>sweepAndSlide(position,dx,dz,canMoveTo,radius,'village',null)
    }):createSprite25dActor(view.THREE,bundle,{shadow:true}));
    if(disposed){next.dispose();return;}actor?.dispose();actor=next;actor.object.visible=false;view.scene.add(actor.object);anchor=null;
    // Read-only observation boundary, only exists for this explicit session.
    view.character25dSnapshot=()=>actor?.snapshot?{...actor.snapshot(),host:{frames,lastDelta,visible:actor.object.visible}}:null;
    if(options.canvas)options.canvas.character25dSnapshot=()=>view.character25dSnapshot?.()||null;
  }
  window.addEventListener('message',event=>{
    if(disposed||loading||received||event.source!==window.opener)return;
    if(event.data?.type!=='rinne.character25d.transfer'||event.data?.token!==transferToken)return;
    if(!trustedOrigin(event.origin))return;
    loading=true;
    void (async()=>{
      try{const bundle=await verifyCharacter25DBundle(event.data.bundle);await install(bundle);received=true;clearInterval(handshake);event.source.postMessage({type:'rinne.character25d.received',token:transferToken},event.origin);}
      catch(error){event.source.postMessage({type:'rinne.character25d.rejected',token:transferToken,message:error.message},event.origin);}
      finally{loading=false;}
    })();
  },{signal:abort.signal});
  const ready=()=>{try{window.opener.postMessage({type:'rinne.character25d.ready',token:transferToken},'*');}catch{}};
  ready();const handshake=setInterval(()=>{if(!received&&!disposed)ready();},750),expiry=setTimeout(()=>clearInterval(handshake),90000);
  function updateGuest(state,delta,renderOptions){
    if(!actor)return;
    frames++;lastDelta=delta;
    const visible=state?.zone==='village'&&!state.interior&&!state.ended&&!renderOptions?.titlePreview&&(!options.canvas||options.canvas.dataset.runtime==='active');
    actor.object.visible=visible;if(!visible){anchor=null;return;}
    const player=view.scene.getObjectByName('Player');if(!player){actor.object.visible=false;return;}
    const x=Number(state.position?.x),z=Number(state.position?.z);if(!Number.isFinite(x)||!Number.isFinite(z)){actor.object.visible=false;return;}
    const key=String(state.id)+':'+String(state.generation);if(key!==lifeKey){anchor=null;lifeKey=key;}
    if(!anchor){
      const radius=actor.proxy?.collider.radius||.24;
      for(const [dx,dz] of [[2.2,.75],[-2.2,.75],[0,2.3],[0,-2.3],[1.15,.75],[-1.15,.75]]){
        if(view.canMoveTo(x+dx,z+dz,radius,'village',null)){anchor={x:x+dx,y:0,z:z+dz};break;}
      }
      if(!anchor){actor.object.visible=false;return;}
      if(actor.setTransform)actor.setTransform(anchor,Number(state.yaw)||0);else actor.object.position.set(anchor.x,anchor.y,anchor.z);
    }
    if(actor.proxy){
      actor.setEquipment(state.equipment||{});
      const yaw=Number(state.yaw)||0,tx=x-Math.sin(yaw)*1.15+Math.cos(yaw)*2.2,tz=z-Math.cos(yaw)*1.15-Math.sin(yaw)*2.2;
      const dx=tx-actor.proxy.position.x,dz=tz-actor.proxy.position.z,distance=Math.hypot(dx,dz),speed=distance>.5?Math.min(distance*1.8,distance>3?4.1:2.1):0;
      if(distance>18){anchor=null;actor.object.visible=false;return;}
      velocity.x=distance?dx/distance*speed:0;velocity.z=distance?dz/distance*speed:0;actor.setVelocity(velocity);
      if(!speed)actor.setFacing(yaw);actor.update({camera:view.camera,delta});
    }else actor.update({camera:view.camera,delta,yaw:0,moving:false});
  }
  view.renderState=function(state,delta=0,renderOptions){updateGuest(state,delta,renderOptions);return originalRender.call(this,state,delta,renderOptions);};
  const dispose=()=>{if(disposed)return;disposed=true;abort.abort();clearInterval(handshake);clearTimeout(expiry);actor?.dispose();delete view[GUEST_INSTALLED];delete view.character25dSnapshot;if(options.canvas)delete options.canvas.character25dSnapshot;};
  view.dispose=function(...args){dispose();return originalDispose?.apply(this,args);};
  addEventListener('pagehide',dispose,{once:true,signal:abort.signal});return view;
}
