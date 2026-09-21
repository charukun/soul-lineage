import {projectAssetUrl,PROJECT_ASSET_MAX_BYTES} from '@soul/assets';
import manifest from './manifest.json' with {type:'json'};

export const NOCTURNE_MODELS=Object.freeze(Object.values(manifest.models));
export function assetUrl(path,base=location.href){
  // This app owns the canonical library. Its local/immutable builds serve those same paths.
  const canonical=new URL(projectAssetUrl(path));
  return new URL(canonical.pathname,new URL(base).origin).href;
}
export async function withTimeout(promise,ms,message){
  let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),ms);})]);}finally{clearTimeout(timer);}
}
export async function verifyBytes(row,buffer){
  if(buffer.byteLength!==row.byteLength||!buffer.byteLength||buffer.byteLength>PROJECT_ASSET_MAX_BYTES)throw new Error('Asset byteLength mismatch: '+row.id);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==row.sha256)throw new Error('Asset SHA-256 mismatch: '+row.id);
  if(new DataView(buffer).getUint32(0,true)!==0x46546c67)throw new Error('Asset is not a GLB: '+row.id);
  return buffer;
}
async function download(row,signal,base){
  let error;
  for(let attempt=0;attempt<2;attempt++){
    if(signal.aborted)throw signal.reason;
    try{
      const response=await fetch(assetUrl(row.path,base),{signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),cache:attempt?'reload':'default',credentials:'same-origin'});
      if(!response.ok)throw new Error('Asset HTTP '+response.status+': '+row.id);
      return await verifyBytes(row,await response.arrayBuffer());
    }catch(cause){error=cause;if(signal.aborted)throw cause;}
  }
  throw error;
}
export async function loadNocturneAssets({loader,signal,onProgress=()=>{},base=location.href}){
  const models=new Map(),queue=[...NOCTURNE_MODELS];let byteLength=0,completed=0;
  const allowed=new Set(manifest.files.map(row=>assetUrl(row.path,base)));
  loader.manager.setURLModifier(url=>{
    if(url.startsWith('blob:')||url.startsWith('data:'))return url;
    const absolute=new URL(url,location.href).href;
    if(!allowed.has(absolute))throw new Error('Unregistered asset dependency: '+absolute);
    return absolute;
  });
  await Promise.all(Array.from({length:4},async()=>{
    while(queue.length){
      if(signal.aborted)throw signal.reason;
      const row=queue.shift(),bytes=await download(row,signal,base);
      const gltf=await withTimeout(loader.parseAsync(bytes,new URL('.',assetUrl(row.path,base)).href),20000,'GLB parse timed out: '+row.id);
      if(signal.aborted)throw signal.reason;
      models.set(row.id,gltf);byteLength+=row.byteLength;onProgress(++completed,NOCTURNE_MODELS.length);
    }
  }));
  return {models,byteLength};
}
