import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {shinoProductionRigFromGLTF} from '@soul/rendering/master-character-production';

export const SHINO_REVIEW_SHA256='83843ade7dbdfaacc9d601bda099fcb5757527e339b9c5deb223a2c2f5eb28ca';
const MAX_MODEL_BYTES=32*1024*1024;
let pending;
export function masterHumanModelUrl(href){return new URL('../rinne/simulator/assets/SHINO_review.vrm',href).href;}

// NPCs and the playable character share one audited download/template. Failed
// requests are evicted so an explicit selection retry can recover on the same page.
export function loadDemonMasterModel() {
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
    if(hash!==SHINO_REVIEW_SHA256)throw new Error('MasterCharacter asset hash mismatch');
    const gltf=await new GLTFLoader().parseAsync(bytes,url);
    return {url,gltf,rig:await shinoProductionRigFromGLTF(gltf)};
  })().catch(error=>{pending=null;throw error;});
  return pending;
}
