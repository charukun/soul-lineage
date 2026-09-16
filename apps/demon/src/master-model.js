import {createCompressedGLTFLoader} from '@soul/rendering/compressed-gltf';
import {shinoProductionRigFromGLTF} from '@soul/rendering/master-character-production';

export const MASTER_HUMAN_SHA256='4f95570fcd0f663e1497b3f4e922d3aa96be014cc4cc0255e70db3f206c1b1db';
// Legacy export name is retained for dependent tests/imports while the actual surface asset changes.
export const SHINO_REVIEW_SHA256=MASTER_HUMAN_SHA256;
const MAX_MODEL_BYTES=32*1024*1024;
let pending;
export function masterHumanModelUrl(href){return new URL('../rinne/simulator/assets/PROTAGONIST_VILLAGER_V1.glb',href).href;}

// NPCs and the playable character share one audited production humanoid template. Failed
// requests are evicted so an explicit selection retry can recover on the same page.
export function loadDemonMasterModel(renderer=null) {
  if(!pending)pending=(async()=>{
    const url=masterHumanModelUrl(location.href);
    const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`MasterCharacter HTTP ${response.status}`);
    const declared=Number(response.headers.get('content-length'));
    if(Number.isFinite(declared)&&declared>MAX_MODEL_BYTES)throw new Error('MasterCharacter asset too large');
    const bytes=await response.arrayBuffer();
    if(bytes.byteLength<28||bytes.byteLength>MAX_MODEL_BYTES)throw new Error('MasterCharacter asset size invalid');
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    if(hash!==MASTER_HUMAN_SHA256)throw new Error('MasterCharacter asset hash mismatch');
    const compressed=createCompressedGLTFLoader({renderer,transcoderPath:`${import.meta.env.BASE_URL}basis/`});
    try{
      const gltf=await compressed.parseAsync(bytes,url);
      return {url,gltf,rig:await shinoProductionRigFromGLTF(gltf),compression:{meshopt:true,ktx2:Boolean(renderer)}};
    }finally{compressed.dispose();}
  })().catch(error=>{pending=null;throw error;});
  return pending;
}
