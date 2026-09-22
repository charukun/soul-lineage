import * as THREE from 'three';
import {disposeReviewObject} from '@soul/rendering';

const size=Object.freeze({width:288,height:184});
let renderer=null,scene=null,camera=null,queue=Promise.resolve(),active=false;
const cache=new Map(),targets=new WeakMap(),queuedKeys=new Set(),jobs=[];
const idle=callback=>globalThis.requestIdleCallback?requestIdleCallback(callback,{timeout:90}):setTimeout(()=>callback({timeRemaining:()=>8,didTimeout:true}),12);
function paintPlaceholder(canvas){
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#18231f');bg.addColorStop(1,'#0d1311');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(w*.5,h*.49);ctx.strokeStyle='#74867d';ctx.fillStyle='#9aa9a1';ctx.lineCap='round';ctx.lineJoin='round';
  ctx.globalAlpha=.22;ctx.beginPath();ctx.ellipse(0,h*.35,w*.24,h*.055,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.72;
  const r=Math.max(8,w*.035);ctx.beginPath();ctx.arc(0,-h*.22,r,0,Math.PI*2);ctx.fill();ctx.lineWidth=Math.max(5,w*.018);
  ctx.beginPath();ctx.moveTo(0,-h*.14);ctx.lineTo(0,h*.08);ctx.moveTo(0,-h*.08);ctx.lineTo(-w*.09,h*.02);ctx.moveTo(0,-h*.08);ctx.lineTo(w*.09,h*.02);ctx.moveTo(0,h*.07);ctx.lineTo(-w*.065,h*.27);ctx.moveTo(0,h*.07);ctx.lineTo(w*.065,h*.27);ctx.stroke();ctx.restore();
  canvas.dataset.thumbnailState='placeholder';
}

function ensureRuntime(){
  if(renderer)return;
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
  renderer.setPixelRatio(1);
  renderer.setSize(size.width,size.height,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.05;
  scene=new THREE.Scene();
  scene.background=new THREE.Color('#101715');
  camera=new THREE.PerspectiveCamera(34,size.width/size.height,.01,100);
  scene.add(new THREE.HemisphereLight('#fff1d7','#334841',2.1));
  const key=new THREE.DirectionalLight('#ffe4bd',2.8);key.position.set(-4,7,5);scene.add(key);
  const rim=new THREE.DirectionalLight('#8dcbe1',1.1);rim.position.set(5,4,-4);scene.add(rim);
}
function draw(target,source){
  if(!target?.isConnected||!source)return;
  const ctx=target.getContext('2d');ctx.clearRect(0,0,target.width,target.height);ctx.drawImage(source,0,0,target.width,target.height);
  target.dataset.thumbnailState='ready';
}
function snapshot(target){
  const copy=document.createElement('canvas');copy.width=target.width;copy.height=target.height;copy.getContext('2d').drawImage(target,0,0);return copy;
}
function dispose(root){disposeReviewObject(root);}
async function renderNow(target,root,{disposeAfter=true,ground=true}={}){
  if(!target?.isConnected||!root){if(disposeAfter)dispose(root);return;}
  ensureRuntime();
  const holder=new THREE.Group();holder.add(root);scene.add(holder);
  root.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(root),dims=box.getSize(new THREE.Vector3()),longest=Math.max(dims.x,dims.y,dims.z);
  if(!Number.isFinite(longest)||longest<1e-6){scene.remove(holder);holder.remove(root);if(disposeAfter)dispose(root);return;}
  root.scale.multiplyScalar(1.55/longest);root.updateMatrixWorld(true);
  box=new THREE.Box3().setFromObject(root);dims=box.getSize(new THREE.Vector3());
  const center=box.getCenter(new THREE.Vector3());
  root.position.x-=center.x;root.position.z-=center.z;root.position.y-=box.min.y;root.updateMatrixWorld(true);
  box=new THREE.Box3().setFromObject(root);dims=box.getSize(new THREE.Vector3());
  const targetY=box.min.y+dims.y*.5,distance=Math.max(dims.x,dims.y,dims.z)*1.9;
  camera.position.set(distance*.72,targetY+dims.y*.12,distance*.72);camera.lookAt(0,targetY,0);camera.updateProjectionMatrix();
  let floor=null;
  if(ground){floor=new THREE.Mesh(new THREE.CircleGeometry(1.3,20),new THREE.MeshStandardMaterial({color:'#25332f',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;scene.add(floor);}
  renderer.render(scene,camera);draw(target,renderer.domElement);
  if(floor){scene.remove(floor);floor.geometry.dispose();floor.material.dispose();}
  scene.remove(holder);holder.remove(root);if(disposeAfter)dispose(root);
}
function pump(){
  if(active||!jobs.length)return;
  active=true;
  idle(async()=>{
    const job=jobs.shift();
    // The queue can be cleared after scheduling this idle callback.
    if(!job){active=false;return;}
    queuedKeys.delete(job.key);
    try{
      if(!job.target.isConnected)return;
      const cached=cache.get(job.key);if(cached){draw(job.target,cached);return;}
      job.target.dataset.thumbnailState='loading';
      const root=await job.load();
      if(!job.target.isConnected){if(job.disposeAfter!==false)dispose(root);return;}
      await renderNow(job.target,root,job.options);
      if(job.target.dataset.thumbnailState==='ready')cache.set(job.key,snapshot(job.target));
    }catch{if(job.target?.isConnected)job.target.dataset.thumbnailState='error';}
    finally{active=false;pump();}
  });
}
const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{
  for(const entry of entries){
    if(!entry.isIntersecting)continue;
    observer.unobserve(entry.target);
    const job=targets.get(entry.target);if(job)enqueue(job);
  }
},{rootMargin:'120px 0px'});
function enqueue(job){
  if(cache.has(job.key)){draw(job.target,cache.get(job.key));return;}
  if(queuedKeys.has(job.key))return;
  queuedKeys.add(job.key);jobs.push(job);pump();
}

export function createRuntimeThumbnail(label=''){
  const canvas=document.createElement('canvas');
  canvas.className='review-runtime-thumbnail';canvas.width=size.width;canvas.height=size.height;
  canvas.setAttribute('aria-hidden','true');canvas.dataset.thumbnailLabel=String(label||'');canvas.dataset.thumbnailState='idle';
  paintPlaceholder(canvas);
  return canvas;
}
export function scheduleRuntimeThumbnail(target,key,load,options={}){
  const job={target,key:String(key),load,options,disposeAfter:options.disposeAfter};
  targets.set(target,job);
  if(cache.has(job.key)){draw(target,cache.get(job.key));return;}
  if(observer)observer.observe(target);else enqueue(job);
}
export function renderRuntimeThumbnail(target,root,options={}){
  queue=queue.then(()=>renderNow(target,root,options)).catch(()=>{});
  return queue;
}
export function captureRuntimeThumbnail(target,source){
  if(!target?.getContext||!source)return;draw(target,source);cache.set(target.dataset.thumbnailLabel||String(cache.size),snapshot(target));
}
export function clearRuntimeThumbnailQueue(){
  jobs.length=0;queuedKeys.clear();
}
