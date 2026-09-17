import * as T from 'three';
import { activeCharacter, CHARACTER_SELECTION_ENABLED } from './characters.js';
import { animateCreature } from './web/creatures.js';
import { NightView } from './web/view.js';

const scratchByView=new WeakMap();
function scratch(view){
  let row=scratchByView.get(view);
  if(row)return row;
  row={
    cameraPosition:new T.Vector3(),cameraTarget:new T.Vector3(),labelPoint:new T.Vector3(),
    shadowMatrix:new T.Matrix4(),shadowPosition:new T.Vector3(),shadowScale:new T.Vector3(),zeroMatrix:new T.Matrix4().makeScale(0,0,0),
    shadowRotation:new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2),
    growth:{scale:1,zoom:19,lookY:0,back:2.2,shadow:.36},
    feastOptions:{reducedMotion:false,target:null,active:true},
    creatureOptions:{form:null,eating:false,feast:0},
    reaperOptions:{preview:false,eating:false,dead:false},
  };
  scratchByView.set(view,row);return row;
}
function growthFrame(out,growthScale=1,wide=false){
  const scale=Math.max(.28,Math.min(3.2,Number(growthScale)||1)),t=(scale-.28)/(3.2-.28);
  out.scale=scale;out.zoom=(wide?15:19)*(.68+t*.96);out.lookY=.08+t*2.9;out.back=2.2+t*2.8;out.shadow=.36+t*2.44;return out;
}

NightView.prototype.update=function optimizedDemonUpdate(game,dt,title=false){
  const s=scratch(this);this.elapsed+=dt;const realNow=performance.now();this.fpsClock+=(realNow-(this.fpsLast||realNow))/1000;this.fpsLast=realNow;this.frameCount++;if(this.fpsClock>1){this.fps=this.frameCount/this.fpsClock;this.frameCount=0;this.fpsClock=0;}this.pulse=Math.max(0,this.pulse-dt);
  const p=game.player,time=game.time||this.elapsed,w=game.village,wide=innerWidth/innerHeight>1.3,frame=growthFrame(s.growth,p.growthScale,wide);
  s.feastOptions.reducedMotion=!!this.motionPreference?.matches;s.feastOptions.target=this.feastTarget;s.feastOptions.active=!title&&!this.characterPreview;
  const feast=this.feast.update(game,s.feastOptions),requested=(CHARACTER_SELECTION_ENABLED&&this.previewCharacter)||activeCharacter(game.profile).id;
  this.characterId=requested==='silver-reaper'&&this.reaper?'silver-reaper':'night-creature';this.canvas.dataset.character=this.characterId;
  const displayPlayer=this.characterPreview?{...p,pose:null,speed:0,walk:0,yaw:this.characterPreviewYaw||0}:p;
  s.creatureOptions.form=game.profile.form;s.creatureOptions.eating=!this.characterPreview&&!!game.devour;s.creatureOptions.feast=game.fight?0:feast.body;
  animateCreature(this.player,displayPlayer,this.characterPreview?this.elapsed:time,s.creatureOptions);
  this.player.visible=this.characterId==='night-creature';
  if(this.reaper){this.reaper.root.visible=this.characterId==='silver-reaper';if(this.reaper.root.visible){s.reaperOptions.preview=!!this.characterPreview;s.reaperOptions.eating=!this.characterPreview&&!!game.devour;s.reaperOptions.dead=!this.characterPreview&&p.hp<=0;this.reaper.update(displayPlayer,this.characterPreview?this.elapsed:time,dt,s.reaperOptions);}}
  for(const n of w.npcs){if(!this.npcs.has(n.id))this.addHuman(n);const actor=this.npcs.get(n.id);actor.visible=!n.eaten;animateCreature(actor,n,time);const label=actor.userData.label,distance=Math.hypot(n.x-p.x,n.z-p.z),show=!title&&!n.eaten&&distance<29&&(distance<7||game.scent>0||game.has('hunter')||n.marked&&distance<15||this.feastTarget?.npc.id===n.id);label.hidden=!show;if(show){s.labelPoint.set(n.x,n.dead?.4:2.15,n.z).project(this.camera);label.style.transform=`translate(${(s.labelPoint.x*.5+.5)*innerWidth}px,${(-s.labelPoint.y*.5+.5)*innerHeight}px) translate(-50%,-100%)`;label.style.opacity=n.dead?.65:1;label.classList.toggle('afraid',n.state==='flee');label.classList.toggle('next-prey',this.feastTarget?.npc.id===n.id);}}
  this.gate.visible=!w.gate.broken;this.back.visible=game.has('gravekeeper');this.ward.visible=!game.has('acolyte');this.entry.rotation.y=time*.05;
  if(this.characterPreview){this.camera.setViewOffset(innerWidth,innerHeight,wide?innerWidth*.18:0,wide?0:innerHeight*.22,innerWidth,innerHeight);s.cameraPosition.set(p.x+.25,2.1,p.z+(wide?4.7:6.5));s.cameraTarget.set(p.x,1.0,p.z);this.camera.position.lerp(s.cameraPosition,1-Math.exp(-dt*8));this.cameraLook.lerp(s.cameraTarget,1-Math.exp(-dt*8));}
  else if(title){this.camera.clearViewOffset();s.cameraPosition.set(p.x+4.2,3.5,p.z+8.0);s.cameraTarget.set(p.x,1.25,p.z);this.camera.position.lerp(s.cameraPosition,1-Math.exp(-dt*3));this.cameraLook.lerp(s.cameraTarget,1-Math.exp(-dt*3));}
  else{this.camera.clearViewOffset();const zoom=frame.zoom*(1-feast.camera);s.cameraPosition.set(p.x+Math.sin(.33)*zoom*.88,zoom,p.z+Math.cos(.33)*zoom*.88);s.cameraTarget.set(p.x,frame.lookY,p.z-frame.back);this.camera.position.lerp(s.cameraPosition,1-Math.exp(-dt*5));this.cameraLook.lerp(s.cameraTarget,1-Math.exp(-dt*5));}
  this.camera.lookAt(this.cameraLook);this.warm.position.set(p.x-3,Math.max(2.5,frame.lookY+1.4),p.z+1);this.warm.intensity=19+Math.sin(time*8)*2;this.rim.position.set(p.x+1.6,Math.max(3,frame.lookY+1.6),p.z-2.4);
  let nearest=null,near=999;for(const flame of this.flames){const distance=Math.hypot(flame.x-p.x,flame.z-p.z);if(distance<near){nearest=flame;near=distance;}flame.sprite.material.opacity=.38+Math.sin(time*7+flame.phase)*.04;}if(nearest&&near<9){this.warm.position.set(nearest.x,Math.max(2.3,frame.lookY+1.2),nearest.z);this.warm.intensity=34;}
  this.moon.position.set(-14,25,-16);this.moon.target.position.set(0,0,0);
  if(this.rain){this.rain.position.set(p.x,0,p.z);const position=this.rain.geometry.attributes.position,show=this.rain.userData.rain;for(let i=0;i<position.count;i+=2){const y=position.getY(i)-dt*(show?10:.35),nextY=y<0?20:y;position.setY(i,nextY);position.setY(i+1,nextY+(show?.45:.02));}position.needsUpdate=true;}
  for(let i=this.fx.length-1;i>=0;i--){const fx=this.fx[i];fx.age+=dt;fx.mesh.material.opacity=1-fx.age/fx.life;if(fx.vel){const position=fx.mesh.geometry.attributes.position;for(let j=0;j<fx.vel.length;j++){const velocity=fx.vel[j];position.setXYZ(j,position.getX(j)+velocity[0]*dt,position.getY(j)+velocity[1]*dt,position.getZ(j)+velocity[2]*dt);velocity[1]-=dt*5;}position.needsUpdate=true;}if(fx.age>fx.life){this.effects.remove(fx.mesh);if(typeof fx.recycle==='function')fx.recycle();else{fx.mesh.geometry.dispose();fx.mesh.material.dispose();}this.fx.splice(i,1);}}
  this.updateBatches();let shadowIndex=0;
  if(!p.eaten){s.shadowPosition.set(p.x,.012,p.z);s.shadowScale.set(frame.shadow,frame.shadow,1);s.shadowMatrix.compose(s.shadowPosition,s.shadowRotation,s.shadowScale);this.contactShadow.setMatrixAt(shadowIndex++,s.shadowMatrix);}
  for(const npc of w.npcs){if(npc.eaten||shadowIndex>=32)continue;s.shadowPosition.set(npc.x,.012,npc.z);s.shadowScale.set(.60,.60,1);s.shadowMatrix.compose(s.shadowPosition,s.shadowRotation,s.shadowScale);this.contactShadow.setMatrixAt(shadowIndex++,s.shadowMatrix);}
  this.contactShadow.count=shadowIndex;this.contactShadow.instanceMatrix.needsUpdate=true;this.renderer.render(this.scene,this.camera);
};
NightView.prototype.update.__runtimeHotloopOptimized=true;

NightView.prototype.updateBatches=function optimizedActorBatches(){
  const s=scratch(this);
  if(this.batchDirty){for(const batch of this.batches){this.batchRoot.remove(batch.mesh);batch.mesh.dispose();}this.batches=[];const groups=new Map();this.actors.traverse(object=>{if(!object.isMesh)return;object.layers.set(1);const key=object.geometry.uuid+object.material.uuid;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(object);});for(const list of groups.values()){const first=list[0],mesh=new T.InstancedMesh(first.geometry,first.material,list.length);mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;this.batchRoot.add(mesh);this.batches.push({mesh,list});}this.batchDirty=false;}
  this.actors.updateMatrixWorld(true);for(const batch of this.batches){let index=0;for(const object of batch.list){let visible=true,node=object;while(node&&node!==this.actors){if(!node.visible){visible=false;break;}node=node.parent;}batch.mesh.setMatrixAt(index++,visible?object.matrixWorld:s.zeroMatrix);}batch.mesh.instanceMatrix.needsUpdate=true;}
};
NightView.prototype.updateBatches.__runtimeHotloopOptimized=true;
