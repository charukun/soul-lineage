import { installPostureWeaponPreview } from './posture-preview.js';
import { installWeaponReviewPolish } from './weapon-review-polish.js';
import { reviewPresets as baseReviewPresets, reviewWeapons, disposeLoaded, installReviewExtensions as installBase } from './review-adapter-base.js';

const SHINO_REFERENCE_PROFILE=Object.freeze({
  version:1,
  face:'classic',
  hair:'original',
  body:'balanced',
  outfit:'uniform',
  accessory:'none'
});

const SHINO_REFERENCE_PRESET=Object.freeze({
  id:'shino.reference.v2',
  label:'Shino Reference v2',
  name:'Sendagaya Shino / Character Reference v2',
  portrait:'SHINO',
  kind:'character',
  sourcePresetId:'model.SHINO',
  referencePath:'docs/characters/references/shino/shino-character-reference-sheet-v2.png',
  profile:SHINO_REFERENCE_PROFILE
});

export const reviewPresets=Object.freeze([
  baseReviewPresets[0],
  SHINO_REFERENCE_PRESET,
  ...baseReviewPresets.slice(1)
]);
export { reviewWeapons, disposeLoaded };

function sourcePresetId(presetId){
  return presetId===SHINO_REFERENCE_PRESET.id?SHINO_REFERENCE_PRESET.sourcePresetId:presetId;
}

export async function installReviewExtensions(options){
  const base=await installBase(options);
  return {...base,async loadPreset(args){
    const reference=args?.presetId===SHINO_REFERENCE_PRESET.id;
    const loaded=await base.loadPreset({...args,presetId:sourcePresetId(args?.presetId)});
    if(reference){
      loaded.label=`${SHINO_REFERENCE_PRESET.name} / CURRENT MASTER / 全モーションソース`;
      loaded.referenceModel=SHINO_REFERENCE_PRESET;
    }
    return installPostureWeaponPreview(installWeaponReviewPolish(loaded));
  }};
}
