import {createCompressedGLTFLoader} from './compressed-gltf.js';
import {kaykitHumanoidFromGLTF} from './kaykit-rig.js';

const DEFAULT_MAX_BYTES=8*1024*1024;

export function gitBlobSha(bytes){
  const body=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  const header=new TextEncoder().encode(`blob ${body.byteLength}\0`);
  const joined=new Uint8Array(header.byteLength+body.byteLength);
  joined.set(header);joined.set(body,header.byteLength);
  return crypto.subtle.digest('SHA-1',joined).then(digest=>[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join(''));
}

export async function verifyKaykitRuntimeBytes(model,bytes,{maxBytes=DEFAULT_MAX_BYTES}={}){
  if(!model?.source?.gitBlobSha||!Number.isInteger(model.source.byteLength))throw Error('KayKit model provenance is incomplete');
  const body=bytes instanceof ArrayBuffer?bytes:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  if(body.byteLength!==model.source.byteLength||body.byteLength>maxBytes)throw Error(`${model.label}: KayKit runtime asset size mismatch`);
  const actual=await gitBlobSha(body);
  if(actual!==model.source.gitBlobSha)throw Error(`${model.label}: KayKit runtime asset Git blob mismatch`);
  return body;
}

export async function loadKaykitRuntimeModel({model,url,renderer=null,transcoderPath='/basis/',fetchImpl=globalThis.fetch,maxBytes=DEFAULT_MAX_BYTES}={}){
  if(!model?.runtime?.url||!url)throw Error('KayKit runtime model and URL are required');
  const response=await fetchImpl(url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`${model.label}: KayKit model HTTP ${response.status}`);
  const declared=Number(response.headers.get('content-length'));
  if(Number.isFinite(declared)&&declared>maxBytes)throw Error(`${model.label}: KayKit runtime asset too large`);
  const bytes=await verifyKaykitRuntimeBytes(model,await response.arrayBuffer(),{maxBytes});
  const compressed=createCompressedGLTFLoader({renderer,transcoderPath});
  try{
    const gltf=await compressed.parseAsync(bytes,url),humanoid=kaykitHumanoidFromGLTF(gltf);
    return Object.freeze({
      url,gltf,
      rig:Object.freeze({humanoid,expressions:[],springs:[],warnings:[`KayKit ${model.rigId} / ${model.license} foundation`]}),
      modelId:model.id,familyId:model.familyId,license:model.license,
      compression:Object.freeze({meshopt:true,ktx2:Boolean(renderer)})
    });
  }finally{compressed.dispose();}
}
