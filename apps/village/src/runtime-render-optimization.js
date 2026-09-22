import { createMiniatureFocus } from '@soul/rendering/miniature-focus';
import { createStaticBatchController } from '@soul/rendering/static-world-batch';
import { defs } from './game/core.js';
import { View } from './web/view.js';
import { syncVillageRenderResolution } from './render-resolution.js';

const controllers=new WeakMap();

function descriptors(view){
  const rows=[{id:'objects',root:view.objects,requireOptIn:true,minInstances:2,maxInstances:256}];
  if(view.foundation?.parent)rows.push({id:'foundation',root:view.outside,requireOptIn:true,minInstances:2,maxInstances:128,ownerFilter:owner=>owner===view.foundation});
  for(const room of view.inside?.children||[])rows.push({id:`room:${room.userData?.roomId||room.uuid}`,root:room,requireOptIn:true,minInstances:2,maxInstances:128});
  return rows;
}

function controllerFor(view){
  let controller=controllers.get(view);
  if(!controller){controller=createStaticBatchController({roots:()=>descriptors(view)});controllers.set(view,controller);}
  return controller;
}

function refreshBatches(view){const controller=controllerFor(view);controller.invalidate();return controller.refresh();}

const node=View.prototype.node;
View.prototype.node=function optimizedStaticNode(object){
  const result=node.call(this,object);
  result.userData=result.userData||{};
  if(defs[object.kind]?.building)result.userData.noBatch=true;
  else result.userData.staticBatchEligible=true;
  return result;
};

const mountFoundation=View.prototype.mountFoundation;
View.prototype.mountFoundation=function optimizedFoundation(world){
  const result=mountFoundation.call(this,world);
  if(this.foundation){this.foundation.userData=this.foundation.userData||{};this.foundation.userData.staticBatchEligible=true;}
  refreshBatches(this);
  return result;
};

const rebuild=View.prototype.rebuild;
View.prototype.rebuild=function optimizedRebuild(...args){
  const controller=controllerFor(this);
  controller.beforeMutation();
  const result=rebuild.apply(this,args);
  controller.invalidate();controller.refresh();
  this.__runtimeStaticBatch=controller.snapshot();
  return result;
};

function revealBatchedSources(root, rows){
  root?.traverse?.(node=>{
    if(node.visible===false&&node.userData?.staticWorldBatchedInto){rows.push(node);node.visible=true;}
  });
}
const pick=View.prototype.pick;
View.prototype.pick=function optimizedPick(...args){
  const revealed=[];revealBatchedSources(this.objects,revealed);revealBatchedSources(this.inside,revealed);
  try{return pick.apply(this,args);}finally{for(const node of revealed)node.visible=false;}
};

View.prototype.makePost=function makeBoundedMiniatureFocus(){
  this.miniatureFocus?.dispose?.();
  this.miniatureFocus=createMiniatureFocus(this.renderer);
};

const resize=View.prototype.resize;
View.prototype.resize=function optimizedResize(...args){
  // MiniatureFocus reads getDrawingBufferSize(), not the legacy this.rt target.
  // Apply the governor scale before either the canvas or post-process is resized.
  syncVillageRenderResolution(this);
  const result=resize.apply(this,args);this.miniatureFocus?.resize();return result;
};

// Same village camera/ambient behavior as the base renderer, but the old full-
// resolution 12-tap blur is replaced by the shared bounded low-resolution pass.
View.prototype.render=function optimizedVillageRender(time,dt){
  this.waterMat.uniforms.time.value=time;this.motes.rotation.y=Math.sin(time*.013)*.025;this.motes.position.y=Math.sin(time*.31)*.18;
  this.updateObservation(dt);
  if(!this.observation&&this.cameraGoal){const g=this.cameraGoal,t=1-Math.exp(-dt*5);this.target.x+=(g.x-this.target.x)*t;this.target.z+=(g.z-this.target.z)*t;this.target.y+=((g.y||0)-this.target.y)*t;this.span+=(g.span-this.span)*t;if(Math.abs(g.x-this.target.x)+Math.abs(g.z-this.target.z)+Math.abs(g.span-this.span)<.05)this.cameraGoal=null;}
  if(!this.observation&&!this.interacting&&performance.now()-this.lastInteraction>2600){
    if(this.autoOrbit)this.yaw+=dt*.009;
    if(this.followId){const p=this.world.people.find(p=>p.id===this.followId);if(p){const t=1-Math.exp(-dt*1.8);this.target.x+=(p.x-this.target.x)*t;this.target.z+=(p.z-this.target.z)*t;}}
  }
  this.updateCamera();this.updateObservationOccluders(time);this.animateAmbient(time);
  this.syncGrounding?.([this.objects,this.foundation].filter(Boolean),this.__stylizedQuality?.level??0);
  const level=this.__stylizedQuality?.level??0,tilt=Number(this.world.state.settings.tilt??1);
  this.miniatureFocus.setLevel(level);
  this.miniatureFocus.render(this.scene,this.camera,{focusY:.48,clear:.12,fade:.32,strength:tilt});
};

View.prototype.runtimeOptimizationSnapshot=function runtimeOptimizationSnapshot(){
  return Object.freeze({staticBatch:controllerFor(this).snapshot(),focus:this.miniatureFocus?.snapshot?.()||null});
};
