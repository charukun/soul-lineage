import './machine-review.js';
import { installPostureWeaponPreview } from './posture-preview.js';
import { installWeaponReviewPolish } from './weapon-review-polish.js';
import { reviewPresets as baseReviewPresets, reviewWeapons, disposeLoaded, installReviewExtensions as installBase } from './review-adapter-base.js';
import { REVIEW_REFERENCE_MODELS, reviewReferenceModel } from './reference-character-models.js';
import { attachReferenceCharacterController } from '@soul/rendering/master-character-reference';
import { ARCANIST_ATLAS_STUDY_ID, attachArcanistAtlasStudy } from '@soul/rendering/arcanist-atlas-study';

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
  const study=reference.id===ARCANIST_ATLAS_STUDY_ID?attachArcanistAtlasStudy(actor,reference):null;
  const dispose=loaded.dispose.bind(loaded);let disposed=false;
  loaded.dispose=()=>{if(disposed)return;disposed=true;study?.destroy();controller.destroy();dispose();};
  loaded.label=study?`${reference.name} / BLOCKOUT Study / 全モーションソース`:`${reference.name} / Runtime Reference / 全モーションソース`;
  loaded.referenceModel=reference;
  loaded.referenceDiagnostics=()=>({
    ...controller.diagnostics(),
    ...(study?{study:{id:study.id,stage:study.stage,modelingMode:study.modelingMode,productionReady:study.productionReady,meshCount:study.meshCount}}:{})
  });
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
