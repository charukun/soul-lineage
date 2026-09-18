import {KAYKIT_MODEL_BY_KEY} from '@soul/characters';
import {loadKaykitRuntimeModel} from '@soul/rendering/kaykit-runtime-model';
import {DEMON_CHARACTER_RUNTIME} from './character-runtime-adapter.js';

const MODEL=KAYKIT_MODEL_BY_KEY.knight;
export const MASTER_HUMAN_GIT_BLOB_SHA=MODEL.source.gitBlobSha;
export const MASTER_HUMAN_BYTES=MODEL.source.byteLength;
// Legacy export retained only for dependent imports. It is no longer the runtime
// integrity authority and no Shino model bytes are loaded by this module.
export const SHINO_REVIEW_SHA256='retired-conditional-model';
let pending;

export function masterHumanModelUrl(href){
  return new URL(`./assets/kaykit/${MODEL.source.path.split('/').at(-1)}`,href).href;
}

export function loadDemonMasterModel(renderer=null) {
  if(!pending)pending=loadKaykitRuntimeModel({
    model:MODEL,
    url:masterHumanModelUrl(location.href),
    renderer,
    transcoderPath:`${import.meta.env.BASE_URL}basis/`
  }).then(result=>({
    ...result,
    runtime:DEMON_CHARACTER_RUNTIME,
    rig:result.rig
  })).catch(error=>{pending=null;throw error;});
  return pending;
}
