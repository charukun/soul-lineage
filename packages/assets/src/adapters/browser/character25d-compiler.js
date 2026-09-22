import {autoPrepareCharacterSheet} from './character25d-image.js';
import {createCharacter25DDraft,assertCharacter25D,CHARACTER25D_SCHEMA,character25dRasterEnvelope,migrateCharacter25D,APPEARANCE_VIEWS} from '../../character25d-schema.js';
import {analyzeSilhouette,createHumanoidRig} from '../../character25d-rig.js';
import {loadSpriteImage,spriteAssetBlob,verifySprite25dBundle,loadSprite25dDraft} from './sprite25d-assets.js';
import {LIMITS} from '../../sprite25d-manifest.js';

async function silhouette(asset) {
  const image=await loadSpriteImage(spriteAssetBlob(asset)),canvas=document.createElement('canvas');canvas.width=asset.width;canvas.height=asset.height;
  try{const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);return analyzeSilhouette(ctx.getImageData(0,0,asset.width,asset.height).data,asset.width,asset.height);}
  finally{canvas.width=canvas.height=1;}
}
export async function compileCharacter25D(file,{id,name,onProgress=()=>{}}={}) {
  onProgress('輪郭と方向の候補を解析しています');
  const prepared=await autoPrepareCharacterSheet(file),source=prepared.assets[prepared.references.sheet];
  const draft=createCharacter25DDraft({id:id||'character.'+source.sha256.slice(0,20),name:name||String(file.name||'キャラクター').replace(/\.[^.]+$/,'').slice(0,100)});
  Object.assign(draft.assets,prepared.assets);Object.assign(draft.references,prepared.references);draft.pose=prepared.pose;
  onProgress('骨格・部位・動作をつないでいます');
  for(const key of ['front','side','back']) {
    const hash=prepared.references[key];if(!hash)continue;
    const analysis=await silhouette(draft.assets[hash]);
    draft.appearance[key]={asset:hash,bounds:analysis.bounds,side:'unknown',mirror:false,status:'detected-candidate'};
    if(key==='front')draft.rig=createHumanoidRig({...analysis.proportions,handLandmarks:analysis.handLandmarks});
  }
  draft.provenance={...draft.provenance,sourceSha256:source.sha256,sourceDimensions:[source.width,source.height],segmentation:'edge-connected-background+alpha-bounds',rig:draft.rig.version,viewAssociation:'left-to-right-front-side-back-candidates',diagnostics:prepared.diagnostics};
  return assertCharacter25D(draft);
}
export async function upgradeCharacter25D(input) {
  if(input.schema===CHARACTER25D_SCHEMA)return verifyCharacter25DBundle(input);
  const legacy=await verifySprite25dBundle(input);
  if(!legacy.pose) return legacy; // Atlas-only v1 retains its real authored playback.
  const analysis=await silhouette(legacy.assets[legacy.pose]);
  const result=migrateCharacter25D(legacy,{bounds:analysis.bounds});result.rig=createHumanoidRig({...analysis.proportions,handLandmarks:analysis.handLandmarks});
  return assertCharacter25D(result);
}
export async function verifyCharacter25DBundle(input) {
  assertCharacter25D(input);
  if(input.schema!==CHARACTER25D_SCHEMA)return verifySprite25dBundle(input);
  const verified=await verifySprite25dBundle(character25dRasterEnvelope(input));
  // Alpha/bounds disagreement must not introduce floating feet or hidden pixels.
  for(const view of Object.values(input.appearance).filter(Boolean)) {
    const analysis=await silhouette(verified.assets[view.asset]);
    if(JSON.stringify(analysis.bounds)!==JSON.stringify(view.bounds))throw new Error('輪郭の範囲が画像のalphaと一致しません');
  }
  return structuredClone(input);
}
export async function readCharacter25DFile(file) {
  if(!file?.size||file.size>LIMITS.bundleBytes)throw new Error('bundleが大きすぎます');
  let value;try{value=JSON.parse(await file.text());}catch{throw new Error('bundle JSONを読み込めません');}
  return upgradeCharacter25D(value);
}
const DATABASE='rinne-character25d-forge-v2';
async function transaction(mode,operation) {
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(DATABASE,1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('下書きを開けません'));});
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction('drafts',mode);let result;const req=operation(tx.objectStore('drafts'));req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(new Error('下書きを保存できません'));});}finally{db.close();}
}
export async function saveCharacter25DDraft(bundle){assertCharacter25D(bundle);await transaction('readwrite',s=>s.put(bundle,'draft:'+bundle.id));await transaction('readwrite',s=>s.put(bundle.id,'last'));}
export async function loadCharacter25DDraft(){const id=await transaction('readonly',s=>s.get('last'));if(id){const value=await transaction('readonly',s=>s.get('draft:'+id));if(value)return verifyCharacter25DBundle(value);}const old=await loadSprite25dDraft();return old?upgradeCharacter25D(old):null;}
export async function deleteCharacter25DDraft(id){await transaction('readwrite',s=>s.delete('draft:'+id));await transaction('readwrite',s=>s.delete('last'));}
export function downloadCharacter25D(bundle){assertCharacter25D(bundle);const url=URL.createObjectURL(new Blob([JSON.stringify(bundle)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=bundle.id+'.character25d.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function reassociateCharacter25D(bundle,associations) {
  const next=structuredClone(bundle),old=structuredClone(bundle.appearance);
  for(const [key,source] of Object.entries(associations)) {if(!APPEARANCE_VIEWS.includes(key)||!APPEARANCE_VIEWS.includes(source))throw new Error('Unknown view');next.appearance[key]=old[source]?{...old[source],status:'user-associated'}:null;}
  return assertCharacter25D(next);
}

