import catalog from '../generated/curated-library.json' with {type:'json'};
import characters from '../generated/quaternius-characters.json' with {type:'json'};
import {projectAssetUrl,PROJECT_ASSET_MAX_BYTES} from './runtime-origin.js';

// Metadata only: payloads are fetched lazily through the existing Asset Origin.
const authoredRows=Array.isArray(catalog)?catalog:catalog.assets.map(row=>{
  const pack=catalog.packs[row.pack];
  return {...row,status:'MATERIALIZED',origin:'artist-authored',license:pack.license,author:pack.author,
    originalSource:pack.originalSource,localPath:`apps/review/public/library/${row.runtimePath}`,
    licensePath:pack.licensePath,
    source:{repository:pack.repository,revision:pack.revision,path:row.sourcePath,
      hash:`git-blob:${row.sourceGitBlobSha}`,gitBlobSha:row.sourceGitBlobSha,byteLength:row.sourceByteLength}};
});
// Review availability is NOT runtime/protagonist/production approval. Native rigs
// stay outside the KayKit character family and gameplay selection contracts.
const characterRows=characters.map(row=>({...row,active:row.review?.excluded!==true,
  reviewOnly:true,productionReady:false,runtimeApproval:false,
  provenancePath:'provenance/quaternius-characters-20260922.json'}));
export const CURATED_ASSETS=Object.freeze([...authoredRows,...characterRows].map(row=>Object.freeze({...row,source:Object.freeze(row.source)})));
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
      animationMode:['creature','character'].includes(asset.kind)?'native-skeleton':'none',
      ...(asset.kind==='character'?{modelId:asset.modelId,rigId:asset.rig.id,reviewOnly:true,productionReady:false}:{})},
    review:{route:'/review-objects',assetId:asset.id,productionVisualApproval:false,
      ...(asset.kind==='character'?{modelId:asset.modelId,nativeClips:asset.availableReviewClips,provenancePath:asset.provenancePath}:{})},
  }]);
}

/** Fetch a materialized payload, never an upstream acquisition URL. */
export async function fetchCuratedAssetBytes(assetOrId,{environment='dev',signal,fetchImpl=globalThis.fetch}={}){
  const asset=typeof assetOrId==='string'?curatedAssetById(assetOrId):assetOrId;
  if(!asset||!Number.isSafeInteger(asset.byteLength)||asset.byteLength<1||asset.byteLength>PROJECT_ASSET_MAX_BYTES||!/^[a-f0-9]{64}$/.test(asset.sha256||''))throw new Error('Invalid curated asset integrity metadata');
  const url=projectAssetUrl(asset.runtimePath,{environment});
  const response=await fetchImpl(url,{signal,redirect:'error',credentials:'omit'});
  if(!response.ok)throw new Error(`Asset load failed (${response.status}): ${asset.id}`);
  const declared=response.headers.get('content-length'),encoding=response.headers.get('content-encoding');
  if(declared!==null&&(!encoding||encoding==='identity')&&Number(declared)!==asset.byteLength){await response.body?.cancel();throw new Error(`Asset byteLength mismatch: ${asset.id}`);}
  const bytes=new Uint8Array(asset.byteLength);let offset=0;
  if(response.body){
    const reader=response.body.getReader();
    try{
      for(;;){
        const {done,value}=await reader.read();if(done)break;
        if(offset+value.byteLength>bytes.length){await reader.cancel();throw new Error(`Asset byteLength mismatch: ${asset.id}`);}
        bytes.set(value,offset);offset+=value.byteLength;
      }
    }finally{reader.releaseLock();}
  }
  if(offset!==asset.byteLength)throw new Error(`Asset byteLength mismatch: ${asset.id}`);
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
  if(actual!==asset.sha256)throw new Error(`Asset SHA-256 mismatch: ${asset.id}`);
  if(signal?.aborted)throw signal.reason||new DOMException('Aborted','AbortError');
  return bytes.buffer;
}
