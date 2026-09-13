import { installPostureWeaponPreview } from './posture-preview.js';
import { installWeaponReviewPolish } from './weapon-review-polish.js';
import { reviewPresets, reviewWeapons, disposeLoaded, installReviewExtensions as installBase } from './review-adapter-base.js';
export { reviewPresets, reviewWeapons, disposeLoaded };

export async function installReviewExtensions(options){
  const base=await installBase(options);
  return {...base,async loadPreset(args){
    return installPostureWeaponPreview(installWeaponReviewPolish(await base.loadPreset(args)));
  }};
}
