import * as THREE from 'three';
import { findNode } from './assets.js';
import { clamp } from '../domain/rules.js';
const reusableColor = new THREE.Color();
export class Actor {
  constructor(assets,kind='hero',position={x:0,z:0}) {
    this.kind=kind;this.isHero=kind==='hero';this.isBoss=kind==='boss';this.isMage=kind==='mage';
    this.assetId=this.isHero?'Knight':this.isMage?'Skeleton_Mage':kind==='minion'?'Skeleton_Minion':'Skeleton_Warrior';
    this.model=assets.character(this.assetId);this.root=new THREE.Group();this.root.add(this.model);
    this.root.position.set(position.x,0.065,position.z);this.position=this.root.position;
    this.scale=this.isBoss?1.8:this.isHero?1.08:kind==='minion'?.92:1;
    this.model.scale.setScalar(this.scale);
    this.radius=this.isBoss?1.1:this.isHero?.58:.52;
    this.hp=100;this.maxHp=100;this.alive=true;this.deadTime=0;this.cooldown=.4;
    this.busy=0;this.hitAt=0;this.pending=null;this.spawnTime=0;this.slow=0;this.flash=0;
    this.velocity=new THREE.Vector3();this.materials=[];this.heading=0;this.targetHeading=0;this.animation='';this.extraMaterials=[];
    const hidden = new Set(['1H_Sword_Offhand','Rectangle_Shield','Round_Shield','Spike_Shield','2H_Sword']);
    this.model.traverse(o=>{
      if(hidden.has(o.name)&&this.isHero)o.visible=false;
      if(!o.isMesh)return;
      o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;
      o.material=o.material.clone();
      if(!this.isHero) {
        o.material.color.multiply(new THREE.Color(this.isBoss?'#9fc7c2':this.isMage?'#b8a0cc':'#a4bbb0'));
        o.material.roughness=.87;
        if(/eyes/i.test(o.name)){o.material.emissive.set(this.isMage?'#ee328a':'#df764b');o.material.emissiveIntensity=2.5;}
      } else {o.material.roughness=.55;o.material.metalness=.18;}
      this.materials.push({m:o.material,emissive:o.material.emissive.clone(),intensity:o.material.emissiveIntensity??1});
    });
    if(!this.isHero&&!this.isMage){
      const hand=findNode(this.model,'handslot.r');
      if(hand){const sword=assets.weapon(this.isBoss);sword.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.color.multiply(new THREE.Color('#9cabaa'));this.extraMaterials.push(o.material);}});hand.add(sword);}
    }
    this.mixer=new THREE.AnimationMixer(this.model);this.actions=new Map();
    this.clips=new Map(assets.model(this.assetId).animations.map(clip=>[clip.name,clip]));
    this.play(this.isHero?'Idle':'Idle_Combat');
  }
  play(name,{once=false,duration=null,fade=.12}={}) {
    const clip=this.clips.get(name)||this.clips.get('Idle');if(!clip)return;
    if(this.animation===name&&!once)return;
    let next=this.actions.get(clip.name);if(!next){next=this.mixer.clipAction(clip);this.actions.set(clip.name,next);}
    const previous=this.current;this.animation=name;this.current=next;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(duration?next.getClip().duration/duration:1);
    next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;
    next.play();if(previous&&previous!==next)previous.crossFadeTo(next,fade,false);
  }
  act(name,duration,hitAt,pending) { if(!this.alive)return;this.busy=duration;this.hitAt=duration-hitAt;this.pending=pending;this.play(name,{once:true,duration,fade:.07}); }
  face(target) {this.targetHeading=Math.atan2(target.x-this.position.x,target.z-this.position.z);}
  move(dx,dz,speed,dt) {
    if(!this.alive||this.spawnTime>0)return;
    const len=Math.hypot(dx,dz);if(len<.001)return;
    this.targetHeading=Math.atan2(dx,dz);const slow=this.slow>0?.38:1;
    this.position.x=clamp(this.position.x+dx/len*speed*dt*slow,-12.8,12.8);
    this.position.z=clamp(this.position.z+dz/len*speed*dt*slow,-10.3,10.3);
    if(this.busy<=0)this.play('Running_A');
  }
  idle(){if(this.alive&&this.busy<=0&&this.spawnTime<=0)this.play(this.isHero?'Idle':'Idle_Combat');}
  tick(dt) {
    this.mixer.update(dt*(this.slow>0&&!this.isHero?.6:1));
    this.flash=Math.max(0,this.flash-dt*5.5);this.slow=Math.max(0,this.slow-dt);
    for(const {m,emissive,intensity}of this.materials){
      m.emissive.copy(emissive);m.emissiveIntensity=intensity;
      if(this.flash>0){m.emissive.lerp(reusableColor.set('#fff3d2'),this.flash);m.emissiveIntensity=2.4;}
      else if(this.slow>0){m.emissive.lerp(reusableColor.set('#1994bf'),.28);m.emissiveIntensity=.9;}
    }
    let da=this.targetHeading-this.heading;da=Math.atan2(Math.sin(da),Math.cos(da));this.heading+=da*Math.min(1,dt*17);this.model.rotation.y=this.heading;
    this.position.x=clamp(this.position.x+this.velocity.x*dt,-13,13);this.position.z=clamp(this.position.z+this.velocity.z*dt,-10.5,10.5);this.velocity.multiplyScalar(Math.exp(-dt*9));
    if(!this.alive){this.deadTime+=dt;if(this.deadTime>1.7)this.position.y-=dt*.8;return;}
    this.cooldown=Math.max(0,this.cooldown-dt);this.spawnTime=Math.max(0,this.spawnTime-dt);
    if(this.busy>0){this.busy=Math.max(0,this.busy-dt);if(this.pending&&this.busy<=this.hitAt){const event=this.pending;this.pending=null;event();}if(this.busy===0)this.idle();}
  }
  die() {if(!this.alive)return;this.alive=false;this.pending=null;this.busy=0;this.velocity.multiplyScalar(.3);this.play(this.isHero?'Death_A':'Death_C_Skeletons',{once:true,duration:this.isHero?1.6:1.4,fade:.06});}
  dispose(){this.root.removeFromParent();this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model);for(const {m}of this.materials)m.dispose();for(const m of this.extraMaterials)m.dispose();}
}
