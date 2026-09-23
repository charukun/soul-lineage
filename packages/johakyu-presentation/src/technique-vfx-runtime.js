import * as THREE from 'three';

export const TECHNIQUE_VFX_DEFINITIONS=Object.freeze({
 'lib-tktk01-light1':Object.freeze({role:'aura',label:'Light1 aura'}),
 slash:Object.freeze({role:'slash',label:'weapon ribbon'}),
 impact:Object.freeze({role:'impact',label:'impact bloom'}),
 'lib-effectmaterials-parts-hit01':Object.freeze({role:'debris',label:'hit debris'})
});

const clamp=THREE.MathUtils.clamp;
const asVector=value=>value?.isVector3?value.clone():new THREE.Vector3(Number(value?.x)||0,Number(value?.y)||0,Number(value?.z)||0);
const vividColor=value=>new THREE.Color(value||'#f7cf80').multiplyScalar(2.15);

function makeParticleTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');
 const gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.18,'rgba(255,255,255,.92)');gradient.addColorStop(.48,'rgba(255,255,255,.32)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;return texture;
}
function additiveMaterial(color,opacity=1,{side=THREE.DoubleSide}={}){
 return new THREE.MeshBasicMaterial({color:vividColor(color),transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,side,toneMapped:false});
}
function disposeNode(root){
 root.traverse(node=>{node.geometry?.dispose?.();const materials=node.material?(Array.isArray(node.material)?node.material:[node.material]):[];for(const material of materials)material?.dispose?.();});
}
function ribbonGeometry(trace){
 const rows=trace.filter(row=>row?.start&&row?.end);if(rows.length<2)return null;
 const positions=new Float32Array(rows.length*6),indices=[];
 rows.forEach((row,index)=>{const a=asVector(row.start),b=asVector(row.end),offset=index*6;positions.set([a.x,a.y,a.z,b.x,b.y,b.z],offset);if(index){const i=(index-1)*2;indices.push(i,i+1,i+2,i+1,i+3,i+2);}});
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function fallbackTrace(axis,yaw){
 if(!axis?.start||!axis?.end)return[];const current={start:asVector(axis.start),end:asVector(axis.end)},back=new THREE.Vector3(-Math.sin(yaw||0),0,-Math.cos(yaw||0)).multiplyScalar(.34);
 return[{start:current.start.clone().add(back),end:current.end.clone().add(back)},current];
}
function particleBurst({texture,random,count,color,size=0.18,speed=3.8,lift=2.4,spread=.12,direction=null,bias=0}){
 const positions=new Float32Array(count*3),velocities=[];
 for(let i=0;i<count;i++){
  const angle=random()*Math.PI*2,radius=random()*spread,y=(random()-.35)*spread;positions.set([Math.cos(angle)*radius,y,Math.sin(angle)*radius],i*3);
  const horizontal=speed*(.35+random()*.95),up=lift*(.35+random()*.95),velocity=new THREE.Vector3(Math.cos(angle)*horizontal,up,Math.sin(angle)*horizontal);
  const force=asVector(direction);force.y*=.35;if(force.lengthSq()>.0001)velocity.addScaledVector(force.normalize(),horizontal*clamp(bias,0,1.4));
  velocities.push(velocity);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const material=new THREE.PointsMaterial({color:vividColor(color),size,map:texture,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true,toneMapped:false});
 const points=new THREE.Points(geometry,material);
 return{node:points,material,tick(dt,gravity=4.8){const attr=geometry.getAttribute('position');for(let i=0;i<count;i++){const velocity=velocities[i];velocity.y-=gravity*dt;attr.setXYZ(i,attr.getX(i)+velocity.x*dt,attr.getY(i)+velocity.y*dt,attr.getZ(i)+velocity.z*dt);}attr.needsUpdate=true;}};
}

export function createTechniqueVfxRuntime({scene,random=Math.random}={}){
 if(!scene)throw Error('Technique VFX requires a Three.js scene');
 const texture=makeParticleTexture(),live=[],spawned=Object.fromEntries(Object.keys(TECHNIQUE_VFX_DEFINITIONS).map(id=>[id,0]));
 function remove(entry){scene.remove(entry.root);disposeNode(entry.root);}
 function track(root,life,update){const entry={root,life,max:life,update};scene.add(root);live.push(entry);while(live.length>40)remove(live.shift());return entry;}
 function aura(context){
  const scale=clamp(Number(context.scale)||1,.04,2.2),root=new THREE.Group();root.position.copy(asVector(context.origin));
  const cloud=particleBurst({texture,random,count:Math.max(18,Math.round(26*scale)),color:context.color,size:.11+.05*scale,speed:.35+.35*scale,lift:.7+.5*scale,spread:.36+.25*scale});root.add(cloud.node);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:vividColor(context.color),transparent:true,opacity:.72,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));sprite.position.y=.72;sprite.scale.setScalar(1.1+.65*scale);root.add(sprite);
  const light=new THREE.PointLight(context.color||'#f7cf80',3.8+4.5*scale,3.2+2.2*scale,2);light.position.y=.8;root.add(light);
  const life=context.stage==='afterglow'?.46:.28;
  return track(root,life,(entry,dt,f)=>{cloud.tick(dt,1.1);root.rotation.y+=dt*2.7;root.scale.setScalar(.82+.38*Math.sin(Math.min(1,f)*Math.PI));cloud.material.opacity=(1-f)*.86;sprite.material.opacity=(1-f)*.72;light.intensity=(1-f)*(3.8+4.5*scale);});
 }
 function slash(context){
  const scale=clamp(Number(context.scale)||1,.35,2.4),root=new THREE.Group(),trace=(context.trace?.length>1?context.trace:fallbackTrace(context.axis,context.yaw)).slice(-7),geometry=ribbonGeometry(trace);
  if(!geometry)return aura({...context,scale:scale*.55});
  const ribbon=additiveMaterial(context.color,.92);const mesh=new THREE.Mesh(geometry,ribbon);root.add(mesh);
  const tips=trace.map(row=>asVector(row.end));if(tips.length>1){const curve=new THREE.CatmullRomCurve3(tips,false,'centripetal'),coreGeometry=new THREE.TubeGeometry(curve,Math.max(4,tips.length*3),.018+.018*scale,5,false),coreMaterial=additiveMaterial('#fff7df',1);root.add(new THREE.Mesh(coreGeometry,coreMaterial));}
  const spark=particleBurst({texture,random,count:Math.max(12,Math.round(18*scale)),color:context.color,size:.085+.035*scale,speed:1.5+scale,lift:1.2,spread:.18});const tip=asVector(context.axis?.end||context.origin);spark.node.position.copy(tip);root.add(spark.node);
  const origin=asVector(context.origin),archetype=context.archetype||'flow';
  if(['sweep','heavy','counter'].includes(archetype)){
   const radius=(archetype==='heavy'?1.72:1.48)*scale,arc=new THREE.TorusGeometry(radius,.035+.035*scale,6,56,archetype==='counter'?Math.PI*.9:Math.PI*1.45),arcMat=additiveMaterial(context.color,.56);const wave=new THREE.Mesh(arc,arcMat);wave.position.copy(origin).add(new THREE.Vector3(0,.72,0));wave.rotation.set(Math.PI/2-.28,context.yaw||0,archetype==='heavy'?.48:.18);root.add(wave);
  }
  const light=new THREE.PointLight(context.color||'#f7cf80',5.5+4*scale,4.5+2*scale,2);light.position.copy(tip);root.add(light);
  const life=.22+(archetype==='heavy'?.12:archetype==='sweep'?.08:0);
  return track(root,life,(entry,dt,f)=>{spark.tick(dt,2.8);const fade=1-f;ribbon.opacity=fade*.92;spark.material.opacity=fade*.88;light.intensity=fade*(5.5+4*scale);for(const child of root.children)if(child.isMesh&&child!==mesh&&child.material?.opacity!==undefined)child.material.opacity=fade*(child.geometry?.type==='TubeGeometry'?1:.56);});
 }
 function impact(context){
  const scale=clamp(Number(context.scale)||1,.4,2.6),root=new THREE.Group();root.position.copy(asVector(context.origin));
  const direction=asVector(context.direction);direction.y*=.25;if(direction.lengthSq()<.0001)direction.set(0,0,1);direction.normalize();
  const flashMat=new THREE.SpriteMaterial({map:texture,color:vividColor(context.color),transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),flash=new THREE.Sprite(flashMat);flash.scale.setScalar(.46*scale);root.add(flash);
  const streakMat=additiveMaterial(context.color,.9),streak=new THREE.Mesh(new THREE.PlaneGeometry(1.4*scale,.075*scale),streakMat);streak.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),direction);root.add(streak);
  const coreMat=additiveMaterial('#fff8df',1),core=new THREE.Mesh(new THREE.PlaneGeometry(.82*scale,.025*scale),coreMat);core.quaternion.copy(streak.quaternion);core.position.addScaledVector(direction,.12*scale);root.add(core);
  const burst=particleBurst({texture,random,count:Math.max(16,Math.round(26*scale)),color:context.color,size:.08+.03*scale,speed:2.7+1.5*scale,lift:1.5+.55*scale,spread:.08*scale,direction,bias:.92});root.add(burst.node);
  const light=new THREE.PointLight(context.color||'#f7cf80',8+6*scale,3.8+2*scale,2);root.add(light);
  return track(root,.3+(context.finisher?.12:0),(entry,dt,f)=>{burst.tick(dt,5.2);const fade=1-f;flash.scale.setScalar(scale*(.42+.58*f));flashMat.opacity=Math.pow(fade,2);streak.scale.x=1+.8*f;streakMat.opacity=fade*.9;core.scale.x=1+.45*f;coreMat.opacity=fade;burst.material.opacity=fade;light.intensity=fade*(8+6*scale);});
 }
 function debris(context){
  const scale=clamp(Number(context.scale)||1,.08,1.6),count=Math.max(6,Math.round(13*scale)),root=new THREE.Group();root.position.copy(asVector(context.origin));
  const geometry=new THREE.TetrahedronGeometry(.055+.035*scale),material=new THREE.MeshBasicMaterial({color:new THREE.Color(context.color||'#f3e7d2').multiplyScalar(1.35),transparent:true,opacity:.92,depthWrite:false,toneMapped:false}),mesh=new THREE.InstancedMesh(geometry,material,count),dummy=new THREE.Object3D(),rows=[];
  const direction=asVector(context.direction);direction.y*=.2;if(direction.lengthSq()>.0001)direction.normalize();
  for(let i=0;i<count;i++){const angle=random()*Math.PI*2,v=new THREE.Vector3(Math.cos(angle)*(1.2+random()*2.3),1.2+random()*3.1,Math.sin(angle)*(1.2+random()*2.3));if(direction.lengthSq()>.0001)v.addScaledVector(direction,1.2+random()*2.2);rows.push({p:new THREE.Vector3(0,0,0),v,r:new THREE.Vector3(random()*4-2,random()*4-2,random()*4-2)});}root.add(mesh);
  return track(root,.58,(entry,dt,f)=>{for(let i=0;i<count;i++){const row=rows[i];row.v.y-=6.8*dt;row.p.addScaledVector(row.v,dt);dummy.position.copy(row.p);dummy.rotation.set(row.r.x*f,row.r.y*f,row.r.z*f);dummy.scale.setScalar(Math.max(.15,1-f*.62));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}mesh.instanceMatrix.needsUpdate=true;material.opacity=(1-f)*.92;});
 }
 const factories={aura,slash,impact,debris};
 function spawn(effectId,context={}){const definition=TECHNIQUE_VFX_DEFINITIONS[effectId];if(!definition)throw Error('Unmaterialized technique VFX: '+effectId);spawned[effectId]++;return factories[definition.role]({...context,effectId});}
 function update(dt){const step=Math.max(0,Math.min(.05,Number(dt)||0));for(let i=live.length-1;i>=0;i--){const entry=live[i];entry.life-=step;const f=clamp(1-entry.life/entry.max,0,1);entry.update?.(entry,step,f);if(entry.life<=0){remove(entry);live.splice(i,1);}}}
 function clear(){while(live.length)remove(live.pop());}
 function dispose(){clear();texture.dispose();}
 return Object.freeze({spawn,update,clear,dispose,metrics:()=>({active:live.length,spawned:{...spawned},materialized:Object.keys(TECHNIQUE_VFX_DEFINITIONS)})});
}
