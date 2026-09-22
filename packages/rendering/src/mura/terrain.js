import {riverX,naturalTrees,TERRAIN_SITES,defs,muraEntry} from '@soul/world/mura';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {partitionStaticInstances} from '../spatial-instances.js';
const fract=x=>x-Math.floor(x),rand=n=>fract(Math.sin(n*127.13+18.3)*41758.34);
export function flattenMuraModel(T,g){g.updateMatrixWorld(true);const bins=new Map();g.traverse(o=>{if(o.isMesh){const k=o.material.uuid;let b=bins.get(k);if(!b)bins.set(k,b={m:o.material,geos:[]});b.geos.push(o.geometry.clone().applyMatrix4(o.matrixWorld));}});const out=new T.Group();for(const b of bins.values()){
 const merged=mergeGeometries(b.geos,false);if(!merged)throw Error('Geometry merge failed');
 // An iframe owns different TypedArray constructors. Keep GPU buffers in its realm.
 const geo=new T.BufferGeometry();for(const [key,a] of Object.entries(merged.attributes))geo.setAttribute(key,new T.Float32BufferAttribute(a.array,a.itemSize,a.normalized));if(merged.index)geo.setIndex(new T.Uint32BufferAttribute(merged.index.array,1));merged.dispose();
 const m=new T.Mesh(geo,b.m);m.castShadow=m.receiveShadow=true;out.add(m);for(const x of b.geos)x.dispose();}return out;}

/** One terrain renderer for 宝満叡智 and visitors; host owns camera and simulation. */
export function createMuraTerrain({THREE:T,scene,outside,getProp,mat,createCanvas,layoutObjects=[]}){
const view={scene,outside,getProp},UP=new T.Vector3(0,1,0);
 const groundDetail=new T.Group();groundDetail.name='MuraGroundDetail';view.outside.add(groundDetail);
 const occupied=(x,z,pad=0)=>layoutObjects.some(o=>{if(o.phase&&o.phase!=='built')return false;const d=defs[o.kind];if(!d)return false;const r=Math.hypot((d.w||1)*.5,(d.d||1)*.5)+pad;return Math.hypot(x-o.x,z-o.z)<r;});
 const surfaceCanvas=createCanvas();surfaceCanvas.width=surfaceCanvas.height=512;const sx=surfaceCanvas.getContext('2d');sx.fillStyle='#8eaa70';sx.fillRect(0,0,512,512);
 for(let i=0;i<1300;i++){const x=rand(i+1701)*512,y=rand(i+2701)*512,r=.7+rand(i+3701)*3.4;const dark=rand(i+4701)>.52;sx.fillStyle=dark?'rgba(72,104,58,.24)':'rgba(186,202,132,.20)';sx.beginPath();sx.ellipse(x,y,r*1.8,r,.4+rand(i+5701)*2.2,0,Math.PI*2);sx.fill();}
 for(let i=0;i<680;i++){const x=rand(i+6101)*512,y=rand(i+7101)*512;sx.strokeStyle=rand(i+8101)>.5?'rgba(50,80,43,.26)':'rgba(212,221,157,.24)';sx.lineWidth=.45+rand(i+9101)*.85;sx.beginPath();sx.moveTo(x,y);sx.lineTo(x+(rand(i+10101)-.5)*4,y-1-rand(i+11101)*5);sx.stroke();}
 view.groundSurfaceTexture=new T.CanvasTexture(surfaceCanvas);view.groundSurfaceTexture.wrapS=view.groundSurfaceTexture.wrapT=T.RepeatWrapping;view.groundSurfaceTexture.repeat.set(28,28);view.groundSurfaceTexture.colorSpace=T.SRGBColorSpace;view.groundSurfaceTexture.anisotropy=4;
 const bumpCanvas=createCanvas();bumpCanvas.width=bumpCanvas.height=128;const bx=bumpCanvas.getContext('2d');bx.fillStyle='#888';bx.fillRect(0,0,128,128);for(let i=0;i<520;i++){const v=96+Math.floor(rand(i+12101)*74);bx.fillStyle=`rgb(${v},${v},${v})`;bx.fillRect(rand(i+13101)*128,rand(i+14101)*128,1+rand(i+15101)*3,1+rand(i+16101)*3);}view.groundBumpTexture=new T.CanvasTexture(bumpCanvas);view.groundBumpTexture.wrapS=view.groundBumpTexture.wrapT=T.RepeatWrapping;view.groundBumpTexture.repeat.set(42,42);
 const dirtCanvas=createCanvas();dirtCanvas.width=dirtCanvas.height=128;const dx=dirtCanvas.getContext('2d');dx.fillStyle='#b49a70';dx.fillRect(0,0,128,128);for(let i=0;i<260;i++){const x=rand(i+17101)*128,y=rand(i+18101)*128,r=.5+rand(i+19101)*2.2;dx.fillStyle=rand(i+20101)>.5?'rgba(91,72,50,.22)':'rgba(219,193,143,.22)';dx.beginPath();dx.arc(x,y,r,0,Math.PI*2);dx.fill();}view.dirtTexture=new T.CanvasTexture(dirtCanvas);view.dirtTexture.wrapS=view.dirtTexture.wrapT=T.RepeatWrapping;view.dirtTexture.repeat.set(5,18);view.dirtTexture.colorSpace=T.SRGBColorSpace;
 const pathPositions=[],pathUvs=[];let pathDistance=0,pathSegments=0;
 const addRibbon=(points,width)=>{
  if(points.length<2)return;
  let distance=0;
  for(let i=0;i<points.length-1;i++){
   const a=points[i],b=points[i+1],vx=b.x-a.x,vz=b.z-a.z,len=Math.max(.001,Math.hypot(vx,vz)),nx=-vz/len,nz=vx/len;
   const wa=(typeof width==='function'?width(i,a):width)*.5,wb=(typeof width==='function'?width(i+1,b):width)*.5;
   const ax1=a.x+nx*wa,az1=a.z+nz*wa,ax2=a.x-nx*wa,az2=a.z-nz*wa,bx1=b.x+nx*wb,bz1=b.z+nz*wb,bx2=b.x-nx*wb,bz2=b.z-nz*wb;
   const u0=distance*.16,u1=(distance+len)*.16;
   pathPositions.push(ax1,.022,az1,ax2,.022,az2,bx1,.022,bz1,bx1,.022,bz1,ax2,.022,az2,bx2,.022,bz2);
   pathUvs.push(0,u0,1,u0,0,u1,0,u1,1,u0,1,u1);distance+=len;pathSegments++;
  }
  pathDistance+=distance;
 };
 const mainPoints=[];for(let z=-34,i=0;z<=38;z+=2.15,i++)mainPoints.push({x:Math.sin(z*.105)*1.15+Math.sin(z*.037)*.55+(rand(i+21101)-.5)*.28,z});
 addRibbon(mainPoints,(i)=>2.15+rand(i+22101)*.45);
 const mainXAt=z=>Math.sin(z*.105)*1.15+Math.sin(z*.037)*.55;
 for(const o of layoutObjects.filter(o=>(!o.phase||o.phase==='built')&&defs[o.kind]?.building).slice(0,30)){
   const entry=muraEntry(o),mx=mainXAt(entry.z),distance=Math.abs(entry.x-mx);if(Math.abs(entry.z)>44||distance>34)continue;
   const bendX=entry.x+(mx-entry.x)*.58,bendZ=entry.z+(Math.sin((o.x+o.z)*.19)*.55);
   addRibbon([entry,{x:bendX,z:bendZ},{x:mx,z:entry.z}],(i)=>i===0?1.15:.92);
 }
 const pathGeo=new T.BufferGeometry();pathGeo.setAttribute('position',new T.Float32BufferAttribute(pathPositions,3));pathGeo.setAttribute('uv',new T.Float32BufferAttribute(pathUvs,2));pathGeo.computeVertexNormals();
 const pathMat=new T.MeshStandardMaterial({color:0xb69b70,map:view.dirtTexture,roughness:1,transparent:true,opacity:.76,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
 const dirt=new T.Mesh(pathGeo,pathMat);dirt.receiveShadow=true;dirt.userData.muraDirtPaths=true;groundDetail.add(dirt);
 const grassGeo=new T.ConeGeometry(.13,.55,3),grassMat=new T.MeshStandardMaterial({color:0x567d45,roughness:1,vertexColors:true});const grassRows=[];for(let i=0;i<420&&grassRows.length<220;i++){const a=rand(i+19101)*Math.PI*2,r=7+Math.pow(rand(i+20101),.6)*92,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.abs(x-riverX(z))<10||occupied(x,z,1.8))continue;grassRows.push({x,z,s:.65+rand(i+21101)*.9,yaw:rand(i+22101)*Math.PI});}
 const grass=new T.InstancedMesh(grassGeo,grassMat,grassRows.length),gm=new T.Matrix4(),gq=new T.Quaternion(),gc=new T.Color();grassRows.forEach((p,i)=>{gq.setFromAxisAngle(UP,p.yaw);gm.compose(new T.Vector3(p.x,.25*p.s,p.z),gq,new T.Vector3(p.s,p.s,p.s));grass.setMatrixAt(i,gm);gc.set(i%3===0?0x6f9655:i%3===1?0x527a44:0x83a861);grass.setColorAt(i,gc);});grass.receiveShadow=true;grass.userData.muraGrassTufts=true;groundDetail.add(grass);
 const pebbleGeo=new T.DodecahedronGeometry(.18,0),pebbleMat=new T.MeshStandardMaterial({color:0x9c9787,roughness:.96,vertexColors:true});const pebbleRows=[];for(let i=0;i<250&&pebbleRows.length<92;i++){const a=rand(i+23101)*Math.PI*2,r=5+Math.pow(rand(i+24101),.62)*86,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.abs(x-riverX(z))<9||occupied(x,z,.7))continue;pebbleRows.push({x,z,s:.5+rand(i+25101)*1.45,yaw:rand(i+26101)*Math.PI});}
 const pebbles=new T.InstancedMesh(pebbleGeo,pebbleMat,pebbleRows.length),pm=new T.Matrix4(),pq=new T.Quaternion(),pc=new T.Color();pebbleRows.forEach((p,i)=>{pq.setFromAxisAngle(UP,p.yaw);pm.compose(new T.Vector3(p.x,.07*p.s,p.z),pq,new T.Vector3(p.s*1.15,p.s*.55,p.s));pebbles.setMatrixAt(i,pm);pc.set(i%3===0?0xb8b09a:i%3===1?0x858b7d:0xaaa18e);pebbles.setColorAt(i,pc);});pebbles.castShadow=false;pebbles.receiveShadow=true;pebbles.userData.muraPebbles=true;groundDetail.add(pebbles);
 view.terrainDetailSnapshot=()=>Object.freeze({dirtPatches:pathSegments,pathDistance:Math.round(pathDistance),grassTufts:grassRows.length,pebbles:pebbleRows.length,groundTexture:true});
 const groundingBytes=new Uint8Array(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4,d=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5),a=Math.max(0,1-d*d);groundingBytes[i]=groundingBytes[i+1]=groundingBytes[i+2]=255;groundingBytes[i+3]=Math.round(a*a*112);}
 const groundingTexture=new T.DataTexture(groundingBytes,32,32,T.RGBAFormat);groundingTexture.needsUpdate=true;groundingTexture.magFilter=groundingTexture.minFilter=T.LinearFilter;
 const groundingGeo=new T.PlaneGeometry(1,1);groundingGeo.rotateX(-Math.PI/2);const groundingMat=new T.MeshBasicMaterial({map:groundingTexture,color:0x39453a,transparent:true,opacity:.58,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
 view.grounding=new T.InstancedMesh(groundingGeo,groundingMat,256);view.grounding.name='MuraGrounding';view.grounding.frustumCulled=false;view.grounding.count=0;view.outside.add(view.grounding);
 view.syncGrounding=function syncGrounding(roots=[],qualityLevel=0){const cap=qualityLevel>=3?48:qualityLevel>=2?96:qualityLevel>=1?160:256,m=new T.Matrix4(),box=new T.Box3(),size=new T.Vector3(),center=new T.Vector3();let count=0;for(const root of roots){if(!root?.visible)continue;for(const node of root.children||[]){if(count>=cap)break;box.setFromObject(node);if(box.isEmpty())continue;box.getSize(size);box.getCenter(center);if(size.x<.18||size.z<.18||size.x>34||size.z>34)continue;const sx=Math.min(12,Math.max(.45,size.x*.58)),sz=Math.min(12,Math.max(.45,size.z*.58));m.makeScale(sx,1,sz);m.setPosition(center.x,.034,center.z);view.grounding.setMatrixAt(count++,m);}if(count>=cap)break;}view.grounding.count=count;if(count)view.grounding.instanceMatrix.needsUpdate=true;return count;};

 const groundMaterial=new T.MeshStandardMaterial({color:0xffffff,map:view.groundSurfaceTexture,bumpMap:view.groundBumpTexture,bumpScale:.075,roughness:.93,metalness:0,vertexColors:true});const ground=new T.Mesh(new T.PlaneGeometry(1100,1100,100,100),groundMaterial);const gp=ground.geometry.attributes.position,colors=[];for(let i=0;i<gp.count;i++){const x=gp.getX(i),z=gp.getY(i);const f=.5+.20*Math.sin(x*.083+Math.sin(z*.067))+.17*Math.cos(z*.074+x*.026);const c=new T.Color(0x779864).lerp(new T.Color(0xb5c68c),f);colors.push(c.r,c.g,c.b);}ground.geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));ground.material.color.set(0xffffff);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.position.y=-.05;ground.material.bumpScale=.075;view.outside.add(ground);
 const verts=[],uv=[];
 for(let z=-480;z<480;z+=5){const x0=riverX(z),x1=riverX(z+5),w=7.1;verts.push(x0-w,.015,z,x1-w,.015,z+5,x0+w,.015,z,x0+w,.015,z,x1-w,.015,z+5,x1+w,.015,z+5);uv.push(0,z/8,0,(z+5)/8,1,z/8,1,z/8,0,(z+5)/8,1,(z+5)/8);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
 view.waterMat=new T.ShaderMaterial({uniforms:{time:{value:0},tint:{value:new T.Color(0x65a4ae)}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform float time;uniform vec3 tint;varying vec2 vUv;void main(){float r=sin(vUv.y*14.+time*.8+sin(vUv.x*15.))*sin(vUv.x*37.+vUv.y*6.-time);float glint=pow(max(r,0.),12.);vec3 c=tint*(.88+r*.12)+vec3(.38,.43,.38)*glint;float bank=pow(abs(vUv.x-.5)*2.,14.);c=mix(c,vec3(.7,.79,.62),bank*.7);gl_FragColor=vec4(c,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace('1.);#include','1.);\n#include'),side:T.DoubleSide});view.outside.add(new T.Mesh(geo,view.waterMat));
 // Broad ford crossings are terrain, not fabricated building assets.
 for(const z of[-42,54]){const b=new T.Mesh(new T.BoxGeometry(19,.13,10),mat(0xc9bba0));b.position.set(riverX(z),.07,z);b.receiveShadow=true;view.outside.add(b);}
 view.forestMeshes=[];const forest=naturalTrees();
 for(const kind of['tree','pine']){const temp=view.getProp(kind),items=forest.filter(o=>o.kind===kind);for(const part of temp.children){const ins=new T.InstancedMesh(part.geometry,part.material,items.length);const m=new T.Matrix4(),q=new T.Quaternion();items.forEach((o,i)=>{q.setFromAxisAngle(UP,o.yaw);m.compose(new T.Vector3(o.x,0,o.z),q,new T.Vector3(o.s,o.s,o.s));ins.setMatrixAt(i,m);});ins.castShadow=false;ins.receiveShadow=true;ins.userData.forestItems=items;view.forestMeshes.push(ins);view.outside.add(ins);}}
 for(let i=0;i<20;i++){const a=i*Math.PI*2/20,r=360+rand(i)*90,h=25+rand(i+3)*58;const hill=new T.Mesh(new T.SphereGeometry(1,16,10),mat([0x859f85,0x8ba98d,0x9aafa0][i%3],false));hill.position.set(Math.cos(a)*r,-8,Math.sin(a)*r);hill.scale.set(60+rand(i+25)*70,h,75);view.outside.add(hill);}
 const oceanGeo=new T.PlaneGeometry(450,1100);oceanGeo.rotateX(-Math.PI/2);oceanGeo.translate(405,.021,0);view.ocean=new T.Mesh(oceanGeo,view.waterMat);view.outside.add(view.ocean);
 const sand=new T.Mesh(new T.PlaneGeometry(6,1100),mat(0xc9c6a0));sand.rotation.x=-Math.PI/2;sand.position.set(177,.02,0);sand.receiveShadow=true;view.outside.add(sand);
 view.trailCanvas=createCanvas();view.trailCanvas.width=view.trailCanvas.height=2048;view.trailTexture=new T.CanvasTexture(view.trailCanvas);view.trailTexture.colorSpace=T.SRGBColorSpace;
 const trailMaterial=new T.MeshStandardMaterial({map:view.trailTexture,transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-1});
 view.trails=new T.Mesh(new T.PlaneGeometry(512,512),trailMaterial);view.trails.rotation.x=-Math.PI/2;view.trails.position.y=.028;view.trails.receiveShadow=true;view.outside.add(view.trails);view.lastTrailRevision=-1;view.trailTimer=0;
 const patches=[];for(let i=0;i<38;i++){const a=rand(i+933)*6.28,r=15+rand(i+431)*40,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.abs(x-riverX(z))<12)continue;patches.push({x,z,s:.9+rand(i)*.8});}
 view.flowerMeshes=[];for(const part of view.getProp('flowers').children){const ins=new T.InstancedMesh(part.geometry,part.material,patches.length),m=new T.Matrix4();patches.forEach((o,i)=>{m.makeScale(o.s,o.s,o.s);m.setPosition(o.x,0,o.z);ins.setMatrixAt(i,m);});ins.receiveShadow=true;ins.userData.forestItems=patches.map(o=>({...o,yaw:0}));view.flowerMeshes.push(ins);view.outside.add(ins);}

 view.landmarks=new T.Group();view.outside.add(view.landmarks);
 // Terrain suitability is communicated through natural scenery. The filled
 // debug-like site circles stay hidden during normal play; placement mode
 // uses showTerrainHints() rings instead.
 for(const site of TERRAIN_SITES){
  if(site.kind==='rock')for(let i=0;i<7;i++){const n=view.getProp('terrainRock').clone(),a=i*2.4,r=site.r*(.15+rand(i+site.x)*.55);n.position.set(site.x+Math.cos(a)*r,0,site.z+Math.sin(a)*r);n.scale.setScalar(.9+rand(i+site.z));view.landmarks.add(n);}
 }
 view.hintGroup=new T.Group();view.scene.add(view.hintGroup);

 // Small motes over the village, as ambience rather than collectible currency.
 const pv=[];for(let i=0;i<80;i++)pv.push((rand(i+14)-.5)*140,1+rand(i+63)*12,(rand(i+126)-.5)*140);const pg=new T.BufferGeometry();pg.setAttribute('position',new T.Float32BufferAttribute(pv,3));view.motes=new T.Points(pg,new T.PointsMaterial({color:0xfff1c0,size:.1,transparent:true,opacity:.5,depthWrite:false}));view.outside.add(view.motes);
 
// Partition after creating all originals so density seeds keep the original IDs.
for(const key of ['forestMeshes','flowerMeshes'])view[key]=view[key].flatMap(mesh=>{
 const chunks=partitionStaticInstances(mesh,{THREE:T,cellSize:64});
 if(chunks[0]!==mesh){mesh.removeFromParent();view.outside.add(...chunks);mesh.dispose();}
 return chunks;
});
// Return generated terrain state only; do not replace host methods with injected callbacks.
const {scene:hostScene,outside:hostOutside,getProp:hostGetProp,...terrain}=view;
return terrain;
}
