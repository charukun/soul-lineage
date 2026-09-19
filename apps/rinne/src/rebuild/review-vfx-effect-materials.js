import {reviewVfxAssetFrom,reviewVfxEffectFrom} from './review-vfx-multisource.js';

export const EFFECT_MATERIALS_SOURCE=Object.freeze({
  namespace:'effect-materials',repository:'effekseer/EffectMaterials',revision:'8bf8edfedb51ac09af3d4cf788cb81746ea75a82',
  license:'CC0-1.0',licensePath:'README.md',licenseBlob:'2c7a97258bb46a322e2c52451031e96cbd1e71fb',licenseBytes:674,
});
const asset=(sourcePath,byteLength,gitBlobSha,reviewLibrary=false)=>reviewVfxAssetFrom(EFFECT_MATERIALS_SOURCE,{sourcePath,byteLength,gitBlobSha,reviewLibrary});
const effect=(id,sourcePath,author)=>reviewVfxEffectFrom(EFFECT_MATERIALS_SOURCE,id,sourcePath,author);

export const EFFECT_MATERIALS_ASSETS=Object.freeze([
]);
export const EFFECT_MATERIALS_EFFECTS=Object.freeze([
]);
