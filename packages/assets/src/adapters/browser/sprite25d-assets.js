import {assertSprite25dManifest,LIMITS,SHINO_ID} from '../../sprite25d-manifest.js';
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
function assertRasterSignature(bytes,type){
  const at=(offset,values)=>values.every((value,index)=>bytes[offset+index]===value);
  const valid=type==='image/png'?at(0,[137,80,78,71,13,10,26,10]):
    type==='image/jpeg'?at(0,[255,216,255]):
    type==='image/webp'&&at(0,[82,73,70,70])&&at(8,[87,69,66,80]);
  if(!valid)throw new Error('画像の実体がPNG/WebP/JPEGの宣言と一致しません');
}
export function spriteAssetBlob(asset){
  const binary=atob(asset.dataUrl.slice(asset.dataUrl.indexOf(',')+1));
  const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
  assertRasterSignature(bytes,asset.mediaType);
  return new Blob([bytes],{type:asset.mediaType});
}
export async function loadSpriteImage(blob){
  const url=URL.createObjectURL(blob),image=new Image();
  try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('画像を復号できません'));image.src=url;});return image;}
  finally{URL.revokeObjectURL(url);}
}
function inspectImage(image){
  const width=image.naturalWidth,height=image.naturalHeight;
  if(!width||!height||width>LIMITS.edge||height>LIMITS.edge||width*height>LIMITS.pixels)throw new Error('画像は4096×4096以下にしてください');
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  try{
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
    const data=ctx.getImageData(0,0,width,height).data;let visible=false,transparent=false;
    for(let i=3;i<data.length;i+=4){visible ||= data[i]>0;transparent ||= data[i]<255;if(visible&&transparent)break;}
    if(!visible)throw new Error('画像が完全に透明です');
    return {width,height,hasTransparency:transparent};
  }finally{canvas.width=canvas.height=1;}
}
export async function importSpriteAsset(file,provenance={kind:'user-upload'}){
  if(!file?.size||file.size>LIMITS.assetBytes||!['image/png','image/webp','image/jpeg'].includes(file.type))throw new Error('PNG/WebP/JPEG、1枚8 MiB以下を選んでください');
  const bytes=await file.arrayBuffer();assertRasterSignature(new Uint8Array(bytes),file.type);
  const sha256=await digest(bytes),meta=inspectImage(await loadSpriteImage(file));
  const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('画像を読み込めません'));reader.readAsDataURL(file);});
  return {sha256,byteLength:file.size,mediaType:file.type,name:String(file.name||'image.png').slice(0,200),...meta,dataUrl,
    provenance:{...provenance,author:'user-supplied-unverified',license:'unverified'}};
}
export async function validateSprite25dAtlas(asset,columns){
  if(!Number.isInteger(columns)||columns<1||columns>32||asset.width%columns||asset.height%8||asset.width/columns<8||asset.height/8<8)throw new Error('シートは8行・等サイズのフレームにしてください');
  const canvas=document.createElement('canvas');canvas.width=asset.width;canvas.height=asset.height;
  try{
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(await loadSpriteImage(spriteAssetBlob(asset)),0,0);
    const data=ctx.getImageData(0,0,asset.width,asset.height).data,cellW=asset.width/columns,cellH=asset.height/8,occupied=new Uint8Array(columns*8);
    for(let row=0;row<8;row++)for(let col=0;col<columns;col++){
      for(let y=row*cellH;y<(row+1)*cellH&&!occupied[row*columns+col];y++)for(let x=col*cellW;x<(col+1)*cellW;x++)if(data[(y*asset.width+x)*4+3]>9){occupied[row*columns+col]=1;break;}
    }
    if(occupied.some(value=>!value))throw new Error('空の方向・フレームがあります。未作成のコマを登録済みにはできません');
  }finally{canvas.width=canvas.height=1;}
}
export async function verifySprite25dBundle(input){
  const bundle=structuredClone(assertSprite25dManifest(input));
  for(const asset of Object.values(bundle.assets)){
    const blob=spriteAssetBlob(asset);
    if(blob.size!==asset.byteLength||await digest(await blob.arrayBuffer())!==asset.sha256)throw new Error('画像のhash/byteLengthが一致しません');
    const meta=inspectImage(await loadSpriteImage(blob));
    if(meta.width!==asset.width||meta.height!==asset.height||meta.hasTransparency!==asset.hasTransparency)throw new Error('画像の実寸・透明度がmanifestと一致しません');
  }
  const checked=new Set();
  for(const clips of Object.values(bundle.animations))for(const clip of Object.values(clips)){
    if(!clip)continue;const key=`${clip.asset}:${clip.columns}`;if(checked.has(key))continue;checked.add(key);await validateSprite25dAtlas(bundle.assets[clip.asset],clip.columns);
  }
  return bundle;
}
export async function readSprite25dFile(file){
  if(!file?.size||file.size>LIMITS.bundleBytes)throw new Error('bundleファイルが大きすぎます');
  let value;try{value=JSON.parse(await file.text());}catch{throw new Error('bundle JSONを読み込めません');}
  return verifySprite25dBundle(value);
}
export async function cropSpriteReference(asset,{rect,removeBorderWhite=false}){
  const [x,y,width,height]=rect;
  if(rect.some(n=>!Number.isInteger(n))||x<0||y<0||width<1||height<1||x+width>asset.width||y+height>asset.height||width*height>4194304)throw new Error('切り出し範囲は画像内、合計4Mピクセル以下にしてください');
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  try{
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(await loadSpriteImage(spriteAssetBlob(asset)),x,y,width,height,0,0,width,height);
    if(removeBorderWhite){
      // Remove only border-connected near-white. Enclosed white stays; edge-connected clothing needs visual review.
      const image=ctx.getImageData(0,0,width,height),p=image.data,seen=new Uint8Array(width*height),queue=new Uint32Array(width*height);let head=0,tail=0;
      const visit=i=>{if(seen[i])return;seen[i]=1;const k=i*4;if(p[k+3]===0||(p[k]>=248&&p[k+1]>=248&&p[k+2]>=248))queue[tail++]=i;};
      for(let col=0;col<width;col++){visit(col);visit((height-1)*width+col);}
      for(let row=0;row<height;row++){visit(row*width);visit(row*width+width-1);}
      while(head<tail){const i=queue[head++],col=i%width;p[i*4+3]=0;if(col)visit(i-1);if(col<width-1)visit(i+1);if(i>=width)visit(i-width);if(i<width*(height-1))visit(i+width);}
      ctx.putImageData(image,0,0);
    }
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('PNGを作成できません')),'image/png'));
    return importSpriteAsset(new File([blob],'shino-pose.png',{type:'image/png'}),{kind:'reference-crop',parentSha256:asset.sha256,rect:[...rect],removeBorderWhite:Boolean(removeBorderWhite)});
  }finally{canvas.width=canvas.height=1;}
}
const DATABASE='rinne-character25d-drafts-v1';
async function openDraftDB(){
  return new Promise((resolve,reject)=>{const request=indexedDB.open(DATABASE,1);request.onupgradeneeded=()=>request.result.createObjectStore('drafts');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('端末保存を開けません。bundleを書き出してください'));request.onblocked=()=>reject(new Error('端末保存が別タブで使用中です'));});
}
async function draftTransaction(mode,operation){
  const db=await openDraftDB();
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction('drafts',mode),request=operation(tx.objectStore('drafts'));let result;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(new Error('端末保存に失敗しました。bundleを書き出してください'));});}
  finally{db.close();}
}
export async function loadSprite25dDraft(){const value=await draftTransaction('readonly',store=>store.get(SHINO_ID));return value?verifySprite25dBundle(value):null;}
export function saveSprite25dDraft(bundle){assertSprite25dManifest(bundle);return draftTransaction('readwrite',store=>store.put(bundle,SHINO_ID));}
export function deleteSprite25dDraft(){return draftTransaction('readwrite',store=>store.delete(SHINO_ID));}
export function downloadSprite25dDraft(bundle){
  assertSprite25dManifest(bundle);
  const url=URL.createObjectURL(new Blob([JSON.stringify(bundle)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='shino.character25d.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
