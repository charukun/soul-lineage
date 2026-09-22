// Manual browser probe: original GLBs, existing normalized motion adapter and thumbnail renderer.
import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {KAYKIT_CURRENT_MODELS} from '../../packages/characters/src/kaykit-library.js';
import {kaykitHumanoidFromGLTF} from '../../packages/rendering/src/kaykit-rig.js';
import {createHumanoidPreview} from '../../packages/rendering/src/humanoid-preview.js';
import {disposeReviewObject} from '../../packages/rendering/src/index.js';
import {loadPinnedReviewTarget,loadPinnedMotionSource,disposePinnedMotionSources} from '../../apps/rinne/src/review/motion/source-runtime.js';
import {createRuntimeThumbnail,renderRuntimeThumbnail} from '../../apps/rinne/src/review/shared/runtime-thumbnail.js';
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const finite=values=>Array.from(values).every(Number.isFinite);
const cases=[['idle','kaykit-general','Idle_A'],['walk','kaykit-movement-basic','Walking_A'],['run','kaykit-movement-basic','Running_A'],
 ['melee','kaykit-combat-melee','Melee_1H_Attack_Chop'],['hit','kaykit-general','Hit_A'],['death','kaykit-general','Death_A'],
 ['ranged','kaykit-combat-ranged','Ranged_Bow_Release'],['tool','kaykit-tools','Chop'],['special','kaykit-special','Skeletons_Taunt'],
 ['advanced','kaykit-movement-advanced','Sneaking'],['simulation','kaykit-simulation','Waving']];
async function thumbnail(root,label){
 const target=createRuntimeThumbnail(label);document.body.append(target);
 const copy=cloneSkeleton(root);await renderRuntimeThumbnail(target,copy,{disposeAfter:false});
 assert(target.dataset.thumbnailState==='ready','Thumbnail renderer failed');
 const pixels=target.getContext('2d').getImageData(0,0,target.width,target.height).data;
 const colors=new Set();for(let i=0;i<pixels.length;i+=16)colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
 assert(colors.size>100,'Blank or untextured thumbnail');
 const url=target.toDataURL('image/webp',.9);target.remove();return url;
}
async function verify(id){
 const model=KAYKIT_CURRENT_MODELS.find(x=>x.id===id);assert(model,'Unregistered model');
 const gltf=await loadPinnedReviewTarget(model),root=gltf.scene,rig=kaykitHumanoidFromGLTF(gltf);
 const result={id:model.id,name:model.name,sha256:model.sha256,byteLength:model.byteLength,status:'passed',meshes:0,triangles:0,textures:0,clips:[],poses:[]};
 try{
  const textures=new Set();root.traverse(node=>{
   if(!node.isMesh)return;result.meshes++;
   const pos=node.geometry.getAttribute('position');assert(pos&&finite(pos.array),'Invalid vertex positions');
   result.triangles+=(node.geometry.index?.count||pos.count)/3;
   if(node.isSkinnedMesh){
    const weights=node.geometry.getAttribute('skinWeight'),indices=node.geometry.getAttribute('skinIndex');
    assert(weights&&indices&&finite(weights.array)&&finite(indices.array),'Invalid skin attributes');
    assert(Array.from(indices.array).every(x=>x>=0&&x<node.skeleton.bones.length),'Out-of-range bone index');
    assert(node.skeleton.boneInverses.every(x=>finite(x.elements)),'Invalid inverse-bind matrices');
   }
   for(const material of Array.isArray(node.material)?node.material:[node.material])for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
  });
  for(const texture of textures){const image=texture.source.data;assert(image?.width>0&&image?.height>0,'Missing texture');assert(Math.max(image.width,image.height)<=2048,'Texture budget exceeded');}
  result.textures=textures.size;assert(result.textures>0&&result.triangles>0&&result.triangles<30000,'Invalid material/triangle budget');
  root.updateMatrixWorld(true);const initialBox=new THREE.Box3().setFromObject(root,true),initialSize=initialBox.getSize(new THREE.Vector3());
  assert(initialSize.y>.5&&initialSize.y<4,'Unexpected original character scale');result.originalBounds={min:initialBox.min.toArray(),max:initialBox.max.toArray()};
  const target=createHumanoidPreview(root,{role:'target',assetHash:model.source.gitBlobSha});
  result.binding=target.descriptor;assert(target.descriptor.status==='PLAYABLE','Incomplete target binding');
  const restLengths=new Map(Object.values(rig).filter(b=>b!==rig.hips).map(b=>[b,b.position.length()]));
  for(const [semantic,sourceId,name] of cases){
   const source=await loadPinnedMotionSource(sourceId,{preview:true});const index=source.animations.findIndex(x=>x.name===name);
   assert(index>=0,'Expected existing motion missing: '+name);const duration=source.duration(index);let first=null,maxDelta=0,maxExtent=0;
   const statuses=new Set();
   for(let frame=0;frame<=16;frame++){
    const applied=target.apply(source.sample(index,duration*frame/16),{mode:'preview',rootMotion:'in-place'});
    assert(applied.applied&&applied.status==='PLAYABLE','Motion not safely playable: '+name+' '+JSON.stringify(applied));statuses.add(applied.status);
    root.updateMatrixWorld(true);const values=Object.values(rig).flatMap(b=>b.matrixWorld.elements);
    assert(finite(values),'Nonfinite animated skeleton');if(!first)first=values;else maxDelta=Math.max(maxDelta,...values.map((x,i)=>Math.abs(x-first[i])));
    for(const [bone,length] of restLengths)assert(Math.abs(bone.position.length()-length)<1e-3,'Bone length changed');
    const box=new THREE.Box3().setFromObject(root,true),size=box.getSize(new THREE.Vector3());
    assert(finite([...box.min,...box.max])&&!box.isEmpty(),'Invalid animated bounds');
    maxExtent=Math.max(maxExtent,size.x,size.y,size.z);assert(maxExtent<Math.max(...initialSize)*4,'Exploding skin or root scale');
   }
   assert(maxDelta>1e-5,'Static/T-pose instead of animation: '+name);
   result.clips.push({semantic,sourceId,name,index,duration,samples:17,maxDelta,maxExtent,status:[...statuses][0]});
   target.apply(source.sample(index,duration*.38),{mode:'preview',rootMotion:'in-place'});
   if(semantic==='idle')result.thumbnail=await thumbnail(root,model.label);
   if(['Ranger','Rogue','Mage','Skeleton_Warrior'].includes(model.name)&&['idle','walk','run','melee','hit','death'].includes(semantic))result.poses.push({label:model.name+' / '+semantic,image:await thumbnail(root,model.label+' '+semantic)});
  }
  target.reset();return result;
 }finally{disposeReviewObject(root);}
}
window.kaykitLibraryProbe={verify,models:KAYKIT_CURRENT_MODELS.map(x=>({id:x.id,name:x.name})),close:disposePinnedMotionSources};
