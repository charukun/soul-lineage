import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createReviewCameraMenu} from '@soul/shared-ui/review-camera-menu';
import './review-object-library.css';

const OBJECT_SOURCE=Object.freeze({
  label:'KayKit Dungeon Remastered',
  repository:'KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0',
  commit:'b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07',
  license:'CC0-1.0',
});
const OBJECTS=Object.freeze([
  {id:'barrel',label:'樽',url:'/assets/vendor/kaykit-dungeon/barrel_small.gltf.glb'},
  {id:'box',label:'木箱',url:'/assets/vendor/kaykit-dungeon/box_small.gltf.glb'},
  {id:'rubble',label:'瓦礫',url:'/assets/vendor/kaykit-dungeon/rubble_large.gltf.glb'},
  {id:'torch',label:'松明',url:'/assets/vendor/kaykit-dungeon/torch_lit.gltf.glb'},
]);

const q=selector=>document.querySelector(selector);
const canvas=q('#object-stage');
const loader=new GLTFLoader();
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.15;

const scene=new THREE.Scene();
scene.background=new THREE.Color('#111716');
const camera=new THREE.PerspectiveCamera(38,1,.01,80);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;
controls.minDistance=.35;
controls.maxDistance=18;
scene.add(new THREE.HemisphereLight('#fff2d5','#4f6872',2.6));
const key=new THREE.DirectionalLight('#ffe0b5',3.2);key.position.set(-4,8,6);scene.add(key);
const fill=new THREE.DirectionalLight('#8dcbe1',1.7);fill.position.set(5,4,-5);scene.add(fill);
const ground=new THREE.Mesh(new THREE.CircleGeometry(3.8,64),new THREE.MeshStandardMaterial({color:'#263431',roughness:1}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.006;scene.add(ground);

let objectRoot=null,frameId=0,loadSequence=0,selected=OBJECTS[0].id,cameraMenu=null;

function status(message,error=false){q('#object-status').textContent=message;q('#object-status').dataset.error=String(error);}
function disposeRoot(root){
  if(!root)return;
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
  root.removeFromParent();geometries.forEach(value=>value.dispose?.());materials.forEach(value=>value.dispose?.());textures.forEach(value=>value.dispose?.());
}
function objectFrame(){
  if(!objectRoot)return null;
  objectRoot.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(objectRoot),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const radius=Math.max(size.x,size.y,size.z,.4);
  return {box,center,size,radius,target:new THREE.Vector3(center.x,box.min.y+size.y*.5,center.z)};
}
function fitObject(root){
  root.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),longest=Math.max(size.x,size.y,size.z);
  if(!Number.isFinite(longest)||longest<1e-6)throw new Error('物体geometryが空です');
  root.scale.multiplyScalar(1.75/longest);
  root.updateMatrixWorld(true);
  box=new THREE.Box3().setFromObject(root);
  const center=box.getCenter(new THREE.Vector3());
  root.position.x-=center.x;root.position.z-=center.z;root.position.y-=box.min.y;root.updateMatrixWorld(true);
}
function setCameraPreset(preset='full'){
  const frame=objectFrame();if(!frame)return;
  const {box,center,size,radius,target}=frame,eyeY=box.min.y+size.y*.58,distance=radius*1.9;
  controls.target.copy(target);
  if(preset==='front')camera.position.set(center.x,eyeY,center.z+distance);
  else if(preset==='side')camera.position.set(center.x+distance,eyeY,center.z);
  else if(preset==='top')camera.position.set(center.x,box.max.y+distance*.8,center.z+.01);
  else camera.position.set(center.x+radius*.85,eyeY+radius*.22,center.z+distance);
  controls.update();
  cameraMenu?.setSelected('view',preset);
}
function renderSelection(){
  for(const button of q('#object-options').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.object===selected));
}
async function loadObject(id){
  const item=OBJECTS.find(row=>row.id===id);if(!item)throw new Error(`Unknown review object: ${id}`);
  const sequence=++loadSequence;selected=id;status(`${item.label} を読み込み中…`);
  if(objectRoot)disposeRoot(objectRoot);objectRoot=null;
  const gltf=await loader.loadAsync(new URL(item.url,location.href).href);
  if(sequence!==loadSequence){disposeRoot(gltf.scene);return;}
  objectRoot=gltf.scene;objectRoot.name=`ReviewObject:${item.id}`;
  objectRoot.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
  scene.add(objectRoot);fitObject(objectRoot);setCameraPreset('full');renderSelection();
  status(`${item.label} · RINNE runtime asset`);
}
function populate(){
  q('#object-options').replaceChildren(...OBJECTS.map(item=>{const button=document.createElement('button');button.type='button';button.textContent=item.label;button.dataset.object=item.id;button.addEventListener('click',()=>loadObject(item.id).catch(error=>status(error.message,true)));return button;}));
  cameraMenu=createReviewCameraMenu({
    host:q('.object-stage'),
    groups:[{id:'view',label:'向き',options:[{id:'front',label:'正面'},{id:'side',label:'横'},{id:'top',label:'俯瞰'},{id:'full',label:'全体'}]}],
    onSelect:(_group,id)=>setCameraPreset(id),
  });
  controls.addEventListener('start',()=>cameraMenu?.clearSelected('view'));
  q('#object-provenance').textContent=`${OBJECT_SOURCE.label} · ${OBJECT_SOURCE.repository}@${OBJECT_SOURCE.commit} · ${OBJECT_SOURCE.license}`;
  renderSelection();
}

const observer=new ResizeObserver(()=>{const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();});
observer.observe(canvas);
function frame(){controls.update();renderer.render(scene,camera);frameId=requestAnimationFrame(frame);}
frameId=requestAnimationFrame(frame);
populate();loadObject(selected).catch(error=>status(error.message,true));
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frameId);observer.disconnect();cameraMenu?.destroy();controls.dispose();disposeRoot(objectRoot);ground.geometry.dispose();ground.material.dispose();renderer.dispose();},{once:true});
