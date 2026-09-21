import {CURATED_MODEL_ASSETS,CURATED_SOUND_ASSETS,projectAssetUrl} from '@soul/assets';
const environment=typeof __BUILD_INFO__==='undefined'?'dev':__BUILD_INFO__.environment;
const url=path=>projectAssetUrl(path,{environment});
const provenance=asset=>Object.freeze({...asset.source,author:asset.author,license:asset.license,
  originalSource:asset.originalSource,sha256:asset.sha256,byteLength:asset.byteLength});

export const CURATED_REVIEW_OBJECTS=Object.freeze(CURATED_MODEL_ASSETS.map(asset=>Object.freeze({
  id:asset.id,label:asset.label,category:asset.category,kind:'gltf',
  curatedAssetId:asset.id,visualAssetId:asset.visualAssetId,
  url:url(asset.runtimePath),thumbnailUrl:asset.thumbnailPath?url(asset.thumbnailPath):null,
  source:`${asset.author} · ${asset.license} · ${asset.pack}`,
  provenance:provenance(asset),
})));

export const CURATED_REVIEW_SOUNDS=Object.freeze(CURATED_SOUND_ASSETS.map(asset=>Object.freeze({
  id:asset.id,kind:'sfx',title:asset.label,category:asset.category,
  scene:asset.category==='足音'?'移動':asset.category==='命中'?'戦闘':'村の生活',
  url:url(asset.runtimePath),source:`${asset.author} · ${asset.license} · ${asset.pack}`,
  description:`作者の原音源。${asset.byteLength.toLocaleString()} bytes。自前Asset Originから選択時に再生。原典: ${asset.originalSource}`,
  provenance:provenance(asset),
})));
