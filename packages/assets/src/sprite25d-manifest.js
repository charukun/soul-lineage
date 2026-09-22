// Portable, local-draft character data. No browser, renderer or game dependencies.
export const SPRITE25D_SCHEMA='rinne.character25d/v1';
export const SHINO_ID='rinne.shino.25d.v1';
export const DIRECTIONS=Object.freeze(['s','sw','w','nw','n','ne','e','se']);
export const REFERENCE_VIEWS=Object.freeze(['sheet','front','quarter','side','back']);
export const ACTIONS=Object.freeze(['idle','walk']);
export const LIMITS=Object.freeze({assetBytes:8*1024*1024,totalBytes:32*1024*1024,pixels:16777216,edge:4096,assets:24,bundleBytes:46*1024*1024});
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
const fail=message=>{throw new Error(message);};
export function createShinoDraft(){
  return {schema:SPRITE25D_SCHEMA,id:SHINO_ID,name:'しのちゃん',stage:'local-draft',revision:1,
    references:Object.fromEntries(REFERENCE_VIEWS.map(view=>[view,null])),pose:null,
    animations:Object.fromEntries(ACTIONS.map(action=>[action,Object.fromEntries(DIRECTIONS.map(direction=>[direction,null]))])),
    render:{height:1.72,pivot:[.5,1]},assets:{},model3d:null,
    review:{identity:'pending',license:'unverified',productionApproved:false}};
}
export function assertSprite25dManifest(value){
  if(!record(value)||value.schema!==SPRITE25D_SCHEMA||value.id!==SHINO_ID||value.stage!=='local-draft')fail('しのちゃん用 local-draft bundle ではありません');
  if(value.name!=='しのちゃん'||!integer(value.revision,1,1000000))fail('キャラクター情報が不正です');
  if(!record(value.assets)||Object.keys(value.assets).length>LIMITS.assets)fail('素材数が上限を超えています');
  let total=0;
  for(const [hash,asset] of Object.entries(value.assets)){
    if(!/^[a-f0-9]{64}$/.test(hash)||!record(asset)||asset.sha256!==hash)fail('素材のSHA-256が不正です');
    if(!integer(asset.byteLength,1,LIMITS.assetBytes))fail('画像は1枚8 MiB以下にしてください');
    total+=asset.byteLength;
    if(!integer(asset.width,1,LIMITS.edge)||!integer(asset.height,1,LIMITS.edge)||asset.width*asset.height>LIMITS.pixels)fail('画像サイズが上限を超えています');
    if(!['image/png','image/webp','image/jpeg'].includes(asset.mediaType)||typeof asset.dataUrl!=='string'||!asset.dataUrl.startsWith(`data:${asset.mediaType};base64,`))fail('埋め込みPNG/WebP/JPEGのみ使えます。外部URLは読み込みません');
    const encoded=asset.dataUrl.slice(asset.dataUrl.indexOf(',')+1);
    if(encoded.length>Math.ceil(LIMITS.assetBytes/3)*4||encoded.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))fail('画像データが不正です');
    if(encoded.length/4*3-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0)!==asset.byteLength)fail('画像のbyteLengthが一致しません');
    if(typeof asset.name!=='string'||asset.name.length>200||typeof asset.hasTransparency!=='boolean')fail('画像メタデータが不正です');
    if(!record(asset.provenance)||!['user-upload','reference-crop'].includes(asset.provenance.kind)||asset.provenance.license!=='unverified'||asset.provenance.author!=='user-supplied-unverified')fail('出典情報が不正です');
    if(asset.provenance.kind==='reference-crop'){
      const source=value.assets[asset.provenance.parentSha256],r=asset.provenance.rect;
      if(!source||!Array.isArray(r)||r.length!==4||!integer(r[0],0,source.width-1)||!integer(r[1],0,source.height-1)||!integer(r[2],1,source.width-r[0])||!integer(r[3],1,source.height-r[1])||typeof asset.provenance.removeBorderWhite!=='boolean'||asset.width!==r[2]||asset.height!==r[3])fail('切り出し元・範囲が不正です');
    }
  }
  for(const hash of Object.keys(value.assets)){
    const seen=new Set();let current=hash;
    while(current){if(seen.has(current))fail('切り出し履歴が循環しています');seen.add(current);current=value.assets[current]?.provenance?.parentSha256;}
  }
  if(total>LIMITS.totalBytes)fail('素材の合計は32 MiB以下にしてください');
  if(!record(value.references)||REFERENCE_VIEWS.some(view=>!own(value.references,view)))fail('基準画の枠が不足しています');
  const checkRef=(hash,transparent=false)=>{
    if(hash===null)return;
    if(typeof hash!=='string'||!own(value.assets,hash))fail('参照先の画像がありません');
    if(transparent&&!value.assets[hash].hasTransparency)fail('ゲーム用素材には透明な余白が必要です');
  };
  for(const view of REFERENCE_VIEWS)checkRef(value.references[view]);
  checkRef(value.pose,true);
  if(value.pose&&(value.assets[value.pose].width<8||value.assets[value.pose].height<8))fail('透過素材は8×8以上にしてください');
  if(!record(value.animations))fail('Idle/Walkの枠がありません');
  for(const action of ACTIONS){
    if(!record(value.animations[action]))fail('Idle/Walkの枠がありません');
    for(const direction of DIRECTIONS){
      if(!own(value.animations[action],direction))fail('8方向の枠が不足しています');
      const clip=value.animations[action][direction];if(clip===null)continue;
      if(!record(clip)||typeof clip.asset!=='string')fail('クリップ情報が不正です');checkRef(clip.asset,true);
      const asset=value.assets[clip.asset];
      if(!integer(clip.columns,1,32)||clip.rows!==8||!integer(clip.row,0,7)||!Number.isFinite(clip.fps)||clip.fps<1||clip.fps>24||asset.width%clip.columns||asset.height%8||asset.width/clip.columns<8||asset.height/8<8)fail('8行・等サイズのスプライトシートを指定してください');
      if(clip.row!==DIRECTIONS.indexOf(direction))fail('方向の並び順が不正です');
    }
  }
  if(value.appearance!==undefined){
    const a=value.appearance;
    if(!record(a)||a.version!==1||a.method!=='auto-cutout-rig'||!record(a.views)||!a.views.front)fail('Actor appearanceが不正です');
    for(const [view,hash] of Object.entries(a.views)){
      if(!['front','quarter','side','back'].includes(view))fail('Actor viewが不正です');
      checkRef(hash,true);
    }
  }
  const runtimeAssets=new Set([value.pose,...Object.values(value.appearance?.views||{})].filter(Boolean));
  for(const action of ACTIONS)for(const clip of Object.values(value.animations[action]))if(clip)runtimeAssets.add(clip.asset);
  if([...runtimeAssets].reduce((sum,hash)=>sum+value.assets[hash].width*value.assets[hash].height,0)>8388608)fail('表示用画像は合計8Mピクセル以下にしてください');
  if(!record(value.render)||!Number.isFinite(value.render.height)||value.render.height<.3||value.render.height>3||!Array.isArray(value.render.pivot)||value.render.pivot.length!==2||value.render.pivot.some(n=>!Number.isFinite(n)||n<0||n>1))fail('接地点・高さが不正です');
  if(!record(value.review)||value.review.identity!=='pending'||value.review.license!=='unverified'||value.review.productionApproved!==false||value.model3d!==null)fail('この入口では本番承認・3D完成を付与できません');
  if((value.pose||ACTIONS.some(a=>DIRECTIONS.some(d=>value.animations[a][d])))&&!REFERENCE_VIEWS.some(view=>value.references[view]))fail('まず正本の基準画を登録してください');
  return value;
}
export function resolveSprite25dFrame(bundle,action='idle',direction='s'){
  const clip=bundle.animations[action]?.[direction];
  if(clip)return {...clip,fallback:false};
  return bundle.pose?{asset:bundle.pose,columns:1,rows:1,row:0,fps:1,fallback:true}:null;
}
export function sprite25dCoverage(bundle){
  return Object.fromEntries(ACTIONS.map(action=>[action,DIRECTIONS.filter(direction=>bundle.animations[action][direction]).length]));
}
export function pruneSprite25dAssets(bundle){
  const used=new Set([...Object.values(bundle.references),bundle.pose,...Object.values(bundle.appearance?.views||{})].filter(Boolean));
  for(const action of ACTIONS)for(const clip of Object.values(bundle.animations[action]))if(clip)used.add(clip.asset);
  for(const hash of used){const parent=bundle.assets[hash]?.provenance?.parentSha256;if(parent)used.add(parent);}
  for(const hash of Object.keys(bundle.assets))if(!used.has(hash))delete bundle.assets[hash];
  return bundle;
}

