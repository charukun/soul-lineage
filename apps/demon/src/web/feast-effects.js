import * as T from 'three';
import {BITE_BEATS,feastEnvelope,feastReward,FEAST_SECONDS} from './feast-state.js';
import {devourInteractionFrame,devourInteractionSide,samplePreyMotion} from './devour-motion.js';

const PARTICLES=84,SEAL_STEPS=24;
const clamp=x=>Math.max(0,Math.min(1,x));
function makeSealGeometry(){
 const points=[];
 for(let i=0;i<SEAL_STEPS;i++){
  const a=i/SEAL_STEPS*Math.PI*2,b=(i+1)/SEAL_STEPS*Math.PI*2;
  points.push(Math.cos(a),0,Math.sin(a),Math.cos(b),0,Math.sin(b));
  if(i%4===0){points.push(Math.cos(a)*.32,0,Math.sin(a)*.32,Math.cos(a)*.92,0,Math.sin(a)*.92);}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));return geometry;
}
/** Fixed preallocated visual budget: feeding never creates geometry, materials or timers. */
export class FeastEffects {
 constructor(scene,texture){
  this.scene=scene;this.baseFogDensity=Number.isFinite(scene.fog?.density)?scene.fog.density:null;this.baseBackground=scene.background?.isColor?scene.background.clone():null;
  this.worldLights=scene.children.filter(o=>o.isHemisphereLight||o.isDirectionalLight).map(light=>({light,intensity:light.intensity}));
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
  this.seal=new T.LineSegments(makeSealGeometry(),new T.LineBasicMaterial({color:0x78c69b,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending}));this.seal.frustumCulled=false;this.root.add(this.seal);
  this.eclipseCore=new T.Sprite(new T.SpriteMaterial({color:0x000508,transparent:true,opacity:0,depthWrite:false,depthTest:true}));this.eclipseCore.renderOrder=3;this.root.add(this.eclipseCore);
  this.eclipseRim=new T.Sprite(new T.SpriteMaterial({map:texture,color:0xc8f8da,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending}));this.eclipseRim.renderOrder=4;this.root.add(this.eclipseRim);
  this.beacon=new T.Mesh(new T.RingGeometry(.72,.80,40),new T.MeshBasicMaterial({color:0xe3bf83,transparent:true,opacity:.7,depthWrite:false,side:T.DoubleSide}));
  this.beacon.rotation.x=-Math.PI/2;scene.add(this.beacon);
  this.light=new T.PointLight(0x9effcd,0,7,2);scene.add(this.light);
  this.reset();
 }
 applyWorldVeil(value){
  const v=clamp(value);
  if(this.scene.fog&&this.baseFogDensity!==null)this.scene.fog.density=this.baseFogDensity*(1+v*.72);
  if(this.baseBackground&&this.scene.background?.isColor)this.scene.background.copy(this.baseBackground).multiplyScalar(1-v*.34);
  for(const {light,intensity} of this.worldLights)light.intensity=intensity*(1-v*.48);
 }
 reset(){
  this.release=null;this.root.visible=false;this.beacon.visible=false;this.light.intensity=0;this.state=feastEnvelope(null);this.applyWorldVeil(0);
  this.seal.visible=false;this.seal.material.opacity=0;this.eclipseCore.visible=false;this.eclipseRim.visible=false;this.eclipseCore.material.opacity=0;this.eclipseRim.material.opacity=0;
 }
 event(e){if(e.type!=='consume')return;this.release={at:e.at,reward:feastReward(e),x:e.npc.x,z:e.npc.z};}
 update(game,{reducedMotion=false,target=null,active=true}={}){
  const p=game.player,progress=active&&!game.finished?p.devourProgress:null;
  const age=active&&!game.finished&&this.release?game.time-this.release.at:Infinity;
  if(age>=FEAST_SECONDS)this.release=null;
  const s=this.state=feastEnvelope(progress,age,{reducedMotion});this.applyWorldVeil(active?s.veil:0);
  this.root.visible=active&&(s.feeding||s.release);this.beacon.visible=active&&!!target;
  if(target){this.beacon.position.set(target.npc.x,.045,target.npc.z);this.beacon.scale.setScalar(target.npc.dead?1:1.15);this.beacon.material.opacity=.55+Math.sin(game.time*3)*.15;}
  const intensity=this.release?.reward?.kind==='form'?1.25:this.release?.reward?.kind==='memory'?1:.76;
  this.light.intensity=active?(s.charge*8+s.eclipse*26+s.torrent*18+s.bloom*38*intensity):0;
  if(!this.root.visible){this.light.position.set(p.x,1.5,p.z);this.seal.visible=false;this.eclipseCore.visible=false;this.eclipseRim.visible=false;return s;}
  const color=this.release?.reward?.color||0x9effcd;
  this.souls.material.color.setHex(color);this.core.material.color.setHex(color);this.light.color.setHex(color);this.seal.material.color.setHex(this.release?.reward?.color||0x78c69b);this.eclipseRim.material.color.setHex(this.release?.reward?.color||0xc8f8da);
  const n=game.devour?.npc,capture=n?.capturedBy,preyMotion=capture&&Number.isFinite(progress)?samplePreyMotion(progress,1,1,devourInteractionSide(capture)):null;
  const interaction=capture&&preyMotion?devourInteractionFrame(n,capture,preyMotion):null;
  const yaw=capture?.yaw??p.yaw??0,mouth=interaction?.mouth||{x:p.x+Math.sin(yaw)*.34,y:1.5,z:p.z+Math.cos(yaw)*.34};
  const from=interaction?.upper||{x:n?.x??p.x,y:.16,z:n?.z??p.z},bitePoint=interaction?.bite||from,actorScale=interaction?.predatorScale||Math.max(.28,Number(p.growthScale)||1);
  this.light.position.set(mouth.x,mouth.y,mouth.z);

  if(s.feeding){
   const center=interaction?.root||{x:n?.x??p.x,z:n?.z??p.z};
   this.seal.visible=s.omen>.015||s.bind>.015||s.torrent>.05;this.seal.position.set(center.x,.028,center.z);this.seal.rotation.set(0,reducedMotion?0:game.time*(.16+s.bind*.34),0);
   const sealScale=(.72+Math.min(actorScale,2.4)*.22)*(1+s.bind*.48+s.torrent*.24);this.seal.scale.setScalar(sealScale);this.seal.material.opacity=Math.min(.82,s.omen*.7+s.bind*.46+s.torrent*.24);
  }else{
   this.seal.visible=s.crown>.015;this.seal.position.set(p.x,Math.max(1.55,(Number(p.growthScale)||1)*1.75),p.z);this.seal.rotation.set(reducedMotion?0:.20,reducedMotion?0:game.time*.62,0);
   this.seal.scale.setScalar((1+s.crown*1.35)*Math.max(.75,Math.min(2.6,(Number(p.growthScale)||1)*.62)));this.seal.material.opacity=s.crown*.78*intensity;
  }

  const eclipseVisible=s.feeding&&s.eclipse>.015;this.eclipseCore.visible=eclipseVisible;this.eclipseRim.visible=eclipseVisible;
  if(eclipseVisible){
   const behind=.10*Math.max(.7,Math.min(2.3,actorScale)),ex=mouth.x-Math.sin(yaw)*behind,ez=mouth.z-Math.cos(yaw)*behind,base=Math.max(.48,Math.min(3.6,actorScale*1.05));
   this.eclipseCore.position.set(ex,mouth.y,ez);this.eclipseRim.position.copy(this.eclipseCore.position);
   this.eclipseCore.scale.setScalar(base*(.82+s.eclipse*.42));this.eclipseRim.scale.setScalar(base*(1.30+s.eclipse*.62));
   this.eclipseCore.material.opacity=s.eclipse*(reducedMotion?.48:.68);this.eclipseRim.material.opacity=s.eclipse*.64;this.eclipseRim.material.rotation=reducedMotion?0:game.time*.17;
  }

  this.core.position.set(mouth.x,mouth.y,mouth.z);this.core.scale.setScalar(s.feeding?.65+s.charge*.72+s.eclipse*.72+s.torrent*.42:1+s.bloom*2.8*intensity);
  this.core.material.opacity=s.feeding?Math.min(.82,s.charge*.25+s.eclipse*.38+s.torrent*.26):s.bloom*.66;
  this.souls.material.opacity=s.feeding?Math.min(1,s.omen*.28+s.charge*.62+s.eclipse*.38+s.torrent*.46):s.bloom;
  this.souls.material.size=reducedMotion?.22:s.feeding?.25+s.eclipse*.09+s.torrent*.05:.36;
  const chest={x:p.x,y:Math.max(.48,actorScale*1.02),z:p.z};
  for(let i=0;i<PARTICLES;i++){
   const a=i*2.399963,j=i%7/7;let x,y,z;
   if(s.feeding&&i<24&&(s.omen>.03||s.bind>.03)&&progress<.46){
    const center=interaction?.root||from,spin=a+(reducedMotion?.12:game.time*.85),r=(.28+(i%6)*.065)*(1+s.bind*.28);
    x=center.x+Math.cos(spin)*r;z=center.z+Math.sin(spin)*r;y=.035+(i%3)*.018+s.bind*.08*Math.sin(a+game.time);
   }else if(s.feeding&&i>=60&&s.torrent>.04){
    const q=(i-60)/(PARTICLES-60),spin=a+(reducedMotion?game.time:game.time*4.8)+q*5.5,r=(.12+.54*(1-q))*(.72+Math.min(actorScale,2.2)*.22)*(1-s.torrent*.24);
    x=chest.x+Math.cos(spin)*r;z=chest.z+Math.sin(spin)*r;y=.18+q*Math.max(.35,chest.y-.12)+Math.sin(spin*1.3)*.06*s.torrent;
   }else if(s.feeding){
    const t=(clamp(progress)*2.7+i/PARTICLES)%1,spiral=Math.sin(t*Math.PI)*(.15+j*.22),spin=a+t*(reducedMotion?4.5:9);
    x=from.x+(mouth.x-from.x)*t+Math.cos(spin)*spiral;z=from.z+(mouth.z-from.z)*t+Math.sin(spin)*spiral;y=from.y+(mouth.y-from.y)*t+Math.sin(t*Math.PI)*(.24+j*.38);
   }else{
    const t=clamp(age/(1.05+j)),r=(.12+(1-Math.pow(1-t,3))*(1.25+j*1.8)*intensity)*(reducedMotion?.65:1);
    x=p.x+Math.cos(a+t*1.4)*r;z=p.z+Math.sin(a+t*1.4)*r;y=.25+(Math.sin(t*Math.PI)*1.8+t*.6)*(1+j)+s.crown*.22;
   }
   this.positions.set([x,y,z],i*3);
  }
  this.souls.geometry.attributes.position.needsUpdate=true;

  for(const [i,ring] of this.rings.entries()){
   const bitePhase=s.feeding?(progress-BITE_BEATS[i])/.09:Infinity;
   if(s.feeding&&Math.abs(bitePhase)<1){
    const t=(bitePhase+1)/2,scale=bitePhase<0?1.35-(bitePhase+1)*.95:.40+bitePhase*1.25;
    ring.visible=true;ring.position.set(bitePoint.x,bitePoint.y,bitePoint.z);ring.rotation.set(0,yaw,0);ring.scale.setScalar(scale*(reducedMotion?.76:1));ring.material.opacity=Math.sin(t*Math.PI)*.9;
   }else{
    const t=clamp((age-i*.16)/1.35);ring.visible=s.release&&age>=i*.16;ring.rotation.set(-Math.PI/2,0,0);ring.position.set(this.release?.x??p.x,.025+i*.012,this.release?.z??p.z);ring.scale.setScalar(.35+(1-Math.pow(1-t,3))*(i?4.7:3.5)*(reducedMotion?.7:1));ring.material.opacity=(1-t)*.8;
   }
  }

  this.wisps.material.opacity=s.feeding?Math.min(.86,s.charge*.30+s.eclipse*.35+s.torrent*.68):s.bloom*.58;
  for(let strand=0;strand<3;strand++)for(let i=0;i<28;i++)for(let end=0;end<2;end++){
   const t=(i+end)/28;let x,y,z;
   if(s.feeding){
    const braid=(.045+.11*Math.sin(t*Math.PI))*(1+s.torrent*.65)*(reducedMotion?.58:1),angle=strand*Math.PI*2/3+t*6.4+game.time*(reducedMotion?.6:2.1);
    if(s.torrent>.12&&t>.62){const u=(t-.62)/.38;x=mouth.x+(chest.x-mouth.x)*u+Math.cos(angle)*braid;z=mouth.z+(chest.z-mouth.z)*u+Math.sin(angle)*braid;y=mouth.y+(chest.y-mouth.y)*u+Math.sin(t*Math.PI)*.08;}
    else{const u=s.torrent>.12?Math.min(1,t/.62):t;x=from.x+(mouth.x-from.x)*u+Math.cos(angle)*braid;z=from.z+(mouth.z-from.z)*u+Math.sin(angle)*braid;y=from.y+(mouth.y-from.y)*u+Math.sin(u*Math.PI)*(.18+strand*.045);}
   }else{
    const angle=strand*Math.PI*2/3+t*6.3+game.time*2.3,radius=(1.05+s.bloom*.4)*(1-t*.66);x=p.x+Math.cos(angle)*radius;z=p.z+Math.sin(angle)*radius;y=.07+t*2.65;
   }
   this.wispPositions.set([x,y,z],(strand*56+i*2+end)*3);
  }
  this.wisps.geometry.attributes.position.needsUpdate=true;
  return s;
 }
 dispose(){
  this.applyWorldVeil(0);this.root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  this.root.removeFromParent();this.beacon.geometry.dispose();this.beacon.material.dispose();this.beacon.removeFromParent();this.light.removeFromParent();
 }
}
