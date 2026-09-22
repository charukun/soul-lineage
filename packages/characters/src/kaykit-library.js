import imported from '../generated/kaykit-current.json' with {type:'json'};
import {KAYKIT_MODELS} from './kaykit-foundation.js';
import {deepFreeze} from './master-character.js';
import {projectAssetUrl} from '../../assets/src/runtime-origin.js';

// Metadata only: importing the library never fetches a GLB or a motion asset.
// The existing foundation descriptor and Static Asset Origin contracts are reused.
// Gameplay's KAYKIT_MODELS, protagonist IDs, selection and save data stay unchanged.
export const KAYKIT_CURRENT_MODELS=deepFreeze(imported.models.map(model=>({
  ...model,
  runtime:{...model.runtime,url:projectAssetUrl(model.runtime.assetPath)},
  thumbnailUrl:model.thumbnailPath?projectAssetUrl(model.thumbnailPath):null
})));
export const KAYKIT_CHARACTER_LIBRARY=deepFreeze([
  ...KAYKIT_CURRENT_MODELS,
  ...KAYKIT_MODELS.map(model=>({...model,label:model.label+' · 1.0',legacyVersion:true}))
]);
export const KAYKIT_LIBRARY_COUNTS=deepFreeze(imported.counts);
export const KAYKIT_CHARACTER_PACKS=deepFreeze(imported.packs);
export function kaykitLibraryModel(id){
  const model=KAYKIT_CHARACTER_LIBRARY.find(model=>model.id===id);
  if(!model)throw new Error('Unknown KayKit library model: '+id);
  return model;
}
