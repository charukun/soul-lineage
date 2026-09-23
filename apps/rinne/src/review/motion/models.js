import {KAYKIT_CHARACTER_LIBRARY,PROTAGONIST_VILLAGER_MODEL,PROTAGONIST_VILLAGER_FEMALE_MODEL} from '@soul/characters';

export const RINNE_PROTAGONIST_REVIEW_TARGET=Object.freeze({
  id:PROTAGONIST_VILLAGER_MODEL.id,
  key:'protagonist',
  label:'主人公',
  familyId:'kaykit.adventurers.v1',
  rigId:'Rig_Medium',
  format:'glb',
  license:'CC0-1.0',
  source:Object.freeze({
    repository:'charukun/soul-lineage',
    revision:'28fae04c0d0276af60e854756e8e7d10a5b965d3',
    path:'apps/rinne/public/simulator/assets/PROTAGONIST_VILLAGER_V1.glb',
    gitBlobSha:'28fae04c0d0276af60e854756e8e7d10a5b965d3',
    byteLength:262324
  }),
  runtime:Object.freeze({
    url:PROTAGONIST_VILLAGER_MODEL.assetPath,
    localPath:'apps/rinne/public/simulator/assets/PROTAGONIST_VILLAGER_V1.glb'
  }),
  productionStage:PROTAGONIST_VILLAGER_MODEL.productionStage,
  modelingMode:PROTAGONIST_VILLAGER_MODEL.modelingMode,
  productionReady:PROTAGONIST_VILLAGER_MODEL.productionReady,
  visualApproval:'pending',
  procedural:false
});

export const RINNE_FEMALE_PROTAGONIST_REVIEW_TARGET=Object.freeze({
  ...PROTAGONIST_VILLAGER_FEMALE_MODEL,
  id:PROTAGONIST_VILLAGER_FEMALE_MODEL.id,
  key:'protagonist-female',
  label:'主人公・女',
  familyId:'kaykit.adventurers.v1',
  rigId:'Rig_Medium',
  format:'glb',
  license:'CC0-1.0',
  source:Object.freeze({
    repository:'charukun/soul-lineage',
    revision:'672074b73ba276876a19e8816ecdc5241817ab47',
    path:'apps/review/public/library/model/3ced3b11942d57cd82763715c7196dfd4f53141e/HeroineDawn.glb',
    gitBlobSha:'3ced3b11942d57cd82763715c7196dfd4f53141e',
    byteLength:3987056
  }),
  runtime:Object.freeze({
    url:PROTAGONIST_VILLAGER_FEMALE_MODEL.assetPath,
    localPath:'apps/review/public/library/model/3ced3b11942d57cd82763715c7196dfd4f53141e/HeroineDawn.glb'
  })
});

export const RINNE_GOLDEN_BASE_REVIEW_TARGET=Object.freeze({
  id:'img2threejs.bald-chibi.v1',
  key:'golden-base',
  label:'ゴールデンベース',
  familyId:'golden-base.v1',
  rigId:'Rig_Medium',
  format:'three-group',
  license:'project-reference',
  source:Object.freeze({
    repository:'charukun/soul-lineage',
    revision:'6e60b5e22419464b4853e01ddb6c0e6f6659a733',
    path:'packages/characters/src/golden-base.js',
    gitBlobSha:'12e3eab8cff6e7023a2db2a54bcd897b88925071'
  }),
  runtime:Object.freeze({
    kind:'golden-base',
    textureUrl:'./img2threejs-bald-chibi/head-uv.png'
  }),
  thumbnailUrl:'./img2threejs-bald-chibi/reference.jpg',
  productionStage:'GOLDEN_BASE',
  modelingMode:'img2threejs-procedural',
  productionReady:false,
  visualApproval:'pending',
  procedural:true
});

export const RINNE_MOTION_REVIEW_MODELS=Object.freeze([
  RINNE_PROTAGONIST_REVIEW_TARGET,
  RINNE_FEMALE_PROTAGONIST_REVIEW_TARGET,
  RINNE_GOLDEN_BASE_REVIEW_TARGET,
  ...KAYKIT_CHARACTER_LIBRARY
]);
export const RINNE_MOTION_REVIEW_DEFAULT_MODEL=RINNE_PROTAGONIST_REVIEW_TARGET;
