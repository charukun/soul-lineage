import {KAYKIT_CHARACTER_LIBRARY,PROTAGONIST_VILLAGER_MODEL} from '@soul/characters';

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

export const RINNE_MOTION_REVIEW_MODELS=Object.freeze([
  RINNE_PROTAGONIST_REVIEW_TARGET,
  ...KAYKIT_CHARACTER_LIBRARY
]);
export const RINNE_MOTION_REVIEW_DEFAULT_MODEL=RINNE_PROTAGONIST_REVIEW_TARGET;
