export const DEV_ASSET_ORIGIN='https://soul-lineage-review-dev.c-okamoto.workers.dev/library/';
export const PROJECT_ASSET_MAX_BYTES=20*1024*1024;
const THIRD_PARTY_RUNTIME_HOSTS=Object.freeze(new Set(['raw.githubusercontent.com','cdn.jsdelivr.net','codeberg.org']));
export function projectAssetOrigin(environment='dev'){
  if(environment==='dev'||environment==='staging'||environment==='local')return DEV_ASSET_ORIGIN;
  throw new Error('Production asset origin is not configured; do not route Production through DEV assets');
}
export function projectAssetUrl(path,{environment='dev'}={}){
  const clean=String(path||'').replace(/^\/+/, '');
  if(!clean||clean.split('/').some(part=>!part||part==='.'||part==='..')||/^[a-z][a-z\d+.-]*:/i.test(clean))throw new Error('Unsafe project asset path');
  return new URL(clean,projectAssetOrigin(environment)).href;
}
export function isThirdPartyRuntimeAssetUrl(value){
  try{return THIRD_PARTY_RUNTIME_HOSTS.has(new URL(String(value)).hostname);}catch{return false;}
}
