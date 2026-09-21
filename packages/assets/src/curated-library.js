import catalog from '../generated/curated-library.json' with {type:'json'};
import {projectAssetUrl,PROJECT_ASSET_MAX_BYTES} from './runtime-origin.js';

// Compact generated data backs the existing visualAssetRegistry and review catalogs.
// Importing this module performs no fetch and does not preload model/audio payloads.
const rows=Array.isArray(catalog)?catalog:catalog.assets.map(row=>{
  const pack=catalog.packs[row.pack];
  return {...row,status:'MATERIALIZED',origin:'artist-authored',license:pack.license,author:pack.author,
    originalSource:pack.originalSource,localPath:`apps/review/public/library/${row.runtimePath}`,
    licensePath:pack.licensePath,
    source:{repository:pack.repository,revision:pack.revision,path:row.sourcePath,
      hash:`git-blob:${row.sourceGitBlobSha}`,gitBlobSha:row.sourceGitBlobSha,byteLength:row.sourceByteLength}};
});
export const CURATED_ASSETS=Object.freeze(rows.map(row=>Object.freeze({...row,source:Object.freeze(row.source)})));
export const CURATED_MODEL_ASSETS=Object.freeze(CURATED_ASSETS.filter(row=>row.active&&row.kind!=='audio'));
export const CURATED_SOUND_ASSETS=Object.freeze(CURATED_ASSETS.filter(row=>row.active&&row.kind==='audio'));
export const CURATED_PROVENANCE_PATH='provenance/curation-20260921.json';
const byId=new Map(CURATED_ASSETS.map(row=>[row.id,row]));
if(byId.size!==CURATED_ASSETS.length)throw new Error('Duplicate curated asset ID');
export function curatedAssetById(id){
  const asset=byId.get(id);
  if(!asset)throw new Error(`Unknown curated asset: ${id}`);
  return asset;
}

/** Entries are consumed only by the existing central visualAssetRegistry. */
export function curatedVisualEntries(){
  return CURATED_MODEL_ASSETS.map(asset=>[asset.visualAssetId,{
    id:asset.visualAssetId,type:asset.type,origin:asset.origin,status:asset.status,active:true,
    license:asset.license,licensePath:asset.licensePath,localPath:asset.localPath,
    attribution:asset.author,source:asset.source,
    sha256:asset.sha256,gitBlobSha:asset.gitBlobSha,byteLength:asset.byteLength,
    runtime:{format:'glb',assetPath:asset.runtimePath,lazy:true,
      animationMode:asset.kind==='creature'?'native-skeleton':'none'},
    review:{route:'/review-objects',assetId:asset.id,productionVisualApproval:false},
  }]);
}

/** Fetch a materialized payload, never an upstream acquisition URL. */
export async function fetchCuratedAssetBytes(assetOrId,{environment='dev',signal,fetchImpl=globalThis.fetch}={}){
  const asset=typeof assetOrId==='string'?curatedAssetById(assetOrId):assetOrId;
  if(!asset||!Number.isSafeInteger(asset.byteLength)||asset.byteLength<1||asset.byteLength>PROJECT_ASSET_MAX_BYTES||!/^[a-f0-9]{64}$/.test(asset.sha256||''))throw new Error('Invalid curated asset integrity metadata');
  const url=projectAssetUrl(asset.runtimePath,{environment});
  const response=await fetchImpl(url,{signal,redirect:'error',credentials:'omit'});
  if(!response.ok)throw new Error(`Asset load failed (${response.status}): ${asset.id}`);
  const declared=response.headers.get('content-length');
  if(declared!==null&&Number(declared)!==asset.byteLength){await response.body?.cancel();throw new Error(`Asset byteLength mismatch: ${asset.id}`);}
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength!==asset.byteLength)throw new Error(`Asset byteLength mismatch: ${asset.id}`);
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
  if(actual!==asset.sha256)throw new Error(`Asset SHA-256 mismatch: ${asset.id}`);
  if(signal?.aborted)throw signal.reason||new DOMException('Aborted','AbortError');
  return bytes;
}
