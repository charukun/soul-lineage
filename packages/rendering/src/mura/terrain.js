import {riverX,naturalTrees,TERRAIN_SITES} from '@soul/world/mura';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const fract=x=>x-Math.floor(x),rand=n=>fract(Math.sin(n*127.13+18.3)*41758.34);
export function flattenMuraModel(T,g){g.updateMatrixWorld(true);const bins=new Map();g.traverse(o=>{if(o.isMesh){const k=o.material.uuid;let b=bins.get(k);if(!b)bins.set(k,b={m:o.material,geos:[]});b.geos.push(o.geometry.clone().applyMatrix4(o.matrixWorld));}});const out=new T.Group();for(const b of bins.values()){
 const merged=mergeGeometries(b.geos,false);if(!merged)throw Error('Geometry merge failed');
 // An iframe owns different TypedArray constructors. Keep GPU buffers in its realm.
 const geo=new T.BufferGeometry();for(const [key,a] of Object.entries(merged.attributes))geo.setAttribute(key,new T.Float32BufferAttribute(a.array,a.itemSize,a.normalized));if(merged.index)geo.setIndex(new T.Uint32BufferAttribute(merged.index.array,1));merged.dispose();
 const m=new T.Mesh(geo,b.m);m.castShadow=m.receiveShadow=true;out.add(m);for(const x of b.geos)x.dispose();}return out;}

/** One terrain renderer for MURAAAAAAA and visitors; host owns camera and simulation. */
export function createMuraTerrain({THREE:T,scene,outside,getProp,mat,createCanvas}){
const view={scene,outside,getProp},UP=new T.Vector3(0,1,0);

 const ground=new T.Mesh(new T.PlaneGeometry(1100,1100,100,100),mat(0x91ad73,true,{vertexColors:true}));const gp=ground.geometry.attributes.position,colors=[];for(let i=0;i<gp.count;i++){const x=gp.getX(i),z=gp.getY(i);const f=.5+.20*Math.sin(x*.083+Math.sin(z*.067))+.17*Math.cos(z*.074+x*.026);const c=new T.Color(0x779864).lerp(new T.Color(0xb5c68c),f);colors.push(c.r,c.g,c.b);}ground.geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));ground.material.color.set(0xffffff);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.position.y=-.05;ground.material.bumpScale=.025;ground.geometry.attributes.uv.array.forEach((_,i,a)=>a[i]*=150);view.outside.add(ground);
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
 for(const site of TERRAIN_SITES){if(!['wetland','rock','fertile'].includes(site.kind))continue;
  const patch=new T.Mesh(new T.CircleGeometry(site.r,48),new T.MeshStandardMaterial({color:site.kind==='wetland'?0x8d8b6b:site.kind==='rock'?0x9b9f88:0xb6bd84,roughness:1,transparent:true,opacity:site.kind==='fertile'?.32:.44,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));patch.rotation.x=-Math.PI/2;patch.position.set(site.x,.018,site.z);view.landmarks.add(patch);
  if(site.kind==='rock')for(let i=0;i<7;i++){const n=view.getProp('terrainRock').clone(),a=i*2.4,r=site.r*(.15+rand(i+site.x)*.55);n.position.set(site.x+Math.cos(a)*r,0,site.z+Math.sin(a)*r);n.scale.setScalar(.9+rand(i+site.z));view.landmarks.add(n);}
 }
 view.hintGroup=new T.Group();view.scene.add(view.hintGroup);

 // Small motes over the village, as ambience rather than collectible currency.
 const pv=[];for(let i=0;i<80;i++)pv.push((rand(i+14)-.5)*140,1+rand(i+63)*12,(rand(i+126)-.5)*140);const pg=new T.BufferGeometry();pg.setAttribute('position',new T.Float32BufferAttribute(pv,3));view.motes=new T.Points(pg,new T.PointsMaterial({color:0xfff1c0,size:.1,transparent:true,opacity:.5,depthWrite:false}));view.outside.add(view.motes);
 
return view;
}
