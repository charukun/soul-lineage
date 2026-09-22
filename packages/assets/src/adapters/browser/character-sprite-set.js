import {SPRITE_SET_BUNDLE_SCHEMA,SPRITE_SET_LIMITS as LIMITS,assertCharacterSpriteSet} from '../../character-sprite-set.js';
import {loadSpriteImage} from './sprite25d-assets.js';
const resources=new WeakSet();
export const spriteSetDigest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
const fail=message=>{throw new Error('Sprite Set: '+message);};
function parseJSON(text,limit){if(text.length>limit)fail('JSONの容量が上限を超えています');try{return JSON.parse(text);}catch{fail('JSONを読み込めません');}}
function bytesFromDataURL(value,max){
  if(typeof value!=='string'||!value.startsWith('data:image/png;base64,'))fail('埋め込み透過PNGが必要です');
  const encoded=value.slice(22);
  if(encoded.length>Math.ceil(max/3)*4||encoded.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))fail('PNGデータが不正です');
  return Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
}
export function inspectSpriteSetPNG(bytes,asset){
  const magic=[137,80,78,71,13,10,26,10];
  if(bytes.length<33||!magic.every((v,i)=>bytes[i]===v)||String.fromCharCode(...bytes.slice(12,16))!=='IHDR')fail('PNGの署名が一致しません');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),width=view.getUint32(16),height=view.getUint32(20);
  if(width!==asset.width||height!==asset.height||width>LIMITS.edge||height>LIMITS.edge)fail('PNGの実寸がmanifestと一致しません');
  return {width,height};
}
function dataURL(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('PNGの読み込みに失敗しました'));reader.readAsDataURL(blob);});}
function inspectCells(image,manifest,assetId){
  const a=manifest.assets[assetId],canvas=document.createElement('canvas');canvas.width=a.width;canvas.height=a.height;
  try{
    if(image.naturalWidth!==a.width||image.naturalHeight!==a.height)fail('復号後の画像寸法が不正です');
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,a.width,a.height).data,[w,h]=manifest.render.frameSize;
    for(let y0=0;y0<a.height;y0+=h)for(let x0=0;x0<a.width;x0+=w){
      let visible=false,transparent=false;
      for(let y=y0;y<y0+h&&!(visible&&transparent);y++)for(let x=x0;x<x0+w;x++){
        const alpha=pixels[(y*a.width+x)*4+3];visible ||= alpha>8;transparent ||= alpha<255;if(visible&&transparent)break;
      }
      if(!visible||!transparent)fail(`${a.file}: 空または不透明なコマ (${x0/w}, ${y0/h})`);
    }
  }finally{canvas.width=canvas.height=1;}
}
export function isSpriteSetResources(value){return resources.has(value);}
export async function loadSpriteSetResources(input,{playable=false}={}){
  if(!input||input.schema!==SPRITE_SET_BUNDLE_SCHEMA)fail('bundle schemaが一致しません');
  if(JSON.stringify(input).length>LIMITS.bundleBytes)fail('bundleが大きすぎます');
  const bundle=structuredClone(input),m=assertCharacterSpriteSet(bundle.manifest,{playable});
  if(JSON.stringify(m).length>LIMITS.manifestBytes)fail('manifestが大きすぎます');
  if(!bundle.images||Object.keys(bundle.images).length!==Object.keys(m.assets).length)fail('画像の数が一致しません');
  // External claims are retained as an annotation, never as an approval capability.
  if(m.stage==='approved')bundle.importedApprovalClaim=structuredClone(m.approval);
  m.stage='local-draft';m.approval={productionApproved:false};
  const images=new Map(),decoded=new Map();let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;for(const image of decoded.values())image.src='';images.clear();decoded.clear();};
  try{
    for(const [id,a] of Object.entries(m.assets)){
      const bytes=bytesFromDataURL(bundle.images[id],LIMITS.assetBytes);
      if(bytes.byteLength!==a.byteLength||await spriteSetDigest(bytes)!==a.sha256)fail(a.file+': hash/byteLengthが一致しません');
      inspectSpriteSetPNG(bytes,a);
      let image=decoded.get(a.sha256);
      if(!image){image=await loadSpriteImage(new Blob([bytes],{type:'image/png'}));decoded.set(a.sha256,image);}
      inspectCells(image,m,id);images.set(id,image);
    }
    const result={bundle,manifest:m,images,dispose,get disposed(){return disposed;},get decodedCount(){return decoded.size;}};
    resources.add(result);return result;
  }catch(error){dispose();throw error;}
}
export async function readSpriteSetFiles(fileList,options={}){
  const files=Array.from(fileList||[]);
  if(!files.length||files.length>LIMITS.assets+1)fail('manifest.jsonと行動PNGを選んでください');
  const json=files.filter(f=>/\.json$/i.test(f.name));
  if(json.length!==1)fail('JSONは1つだけ選んでください');
  const file=json[0];if(file.size>LIMITS.bundleBytes)fail('JSONが大きすぎます');
  const parsed=parseJSON(await file.text(),LIMITS.bundleBytes);
  if(parsed.schema===SPRITE_SET_BUNDLE_SCHEMA){if(files.length!==1)fail('bundleは単独で選んでください');return loadSpriteSetResources(parsed,options);}
  if(file.size>LIMITS.manifestBytes)fail('manifestが大きすぎます');
  const m=assertCharacterSpriteSet(parsed,options),images={};
  const root=(file.webkitRelativePath||file.name).replace(/[^/]+$/,'');
  const byPath=new Map();
  for(const f of files){const path=(f.webkitRelativePath||f.name).slice(root.length);if(byPath.has(path))fail('ファイルパスが重複しています');byPath.set(path,f);}
  if(files.length!==Object.keys(m.assets).length+1)fail('manifestにないファイルが含まれています');
  for(const [id,a] of Object.entries(m.assets)){
    const image=byPath.get(a.file);if(!image||image.size!==a.byteLength||image.size>LIMITS.assetBytes)fail(a.file+': 画像が不足しているか容量が一致しません');
    images[id]=await dataURL(image);
  }
  return loadSpriteSetResources({schema:SPRITE_SET_BUNDLE_SCHEMA,manifest:m,images},options);
}
async function boundedFetch(url,max){
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)fail('HTTP '+response.status);
  const reader=response.body.getReader(),parts=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();fail('HTTP応答が容量上限を超えています');}parts.push(value);}}finally{reader.releaseLock();}
  return new Blob(parts);
}
export async function loadSpriteSetURL(url,options={}){
  const source=new URL(url,location.href);if(source.origin!==location.origin)fail('サンプルmanifestは同じoriginから読み込んでください');
  const m=assertCharacterSpriteSet(parseJSON(await (await boundedFetch(source,LIMITS.manifestBytes)).text(),LIMITS.manifestBytes),options),images={};
  for(const [id,a] of Object.entries(m.assets)){const blob=await boundedFetch(new URL(a.file,source),a.byteLength);images[id]=await dataURL(new Blob([blob],{type:'image/png'}));}
  return loadSpriteSetResources({schema:SPRITE_SET_BUNDLE_SCHEMA,manifest:m,images},options);
}
export function downloadSpriteSetBundle(bundle){
  assertCharacterSpriteSet(bundle.manifest);
  const url=URL.createObjectURL(new Blob([JSON.stringify(bundle)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=bundle.manifest.id+'.sprite-set.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
