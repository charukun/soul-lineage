import * as T from 'three';
import {feastEnvelope,feastReward,FEAST_SECONDS} from './feast-state.js';

const PARTICLES=84;
const clamp=x=>Math.max(0,Math.min(1,x));
/** Six preallocated draw calls; no per-bite meshes, textures or timers. */
export class FeastEffects {
 constructor(scene,texture){
  this.root=new T.Group();this.root.name='feast-effects';scene.add(this.root);
  this.positions=new Float32Array(PARTICLES*3);
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(this.positions,3));
  this.souls=new T.Points(geometry,new T.PointsMaterial({map:texture,color:0x9effcd,size:.32,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
  this.souls.frustumCulled=false;this.root.add(this.souls);
  this.rings=Array.from({length:2},(_,i)=>{
   const ring=new T.Mesh(new T.RingGeometry(.94,1,64),new T.MeshBasicMaterial({color:i?0x8bf4ba:0xffcc86,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));
   ring.rotation.x=-Math.PI/2;this.root.add(ring);return ring;
  });
  this.core=new T.Sprite(new T.SpriteMaterial({map:texture,color:0xbaffd3,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending}));this.root.add(this.core);
  this.wisps=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:0xc2ffe1,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending}));
  this.wispPositions=new Float32Array(3*28*2*3);this.wisps.geometry.setAttribute('position',new T.BufferAttribute(this.wispPositions,3));this.wisps.frustumCulled=false;this.root.add(this.wisps);
  this.beacon=new T.Mesh(new T.RingGeometry(.72,.80,40),new T.MeshBasicMaterial({color:0xe3bf83,transparent:true,opacity:.7,depthWrite:false,side:T.DoubleSide}));
  this.beacon.rotation.x=-Math.PI/2;scene.add(this.beacon);
  this.light=new T.PointLight(0x9effcd,0,7,2);scene.add(this.light);
  this.reset();
 }
 reset(){this.release=null;this.root.visible=false;this.beacon.visible=false;this.light.intensity=0;this.state=feastEnvelope(null);}
 event(e){if(e.type!=='consume')return;this.release={at:e.at,reward:feastReward(e),x:e.npc.x,z:e.npc.z};}
 update(game,{reducedMotion=false,target=null,active=true}={}){
  const p=game.player,progress=active&&!game.finished?p.devourProgress:null;
  const age=active&&!game.finished&&this.release?game.time-this.release.at:Infinity;
  if(age>=FEAST_SECONDS)this.release=null;
  const s=this.state=feastEnvelope(progress,age,{reducedMotion});
  this.root.visible=active&&(s.feeding||s.release);this.beacon.visible=active&&!!target;
  if(target){this.beacon.position.set(target.npc.x,.045,target.npc.z);this.beacon.scale.setScalar(target.npc.dead?1:1.15);this.beacon.material.opacity=.55+Math.sin(game.time*3)*.15;}
  const intensity=this.release?.reward?.kind==='form'?1.25:this.release?.reward?.kind==='memory'?1:.76;
  this.light.intensity=active?(s.charge*10+s.bloom*38*intensity):0;this.light.position.set(p.x,1.5,p.z);
  if(!this.root.visible)return s;
  const color=this.release?.reward?.color||0x9effcd;
  this.souls.material.color.setHex(color);this.core.material.color.setHex(color);this.light.color.setHex(color);
  const yaw=p.yaw||0,mouth={x:p.x+Math.sin(yaw)*.34,y:s.feeding?.85:1.5,z:p.z+Math.cos(yaw)*.34};
  const n=game.devour?.npc,from={x:n?.x??p.x,z:n?.z??p.z};
  this.core.position.set(mouth.x,mouth.y,mouth.z);this.core.scale.setScalar(s.feeding?.7+s.charge*.85+s.bite*.5:1+s.bloom*2.8*intensity);
  this.core.material.opacity=s.feeding?s.charge*.32+s.bite*.27:s.bloom*.66;
  this.souls.material.opacity=s.feeding?s.charge*.9:s.bloom;
  this.souls.material.size=reducedMotion?.23:s.feeding?.28:.36;
  for(let i=0;i<PARTICLES;i++){
   const a=i*2.399963,j=i%7/7;let x,y,z;
   if(s.feeding){
    const t=(clamp(progress)*2.7+i/PARTICLES)%1,spiral=Math.sin(t*Math.PI)*(.18+j*.25),spin=a+t*9;
    x=from.x+(mouth.x-from.x)*t+Math.cos(spin)*spiral;
    z=from.z+(mouth.z-from.z)*t+Math.sin(spin)*spiral;
    y=.16+(mouth.y-.16)*t+Math.sin(t*Math.PI)*(.48+j*.6);
   }else{
    const t=clamp(age/(1.05+j)),r=(.12+(1-Math.pow(1-t,3))*(1.25+j*1.8)*intensity)*(reducedMotion?.65:1);
    x=p.x+Math.cos(a+t*1.4)*r;z=p.z+Math.sin(a+t*1.4)*r;
    y=.25+(Math.sin(t*Math.PI)*1.8+t*.6)*(1+j);
   }
   this.positions.set([x,y,z],i*3);
  }
  this.souls.geometry.attributes.position.needsUpdate=true;
  for(const [i,ring] of this.rings.entries()){
   const t=clamp((age-i*.16)/1.35);ring.visible=s.release&&age>=i*.16;
   ring.position.set(this.release?.x??p.x,.025+i*.012,this.release?.z??p.z);
   ring.scale.setScalar(.35+(1-Math.pow(1-t,3))*(i?4.7:3.5)*(reducedMotion?.7:1));
   ring.material.opacity=(1-t)*.8;
  }
  this.wisps.material.opacity=s.feeding?s.charge*.48:s.bloom*.58;
  for(let strand=0;strand<3;strand++)for(let i=0;i<28;i++)for(let end=0;end<2;end++){
   const t=(i+end)/28,angle=strand*Math.PI*2/3+t*6.3+game.time*2.3;
   const radius=(s.feeding?.55:1.05+s.bloom*.4)*(1-t*.66);
   this.wispPositions.set([p.x+Math.cos(angle)*radius,.07+t*(s.feeding?1.45:2.65),p.z+Math.sin(angle)*radius],(strand*56+i*2+end)*3);
  }
  this.wisps.geometry.attributes.position.needsUpdate=true;
  return s;
 }
 dispose(){
  this.root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  this.root.removeFromParent();this.beacon.geometry.dispose();this.beacon.material.dispose();this.beacon.removeFromParent();this.light.removeFromParent();
 }
}
