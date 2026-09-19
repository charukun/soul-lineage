import * as THREE from 'three';

const size=Object.freeze({width:144,height:92});
let renderer=null,scene=null,camera=null,queue=Promise.resolve();

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
  scene.add(new THREE.HemisphereLight('#fff1d7','#334841',2.4));
  const key=new THREE.DirectionalLight('#ffe4bd',3.2);key.position.set(-4,7,5);scene.add(key);
  const rim=new THREE.DirectionalLight('#8dcbe1',1.4);rim.position.set(5,4,-4);scene.add(rim);
}

function dispose(root){
  const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
  root?.traverse?.(node=>{
    if(node.geometry)geometries.add(node.geometry);
    if(node.skeleton)skeletons.add(node.skeleton);
    for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){
      materials.add(material);
      for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
    }
  });
  geometries.forEach(value=>value.dispose?.());materials.forEach(value=>value.dispose?.());textures.forEach(value=>value.dispose?.());skeletons.forEach(value=>value.dispose?.());
  root?.removeFromParent?.();
}

export function createRuntimeThumbnail(label=''){
  const canvas=document.createElement('canvas');
  canvas.className='review-runtime-thumbnail';
  canvas.width=size.width;canvas.height=size.height;
  canvas.setAttribute('aria-hidden','true');
  canvas.dataset.thumbnailLabel=String(label||'');
  const ctx=canvas.getContext('2d');ctx.fillStyle='#101715';ctx.fillRect(0,0,size.width,size.height);
  return canvas;
}

export function renderRuntimeThumbnail(target,root,{disposeAfter=true,ground=true}={}){
  queue=queue.then(async()=>{
    if(!target?.getContext||!root)return;
    ensureRuntime();
    const holder=new THREE.Group();holder.add(root);scene.add(holder);
    root.updateMatrixWorld(true);
    let box=new THREE.Box3().setFromObject(root),dims=box.getSize(new THREE.Vector3()),longest=Math.max(dims.x,dims.y,dims.z);
    if(!Number.isFinite(longest)||longest<1e-6){scene.remove(holder);if(disposeAfter)dispose(root);return;}
    const scale=1.55/longest;root.scale.multiplyScalar(scale);root.updateMatrixWorld(true);
    box=new THREE.Box3().setFromObject(root);dims=box.getSize(new THREE.Vector3());
    const center=box.getCenter(new THREE.Vector3());
    root.position.x-=center.x;root.position.z-=center.z;root.position.y-=box.min.y;root.updateMatrixWorld(true);
    box=new THREE.Box3().setFromObject(root);dims=box.getSize(new THREE.Vector3());
    const targetY=box.min.y+dims.y*.5,distance=Math.max(dims.x,dims.y,dims.z)*1.9;
    camera.position.set(distance*.72,targetY+dims.y*.12,distance*.72);camera.lookAt(0,targetY,0);camera.updateProjectionMatrix();
    let floor=null;
    if(ground){floor=new THREE.Mesh(new THREE.CircleGeometry(1.3,28),new THREE.MeshStandardMaterial({color:'#25332f',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;scene.add(floor);}
    renderer.render(scene,camera);
    const ctx=target.getContext('2d');ctx.clearRect(0,0,target.width,target.height);ctx.drawImage(renderer.domElement,0,0,target.width,target.height);
    if(floor){scene.remove(floor);floor.geometry.dispose();floor.material.dispose();}
    scene.remove(holder);holder.remove(root);if(disposeAfter)dispose(root);
  }).catch(()=>{});
  return queue;
}

export function captureRuntimeThumbnail(target,source){
  if(!target?.getContext||!source)return;
  const ctx=target.getContext('2d');ctx.clearRect(0,0,target.width,target.height);ctx.drawImage(source,0,0,target.width,target.height);
}
