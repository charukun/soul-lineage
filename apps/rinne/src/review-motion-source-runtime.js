import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BVHLoader} from 'three/addons/loaders/BVHLoader.js';
import {captureMotionRest,captureNormalizedMotion} from '@soul/rendering/motion-quality';
import {kaykitHumanoidFromGLTF} from '@soul/rendering/kaykit-rig';
import {createHumanoidPreview} from '@soul/rendering/humanoid-preview';
import {MOTION_LIBRARY_SOURCE_BY_ID} from './review-motion-sources.js';
import {resolveReviewHumanoidDescriptor} from './review-humanoid-calibrations.js';
import {isThirdPartyRuntimeAssetUrl,projectAssetOrigin} from '@soul/assets';

const MAX_SOURCE_BYTES=12_000_000;
const encoder=new TextEncoder(),pinnedPromises=new Map(),reviewModelPromises=new Map();
const runtimeEnvironment=typeof __BUILD_INFO__==='undefined'?'dev':__BUILD_INFO__.environment;
async function gitBlobSha(bytes){
  const body=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),header=encoder.encode(`blob ${body.byteLength}\0`);
  const joined=new Uint8Array(header.byteLength+body.byteLength);joined.set(header);joined.set(body,header.byteLength);
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
// Catalog targets remain license/provenance-gated before the permissive pose adapter.
export async function loadPinnedReviewTarget(model,{fetcher=fetch,baseUrl=globalThis.location?.href}={}){
  const source=model?.source;
  if(model?.license!=='CC0-1.0'||!source||!/^[a-f0-9]{40}$/.test(source.gitBlobSha)||!Number.isSafeInteger(source.byteLength)||source.byteLength<1||source.byteLength>MAX_SOURCE_BYTES)throw new Error('Unverified review target');
  const base=new URL(baseUrl),url=new URL(model.runtime.url,base);
  if(!['http:','https:'].includes(url.protocol)||url.origin!==base.origin)throw new Error('Review target must be self-hosted');
  const response=await fetcher(url.href,{signal:AbortSignal.timeout(60000),cache:'force-cache'});
  if(!response.ok)throw new Error('Review target HTTP '+response.status);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.byteLength!==source.byteLength||await gitBlobSha(bytes)!==source.gitBlobSha)throw new Error('Review target integrity mismatch');
  return new GLTFLoader().parseAsync(bytes.buffer,'');
}
const normalizeBoneName=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function exactObjectMap(root,names){
  const nodes=[];root.traverse(node=>{if(node?.name)nodes.push(node);});const out={};
  for(const [key,rawNames] of Object.entries(names)){
    const aliases=(Array.isArray(rawNames)?rawNames:[rawNames]).map(normalizeBoneName).filter(Boolean);
    const node=nodes.find(candidate=>aliases.includes(normalizeBoneName(candidate.name)))||nodes.find(candidate=>aliases.some(alias=>normalizeBoneName(candidate.name).endsWith(alias)));
    if(!node)throw new Error(`Motion source bone missing: ${(Array.isArray(rawNames)?rawNames:[rawNames]).join(' / ')}`);
    out[key]=node;
  }
  return Object.freeze(out);
}
export function quaterniusHumanoidFromGLTF(gltf){
  return exactObjectMap(gltf.scene,{
    hips:['pelvis','Hips','hips','mixamorig:Hips'],spine:['spine_01','Spine','spine'],chest:['spine_02','Spine1','chest'],upperChest:['spine_03','Spine2','upperchest'],head:['Head','head'],
    leftUpperArm:['upperarm_l','LeftArm','leftupperarm'],leftLowerArm:['lowerarm_l','LeftForeArm','leftlowerarm'],leftHand:['hand_l','LeftHand','lefthand'],
    leftUpperLeg:['thigh_l','LeftUpLeg','leftupperleg'],leftLowerLeg:['calf_l','LeftLeg','leftlowerleg'],leftFoot:['foot_l','LeftFoot','leftfoot'],
    rightUpperArm:['upperarm_r','RightArm','rightupperarm'],rightLowerArm:['lowerarm_r','RightForeArm','rightlowerarm'],rightHand:['hand_r','RightHand','righthand'],
    rightUpperLeg:['thigh_r','RightUpLeg','rightupperleg'],rightLowerLeg:['calf_r','RightLeg','rightlowerleg'],rightFoot:['foot_r','RightFoot','rightfoot']
  });
}
const CMU_BVH_METERS_PER_UNIT=.01;
function scaleBvhToMeters(root,clip){
  root.traverse(node=>{if(node?.isBone)node.position.multiplyScalar(CMU_BVH_METERS_PER_UNIT);});
  for(const track of clip.tracks||[]){if(!/\.position$/i.test(track.name))continue;for(let i=0;i<track.values.length;i++)track.values[i]*=CMU_BVH_METERS_PER_UNIT;}
  root.updateMatrixWorld(true);
}
function skeletonHeight(root){
  root.updateMatrixWorld(true);const point=new T.Vector3();let minY=Infinity,maxY=-Infinity;
  root.traverse(node=>{if(!node?.isBone)return;node.getWorldPosition(point);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);});
  const height=maxY-minY;if(!Number.isFinite(height)||height<=.1||height>=100)throw new Error('Invalid BVH humanoid height');return height;
}
export function cmuHumanoidFromBVH(root){
  return exactObjectMap(root,{
    hips:'Hips',spine:'ToSpine',chest:'Spine',upperChest:'Spine1',head:'Head',
    leftUpperArm:'LeftArm',leftLowerArm:'LeftForeArm',leftHand:'LeftHand',leftUpperLeg:'LeftUpLeg',leftLowerLeg:'LeftLeg',leftFoot:'LeftFoot',
    rightUpperArm:'RightArm',rightLowerArm:'RightForeArm',rightHand:'RightHand',rightUpperLeg:'RightUpLeg',rightLowerLeg:'RightLeg',rightFoot:'RightFoot'
  });
}
export function createNormalizedBvhMotionSource(parsed,{id='cmu-bvh',clipName='CMU_Motion',preview=false,binding={}}={}){
  const root=parsed?.skeleton?.bones?.[0],clip=parsed?.clip;if(!root||!clip)throw new Error('Loaded BVH motion source required');
  clip.name=clipName;scaleBvhToMeters(root,clip);
  if(preview)return createPreviewMotionSource({scene:root,animations:[clip]},{id,zeroInitialTranslation:true,...binding});
  const bones=cmuHumanoidFromBVH(root),sourceHeight=skeletonHeight(root),restBase=captureMotionRest(bones,sourceHeight),mixer=new T.AnimationMixer(root);
  const action=mixer.clipAction(clip);action.reset().setLoop(T.LoopRepeat,Infinity).play();mixer.setTime(0);root.updateMatrixWorld(true);
  const rest=Object.freeze({...restBase,hips:bones.hips.position.toArray()});
  return Object.freeze({id,root,skeleton:parsed.skeleton,animations:Object.freeze([clip]),sourceHeight,rest,
    duration(index){if(index!==0)throw new Error('Motion clip index unavailable: '+index);return Math.max(1/60,Number(clip.duration)||1/60);},
    sample(index,seconds){if(index!==0)throw new Error('Motion clip index unavailable: '+index);const duration=Math.max(1/60,Number(clip.duration)||1/60),time=Math.max(0,Math.min(duration,Number(seconds)||0));mixer.setTime(time);root.updateMatrixWorld(true);return captureNormalizedMotion(bones,rest);},
    dispose(){mixer.stopAllAction();mixer.uncacheRoot(root);}
  });
}
export function parseCmuBvhMotionSource(bytes,source,{preview=false}={}){
  if(!(bytes instanceof Uint8Array))throw new Error('CMU BVH source bytes required');
  const parsed=new BVHLoader().parse(new TextDecoder('utf-8').decode(bytes));
  const calibration=resolveReviewHumanoidDescriptor(source);
  return createNormalizedBvhMotionSource(parsed,{id:source.id,clipName:source.clips[0]?.name||source.id,preview,binding:{basis:calibration.basis,mapping:calibration.mapping}});
}
function sceneHeight(scene){scene.updateMatrixWorld(true);const size=new T.Vector3();new T.Box3().setFromObject(scene).getSize(size);return Number.isFinite(size.y)&&size.y>.1&&size.y<100?size.y:2;}
function checkClips(gltf,id,expectedClips){
  if(!gltf?.scene||!Array.isArray(gltf.animations)||!gltf.animations.length)throw new Error('Loaded glTF motion source required');
  if(expectedClips){
    if(gltf.animations.length!==expectedClips.length)throw new Error(`${id} clip count mismatch: expected ${expectedClips.length}, got ${gltf.animations.length}`);
    expectedClips.forEach((row,index)=>{if(row.index!==index||gltf.animations[index]?.name!==row.name)throw new Error(`${id} clip identity mismatch at ${index}: expected ${row.name}, got ${gltf.animations[index]?.name||'<unnamed>'}`);});
  }
}
// Kept strict for existing consumers. Approximate preview is a separate explicit contract.
export function createNormalizedMotionSource(gltf,rigResolver,{id='motion-source',expectedClips=null}={}){
  checkClips(gltf,id,expectedClips);const bones=rigResolver(gltf),sourceHeight=sceneHeight(gltf.scene);
  gltf.scene.updateMatrixWorld(true);const rest=captureMotionRest(bones,sourceHeight),mixer=new T.AnimationMixer(gltf.scene);let activeIndex=-1,action=null;
  function select(index){const clip=gltf.animations[index];if(!clip)throw new Error(`Motion clip index unavailable: ${index}`);if(index!==activeIndex){mixer.stopAllAction();action=mixer.clipAction(clip);action.reset().setLoop(T.LoopRepeat,Infinity).play();activeIndex=index;}return clip;}
  return Object.freeze({id,gltf,animations:gltf.animations,sourceHeight,rest,
    duration(index){return Math.max(1/60,Number(gltf.animations[index]?.duration)||1/60);},
    sample(index,seconds){const clip=select(index),duration=Math.max(1/60,Number(clip.duration)||1/60),time=Math.max(0,Math.min(duration,Number(seconds)||0));mixer.setTime(time);gltf.scene.updateMatrixWorld(true);return captureNormalizedMotion(bones,rest);},
    dispose(){mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);}
  });
}
export function createPreviewMotionSource(gltf,{id='motion-preview',expectedClips=null,assetHash='',zeroInitialTranslation=false,...binding}={}){
  checkClips(gltf,id,expectedClips);
  const wrapper=createHumanoidPreview(gltf.scene,{...binding,role:'source',assetHash});
  if(['RIG_REQUIRED','UNSUPPORTED'].includes(wrapper.descriptor.status))throw new Error(`Motion source ${wrapper.descriptor.status}: ${id}`);
  const mixer=new T.AnimationMixer(gltf.scene);let active=-1,action=null;
  const origins=new Map();
  function duration(index){const clip=gltf.animations[index];if(!Number.isInteger(index)||!clip||!(clip.duration>0)||!Number.isFinite(clip.duration))throw new Error('Invalid motion clip: '+index);return clip.duration;}
  function sampleRaw(index,time){
    if(active!==index){mixer.stopAllAction();wrapper.reset();action=mixer.clipAction(gltf.animations[index]);action.reset().setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();active=index;}
    wrapper.reset();action.paused=false;action.enabled=true;mixer.setTime(time);return wrapper.capture();
  }
  return Object.freeze({id,gltf,animations:gltf.animations,wrapper,profile:wrapper.profile,compatibility:wrapper.descriptor,sourceHeight:wrapper.profile.height,duration,
    sample(index,seconds){
      const end=duration(index);if(!Number.isFinite(seconds))throw new Error('Invalid motion time');
      if(zeroInitialTranslation&&!origins.has(index))origins.set(index,sampleRaw(index,0).hips);
      const pose=sampleRaw(index,Math.max(0,Math.min(end,seconds)));
      if(zeroInitialTranslation)pose.hips=pose.hips.map((v,i)=>v-origins.get(index)[i]);return pose;
    },
    dispose(){mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);wrapper.reset();}
  });
}
export async function parseKaykitMotionSource(bytes){
  if(!(bytes instanceof ArrayBuffer))throw new Error('KayKit source bytes required');
  const gltf=await new GLTFLoader().parseAsync(bytes.slice(0),'');return createNormalizedMotionSource(gltf,kaykitHumanoidFromGLTF,{id:'kaykit-adventurers'});
}
export async function loadPinnedMotionSource(sourceId,{fetcher=fetch,preview=false}={}){
  const source=MOTION_LIBRARY_SOURCE_BY_ID[sourceId];if(!source)throw new Error(`Unknown pinned motion source: ${sourceId}`);
  if(source.reviewModel)throw new Error('A reference model is not a motion source');
  const key=sourceId+(preview?':preview':':strict');if(pinnedPromises.has(key))return pinnedPromises.get(key);
  const promise=(async()=>{
    const bytes=await checkedBytes(source,fetcher);
    if(source.format==='bvh')return parseCmuBvhMotionSource(bytes,source,{preview});
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const calibration=resolveReviewHumanoidDescriptor(source);
    const options={id:source.id,expectedClips:source.clips.length?source.clips:null,assetHash:source.gitBlobSha,basis:calibration.basis,mapping:calibration.mapping};
    if(preview)return createPreviewMotionSource(gltf,options);
    const rigResolver=source.rig==='kaykit-rig-medium'?kaykitHumanoidFromGLTF:['quaternius-standard','mesh2motion-human'].includes(source.rig)?quaterniusHumanoidFromGLTF:null;
    if(!rigResolver)throw new Error(`Unsupported motion rig: ${source.rig}`);return createNormalizedMotionSource(gltf,rigResolver,options);
  })().catch(error=>{pinnedPromises.delete(key);throw error;});
  pinnedPromises.set(key,promise);return promise;
}
export async function loadMotionReviewModel(sourceId,{fetcher=fetch}={}){
  const source=MOTION_LIBRARY_SOURCE_BY_ID[sourceId];if(!source?.reviewModel)throw new Error('Unknown motion review model: '+sourceId);
  if(reviewModelPromises.has(sourceId))return reviewModelPromises.get(sourceId);
  const promise=(async()=>{
    const bytes=await checkedBytes(source,fetcher),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const calibration=resolveReviewHumanoidDescriptor(source);
    const wrapper=createHumanoidPreview(gltf.scene,{role:'target',assetHash:source.gitBlobSha,basis:calibration.basis,mapping:calibration.mapping});
    return Object.freeze({source,gltf,bones:wrapper.bones,wrapper,compatibility:wrapper.descriptor});
  })().catch(error=>{reviewModelPromises.delete(sourceId);throw error;});
  reviewModelPromises.set(sourceId,promise);return promise;
}
export async function discoverPinnedMotionLibraryClips({preview=false,onFailure=()=>{}}={}){
  const discovered={},sources=Object.values(MOTION_LIBRARY_SOURCE_BY_ID).filter(source=>source.discoverAtRuntime&&!source.reviewModel);
  const results=await Promise.allSettled(sources.map(async source=>{
    const loaded=await loadPinnedMotionSource(source.id,{preview});
    return [source.id,loaded.animations.map((clip,index)=>Object.freeze({index,name:String(clip.name||('clip-'+index)),duration:Number(clip.duration)||0}))];
  }));
  results.forEach((result,i)=>{if(result.status==='fulfilled')discovered[result.value[0]]=Object.freeze(result.value[1]);else onFailure(sources[i].id,String(result.reason?.message||result.reason));});
  return Object.freeze(discovered);
}
export function disposePinnedMotionSources(){
  for(const promise of pinnedPromises.values())void promise.then(source=>source.dispose()).catch(()=>{});pinnedPromises.clear();reviewModelPromises.clear();
}
