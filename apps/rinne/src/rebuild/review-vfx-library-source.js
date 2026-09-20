import {normalizeInspirationAttributes} from '@soul/game-data';
// Shared metadata/builders for the pinned CC0 review VFX library.
const ATTRIBUTE_RULES=Object.freeze([
  ['fire',/fire|flame|ember|meteor|meteo|salamander/i],
  ['water',/water|aqua|undine/i],
  ['ice',/cold|ice|icicle|snow/i],
  ['wind',/wind|tornado|tornade|turbulence|sylph/i],
  ['lightning',/thunder|lightning|electric/i],
  ['earth',/soil|earth|rock|gohlem|sand/i],
  ['light',/light(?!ning)|holy|sacred|benediction|moonlight/i],
  ['dark',/dark|shadow/i],
]);
export const inferVfxAttributes=sourcePath=>Object.freeze(normalizeInspirationAttributes(ATTRIBUTE_RULES.filter(([,pattern])=>pattern.test(String(sourcePath||''))).map(([id])=>id)));
export const REVIEW_VFX_LIBRARY_SOURCE = Object.freeze({repository:"munokura/Effekseer-sample-for-RPG-Tkool-MZ",revision:"7faccfd4c769d49f56877950eb4b815846b952e5",license:'CC0-1.0',licensePath:'LICENSE.md',licenseBlob:"0e259d42c996742e9e3cba14c677129b2c1b6311",licenseBytes:7048,basePath:'review-library'});
export const reviewVfxAsset=(sourcePath,byteLength,gitBlobSha,reviewLibrary=false)=>Object.freeze({
  path:`${REVIEW_VFX_LIBRARY_SOURCE.basePath}/${sourcePath}`,sourcePath,byteLength,gitBlobSha,
  repository:REVIEW_VFX_LIBRARY_SOURCE.repository,revision:REVIEW_VFX_LIBRARY_SOURCE.revision,license:REVIEW_VFX_LIBRARY_SOURCE.license,
  reviewOnly:true,...(reviewLibrary?{reviewLibrary:true}:{})
});
const scaleFor=sourcePath=>sourcePath.endsWith('/Tktk03_Light.efkefc')?.05:sourcePath.startsWith('Tktk03/')?.065:1;
export const reviewVfxEffect=(id,sourcePath,author)=>Object.freeze({
  id,path:`${REVIEW_VFX_LIBRARY_SOURCE.basePath}/${sourcePath}`,sourcePath,author,
  scale:scaleFor(sourcePath),lifetime:2,attributes:inferVfxAttributes(sourcePath),reviewOnly:true
});
