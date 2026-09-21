#!/usr/bin/env node
// Manual asset maintenance only; intentionally not part of build or Fast DEV.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const library=path.join(root,'apps/review/public/library');
const ledgerPath=path.join(library,'provenance/curation-20260921.json');
const ledger=JSON.parse(await fs.readFile(ledgerPath,'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const write=async(file,data)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');};
const activate=process.argv.indexOf('--activate');
if(activate>=0){
  const receiptBytes=await fs.readFile(process.argv[activate+1]);
  const receipt=JSON.parse(receiptBytes);
  if(receipt.schema!==1||receipt.status!=='passed'||!/^[0-9a-f]{40}$/.test(receipt.head)||receipt.assets.length!==ledger.files.length)throw new Error('Complete exact-head native receipt required');
  const checked=new Map(receipt.assets.map(item=>[item.id,item]));
  if(checked.size!==ledger.files.length)throw new Error('Receipt IDs must be unique');
  for(const asset of ledger.files){
    const evidence=checked.get(asset.id);
    if(evidence?.status!=='passed'||evidence.sha256!==asset.sha256||evidence.byteLength!==asset.byteLength)throw new Error('Missing native evidence: '+asset.id);
    if(asset.kind==='audio'){
      if(!(evidence.audio?.duration>0&&evidence.audio.peak>0&&evidence.audio.channels>0))throw new Error('Audio decode evidence missing');
    }else{
      if(!(evidence.meshes>0&&evidence.visiblePixels>0&&evidence.triangles>0))throw new Error('GLTF render evidence missing');
      if(asset.kind==='creature'&&(!evidence.rig?.skins||evidence.animations.length!==asset.inspection.animations.length||evidence.animations.some(clip=>!clip.bindingsValid||!clip.finite||!clip.moved)))throw new Error('Native rig/animation evidence missing');
      if(!evidence.thumbnailPath?.startsWith('thumbnail/curation-20260921/'))throw new Error('Authored model thumbnail required');
      const thumb=await fs.readFile(path.join(library,evidence.thumbnailPath));
      if(hash(thumb)!==evidence.thumbnailSha256)throw new Error('Thumbnail integrity mismatch');
      asset.thumbnailPath=evidence.thumbnailPath;
    }
    asset.active=true;
  }
  ledger.active=true;
  ledger.nativeValidation={head:receipt.head,receiptSha256:hash(receiptBytes),assetCount:receipt.assets.length,
    nativeClipCount:receipt.assets.reduce((n,item)=>n+(item.animations?.length||0),0),
    browser:receipt.browser,scope:'Real WebGL parse/render, original rigs/clips, decoded audio; not Production visual approval'};
  await write(ledgerPath,ledger);
}
const translations=new Map(Object.entries({building:'建築',archeryrange:'弓練場',barracks:'兵舎',blacksmith:'鍛冶屋',bridge:'橋',castle:'城',church:'礼拝堂',home:'家',lumbermill:'製材所',market:'市場',mine:'鉱山',tavern:'酒場',tower:'塔',watermill:'水車',well:'井戸',windmill:'風車',blue:'青',green:'緑',red:'赤',yellow:'黄',white:'白',brown:'茶',banner:'旗',shield:'盾',sword:'剣',broken:'壊れた',gold:'金',barrel:'樽',bucket:'桶',crate:'木箱',box:'箱',candle:'ろうそく',table:'机',bed:'寝台',shelf:'棚',shelves:'棚',stool:'腰掛け',plate:'皿',food:'食事',bottle:'瓶',key:'鍵',keyring:'鍵束',keg:'酒樽',coin:'コイン',stack:'積み',stairs:'階段',wall:'壁',floor:'床',pillar:'柱',column:'石柱',corner:'角',doorway:'出入口',window:'窓',open:'開放',closed:'閉鎖',gated:'格子',wood:'木',stone:'石',dirt:'土',tile:'タイル',grate:'格子',spikes:'棘',decorated:'装飾',scaffold:'足場',scaffolding:'足場',foundation:'基礎',fence:'柵',gate:'門',tree:'木',trees:'木立',rock:'岩',rocks:'岩群',hill:'丘',hills:'丘陵',mountain:'山',cloud:'雲',grass:'草地',coast:'海岸',river:'川',water:'水面',waterless:'水なし',road:'道',hex:'六角地形',waterlily:'睡蓮',waterplant:'水草',large:'大',big:'大',small:'小',medium:'中',single:'単体',thin:'細',triple:'三連',long:'長',short:'短',empty:'空',cut:'切株',straight:'直線',sloped:'斜面',high:'高',low:'低',torch:'松明',trunk:'幹',rubble:'瓦礫',footstep:'足音',impact:'衝撃',carpet:'布床',concrete:'石床',snow:'雪',metal:'金属',glass:'ガラス',heavy:'強',light:'軽',punch:'打撃',cloth:'衣擦れ',bookflip:'本をめくる',bookplace:'本を置く',chop:'切る',creak:'軋み',doorclose:'扉を閉める',dooropen:'扉を開く',drawknife:'抜刀',dropleather:'革を置く',handlecoins:'硬貨',handlesmallleather:'革小物',knifeslice:'刃の風切り',metalclick:'金属クリック',metallatch:'留め金',metalpot:'金属鍋'}));
const labelFor=asset=>{
  if(asset.kind==='creature')return asset.label;
  const stem=path.basename(asset.source.path).replace(/\.gltf\.glb$|\.glb$|\.gltf$|\.ogg$/,'');
  return stem.replace(/([a-z])([A-Z])/g,'$1 $2').split(/[_\s-]+/).map(token=>{
    const match=token.match(/^([a-zA-Z]+)(\d+)$/);
    return translations.get(token.toLowerCase())||(match?`${translations.get(match[1].toLowerCase())||match[1]} ${match[2]}`:token);
  }).join(' ');
};
const packs=Object.fromEntries(ledger.packs.map(pack=>[pack.id,{
  author:pack.author,license:pack.license,originalSource:pack.originalSource,repository:pack.repository,revision:pack.revision,
  licensePath:'apps/review/public/library/'+pack.licenseEvidence[0].runtimePath,
}]));
const assets=ledger.files.map(asset=>({
  id:asset.id,visualAssetId:asset.visualAssetId,label:labelFor(asset),kind:asset.kind,type:asset.type,category:asset.category,
  active:asset.active===true,pack:asset.pack,runtimePath:asset.runtimePath,byteLength:asset.byteLength,
  gitBlobSha:asset.gitBlobSha,sha256:asset.sha256,sourcePath:asset.source.path,
  sourceGitBlobSha:asset.source.gitBlobSha,sourceByteLength:asset.source.byteLength,
  ...(asset.thumbnailPath?{thumbnailPath:asset.thumbnailPath}:{}),
}));
await write(path.join(root,'packages/assets/generated/curated-library.json'),{schema:2,packs,assets});
console.log(JSON.stringify({assets:assets.length,active:assets.filter(asset=>asset.active).length,nativeClips:ledger.nativeValidation?.nativeClipCount||0}));
