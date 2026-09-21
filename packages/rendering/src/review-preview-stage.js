import {ACESFilmicToneMapping,Box3,SRGBColorSpace,Vector3,WebGLRenderer} from 'three';

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export function createReviewRenderer(canvas,{exposure=1.15,pixelRatioCap=1.5,powerPreference='high-performance'}={}){
  if(!canvas)throw new Error('Review renderer requires a canvas');
  const renderer=new WebGLRenderer({canvas,antialias:true,powerPreference});
  renderer.setPixelRatio(Math.min(Number(globalThis.devicePixelRatio)||1,pixelRatioCap));
  renderer.outputColorSpace=SRGBColorSpace;
  renderer.toneMapping=ACESFilmicToneMapping;
  renderer.toneMappingExposure=exposure;
  return renderer;
}

export function measureReviewSubject(root,{minimumExtent=.4}={}){
  if(!root?.isObject3D)throw new Error('Review subject must be Object3D');
  root.updateWorldMatrix(true,true);
  const box=new Box3().setFromObject(root);
  if(box.isEmpty())throw new Error('Review subject geometry is empty');
  const center=box.getCenter(new Vector3()),size=box.getSize(new Vector3());
  if(![size.x,size.y,size.z].every(Number.isFinite))throw new Error('Review subject bounds are invalid');
  const width=Math.max(minimumExtent,size.x),height=Math.max(minimumExtent,size.y),depth=Math.max(minimumExtent,size.z);
  return Object.freeze({box,center,size,width,height,depth,radius:Math.max(width,height,depth),target:new Vector3(center.x,box.min.y+height*.5,center.z)});
}

export function normalizeReviewSubject(root,{targetLongest=null,centerXZ=true,ground=true}={}){
  let frame=measureReviewSubject(root,{minimumExtent:1e-6});
  if(targetLongest!==null){
    const longest=Math.max(frame.size.x,frame.size.y,frame.size.z);
    if(!(longest>1e-6))throw new Error('Review subject geometry is empty');
    root.scale.multiplyScalar(targetLongest/longest);
    root.updateWorldMatrix(true,true);
    frame=measureReviewSubject(root,{minimumExtent:1e-6});
  }
  if(centerXZ){root.position.x-=frame.center.x;root.position.z-=frame.center.z;}
  if(ground)root.position.y-=frame.box.min.y;
  root.updateWorldMatrix(true,true);
  return measureReviewSubject(root);
}

export function positionReviewCamera({camera,controls,root,preset='front',padding=1.16,minDistance=.35,maxDistance=80}={}){
  if(!camera||!controls)throw new Error('Review camera requires camera and controls');
  const frame=measureReviewSubject(root),aspect=Math.max(.2,Number(camera.aspect)||1);
  const verticalFov=Math.max(.1,(Number(camera.fov)||38)*Math.PI/180);
  const horizontalFov=2*Math.atan(Math.tan(verticalFov/2)*aspect);
  let target=frame.target.clone(),visibleHeight=frame.height,visibleWidth=frame.width;
  if(preset==='face'){
    target.set(frame.center.x,frame.box.min.y+frame.height*.78,frame.center.z);
    visibleHeight=Math.max(.22,frame.height*.34);
    visibleWidth=Math.max(.22,frame.width*.58);
  }else if(preset==='side'){
    visibleWidth=frame.depth;
  }else if(preset==='three-quarter'||preset==='full'){
    visibleWidth=Math.max(frame.width,frame.depth)*1.12;
  }else if(preset==='top'){
    visibleHeight=Math.max(frame.width,frame.depth);
    visibleWidth=visibleHeight;
    target.copy(frame.center);
  }
  const dv=(visibleHeight*.5)/Math.tan(verticalFov*.5);
  const dh=(visibleWidth*.5)/Math.tan(horizontalFov*.5);
  const distance=clamp(Math.max(dv,dh,minDistance)*padding,minDistance,maxDistance);
  controls.target.copy(target);
  if(preset==='side')camera.position.set(target.x+distance,target.y,target.z);
  else if(preset==='back')camera.position.set(target.x,target.y,target.z-distance);
  else if(preset==='three-quarter'||preset==='full')camera.position.set(target.x+distance*.72,target.y+distance*.08,target.z+distance*.72);
  else if(preset==='top')camera.position.set(target.x,target.y+distance,target.z+.001);
  else camera.position.set(target.x,target.y,target.z+distance);
  camera.lookAt(target);
  controls.update();
  return Object.freeze({frame,target,distance,preset});
}
