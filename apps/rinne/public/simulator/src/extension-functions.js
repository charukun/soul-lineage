// Common VRMA bank. Each source is decoded once, then retargeted per humanoid.
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {VRMAnimationLoaderPlugin,VRMLookAtQuaternionProxy,createVRMAnimationClip} from '../vendor/three-vrm-animation.module.js';
import catalog from './motion-catalog.js';
let bankPromise;
export function sharedBank(){
 return bankPromise??=(async()=>{const bank={};for(const item of catalog){const loader=new GLTFLoader();loader.register(p=>new VRMAnimationLoaderPlugin(p));const boot=window.__RINNE_BOOT__,loaded=Object.keys(bank).length;
 await boot?.step({stage:'motion',message:'モーションを読み込んでいます：'+item.id,loaded,total:catalog.length,unit:'clips'});
 const bytes=boot?await boot.readAsset('motion:'+item.id,item.file):window.assetBuffer?await window.assetBuffer('motion:'+item.id):await(await fetch(item.file)).arrayBuffer();const gltf=await loader.parseAsync(bytes,'');const anim=gltf.userData.vrmAnimations?.[0];if(!anim)throw Error('VRMAを解析できません: '+item.id);bank[item.id]=anim;boot?.progress({stage:'motion',message:'モーションを読み込んでいます',loaded:Object.keys(bank).length,total:catalog.length,unit:'clips'});}return bank;})().catch(e=>{bankPromise=null;throw e;});
}
export async function retargetBank(vrm){
 const bank=await sharedBank(),clips={};
 if(vrm.lookAt){const proxy=new VRMLookAtQuaternionProxy(vrm.lookAt);proxy.name='ReviewLookAtProxy';vrm.scene.add(proxy);}
 for(const item of catalog){const clip=createVRMAnimationClip(bank[item.id],vrm);clip.name=item.id;
  // Keep locomotion in-place for a fixed studio, preserving vertical motion.
  if(['walk','run-slow'].includes(item.id))for(const track of clip.tracks)if(track.name.endsWith('.position'))for(let i=0;i<track.values.length;i+=3){track.values[i]=0;track.values[i+2]=0;}
  if(!Number.isFinite(clip.duration)||clip.duration<=0||clip.tracks.some(t=>Array.from(t.values).some(v=>!Number.isFinite(v))))throw Error('VRMAに不正値: '+item.id);
  clips[item.id]=clip;
 }
 return clips;
}
