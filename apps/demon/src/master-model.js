import {createCompressedGLTFLoader} from '@soul/rendering/compressed-gltf';
import {kaykitHumanoidFromGLTF} from '@soul/rendering/kaykit-rig';
import {KAYKIT_MODEL_BY_KEY} from '@soul/characters';

const MODEL=KAYKIT_MODEL_BY_KEY.knight;
export const MASTER_HUMAN_GIT_BLOB_SHA=MODEL.source.gitBlobSha;
export const MASTER_HUMAN_BYTES=MODEL.source.byteLength;
// Legacy export retained only for dependent imports. It is no longer the runtime
// integrity authority and no Shino model bytes are loaded by this module.
export const SHINO_REVIEW_SHA256='retired-conditional-model';
const MAX_MODEL_BYTES=8*1024*1024;
let pending;

export function masterHumanModelUrl(href){return new URL(`../rinne/${MODEL.runtime.url.replace(/^\.\//,'')}`,href).href;}

async function gitBlobSha(bytes){
  const header=new TextEncoder().encode(`blob ${bytes.byteLength}\0`),body=new Uint8Array(bytes),joined=new Uint8Array(header.byteLength+body.byteLength);
  joined.set(header);joined.set(body,header.byteLength);
  const digest=await crypto.subtle.digest('SHA-1',joined);
  return[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}

// Demon humans now use the pinned CC0 KayKit foundation. The legacy production
// pool remains as a provider-neutral clone/pose wrapper, but receives a KayKit
// Rig_Medium humanoid descriptor with no VRM expression or spring metadata.
export function loadDemonMasterModel(renderer=null) {
  if(!pending)pending=(async()=>{
    const url=masterHumanModelUrl(location.href);
    const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`MasterCharacter HTTP ${response.status}`);
    const declared=Number(response.headers.get('content-length'));
    if(Number.isFinite(declared)&&declared>MAX_MODEL_BYTES)throw new Error('MasterCharacter asset too large');
    const bytes=await response.arrayBuffer();
    if(bytes.byteLength!==MASTER_HUMAN_BYTES||bytes.byteLength>MAX_MODEL_BYTES)throw new Error('MasterCharacter asset size mismatch');
    if(await gitBlobSha(bytes)!==MASTER_HUMAN_GIT_BLOB_SHA)throw new Error('MasterCharacter asset Git blob mismatch');
    const compressed=createCompressedGLTFLoader({renderer,transcoderPath:`${import.meta.env.BASE_URL}basis/`});
    try{
      const gltf=await compressed.parseAsync(bytes,url),humanoid=kaykitHumanoidFromGLTF(gltf);
      return {url,gltf,rig:{humanoid,expressions:[],springs:[],warnings:['KayKit Rig_Medium / CC0 character foundation']},compression:{meshopt:true,ktx2:Boolean(renderer)},license:MODEL.license,modelId:MODEL.id};
    }finally{compressed.dispose();}
  })().catch(error=>{pending=null;throw error;});
  return pending;
}
