import {EFFECT_MATERIALS_SOURCE as SOURCE} from './review-vfx-additional-sources.js';
import {reviewVfxEffectFrom as effectFrom} from './review-vfx-multisource.js';
const effect=(id,sourcePath,author)=>effectFrom(SOURCE,id,sourcePath,author);
export const REVIEW_VFX_EFFECT_MATERIALS_EFFECTS=Object.freeze([
  effect("lib-effectmaterials-fire01","Effects/ef_fire01.efkefc","KTK_kumamoto"),
  effect("lib-effectmaterials-fire02","Effects/ef_fire02.efkefc","KTK_kumamoto"),
  effect("lib-effectmaterials-fire03","Effects/ef_fire03.efkefc","KTK_kumamoto"),
  effect("lib-effectmaterials-holy01","Effects/ef_holy01.efkefc","Effekseer"),
  effect("lib-effectmaterials-ice01","Effects/ef_ice01.efkefc","KTK_kumamoto"),
  effect("lib-effectmaterials-ice02","Effects/ef_ice02.efkefc","KTK_kumamoto"),
  effect("lib-effectmaterials-ice03","Effects/ef_ice03.efkefc","KTK_kumamoto"),
  effect("lib-effectmaterials-lightning01","Effects/ef_lightning01.efkefc","KTK_kumamoto"),
  effect("lib-effectmaterials-lightning02","Effects/ef_lightning02.efkefc","KTK_kumamoto"),
  effect("lib-effectmaterials-lightning03","Effects/ef_lightning03.efkefc","KTK_kumamoto"),
  effect("lib-effectmaterials-parts-hit01","Effects/ef_parts_hit01.efkefc","Effekseer"),
  effect("lib-effectmaterials-parts-hit02","Effects/ef_parts_hit02.efkefc","Effekseer"),
  effect("lib-effectmaterials-wind01","Effects/ef_wind01.efkefc","KTK_kumamoto"),
  effect("lib-effectmaterials-wind02","Effects/ef_wind02.efkefc","KTK_kumamoto"),
  effect("lib-effectmaterials-wind03","Effects/ef_wind03.efkefc","KTK_kumamoto"),
]);
