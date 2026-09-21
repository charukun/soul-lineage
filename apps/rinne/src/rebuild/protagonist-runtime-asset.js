import { KAYKIT_MODEL_BY_KEY, kaykitRuntimeAsset } from '@soul/characters';

const knight = KAYKIT_MODEL_BY_KEY.knight;
const foundationAsset = kaykitRuntimeAsset(knight.id);

export const RINNE_PROTAGONIST_MODEL_ID = knight.id;
export const RINNE_PROTAGONIST_ASSET_ID = foundationAsset.id;
export const RINNE_PROTAGONIST_RUNTIME_URL = knight.runtime.url;
export const RINNE_PROTAGONIST_GIT_BLOB_SHA = knight.source.gitBlobSha;
export const RINNE_PROTAGONIST_BYTES = knight.source.byteLength;

export const RINNE_PROTAGONIST_RUNTIME_ASSET = Object.freeze({
  ...foundationAsset,
  label: '主人公 / Knight',
  integrityRigId: 'kaykit.Rig_Medium.v1',
  usage: 'dev-runtime-protagonist'
});
