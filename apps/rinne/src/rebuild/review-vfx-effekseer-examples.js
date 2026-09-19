import {reviewVfxAssetFrom,reviewVfxEffectFrom} from './review-vfx-multisource.js';

export const EFFEKSEER_EXAMPLES_SOURCE=Object.freeze({
  namespace:'effekseer-examples',repository:'effekseer/Effekseer',revision:'82b37081a302b9f9eff0bf14dc6c845fca8c3c54',
  license:'MIT',licensePath:'LICENSE',licenseBlob:'c7c0094a9a163d8013086a42b3dcb3a46f984cb1',licenseBytes:1084,
});
const asset=(sourcePath,byteLength,gitBlobSha,reviewLibrary=false)=>reviewVfxAssetFrom(EFFEKSEER_EXAMPLES_SOURCE,{sourcePath,byteLength,gitBlobSha,reviewLibrary});
const effect=(id,sourcePath)=>reviewVfxEffectFrom(EFFEKSEER_EXAMPLES_SOURCE,id,sourcePath,'Effekseer');

export const EFFEKSEER_EXAMPLES_ASSETS=Object.freeze([
]);
export const EFFEKSEER_EXAMPLES_EFFECTS=Object.freeze([
]);
