import { KAYKIT_FAMILY_ID } from '@soul/characters';

export const RINNE_PROTAGONIST_MODEL_ID = 'protagonist.villager.v1';
export const RINNE_PROTAGONIST_ASSET_ID = 'character.protagonist-villager.v1';
export const RINNE_PROTAGONIST_RUNTIME_URL = './simulator/assets/PROTAGONIST_VILLAGER_V1.glb';
export const RINNE_PROTAGONIST_SHA256 = 'ab3e2e71b768843a756abaa79f47859d1cd3c77a45b0c8b7a582f8d0b158fab6';
export const RINNE_PROTAGONIST_BYTES = 262324;

export const RINNE_PROTAGONIST_RUNTIME_ASSET = Object.freeze({
  id: `asset.${RINNE_PROTAGONIST_MODEL_ID}`,
  familyId: KAYKIT_FAMILY_ID,
  modelId: RINNE_PROTAGONIST_MODEL_ID,
  label: '主人公 / KayKit Knight主軸・村人服 PRIMARY',
  url: RINNE_PROTAGONIST_RUNTIME_URL,
  source: Object.freeze({
    repository: 'KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0',
    revision: '672074b73ba276876a19e8816ecdc5241817ab47',
    primaryModel: 'Knight.glb',
    primaryGitBlobSha: '717b56ca2b5ff5392679774725201ba03a3eefab',
    torsoModel: 'Rogue.glb',
    torsoGitBlobSha: 'c8827661105eef7b2bfbef3bc676d41a47625733',
    runtimeSha256: RINNE_PROTAGONIST_SHA256,
    byteLength: RINNE_PROTAGONIST_BYTES
  }),
  license: 'CC0-1.0',
  rigId: 'Rig_Medium',
  integrityRigId: 'kaykit.Rig_Medium.v1',
  productionStage: 'PRIMARY',
  modelingMode: 'dcc-blender',
  usage: 'dev-runtime-protagonist',
  productionReady: false,
  visualApproval: 'pending',
  procedural: false
});
