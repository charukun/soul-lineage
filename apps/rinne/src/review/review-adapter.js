import { installPostureWeaponPreview } from './posture-preview.js';
import { installWeaponReviewPolish } from './weapon-review-polish.js';
import { reviewPresets as baseReviewPresets, reviewWeapons, disposeLoaded, installReviewExtensions as installBase } from './review-adapter-base.js';
import { REVIEW_REFERENCE_MODELS, reviewReferenceModel } from './reference-character-models.js';
import { attachReferenceCharacterController } from '@soul/rendering/master-character-reference';

export const reviewPresets=Object.freeze([
  baseReviewPresets[0],
  ...REVIEW_REFERENCE_MODELS,
  ...baseReviewPresets.slice(1)
]);
export { reviewWeapons, disposeLoaded };

function sourcePresetId(presetId){
  return reviewReferenceModel(presetId)?.sourcePresetId||presetId;
}

function installRuntimeReference(loaded,reference){
  const actor={root:loaded.root,visual:loaded.root,bones:loaded.bones,sample(){},destroy(){}};
  const controller=attachReferenceCharacterController(actor);
  controller.setIdentity(reference);
  const dispose=loaded.dispose.bind(loaded);let disposed=false;
  loaded.dispose=()=>{if(disposed)return;disposed=true;controller.destroy();dispose();};
  loaded.label=`${reference.name} / Runtime Reference / 全モーションソース`;
  loaded.referenceModel=reference;
  loaded.referenceDiagnostics=()=>controller.diagnostics();
  return loaded;
}

export async function installReviewExtensions(options){
  const base=await installBase(options);
  return {...base,async loadPreset(args){
    const reference=reviewReferenceModel(args?.presetId);
    let loaded=await base.loadPreset({...args,presetId:sourcePresetId(args?.presetId)});
    if(reference)loaded=installRuntimeReference(loaded,reference);
    return installPostureWeaponPreview(installWeaponReviewPolish(loaded));
  }};
}
