// Browser execution surface for an upstream-generated factory, never a replacement modeler.
import * as THREE from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as factory from '/factory.js';

const fetchJSON=async path=>{const r=await fetch('/artifact/'+path);if(!r.ok)throw new Error(`Missing ${path}`);return r.json();};
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(600,900);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.NoToneMapping;renderer.setClearColor(0xffffff,1);document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene(), rootFactory=Object.entries(factory).find(([name,fn])=>/^create.*Model$/.test(name)&&typeof fn==='function');
if(!rootFactory)throw new Error('The pinned factory did not export its model constructor');
const root=rootFactory[1]({qualityPriority:'reference-fidelity'});if(!root?.isObject3D)throw new Error('Factory result is not Object3D');scene.add(root);
scene.add(new THREE.HemisphereLight(0xffffff,0x888078,2.1));const key=new THREE.DirectionalLight(0xffffff,1.3);key.position.set(-2,3,4);scene.add(key);
const session=await fetchJSON('session.json'), spec=await fetchJSON('img2threejs/object-sculpt-spec.json');
root.updateMatrixWorld(true);
const byId=new Map();root.traverse(o=>{if(o.isMesh){const id=o.userData.sculptComponent?.id||o.name;byId.set(id,o);}});
const cameras={};for(const view of Object.keys(session.sourceViews))cameras[view]=await fetchJSON(`img2threejs/camera-${view}.json`);
const baseMaterials=new Map([...byId.values()].map(o=>[o,o.material]));let camera,mode='material';
function referenceCamera(view) {
 const c=cameras[view];if(!c||c.type!=='orthographic'||!(c.pixelsPerUnit>0))throw new Error('Missing calibrated reference camera');
 const [x,y]=c.imageOrigin,p=c.pixelsPerUnit;
 const cam=new THREE.OrthographicCamera(-x/p,(c.imageWidth-x)/p,y/p,(y-c.imageHeight)/p,.01,20);
 const axes={'+Z':[0,0,4],'-Z':[0,0,-4],'+X':[4,0,0],'-X':[-4,0,0]};if(!axes[c.axis])throw new Error('Unsupported reference orientation');
 cam.position.fromArray(axes[c.axis]);cam.lookAt(0,0,0);cam.updateMatrixWorld(true);cam.updateProjectionMatrix();return cam;
}
function setView(view,{scale=3,width=900,height=1000}={}) {
 if(cameras[view]){const c=cameras[view];renderer.setSize(c.imageWidth*scale,c.imageHeight*scale);camera=referenceCamera(view);}
 else {renderer.setSize(width,height);const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3()),h=box.max.y-box.min.y,aspect=width/height;
  const angles={right:Math.PI/2,left:-Math.PI/2,'three-quarter':Math.PI/4,'rear-three-quarter':Math.PI*3/4,front:0,back:Math.PI};
  if(!(view in angles))throw new Error('Unknown camera');camera=new THREE.OrthographicCamera(-h*.62*aspect,h*.62*aspect,h*.62,-h*.62,.01,20);const a=angles[view];camera.position.copy(center).add(new THREE.Vector3(Math.sin(a)*4,h*.025,Math.cos(a)*4));camera.lookAt(center);camera.updateMatrixWorld();}
 render();return {view,camera:camera.toJSON(),width:renderer.domElement.width,height:renderer.domElement.height};
}
function setMode(next) {
 if(!['material','clay','wireframe','albedo'].includes(next))throw new Error('Unknown display mode');mode=next;
 for(const [o,material] of baseMaterials){
  if(next==='material')o.material=material;
  else if(next==='clay'||next==='wireframe')o.material=new THREE.MeshStandardMaterial({color:0xb7bec5,roughness:.9,wireframe:next==='wireframe',side:THREE.DoubleSide});
  else {const m=Array.isArray(material)?material[0]:material;o.material=new THREE.MeshBasicMaterial({color:m.color,map:m.map,side:m.side});}
  if(o.userData.sculptComponent?.id==='root'){o.visible=false;}
 }
 render();
}
function render(){root.updateMatrixWorld(true);if(camera)renderer.render(scene,camera);}
function geometry() {
 root.updateMatrixWorld(true);return [...byId.entries()].map(([id,o])=>{
  const g=o.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv');
  return {id,name:o.name,vertices:Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)]),normals:n?Array.from({length:n.count},(_,i)=>[n.getX(i),n.getY(i),n.getZ(i)]):null,
   uv:uv?Array.from({length:uv.count},(_,i)=>[uv.getX(i),uv.getY(i)]):null,indices:g.index?Array.from(g.index.array):Array.from({length:p.count},(_,i)=>i),matrix:o.matrixWorld.toArray(),component:o.userData.sculptComponent};
 });
}
function applyUnwrap(id,data) {
 const o=byId.get(id);if(!o)throw new Error('Unknown mesh '+id);const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(data.vertices.flat(),3));g.setIndex(data.indices);g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv.flat(),2));
 if(data.normals)g.setAttribute('normal',new THREE.Float32BufferAttribute(data.normals.flat(),3));else g.computeVertexNormals();o.geometry=g;render();
}
function metrics(){const meshes=geometry(),box=new THREE.Box3().setFromObject(root);return {meshCount:meshes.length,triangles:meshes.reduce((n,m)=>n+m.indices.length/3,0),vertices:meshes.reduce((n,m)=>n+m.vertices.length,0),bounds:{min:box.min.toArray(),max:box.max.toArray()},drawCalls:renderer.info.render.calls,renderer:renderer.getContext().getParameter(renderer.getContext().RENDERER),mode};}
async function exportGLB(){
 // sculptRuntime contains live Object3D references. Temporarily remove only runtime
 // caches during serialization, preserving all model buffers and metadata.
 const saved=[];root.traverse(o=>{saved.push([o,o.userData]);o.userData=Object.fromEntries(Object.entries(o.userData).filter(([k])=>k!=='sculptRuntime'));});
 try{return Array.from(new Uint8Array(await new GLTFExporter().parseAsync(root,{binary:true,animations:root.animations||[]})));}
 finally{for(const [o,data]of saved)o.userData=data;}
}
window.forge={THREE,renderer,scene,root,byId,baseMaterials,cameras,referenceCamera,setView,setMode,render,geometry,applyUnwrap,metrics,exportGLB,spec,session};
setView('front');window.forgeReady=true;
