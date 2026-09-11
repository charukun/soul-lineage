import { THREE as T } from '@soul/rendering';
import { mergeGeometries } from '@soul/rendering';
import {defs,LIMIT,riverX,localToWorld,ready,isGuard,TERRAIN_SITES} from '../game/core.js';
import {naturalTrees} from '../game/terrain.js';
import {building,prop,person,mat,floorFor,sailingShip,animal} from './models.js';
const fract=x=>x-Math.floor(x),rand=n=>fract(Math.sin(n*127.13+18.3)*41758.34);
const UP=new T.Vector3(0,1,0);
function flatten(g){g.updateMatrixWorld(true);const bins=new Map();g.traverse(o=>{if(o.isMesh){const k=o.material.uuid;let b=bins.get(k);if(!b)bins.set(k,b={m:o.material,geos:[]});b.geos.push(o.geometry.clone().applyMatrix4(o.matrixWorld));}});const out=new T.Group();for(const b of bins.values()){const geo=mergeGeometries(b.geos,false);if(!geo)throw Error('Geometry merge failed');const m=new T.Mesh(geo,b.m);m.castShadow=m.receiveShadow=true;out.add(m);for(const x of b.geos)x.dispose();}return out;}
export class View{
 constructor(canvas,world){
 this.canvas=canvas;this.world=world;this.scene=new T.Scene();this.scene.background=new T.Color(0xb5d0cf);this.scene.fog=new T.Fog(0xb5d0cf,145,520);
 this.renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true,alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
 const gl=this.renderer.getContext(),info=gl.getExtension('WEBGL_debug_renderer_info');this.softwareGPU=!!(info&&/swiftshader|llvmpipe|software/i.test(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)));this.renderScale=this.softwareGPU?.75:1;this.renderer.localClippingEnabled=false;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;
 this.camera=new T.OrthographicCamera(-50,50,50,-50,.1,1200);this.target=new T.Vector3(0,0,0);this.yaw=.63;this.pitch=.72;this.span=innerWidth<600?38:65;this.savedCamera=null;
 this.sun=new T.DirectionalLight(0xffe0b2,2.65);this.sun.position.set(-45,90,60);this.sun.castShadow=true;this.sun.shadow.mapSize.set(this.softwareGPU?1024:2048,this.softwareGPU?1024:2048);Object.assign(this.sun.shadow.camera,{left:-100,right:100,top:100,bottom:-100,near:1,far:230});this.sun.shadow.bias=-.00022;this.sun.shadow.normalBias=.12;this.scene.add(this.sun,this.sun.target);
 this.hemi=new T.HemisphereLight(0xddeafb,0x839767,2.1);this.scene.add(this.hemi);
 this.outside=new T.Group();this.objects=new T.Group();this.actors=new T.Group();this.inside=new T.Group();this.scene.add(this.outside,this.objects,this.actors,this.inside);this.inside.visible=true;this.propCache=new Map();this.buildingCache=new Map();this.floorCache=new Map();this.cutawayCache=new Map();this.objectNodes=new Map();this.actorNodes=new Map();this.picking=[];
 this.makeTerrain();this.makePost();this.setupSelection();this.roomId=null;this.blur=.85;this.autoOrbit=true;this.interacting=false;this.lastInteraction=0;this.cameraGoal=null;this.followId=null;this.resize();this.rebuild();this.thumbCache={};
 }
 mountFoundation(world){
  this.foundation=new T.Group();this.foundation.userData.worldId=world.id;
  for(const entity of world.entities){
   if(entity.assetId!=='furniture.bench.oak.v1')throw new Error('Unsupported foundation asset: '+entity.assetId);
   const node=this.getProp('bench').clone();node.position.fromArray(entity.position);node.rotation.fromArray([...entity.rotation,'XYZ']);node.scale.fromArray(entity.scale);
   node.userData.entityId=entity.id;node.userData.assetId=entity.assetId;this.foundation.add(node);
  }
  this.outside.add(this.foundation);this.renderer.shadowMap.needsUpdate=true;
 }
 makeTerrain(){
 const ground=new T.Mesh(new T.PlaneGeometry(1100,1100,100,100),mat(0x91ad73,true,{vertexColors:true}));const gp=ground.geometry.attributes.position,colors=[];for(let i=0;i<gp.count;i++){const x=gp.getX(i),z=gp.getY(i);const f=.5+.20*Math.sin(x*.083+Math.sin(z*.067))+.17*Math.cos(z*.074+x*.026);const c=new T.Color(0x779864).lerp(new T.Color(0xb5c68c),f);colors.push(c.r,c.g,c.b);}ground.geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));ground.material.color.set(0xffffff);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.position.y=-.05;ground.material.bumpScale=.025;ground.geometry.attributes.uv.array.forEach((_,i,a)=>a[i]*=150);this.outside.add(ground);
 const verts=[],uv=[];
 for(let z=-480;z<480;z+=5){const x0=riverX(z),x1=riverX(z+5),w=7.1;verts.push(x0-w,.015,z,x1-w,.015,z+5,x0+w,.015,z,x0+w,.015,z,x1-w,.015,z+5,x1+w,.015,z+5);uv.push(0,z/8,0,(z+5)/8,1,z/8,1,z/8,0,(z+5)/8,1,(z+5)/8);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
 this.waterMat=new T.ShaderMaterial({uniforms:{time:{value:0},tint:{value:new T.Color(0x65a4ae)}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform float time;uniform vec3 tint;varying vec2 vUv;void main(){float r=sin(vUv.y*14.+time*.8+sin(vUv.x*15.))*sin(vUv.x*37.+vUv.y*6.-time);float glint=pow(max(r,0.),12.);vec3 c=tint*(.88+r*.12)+vec3(.38,.43,.38)*glint;float bank=pow(abs(vUv.x-.5)*2.,14.);c=mix(c,vec3(.7,.79,.62),bank*.7);gl_FragColor=vec4(c,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace('1.);#include','1.);\n#include'),side:T.DoubleSide});this.outside.add(new T.Mesh(geo,this.waterMat));
 // Broad ford crossings are terrain, not fabricated building assets.
 for(const z of[-42,54]){const b=new T.Mesh(new T.BoxGeometry(19,.13,10),mat(0xc9bba0));b.position.set(riverX(z),.07,z);b.receiveShadow=true;this.outside.add(b);}
 this.forestMeshes=[];const forest=naturalTrees();
 for(const kind of['tree','pine']){const temp=this.getProp(kind),items=forest.filter(o=>o.kind===kind);for(const part of temp.children){const ins=new T.InstancedMesh(part.geometry,part.material,items.length);const m=new T.Matrix4(),q=new T.Quaternion();items.forEach((o,i)=>{q.setFromAxisAngle(UP,o.yaw);m.compose(new T.Vector3(o.x,0,o.z),q,new T.Vector3(o.s,o.s,o.s));ins.setMatrixAt(i,m);});ins.castShadow=false;ins.receiveShadow=true;ins.userData.forestItems=items;this.forestMeshes.push(ins);this.outside.add(ins);}}
 for(let i=0;i<20;i++){const a=i*Math.PI*2/20,r=360+rand(i)*90,h=25+rand(i+3)*58;const hill=new T.Mesh(new T.SphereGeometry(1,16,10),mat([0x859f85,0x8ba98d,0x9aafa0][i%3],false));hill.position.set(Math.cos(a)*r,-8,Math.sin(a)*r);hill.scale.set(60+rand(i+25)*70,h,75);this.outside.add(hill);}
 const oceanGeo=new T.PlaneGeometry(450,1100);oceanGeo.rotateX(-Math.PI/2);oceanGeo.translate(405,.021,0);this.ocean=new T.Mesh(oceanGeo,this.waterMat);this.outside.add(this.ocean);
 const sand=new T.Mesh(new T.PlaneGeometry(6,1100),mat(0xc9c6a0));sand.rotation.x=-Math.PI/2;sand.position.set(177,.02,0);sand.receiveShadow=true;this.outside.add(sand);
 this.trailCanvas=document.createElement('canvas');this.trailCanvas.width=this.trailCanvas.height=2048;this.trailTexture=new T.CanvasTexture(this.trailCanvas);this.trailTexture.colorSpace=T.SRGBColorSpace;
 const trailMaterial=new T.MeshStandardMaterial({map:this.trailTexture,transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-1});
 this.trails=new T.Mesh(new T.PlaneGeometry(512,512),trailMaterial);this.trails.rotation.x=-Math.PI/2;this.trails.position.y=.028;this.trails.receiveShadow=true;this.outside.add(this.trails);this.lastTrailRevision=-1;this.trailTimer=0;
 const patches=[];for(let i=0;i<38;i++){const a=rand(i+933)*6.28,r=15+rand(i+431)*40,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.abs(x-riverX(z))<12)continue;patches.push({x,z,s:.9+rand(i)*.8});}
 this.flowerMeshes=[];for(const part of this.getProp('flowers').children){const ins=new T.InstancedMesh(part.geometry,part.material,patches.length),m=new T.Matrix4();patches.forEach((o,i)=>{m.makeScale(o.s,o.s,o.s);m.setPosition(o.x,0,o.z);ins.setMatrixAt(i,m);});ins.receiveShadow=true;ins.userData.forestItems=patches.map(o=>({...o,yaw:0}));this.flowerMeshes.push(ins);this.outside.add(ins);}

 this.landmarks=new T.Group();this.outside.add(this.landmarks);
 for(const site of TERRAIN_SITES){if(!['wetland','rock','fertile'].includes(site.kind))continue;
  const patch=new T.Mesh(new T.CircleGeometry(site.r,48),new T.MeshStandardMaterial({color:site.kind==='wetland'?0x8d8b6b:site.kind==='rock'?0x9b9f88:0xb6bd84,roughness:1,transparent:true,opacity:site.kind==='fertile'?.32:.44,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));patch.rotation.x=-Math.PI/2;patch.position.set(site.x,.018,site.z);this.landmarks.add(patch);
  if(site.kind==='rock')for(let i=0;i<7;i++){const n=this.getProp('terrainRock').clone(),a=i*2.4,r=site.r*(.15+rand(i+site.x)*.55);n.position.set(site.x+Math.cos(a)*r,0,site.z+Math.sin(a)*r);n.scale.setScalar(.9+rand(i+site.z));this.landmarks.add(n);}
 }
 this.hintGroup=new T.Group();this.scene.add(this.hintGroup);

 // Small motes over the village, as ambience rather than collectible currency.
 const pv=[];for(let i=0;i<80;i++)pv.push((rand(i+14)-.5)*140,1+rand(i+63)*12,(rand(i+126)-.5)*140);const pg=new T.BufferGeometry();pg.setAttribute('position',new T.Float32BufferAttribute(pv,3));this.motes=new T.Points(pg,new T.PointsMaterial({color:0xfff1c0,size:.1,transparent:true,opacity:.5,depthWrite:false}));this.outside.add(this.motes);
 }
 getProp(kind){if(!this.propCache.has(kind))this.propCache.set(kind,flatten(prop(kind,14)));return this.propCache.get(kind);}
 getBuilding(kind,material='base',level=1){const key=kind+':'+material+':'+level;if(!this.buildingCache.has(key))this.buildingCache.set(key,flatten(building(kind,material,level)));return this.buildingCache.get(key);}
 getFloor(host){if(!this.floorCache.has(host.kind))this.floorCache.set(host.kind,flatten(floorFor(host)));return this.floorCache.get(host.kind);}
 node(o){const g=defs[o.kind].building?this.getBuilding(o.kind,o.material||'base',o.level||1).clone():this.getProp(o.kind).clone();g.position.set(o.x,.025,o.z);g.rotation.y=o.rot;g.userData.objectId=o.id;return g;}
 rebuild(){
 this.objects.traverse(o=>{if(o.userData.privateMaterial)o.material.dispose();});this.objects.clear();this.inside.clear();this.objectNodes.clear();this.picking=[];
 for(const o of this.world.objects){const n=this.node(o);n.userData.hostId=o.id;
  n.traverse(m=>{if(m.isMesh&&defs[o.kind].building){m.material=m.material.clone();m.userData.privateMaterial=true;if(!ready(o)){m.material.transparent=true;m.material.opacity=o.phase==='building'?.50:.22;m.material.color.lerp(new T.Color(0xb5d9dd),.6);m.castShadow=false;}}});
  this.objects.add(n);this.objectNodes.set(o.id,n);this.picking.push(n);
  if(defs[o.kind].building&&ready(o)){
   const room=new T.Group();room.position.set(o.x,.035,o.z);room.rotation.y=o.rot;room.userData.roomId=o.id;room.add(this.getFloor(o).clone());
   for(const f of o.room){const m=this.node(f);m.userData.roomId=o.id;room.add(m);this.picking.push(m);}this.inside.add(room);
  }
 }
 const q=new T.Quaternion(),m=new T.Matrix4();for(const ins of [...this.forestMeshes,...this.flowerMeshes]){ins.userData.forestItems.forEach((o,i)=>{const covered=this.world.objects.some(b=>defs[b.kind].building&&Math.abs(b.x-o.x)<Math.max(defs[b.kind].w,defs[b.kind].d)/2+4&&Math.abs(b.z-o.z)<Math.max(defs[b.kind].w,defs[b.kind].d)/2+4);q.setFromAxisAngle(UP,o.yaw);m.compose(new T.Vector3(o.x,0,o.z),q,new T.Vector3().setScalar(covered?0:o.s));ins.setMatrixAt(i,m);});ins.instanceMatrix.needsUpdate=true;}
 if(this.roomId&&!this.world.object(this.roomId))this.roomId=null;
 this.applyCutaway();this.updateActors();this.objects.updateMatrixWorld(true);this.inside.updateMatrixWorld(true);this.renderer.shadowMap.needsUpdate=true;
 }
 cutGeometry(geo,height=1.1){
 const src=geo.index?geo.toNonIndexed():geo,p=src.attributes.position,uv=src.attributes.uv,out=[],tex=[];
 const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:height,z:a.z+(b.z-a.z)*t,u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t});
 for(let i=0;i<p.count;i+=3){const polygon=[];for(let j=0;j<3;j++){const k=i+j;polygon.push({x:p.getX(k),y:p.getY(k),z:p.getZ(k),u:uv?.getX(k)||0,v:uv?.getY(k)||0});}const clipped=[];
  for(let j=0;j<3;j++){const a=polygon[j],b=polygon[(j+1)%3],ai=a.y<=height,bi=b.y<=height;if(ai)clipped.push(a);if(ai!==bi)clipped.push(mix(a,b,(height-a.y)/(b.y-a.y)));}
  for(let j=1;j<clipped.length-1;j++)for(const v of[clipped[0],clipped[j],clipped[j+1]]){out.push(v.x,v.y,v.z);tex.push(v.u,v.v);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(out,3));g.setAttribute('uv',new T.Float32BufferAttribute(tex,2));g.computeVertexNormals();g.computeBoundingSphere();return g;
 }
 applyCutaway(){for(const room of this.inside.children){const host=this.world.object(room.userData.roomId),d=defs[host?.kind];const exposed=host?.id===this.roomId||d?.open||['yard','market','orchard','pond'].includes(d?.shape);for(const child of room.children)if(child.userData.roomId)child.visible=exposed;}
 for(const[id,n]of this.objectNodes){const kind=this.world.object(id)?.kind;if(!defs[kind]?.building)continue;const object=this.world.object(id),cacheKey=kind+':'+(object.material||'base')+':'+(object.level||1);let cached=this.cutawayCache.get(cacheKey);if(id===this.roomId&&!cached){cached=n.children.map(m=>m.isMesh?this.cutGeometry(m.geometry):null);this.cutawayCache.set(cacheKey,cached);}
  n.children.forEach((m,i)=>{if(!m.isMesh)return;m.userData.fullGeometry??=m.geometry;m.geometry=id===this.roomId?cached[i]:m.userData.fullGeometry;m.userData.cutaway=id===this.roomId;});}}
 drawTrails(sim,dt){this.trailTimer+=dt;if(this.lastTrailRevision===sim.trafficRevision||this.trailTimer<1.4)return;this.trailTimer=0;this.lastTrailRevision=sim.trafficRevision;const c=this.trailCanvas.getContext('2d');c.clearRect(0,0,2048,2048);
 for(const[k,v]of Object.entries(this.world.state.traffic)){if(v<1.1)continue;const[x,z]=k.split(',').map(Number),a=Math.min(.65,(v-1)/15),px=(x*2+256)*4,py=(z*2+256)*4,r=6.5+Math.min(v,20)*.11;
 c.lineCap='round';for(const[dx,dz]of[[1,0],[0,1],[1,1],[1,-1]]){const v2=this.world.state.traffic[`${x+dx},${z+dz}`]||0;if(v2<=1.1)continue;const alpha=Math.min(a,Math.min(.65,(v2-1)/15))*.38;c.strokeStyle=`rgba(152,132,95,${alpha})`;c.lineWidth=4.6+Math.min(v,v2,20)*.1;c.beginPath();c.moveTo(px,py);c.lineTo(px+dx*8,py+dz*8);c.stroke();}
 const g=c.createRadialGradient(px,py,1,px,py,r);g.addColorStop(0,`rgba(148,126,91,${a})`);g.addColorStop(.5,`rgba(158,139,101,${a*.8})`);g.addColorStop(1,'rgba(163,145,107,0)');c.fillStyle=g;c.fillRect(px-r,py-r,r*2,r*2);}
 this.trailTexture.needsUpdate=true;
 }
 setupSelection(){
 const geo=new T.BufferGeometry().setFromPoints([new T.Vector3(-.5,0,-.5),new T.Vector3(.5,0,-.5),new T.Vector3(.5,0,.5),new T.Vector3(-.5,0,.5),new T.Vector3(-.5,0,-.5)]);
 this.selection=new T.Line(geo,new T.LineBasicMaterial({color:0xffedb8,depthTest:false,transparent:true,opacity:.95}));this.selection.renderOrder=50;this.selection.position.y=.12;this.selection.visible=false;this.scene.add(this.selection);
 }
 select(o,roomId=this.roomId){this.selected=o;this.selection.visible=!!o;if(o){const h=roomId&&this.world.object(roomId),p=h?localToWorld(h,o.x,o.z):o;this.selection.position.set(p.x,.14,p.z);this.selection.rotation.y=o.rot+(h?.rot||0);this.selection.scale.set(defs[o.kind].w+.5,1,defs[o.kind].d+.5);}}
 setGhost(kind,x,z,rot=0,valid=true,material='base'){if(!this.ghost||this.ghost.userData.kind!==kind||this.ghost.userData.variant!==material){this.clearGhost();this.ghost=defs[kind].building?this.getBuilding(kind,material).clone():this.getProp(kind).clone();this.ghost.userData.kind=kind;this.ghost.userData.variant=material;this.ghost.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.65;o.castShadow=false;}});this.scene.add(this.ghost);}const h=this.roomId&&this.world.object(this.roomId),p=h?localToWorld(h,x,z):{x,z};this.ghost.position.set(p.x,.15,p.z);this.ghost.rotation.y=rot+(h?.rot||0);this.ghost.traverse(o=>{if(o.isMesh){o.material.emissive.set(valid?0x354630:0xaa2118);o.material.emissiveIntensity=valid?.08:.65;}});this.select({kind,x,z,rot});this.selection.material.color.set(valid?0xffedb8:0xd87360);}
 clearGhost(){if(this.ghost){this.ghost.traverse(o=>{if(o.isMesh)o.material.dispose();});this.scene.remove(this.ghost);this.ghost=null;}this.selection.material.color.set(0xffedb8);this.select(null);}
 focus(x,z,span=null){this.cameraGoal={x,z,span:span||this.span};this.lastInteraction=performance.now();}
 enterRoom(id){const h=this.world.object(id);if(!h||!ready(h)||h.kind==='campfire')return false;this.roomId=id;const d=defs[h.kind];this.applyCutaway();this.focus(h.x,h.z,Math.max(d.w,d.d)*1.3);this.select(null);this.renderer.shadowMap.needsUpdate=true;return true;}
 exitRoom(){const h=this.world.object(this.roomId);this.roomId=null;this.applyCutaway();if(h)this.focus(h.x,h.z,Math.max(42,this.span*1.6));this.select(null);this.renderer.shadowMap.needsUpdate=true;}
 makePerson(i,monster=false,role='resident',species=null){const n=species&&species!=='monster'?animal(species):person(i,monster,role),body=n.userData.body,legs=n.userData.legs;for(const leg of legs)body.remove(leg);const flat=flatten(body);body.clear();body.add(flat,...legs);n.traverse(o=>{if(o.isMesh)o.castShadow=false;});return n;}
 updateActors(){}
 syncActor(p,time,monster=false){const signature=(p.role||'resident')+':'+(p.species||'')+':'+monster;let n=this.actorNodes.get(p.id);if(n&&n.userData.signature!==signature){this.removeActor(p.id);n=null;}
  if(!n){n=this.makePerson(Math.floor(p.seed||0)%5,monster,p.role,p.species);n.userData.monster=monster;n.userData.personId=p.id;n.userData.signature=signature;this.actorNodes.set(p.id,n);this.actors.add(n);}
  n.position.set(p.x,0,p.z);n.visible=!p.hidden;n.rotation.y=p.angle||0;
  const a=p.moving?Math.sin(time*(p.species==='rabbit'?11:7.5)+(p.seed||0))*.46:Math.sin(time*1.6+(p.seed||0))*.025;
  n.userData.legs.forEach((leg,i)=>leg.rotation.x=i%2?-a:a);n.userData.body.position.y=p.moving?Math.abs(Math.sin(time*7.5+(p.seed||0)))*.035:Math.sin(time*1.4+(p.seed||0))*.016;
  n.userData.body.rotation.z=p.downed?.9:p.task==='work'?Math.sin(time*3)*.09:0;
  n.userData.body.rotation.x=p.task==='work'?Math.sin(time*3)*.12:0;
  if(p.species==='rabbit'&&p.moving)n.userData.body.position.y=Math.abs(Math.sin(time*7+(p.seed||0)))*.22;
  if(p.task==='defending')n.userData.body.rotation.y=Math.sin(time*9)*.23;else n.userData.body.rotation.y=0;
  if(n.userData.carry!==p.carry){if(n.userData.parcel)n.remove(n.userData.parcel);n.userData.carry=p.carry;if(p.carry){const parcel=new T.Mesh(new T.BoxGeometry(.8,.55,.65),mat(0xc3ad83));parcel.position.set(0,1,.52);n.add(parcel);n.userData.parcel=parcel;}}
 }
 removeActor(id){const n=this.actorNodes.get(id);if(n){this.actors.remove(n);this.actorNodes.delete(id);}}
 resize(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;this.renderer.setSize(r.width,r.height,false);this.rt?.setSize(Math.round(r.width*Math.min(devicePixelRatio||1,1.5)*this.renderScale),Math.round(r.height*Math.min(devicePixelRatio||1,1.5)*this.renderScale));this.blurMaterial?.uniforms.resolution.value.set(this.rt.width,this.rt.height);this.updateCamera();}
 updateCamera(){const aspect=this.w/this.h;const vw=this.span*Math.max(1,aspect),vh=this.span*Math.max(1,1/aspect);Object.assign(this.camera,{left:-vw/2,right:vw/2,top:vh/2,bottom:-vh/2});this.camera.updateProjectionMatrix();const distance=165;this.camera.position.set(this.target.x+Math.sin(this.yaw)*distance*Math.cos(this.pitch),this.target.y+Math.sin(this.pitch)*distance,this.target.z+Math.cos(this.yaw)*distance*Math.cos(this.pitch));this.camera.lookAt(this.target);this.camera.updateMatrixWorld();if(!this.shadowTarget||this.shadowTarget.distanceTo(this.target)>20){this.shadowTarget=this.target.clone();this.sun.position.set(this.target.x-45,90,this.target.z+60);this.sun.target.position.copy(this.target);this.sun.target.updateMatrixWorld();this.renderer.shadowMap.needsUpdate=true;}}
 ground(clientX,clientY){const r=this.canvas.getBoundingClientRect(),v=new T.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),ray=new T.Raycaster();ray.setFromCamera(v,this.camera);return ray.ray.intersectPlane(new T.Plane(UP,0),new T.Vector3());}
 touch(){this.lastInteraction=performance.now();this.cameraGoal=null;this.followId=null;}
 pan(dx,dy){this.touch();const r=this.canvas.getBoundingClientRect(),x=r.left+this.w*.5,y=r.top+this.h*.5,a=this.ground(x,y),b=this.ground(x+dx,y+dy);if(!a||!b)return;this.target.add(a.sub(b));this.target.x=T.MathUtils.clamp(this.target.x,-LIMIT,LIMIT);this.target.z=T.MathUtils.clamp(this.target.z,-LIMIT,LIMIT);this.updateCamera();}
 zoom(factor){this.touch();this.span=T.MathUtils.clamp(this.span*factor,10,680);this.updateCamera();}
 pick(x,y,people=false){this.scene.updateMatrixWorld(true);const r=this.canvas.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((x-r.left)/this.w*2-1,-(y-r.top)/this.h*2+1),this.camera);
 const hits=ray.intersectObjects(people?[...this.actors.children]:this.picking,true);
 for(const hit of hits){let n=hit.object,visible=true,id=null,room=null,host=null;while(n){if(!n.visible)visible=false;if(n.userData.personId&&people)id=n.userData.personId;if(n.userData.objectId&&!id)id=n.userData.objectId;if(n.userData.roomId)room=n.userData.roomId;if(n.userData.hostId)host=n.userData.hostId;n=n.parent;}
  if(!visible||host===this.roomId&&hit.point.y>1.1)continue;if(!people&&room&&room!==this.roomId)continue;if(id)return id;
 }return null;}
 project(x,y,z){const p=new T.Vector3(x,y,z).project(this.camera);return{x:(p.x+1)*this.w/2,y:(1-p.y)*this.h/2};}

 pickPerson(x,y,radius=21){let best=null,bd=radius;for(const p of this.world.people){if(p.insideId&&p.insideId!==this.roomId)continue;const point=this.project(p.x,1.2,p.z),d=Math.hypot(point.x-x,point.y-y);if(d<bd){best=p.id;bd=d;}}return best;}
 showTerrainHints(kind){for(const o of this.hintGroup.children){o.geometry?.dispose();o.material?.dispose();}this.hintGroup.clear();const terrain=defs[kind]?.terrain;if(!terrain)return;for(const site of TERRAIN_SITES){if(site.kind!==terrain&&!(terrain==='water'&&site.kind==='wetland'))continue;const m=new T.Mesh(new T.RingGeometry(site.r-.2,site.r+.2,64),new T.MeshBasicMaterial({color:0xffe3a4,transparent:true,opacity:.8,depthWrite:false,side:T.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(site.x,.07,site.z);this.hintGroup.add(m);}}

 setTime(hour){const night=hour>=19||hour<5.5,evening=hour>=16.5&&hour<19;this.night=night;this.sun.intensity=night?.22:evening?1.65:2.65;this.sun.color.set(night?0xb1c9ea:evening?0xffbd84:0xffe0b2);this.hemi.intensity=night?.7:1.7;this.hemi.color.set(night?0x93afd2:0xdceafa);this.hemi.groundColor.set(night?0x4c6555:0x8e9f6b);const bg=night?0x263e54:evening?0xcbb79d:0xb5d0cf;this.scene.background.set(bg);this.scene.fog.color.set(bg);this.renderer.toneMappingExposure=night?1.05:1.12;this.waterMat.uniforms.tint.value.set(night?0x345369:0x65a4ae);}
 makePost(){this.rt=new T.WebGLRenderTarget(1,1,{depthBuffer:true,samples:this.softwareGPU?0:2});this.postScene=new T.Scene();this.postCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);this.blurMaterial=new T.ShaderMaterial({uniforms:{image:{value:this.rt.texture},resolution:{value:new T.Vector2(1,1)},strength:{value:1}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`uniform sampler2D image;uniform vec2 resolution;uniform float strength;varying vec2 vUv;void main(){float band=smoothstep(.12,.44,abs(vUv.y-.48));float r=band*strength*6.;vec2 px=vec2(r)/resolution;vec3 c=texture2D(image,vUv).rgb*.20;float w=.8/12.;for(int i=0;i<12;i++){float a=float(i)*2.39996323;float rad=sqrt((float(i)+.5)/12.);c+=texture2D(image,vUv+vec2(cos(a),sin(a))*px*rad).rgb*w;}c*=1.-.09*pow(length((vUv-.5)*1.35),2.);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`});this.postScene.add(new T.Mesh(new T.PlaneGeometry(2,2),this.blurMaterial));}
 render(time,dt){this.waterMat.uniforms.time.value=time;this.motes.rotation.y=Math.sin(time*.013)*.025;this.motes.position.y=Math.sin(time*.31)*.18;
 if(this.cameraGoal){const g=this.cameraGoal,t=1-Math.exp(-dt*5);this.target.x+=(g.x-this.target.x)*t;this.target.z+=(g.z-this.target.z)*t;this.span+=(g.span-this.span)*t;if(Math.abs(g.x-this.target.x)+Math.abs(g.z-this.target.z)+Math.abs(g.span-this.span)<.05)this.cameraGoal=null;}
 if(!this.interacting&&performance.now()-this.lastInteraction>2600){this.yaw+=dt*.009;
  if(this.followId){const p=this.world.people.find(p=>p.id===this.followId);if(p){const t=1-Math.exp(-dt*1.8);this.target.x+=(p.x-this.target.x)*t;this.target.z+=(p.z-this.target.z)*t;}}
 }
 this.updateCamera();this.animateAmbient(time);
 this.blurMaterial.uniforms.strength.value=this.world.state.settings.tilt;this.renderer.setRenderTarget(this.rt);this.renderer.render(this.scene,this.camera);this.renderer.setRenderTarget(null);this.renderer.render(this.postScene,this.postCamera);
 }
 animateAmbient(time){const fire=this.world.objects.find(o=>o.kind==='campfire');if(fire){if(!this.fireFX){this.fireFX=new T.Group();for(let i=0;i<4;i++){const m=new T.Mesh(new T.ConeGeometry(.35,1.4,7),new T.MeshBasicMaterial({color:i%2?0xffd184:0xef9b58,transparent:true,opacity:.85,depthWrite:false}));m.position.set(Math.cos(i*2)*.3,.8,Math.sin(i*2)*.3);this.fireFX.add(m);}this.scene.add(this.fireFX);this.fireLight=new T.PointLight(0xffab61,3,18);this.scene.add(this.fireLight);}this.fireFX.position.set(fire.x,.35,fire.z);this.fireLight.position.set(fire.x,2,fire.z);this.fireFX.children.forEach((m,i)=>{m.scale.y=.75+Math.sin(time*4+i*2)*.2;m.rotation.y=time*.6;});}
 const v=this.world.state.voyage,h=this.world.object(v.harborId);if(v.phase!=='away'&&h){if(!this.ship){this.ship=sailingShip();this.scene.add(this.ship);}this.ship.visible=true;const t=Math.min(1,v.progress/18);this.ship.position.set(207,Math.sin(time*.8)*.15,h.z+(v.phase==='arriving'?180*(1-t):v.phase==='departing'?-180*t:0));this.ship.rotation.z=Math.sin(time*.45)*.008;}else if(this.ship)this.ship.visible=false;
 }
 thumbnail(kind){if(this.thumbCache[kind])return this.thumbCache[kind];const scene=new T.Scene();scene.background=new T.Color(0xebe7d9);scene.add(new T.HemisphereLight(0xffffff,0xb1ab8c,2.4));const light=new T.DirectionalLight(0xffe1b7,3);light.position.set(-8,15,12);scene.add(light);const g=defs[kind].building?this.getBuilding(kind).clone():this.getProp(kind).clone();scene.add(g);const bb=new T.Box3().setFromObject(g),sz=bb.getSize(new T.Vector3()),c=bb.getCenter(new T.Vector3()),s=Math.max(sz.x,sz.y,sz.z)*.8;const cam=new T.OrthographicCamera(-s,s,s*.8,-s*.8,.1,200);cam.position.copy(c).add(new T.Vector3(25,20,32));cam.lookAt(c);const oldRatio=this.renderer.getPixelRatio(),oldSize=this.renderer.getSize(new T.Vector2());this.renderer.setPixelRatio(1);this.renderer.setSize(140,112,false);this.renderer.render(scene,cam);const img=this.canvas.toDataURL('image/png');this.renderer.setPixelRatio(oldRatio);this.renderer.setSize(oldSize.x,oldSize.y,false);this.thumbCache[kind]=img;return img;}
}
