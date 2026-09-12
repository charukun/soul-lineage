import { installPostureWeaponPreview } from './posture-preview.js';
import { installWeaponReviewPolish } from './weapon-review-polish.js';
import { reviewPresets, reviewWeapons, disposeLoaded, installReviewExtensions as installBase } from './review-adapter-base.js';
export { reviewPresets, reviewWeapons, disposeLoaded };
export async function installReviewExtensions(options){
  const base=await installBase(options);
  return {...base,async loadPreset(args){
    const body=installPostureWeaponPreview(installWeaponReviewPolish(await base.loadPreset(args)));
    const originalGet=body.getClip?.bind(body),cache=new WeakMap();
    body.getClip=(name,opts)=>{
      const clip=originalGet?.(name,opts);if(!clip||name!=='技 / 流し斬り')return clip;
      if(!cache.has(clip)){const stretched=clip.clone();for(const track of stretched.tracks)track.scale(1.28);stretched.resetDuration();cache.set(clip,stretched);}return cache.get(clip);
    };
    return body;
  }};
}
