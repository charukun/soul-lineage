import {reviewVfxAssetFrom,reviewVfxEffectFrom} from './review-vfx-multisource.js';

export const RESOURCE_DATA_SOURCE=Object.freeze({
  namespace:'resource-data',repository:'effekseer/ResourceData',revision:'54e00177497a148647373099e996d0392f28aec2',
  license:'CC0-1.0',licenseRepository:'effekseer/Effekseer',licenseRevision:'216c307192ff9bc7917472b05731bbc4fd46fa04',
  licensePath:'docs/readme_sample.txt',licenseBlob:'dd2fdb3f8a615965bf54be715a6c0ccbca5daae3',licenseBytes:731,
});
const asset=(sourcePath,byteLength,gitBlobSha,reviewLibrary=false)=>reviewVfxAssetFrom(RESOURCE_DATA_SOURCE,{sourcePath,byteLength,gitBlobSha,reviewLibrary});
const effect=(id,sourcePath,author)=>reviewVfxEffectFrom(RESOURCE_DATA_SOURCE,id,sourcePath,author);

export const RESOURCE_DATA_ASSETS=Object.freeze([
]);
export const RESOURCE_DATA_EFFECTS=Object.freeze([
]);
