import {RESOURCE_DATA_CURRENT_SOURCE as SOURCE} from './review-vfx-additional-sources.js';
import {reviewVfxEffectFrom as effectFrom} from './review-vfx-multisource.js';
const effect=(id,sourcePath,author='Effekseer')=>effectFrom(SOURCE,id,sourcePath,author);
export const REVIEW_VFX_RESOURCE_DATA_EFFECTS=Object.freeze([
  effect("lib-resourcedata-simple-turbulence-fireworks","samples/00_Basic/Simple_Turbulence_Fireworks.efkefc"),
  effect("lib-resourcedata-aura01","samples/00_Version16/Aura01.efkefc"),
  effect("lib-resourcedata-barrior01","samples/00_Version16/Barrior01.efkefc"),
  effect("lib-resourcedata-barrior02","samples/00_Version16/Barrior02.efkefc"),
  effect("lib-resourcedata-barrior03","samples/00_Version16/Barrior03.efkefc"),
  effect("lib-resourcedata-forcefieldtornado","samples/00_Version16/ForceFieldTornado.efkefc"),
  effect("lib-resourcedata-hanmado-hit","samples/03_Hanmado01/Effect/hit_hanmado_0409.efkefc","Hanmado"),
]);
