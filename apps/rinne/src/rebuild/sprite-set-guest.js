import {createCharacterSpriteSetActor} from '@soul/assets/character-sprite-set/three';
import {createSpriteSetSandbox} from '@soul/assets/character-sprite-set/sandbox';
import {sweepAndSlide} from './locomotion.js';
const REVIEW_ORIGINS=new Set(['https://soul-lineage-review-dev.c-okamoto.workers.dev','https://rinne-visual-review.c-okamoto.workers.dev']);
export function trustedSpriteSetOrigin(origin,locationLike=location){
  if(REVIEW_ORIGINS.has(origin))return true;
  try{const url=new URL(origin);return ['localhost','127.0.0.1'].includes(locationLike.hostname)&&url.hostname===locationLike.hostname&&url.protocol===locationLike.protocol&&['5176','5276'].includes(url.port);}catch{return false;}
}
export function installSpriteSetGuest(view,{environment,canvas}={}){
  const query=new URLSearchParams(location.search),token=query.get('spriteTransfer');
  if(!['dev','local'].includes(environment)||query.get('spriteSet')!=='1'||!token||!/^[a-zA-Z0-9-]{20,80}$/.test(token)||!window.opener||!view?.scene||!view.camera||!view.THREE)return view;
  const abort=new AbortController(),originalRender=view.renderState,originalDispose=view.dispose;
  let actor=null,sandbox=null,disposed=false,loading=false,received=false,origin=null,spawned=false,lifeKey='',telemetry=0;
  const send=(type,data={})=>{try{window.opener?.postMessage({type,token,...data},origin||'*');}catch{}};
  async function install(bundle){
    const next=await createCharacterSpriteSetActor(view.THREE,bundle,{playable:true});
    if(disposed){next.dispose();return;}
    actor=next;sandbox=createSpriteSetSandbox(actor,{
      canMoveTo:(x,z,r)=>view.canMoveTo(x,z,r,'village',null),sampleGround:view.sampleActorGround,
      sweep:(position,dx,dz,canMoveTo,radius)=>sweepAndSlide(position,dx,dz,canMoveTo,radius,'village',null),
    });
    view.scene.add(actor.object);actor.object.visible=false;sandbox.setDemo(true);
    canvas.spriteSetSnapshot=()=>({actor:actor.snapshot(),sandbox:sandbox.snapshot(),visible:actor.object.visible});
  }
  window.addEventListener('message',event=>{
    if(disposed||event.source!==window.opener||event.data?.token!==token||!trustedSpriteSetOrigin(event.origin))return;
    if(received){
      if(event.origin!==origin||event.data.type!=='rinne.sprite-set.command')return;
      try{
        const command=event.data.command;
        if(command==='action'){sandbox.setDemo(false);sandbox.play(event.data.action);}
        else if(command==='demo')sandbox.setDemo(Boolean(event.data.value));
        else if(command==='pause')sandbox.pause(Boolean(event.data.value));
        else if(command==='reset'){sandbox.reset();sandbox.setDemo(false);}
        else return;
        send('rinne.sprite-set.state',{snapshot:canvas.spriteSetSnapshot()});
      }catch(error){send('rinne.sprite-set.rejected',{message:error.message});}
      return;
    }
    if(loading||event.data.type!=='rinne.sprite-set.transfer')return;
    loading=true;origin=event.origin;
    void install(event.data.bundle).then(()=>{if(disposed)return;received=true;clearInterval(handshake);send('rinne.sprite-set.received');}).catch(error=>send('rinne.sprite-set.rejected',{message:error.message})).finally(()=>{loading=false;});
  },{signal:abort.signal});
  const ready=()=>send('rinne.sprite-set.ready');ready();
  const handshake=setInterval(()=>{if(!received&&!disposed)ready();},750),expiry=setTimeout(()=>clearInterval(handshake),90000);
  function update(state,delta,options){
    if(!actor)return;
    const visible=state?.zone==='village'&&!state.interior&&!state.ended&&!options?.titlePreview&&canvas.dataset.runtime==='active';
    actor.object.visible=visible;if(!visible){spawned=false;return;}
    const key=String(state.id)+':'+String(state.generation);if(key!==lifeKey){spawned=false;lifeKey=key;}
    const x=Number(state.position?.x),z=Number(state.position?.z);
    if(!Number.isFinite(x)||!Number.isFinite(z)){actor.object.visible=false;return;}
    if(!spawned||Math.hypot(x-sandbox.proxy.position.x,z-sandbox.proxy.position.z)>15){
      let position=null;
      for(const [dx,dz] of [[2,.8],[-2,.8],[0,2.2],[0,-2.2],[1,.5],[-1,.5]])if(view.canMoveTo(x+dx,z+dz,.24,'village',null)){position={x:x+dx,y:0,z:z+dz};break;}
      if(!position){actor.object.visible=false;return;}
      sandbox.reset(position,Number(state.yaw)||0);spawned=true;
    }
    sandbox.update(delta,view.camera);telemetry+=delta;
    if(telemetry>.2){telemetry=0;send('rinne.sprite-set.state',{snapshot:canvas.spriteSetSnapshot()});}
  }
  // State/ground hooks are existing RINNE hooks; onBeforeRender resolves the final camera.
  view.renderState=function(state,delta=0,options){update(state,delta,options);return originalRender.call(this,state,delta,options);};
  function dispose(){if(disposed)return;disposed=true;abort.abort();clearInterval(handshake);clearTimeout(expiry);sandbox?.dispose();actor?.dispose();delete canvas.spriteSetSnapshot;}
  view.dispose=function(...args){dispose();return originalDispose?.apply(this,args);};
  addEventListener('pagehide',dispose,{once:true,signal:abort.signal});return view;
}
