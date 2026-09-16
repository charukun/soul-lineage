import {SHINO_REFERENCE_V2_SHA256} from '@soul/characters';
import {loadShinoReferenceV2Runtime} from '@soul/rendering/shino-reference-v2-runtime';

export const MASTER_HUMAN_SHA256=SHINO_REFERENCE_V2_SHA256;
// Legacy export name is retained for dependent tests/imports while the actual surface asset changes.
export const SHINO_REVIEW_SHA256=MASTER_HUMAN_SHA256;
let pending;
export function masterHumanModelUrl(href){return new URL('../rinne/simulator/assets/SHINO_REFERENCE_V2.vrm',href).href;}

// NPCs and the playable character share one audited production humanoid template. Failed
// requests are evicted so an explicit selection retry can recover on the same page.
export function loadDemonMasterModel(renderer=null) {
  if(!pending)pending=(async()=>{
    const url=masterHumanModelUrl(location.href);
    const loaded=await loadShinoReferenceV2Runtime({
      url,
      renderer,
      transcoderPath:`${import.meta.env.BASE_URL}basis/`,
      timeoutMs:20000
    });
    return {url,gltf:loaded.gltf,rig:loaded.rig,audit:loaded.audit,compression:loaded.compression};
  })().catch(error=>{pending=null;throw error;});
  return pending;
}