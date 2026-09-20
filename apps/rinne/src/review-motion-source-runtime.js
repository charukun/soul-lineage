import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BVHLoader} from 'three/addons/loaders/BVHLoader.js';
import {captureMotionRest,captureNormalizedMotion} from '@soul/rendering/motion-quality';
import {kaykitHumanoidFromGLTF} from '@soul/rendering/kaykit-rig';
import {MOTION_LIBRARY_SOURCE_BY_ID} from './review-motion-sources.js';
import {isThirdPartyRuntimeAssetUrl,projectAssetOrigin} from '@soul/assets';

const MAX_SOURCE_BYTES=12_000_000;
const encoder=new TextEncoder();
const pinnedPromises=new Map();
const reviewModelPromises=new Map();
const runtimeEnvironment=typeof __BUILD_INFO__==='undefined'?'dev':__BUILD_INFO__.environment;

async function gitBlobSha(bytes){
  const body=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  const header=encoder.encode(`blob ${body.byteLength}\0`);
  const joined=new Uint8Array(header.byteLength+body.byteLength);
  joined.set(header);joined.set(body,header.byteLength);
  const digest=await crypto.subtle.digest('SHA-1',joined);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}
async function checkedBytes(source,fetcher=fetch){
  if(!source?.selfHosted||!source.runtimeUrl||!source.runtimeUrl.startsWith(projectAssetOrigin(runtimeEnvironment))||isThirdPartyRuntimeAssetUrl(source.runtimeUrl))throw new Error('Unsafe or non-project motion source URL');
  if(source.path.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Unsafe motion source path');
  if(!Number.isSafeInteger(source.byteLength)||source.byteLength<1||source.byteLength>MAX_SOURCE_BYTES)throw new Error('Invalid motion source size budget');
  const response=await fetcher(source.runtimeUrl,{signal:AbortSignal.timeout(60000),cache:'force-cache'});
  if(!response.ok)throw new Error(`Motion source HTTP ${response.status}`);
  const headerLength=Number(response.headers.get('content-length')||0);
  if(headerLength&&headerLength!==source.byteLength)throw new Error(`Motion source length mismatch: expected ${source.byteLength}, got ${headerLength}`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.byteLength!==source.byteLength)throw new Error(`Motion source length mismatch: expected ${source.byteLength}, got ${bytes.byteLength}`);
  const actual=await gitBlobSha(bytes);
  if(actual!==source.gitBlobSha)throw new Error(`Motion source hash mismatch: expected ${source.gitBlobSha}, got ${actual}`);
  return bytes;
}
function exactObjectMap(root,names){
  const nodes=new Map();root.traverse(node=>{if(node?.name)nodes.set(node.name,node);});
  const out={};
  for(const [key,name] of Object.entries(names)){
    const node=nodes.get(name);
    if(!node)throw new Error(`Motion source bone missing: ${name}`);
    out[key]=node;
  }
  return Object.freeze(out);
}
function exactNodeMap(gltf,names){return exactObjectMap(gltf.scene,names);}
export function quaterniusHumanoidFromGLTF(gltf){
  return exactNodeMap(gltf,{
    hips:'pelvis',spine:'spine_01',chest:'spine_02',upperChest:'spine_03',head:'Head',
    leftUpperArm:'upperarm_l',leftLowerArm:'lowerarm_l',leftHand:'hand_l',
    leftUpperLeg:'thigh_l',leftLowerLeg:'calf_l',leftFoot:'foot_l',
    rightUpperArm:'upperarm_r',rightLowerArm:'lowerarm_r',rightHand:'hand_r',
    rightUpperLeg:'thigh_r',rightLowerLeg:'calf_r',rightFoot:'foot_r'
  });
}

const CMU_BVH_METERS_PER_UNIT=.01;
function scaleBvhToMeters(root,clip){
  root.traverse(node=>{if(node?.isBone)node.position.multiplyScalar(CMU_BVH_METERS_PER_UNIT);});
  for(const track of clip.tracks||[]){
    if(!/\.position$/i.test(track.name))continue;
    for(let index=0;index<track.values.length;index++)track.values[index]*=CMU_BVH_METERS_PER_UNIT;
  }
  root.updateMatrixWorld(true);
}
function skeletonHeight(root){
  root.updateMatrixWorld(true);
  const point=new T.Vector3();let minY=Infinity,maxY=-Infinity;
  root.traverse(node=>{if(!node?.isBone)return;node.getWorldPosition(point);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);});
  const height=maxY-minY;
  if(!Number.isFinite(height)||height<=.1||height>=100)throw new Error('Invalid BVH humanoid height');
  return height;
}
export function cmuHumanoidFromBVH(root){
  return exactObjectMap(root,{
    hips:'Hips',spine:'ToSpine',chest:'Spine',upperChest:'Spine1',head:'Head',
    leftUpperArm:'LeftArm',leftLowerArm:'LeftForeArm',leftHand:'LeftHand',
    leftUpperLeg:'LeftUpLeg',leftLowerLeg:'LeftLeg',leftFoot:'LeftFoot',
    rightUpperArm:'RightArm',rightLowerArm:'RightForeArm',rightHand:'RightHand',
    rightUpperLeg:'RightUpLeg',rightLowerLeg:'RightLeg',rightFoot:'RightFoot'
  });
}
export function createNormalizedBvhMotionSource(parsed,{id='cmu-bvh',clipName='CMU_Motion'}={}){
  const root=parsed?.skeleton?.bones?.[0],clip=parsed?.clip;
  if(!root||!clip)throw new Error('Loaded BVH motion source required');
  clip.name=clipName;
  scaleBvhToMeters(root,clip);
  const bones=cmuHumanoidFromBVH(root),sourceHeight=skeletonHeight(root);
  const restBase=captureMotionRest(bones,sourceHeight),mixer=new T.AnimationMixer(root);
  const action=mixer.clipAction(clip);action.reset().setLoop(T.LoopRepeat,Infinity).play();
  mixer.setTime(0);root.updateMatrixWorld(true);
  const rest=Object.freeze({...restBase,hips:bones.hips.position.toArray()});
  return Object.freeze({
    id,root,skeleton:parsed.skeleton,animations:Object.freeze([clip]),sourceHeight,rest,
    duration(index){if(index!==0)throw new Error('Motion clip index unavailable: '+index);return Math.max(1/60,Number(clip.duration)||1/60);},
    sample(index,seconds){
      if(index!==0)throw new Error('Motion clip index unavailable: '+index);
      const duration=Math.max(1/60,Number(clip.duration)||1/60),time=Math.max(0,Math.min(duration,Number(seconds)||0));
      mixer.setTime(time);root.updateMatrixWorld(true);return captureNormalizedMotion(bones,rest);
    },
    dispose(){mixer.stopAllAction();mixer.uncacheRoot(root);}
  });
}
export function parseCmuBvhMotionSource(bytes,source){
  if(!(bytes instanceof Uint8Array))throw new Error('CMU BVH source bytes required');
  const parsed=new BVHLoader().parse(new TextDecoder('utf-8').decode(bytes));
  return createNormalizedBvhMotionSource(parsed,{id:source.id,clipName:source.clips[0]?.name||source.id});
}

function sceneHeight(scene){
  scene.updateMatrixWorld(true);
  const size=new T.Vector3();new T.Box3().setFromObject(scene).getSize(size);
  return Number.isFinite(size.y)&&size.y>.1&&size.y<100?size.y:2;
}
export function createNormalizedMotionSource(gltf,rigResolver,{id='motion-source',expectedClips=null}={}){
  if(!gltf?.scene||!Array.isArray(gltf.animations)||!gltf.animations.length)throw new Error('Loaded glTF motion source required');
  if(expectedClips){
    if(gltf.animations.length!==expectedClips.length)throw new Error(`${id} clip count mismatch: expected ${expectedClips.length}, got ${gltf.animations.length}`);
    expectedClips.forEach((row,index)=>{
      if(row.index!==index||gltf.animations[index]?.name!==row.name)throw new Error(`${id} clip identity mismatch at ${index}: expected ${row.name}, got ${gltf.animations[index]?.name||'<unnamed>'}`);
    });
  }
  const bones=rigResolver(gltf),sourceHeight=sceneHeight(gltf.scene);
  gltf.scene.updateMatrixWorld(true);
  const rest=captureMotionRest(bones,sourceHeight),mixer=new T.AnimationMixer(gltf.scene);
  let activeIndex=-1,action=null;
  function select(index){
    const clip=gltf.animations[index];
    if(!clip)throw new Error(`Motion clip index unavailable: ${index}`);
    if(index!==activeIndex){
      mixer.stopAllAction();action=mixer.clipAction(clip);action.reset().setLoop(T.LoopRepeat,Infinity).play();activeIndex=index;
    }
    return clip;
  }
  return Object.freeze({
    id,gltf,animations:gltf.animations,sourceHeight,rest,
    duration(index){return Math.max(1/60,Number(gltf.animations[index]?.duration)||1/60);},
    sample(index,seconds){
      const clip=select(index),duration=Math.max(1/60,Number(clip.duration)||1/60),time=Math.max(0,Math.min(duration,Number(seconds)||0));
      mixer.setTime(time);gltf.scene.updateMatrixWorld(true);return captureNormalizedMotion(bones,rest);
    },
    dispose(){mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);}
  });
}
export async function parseKaykitMotionSource(bytes){
  if(!(bytes instanceof ArrayBuffer))throw new Error('KayKit source bytes required');
  const gltf=await new GLTFLoader().parseAsync(bytes.slice(0),'');
  return createNormalizedMotionSource(gltf,kaykitHumanoidFromGLTF,{id:'kaykit-adventurers'});
}
export async function loadPinnedMotionSource(sourceId,{fetcher=fetch}={}){
  const source=MOTION_LIBRARY_SOURCE_BY_ID[sourceId];
  if(!source)throw new Error(`Unknown pinned motion source: ${sourceId}`);
  if(pinnedPromises.has(sourceId))return pinnedPromises.get(sourceId);
  const promise=(async()=>{
    const bytes=await checkedBytes(source,fetcher);
    if(source.format==='bvh')return parseCmuBvhMotionSource(bytes,source);
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const rigResolver=source.rig==='kaykit-rig-medium'?kaykitHumanoidFromGLTF:['quaternius-standard','mesh2motion-human'].includes(source.rig)?quaterniusHumanoidFromGLTF:null;
    if(!rigResolver)throw new Error(`Unsupported motion rig: ${source.rig}`);
    return createNormalizedMotionSource(gltf,rigResolver,{id:source.id,expectedClips:source.clips.length?source.clips:null});
  })().catch(error=>{pinnedPromises.delete(sourceId);throw error;});
  pinnedPromises.set(sourceId,promise);return promise;
}
export async function loadMotionReviewModel(sourceId,{fetcher=fetch}={}){
  const source=MOTION_LIBRARY_SOURCE_BY_ID[sourceId];
  if(!source?.reviewModel)throw new Error('Unknown motion review model: '+sourceId);
  if(reviewModelPromises.has(sourceId))return reviewModelPromises.get(sourceId);
  const promise=(async()=>{
    const bytes=await checkedBytes(source,fetcher);
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const bones=quaterniusHumanoidFromGLTF(gltf);
    return Object.freeze({source,gltf,bones});
  })().catch(error=>{reviewModelPromises.delete(sourceId);throw error;});
  reviewModelPromises.set(sourceId,promise);return promise;
}
export async function discoverPinnedMotionLibraryClips(){
  const discovered={};
  const sources=Object.values(MOTION_LIBRARY_SOURCE_BY_ID).filter(source=>source.discoverAtRuntime&&!source.reviewModel);
  const results=await Promise.allSettled(sources.map(async source=>{
    const loaded=await loadPinnedMotionSource(source.id);
    return [source.id,loaded.animations.map((clip,index)=>Object.freeze({index,name:String(clip.name||('clip-'+index)),duration:Number(clip.duration)||0}))];
  }));
  for(const result of results)if(result.status==='fulfilled')discovered[result.value[0]]=Object.freeze(result.value[1]);
  return Object.freeze(discovered);
}
export function disposePinnedMotionSources(){
  for(const promise of pinnedPromises.values())void promise.then(source=>source.dispose()).catch(()=>{});
  pinnedPromises.clear();
  reviewModelPromises.clear();
}
