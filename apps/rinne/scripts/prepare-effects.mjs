import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {EFFECT_SOURCE,EFFECT_RUNTIME,EFFECT_ASSETS,RUNTIME_ASSETS,EFFECT_PUBLIC_PATH,REVIEW_VFX_LIBRARY_SOURCE} from '../src/rebuild/authored-effect-manifest.js';
import {EFFECT_MATERIALS_SOURCE,RESOURCE_DATA_SOURCE,EFFEKSEER_EXAMPLES_SOURCE} from '../src/rebuild/review-vfx-library-manifest.js';

const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const REVIEWED_EFFECT_LAYOUTS=new Map([[1500,6],[1610,7],[1710,'dependent-files']]);
const REVIEWED_EFFECT_VERSIONS=new Set(REVIEWED_EFFECT_LAYOUTS.keys());
export const EFFECT_DOWNLOADS=Object.freeze([
  ...EFFECT_ASSETS.map(row=>({...row,...{repository:row.repository||EFFECT_SOURCE.repository,revision:row.revision||EFFECT_SOURCE.revision,sourcePath:row.sourcePath||row.path,target:row.path}})),
  ...RUNTIME_ASSETS.map(row=>({...row,...{repository:EFFECT_RUNTIME.repository,revision:EFFECT_RUNTIME.revision,target:row.path==='LICENSE'?'LICENSE-MIT.txt':path.posix.basename(row.path)}})),
  {path:EFFECT_SOURCE.licensePath,repository:EFFECT_SOURCE.licenseRepository,revision:EFFECT_SOURCE.licenseRevision,
    gitBlobSha:EFFECT_SOURCE.licenseBlob,byteLength:731,target:'LICENSE-SAMPLES.txt'},
  {path:REVIEW_VFX_LIBRARY_SOURCE.licensePath,sourcePath:REVIEW_VFX_LIBRARY_SOURCE.licensePath,repository:REVIEW_VFX_LIBRARY_SOURCE.repository,revision:REVIEW_VFX_LIBRARY_SOURCE.revision,
    gitBlobSha:REVIEW_VFX_LIBRARY_SOURCE.licenseBlob,byteLength:REVIEW_VFX_LIBRARY_SOURCE.licenseBytes,target:'LICENSE-REVIEW-LIBRARY-CC0.txt'},
  {path:EFFECT_MATERIALS_SOURCE.licensePath,sourcePath:EFFECT_MATERIALS_SOURCE.licensePath,repository:EFFECT_MATERIALS_SOURCE.repository,revision:EFFECT_MATERIALS_SOURCE.revision,
    gitBlobSha:EFFECT_MATERIALS_SOURCE.licenseBlob,byteLength:EFFECT_MATERIALS_SOURCE.licenseBytes,target:'LICENSE-EFFECT-MATERIALS-CC0.txt'},
  {path:RESOURCE_DATA_SOURCE.licensePath,sourcePath:RESOURCE_DATA_SOURCE.licensePath,repository:RESOURCE_DATA_SOURCE.licenseRepository,revision:RESOURCE_DATA_SOURCE.licenseRevision,
    gitBlobSha:RESOURCE_DATA_SOURCE.licenseBlob,byteLength:RESOURCE_DATA_SOURCE.licenseBytes,target:'LICENSE-RESOURCE-DATA-CC0.txt'},
  {path:EFFEKSEER_EXAMPLES_SOURCE.licensePath,sourcePath:EFFEKSEER_EXAMPLES_SOURCE.licensePath,repository:EFFEKSEER_EXAMPLES_SOURCE.repository,revision:EFFEKSEER_EXAMPLES_SOURCE.revision,
    gitBlobSha:EFFEKSEER_EXAMPLES_SOURCE.licenseBlob,byteLength:EFFEKSEER_EXAMPLES_SOURCE.licenseBytes,target:'LICENSE-EFFEKSEER-EXAMPLES-MIT.txt'},
]);
export function gitBlobSha(bytes){return createHash('sha1').update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex');}
export function verifyEffectBytes(row,bytes){
  if(bytes.byteLength!==row.byteLength||gitBlobSha(bytes)!==row.gitBlobSha)throw Error(`Effekseer integrity mismatch: ${row.path}`);
  return true;
}

/** Read reviewed INFO dependency layouts without regenerating authored binaries. */
export function effectDependencies(bytes,expectedVersion=null){
  const b=Buffer.from(bytes);if(b.length<8||b.toString('ascii',0,4)!=='EFKE')throw Error('Not an EFKE original');
  for(let p=8;p+8<=b.length;){
    const tag=b.toString('ascii',p,p+4),size=b.readUInt32LE(p+4),end=p+8+size;
    if(end>b.length)throw Error('Truncated effect chunk');
    if(tag==='INFO'){
      let cursor=p+8;const read=()=>{if(cursor+4>end)throw Error('Truncated INFO');const n=b.readUInt32LE(cursor);cursor+=4;return n;};
      const version=read(),groupCount=REVIEWED_EFFECT_LAYOUTS.get(version);
      if(!REVIEWED_EFFECT_VERSIONS.has(version)||!groupCount)throw Error(`Unreviewed effect version: ${version}`);
      if(expectedVersion!=null&&version!==expectedVersion)throw Error(`Effect INFO version mismatch: expected ${expectedVersion}, got ${version}`);
      const result=[];
      const readString=()=>{const length=read()*2;if(length<2||length>4096||cursor+length>end)throw Error('Invalid effect dependency');const value=b.toString('utf16le',cursor,cursor+length).replace(/\0$/,'');cursor+=length;return value;};
      const accept=value=>{if(!value||value.includes('\\\\')||value.startsWith('/')||value.split('/').includes('..')||value.includes(':'))throw Error('Unsafe effect dependency');result.push(value);};
      if(groupCount==='dependent-files'){
        const count=read();if(count>512)throw Error('Too many effect dependencies');
        for(let i=0;i<count;i++){read();read();accept(readString());}
      }else{
        for(let group=0;group<groupCount;group++){
          const count=read();if(count>128)throw Error('Too many effect dependencies');
          for(let i=0;i<count;i++)accept(readString());
        }
      }
      if(cursor!==end)throw Error('Unexpected INFO data');
      return [...new Set(result)];
    }
    p=end;
  }
  throw Error('Effect INFO missing');
}

export function verifyEffectClosure(row,bytes){
  if(!Number.isInteger(row.infoVersion)&&!row.reviewLibrary)throw Error(`Missing reviewed effect version: ${row.path}`);
  const declared=new Set(EFFECT_ASSETS.map(item=>item.path));
  const expectedVersion=Number.isInteger(row.infoVersion)?row.infoVersion:null;
  for(const dependency of effectDependencies(bytes,expectedVersion)){
    const target=path.posix.join(path.posix.dirname(row.path),dependency);
    if(!declared.has(target))throw Error(`Unpinned effect dependency: ${target}`);
  }
}

async function readBounded(response,limit){
  const reader=response.body?.getReader();
  if(!reader){const b=Buffer.from(await response.arrayBuffer());if(b.length>limit)throw Error('Oversized effect response');return b;}
  const parts=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw Error('Oversized effect response');parts.push(Buffer.from(value));}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}
  return Buffer.concat(parts,size);
}

export async function acquireEffect(row,{outputRoot,fetchImpl=globalThis.fetch}={}){
  if(!/^[a-f\d]{40}$/.test(row.revision)||!row.target||row.target.includes('..')||path.isAbsolute(row.target))throw Error('Unsafe effect manifest');
  const target=path.join(outputRoot,row.target);
  try{const bytes=await readFile(target);verifyEffectBytes(row,bytes);return {target,source:'verified-cache',bytes};}catch(error){if(error.code&&error.code!=='ENOENT')throw error;}
  const sourcePath=row.sourcePath||row.path;
  const encoded=sourcePath.split('/').map(encodeURIComponent).join('/');
  const urls=[`https://raw.githubusercontent.com/${row.repository}/${row.revision}/${encoded}`,
    `https://cdn.jsdelivr.net/gh/${row.repository}@${row.revision}/${encoded}`];
  let bytes,lastError;
  for(const url of urls){
    try{
      const response=await fetchImpl(url,{signal:AbortSignal.timeout(30_000),redirect:'follow'});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      bytes=await readBounded(response,row.byteLength);verifyEffectBytes(row,bytes);break;
    }catch(error){lastError=error;bytes=null;}
  }
  if(!bytes)throw Error(`Effekseer acquisition failed: ${row.path}: ${lastError?.message}`);
  await mkdir(path.dirname(target),{recursive:true});const temporary=`${target}.${randomUUID()}.tmp`;
  try{await writeFile(temporary,bytes,{flag:'wx'});await rename(temporary,target);}finally{await rm(temporary,{force:true});}
  return {target,source:'pinned-upstream',bytes};
}

export async function prepareRinneEffects({outputRoot=path.join(appRoot,'public',EFFECT_PUBLIC_PATH),fetchImpl=globalThis.fetch}={}){
  const rows=[];
  for(let start=0;start<EFFECT_DOWNLOADS.length;start+=4){
    rows.push(...await Promise.all(EFFECT_DOWNLOADS.slice(start,start+4).map(row=>acquireEffect(row,{outputRoot,fetchImpl}).then(result=>{
      if(row.path.endsWith('.efkefc'))verifyEffectClosure(row,result.bytes);
      return {path:row.target,source:result.source};
    }))));
  }
  await writeFile(path.join(outputRoot,'NOTICE.txt'),
    'Effekseer for WebGL 1.70: MIT (LICENSE-MIT.txt).\\nOriginal review library and ResourceData samples: CC0-1.0.\\nEffectMaterials: CC0-1.0 (LICENSE-EFFECT-MATERIALS-CC0.txt).\\nEffekseer Examples: MIT (LICENSE-EFFEKSEER-EXAMPLES-MIT.txt).\\nUnmodified originals; review-side placement and model-relative scale are adaptations.\\nSources and exact revisions: apps/rinne/src/rebuild/review-vfx-library-manifest.js\\n');
  return rows;
}
