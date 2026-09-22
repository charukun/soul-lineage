import * as T from 'three';
import {createCompressedGLTFLoader} from '@soul/rendering/compressed-gltf';
import {readResponseArrayBufferWithProgress} from '@soul/rendering/progressive-manifestation';
import {projectAssetUrl} from '@soul/assets';

export const GOBKIT_SOURCE_COMMIT='0d654ab3306515b1b63621a5c6548554034482dc';
const runtimeEnvironment=typeof __BUILD_INFO__==='undefined'?'dev':__BUILD_INFO__.environment;
const MINION_CLIPS=Object.freeze({idle:[0,29],attack:[30,59],dead:[60,89]});
const ANIMAL_CLIPS=Object.freeze({idle:[0,29],attack:[30,59],dead:[60,89],walk:[90,119]});

export const EXTERNAL_MONSTER_MODELS=Object.freeze({
 'goblin-runt':Object.freeze({path:'minion/minion-a01.glb',gitBlobSha:'f7700d62b6252f14601743f156049ef3b8454f96',bytes:170752,targetHeight:2.0,fps:24,clips:MINION_CLIPS,manifestation:'hostile'}),
 'horn-brute':Object.freeze({path:'minion/minion-b01.glb',gitBlobSha:'b8419a471e5f2619c17b2a8905dec1a04101430b',bytes:174432,targetHeight:2.05,fps:24,clips:MINION_CLIPS,manifestation:'massive'}),
 'maw-stalker':Object.freeze({path:'minion/minion-c01.glb',gitBlobSha:'584b85913b3a075948e6630b6a0d48883227c6d4',bytes:151100,targetHeight:1.95,fps:24,clips:MINION_CLIPS,manifestation:'shadow'}),
 'grave-ogre':Object.freeze({path:'minion/minion-d01.glb',gitBlobSha:'ceb7beba04fa67b9607af9c8e704d1d084dd13ee',bytes:189716,targetHeight:2.15,fps:24,clips:MINION_CLIPS,manifestation:'massive'}),
 'night-bat':Object.freeze({path:'animal/Bat.glb',gitBlobSha:'766de4372d17206835c491f80f6b0db367ca0012',bytes:63308,targetHeight:1.7,fps:24,clips:ANIMAL_CLIPS,hover:.7,manifestation:'swarm'})
});

export function externalMonsterSpec(species){return EXTERNAL_MONSTER_MODELS[species]||null;}
export function externalMonsterUrl(species){const spec=externalMonsterSpec(species);return spec?projectAssetUrl(`model/gobkit/${species}/${spec.gitBlobSha}.glb`,{environment:runtimeEnvironment}):null;}
const hex=bytes=>[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
export async function gitBlobSha(bytes){
 const data=bytes instanceof ArrayBuffer?new Uint8Array(bytes):new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const header=new TextEncoder().encode(`blob ${data.byteLength}\0`),payload=new Uint8Array(header.byteLength+data.byteLength);payload.set(header);payload.set(data,header.byteLength);
 return hex(new Uint8Array(await crypto.subtle.digest('SHA-1',payload)));
}
export function monsterAnimationTime(spec,state='idle',time=0,progress=0){
 const clips=spec?.clips||{},range=clips[state]||clips.idle;if(!range)return 0;
 const [start,end]=range,fps=spec.fps||24,first=start/fps,last=end/fps;
 if(state==='dead')return last;
 if(state==='attack')return first+(last-first)*Math.max(0,Math.min(1,Number(progress)||0));
 const duration=Math.max(1/fps,(end-start+1)/fps),clock=((Number(time)||0)%duration+duration)%duration;
 return first+clock;
}

export async function loadExternalMonsterModel(species,renderer=null,fetchImpl=fetch,{signal=null,onProgress=()=>{}}={}){
 const spec=externalMonsterSpec(species);if(!spec)return null;
 const url=externalMonsterUrl(species),timeout=AbortSignal.timeout(15000),requestSignal=signal&&AbortSignal.any?AbortSignal.any([signal,timeout]):signal||timeout,response=await fetchImpl(url,{signal:requestSignal});
 if(!response.ok)throw new Error(`Monster model HTTP ${response.status}`);
 const bytes=await readResponseArrayBufferWithProgress(response,{expectedBytes:spec.bytes,maxBytes:512*1024,onProgress});
 if(bytes.byteLength!==spec.bytes)throw new Error(`Monster model size mismatch: ${species}`);
 if(await gitBlobSha(bytes)!==spec.gitBlobSha)throw new Error(`Monster model integrity mismatch: ${species}`);
 const loader=createCompressedGLTFLoader({renderer,transcoderPath:`${import.meta.env.BASE_URL}basis/`});
 try{
  const gltf=await loader.parseAsync(bytes,url),visual=gltf.scene;visual.updateMatrixWorld(true);
  let box=new T.Box3().setFromObject(visual),size=box.getSize(new T.Vector3());if(!Number.isFinite(size.y)||size.y<=0)throw new Error(`Monster model bounds invalid: ${species}`);
  visual.scale.multiplyScalar(spec.targetHeight/size.y);visual.updateMatrixWorld(true);box=new T.Box3().setFromObject(visual);const center=box.getCenter(new T.Vector3());
  visual.position.x-=center.x;visual.position.y-=box.min.y;visual.position.z-=center.z;visual.updateMatrixWorld(true);
  visual.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
  const root=new T.Group();root.userData.externalMonster=true;root.userData.species=species;root.userData.manifestationProfile=spec.manifestation;root.add(visual);
  let mixer=null,action=null;if(gltf.animations?.length){mixer=new T.AnimationMixer(visual);action=mixer.clipAction(gltf.animations[0]);action.play();mixer.setTime(0);}
  return{species,spec,url,root,visual,mixer,action,clip:gltf.animations?.[0]||null};
 }finally{loader.dispose();}
}

export function updateExternalMonsterModel(instance,actor,time,{form='hollow',eating=false}={}){
 if(!instance||!actor)return;const {root,spec,mixer,clip}=instance;
 const growth=Math.max(.28,Math.min(3.2,Number(actor.growthScale)||1)),formScale=form==='brute'?1.12:form==='stalker'?1.04:1;
 root.position.set(Number(actor.x)||0,(spec.hover||0)*growth,Number(actor.z)||0);root.rotation.set(0,Number(actor.yaw)||0,0);root.scale.setScalar(growth*formScale);
 const dead=actor.dead||actor.hp<=0,attacking=eating||Boolean(actor.pose)||Boolean(actor.skill),moving=(Number(actor.speed)||0)>.05;
 const state=dead?'dead':attacking?'attack':moving&&spec.clips.walk?'walk':'idle';
 const progress=eating&&Number.isFinite(actor.devourProgress)?actor.devourProgress:Number.isFinite(actor.progress)?actor.progress:(Number(time)||0)%1;
 if(mixer&&clip){const sample=Math.min(Math.max(0,monsterAnimationTime(spec,state,time,progress)),Math.max(0,clip.duration-1/(spec.fps||24)));mixer.setTime(sample);}
 root.rotation.x=eating?.10*Math.sin(Math.max(0,Math.min(1,progress))*Math.PI):0;
}
