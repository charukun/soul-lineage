export const KAYKIT_FAMILY_ID = 'kaykit.adventurers.v1';
export const DEFAULT_CHARACTER_FAMILY_ID = KAYKIT_FAMILY_ID;
export const KAYKIT_SOURCE_REPOSITORY = 'KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0';
export const KAYKIT_SOURCE_REVISION = '672074b73ba276876a19e8816ecdc5241817ab47';
export const KAYKIT_LICENSE = 'CC0-1.0';
export const KAYKIT_RIG_ID = 'Rig_Medium';

const model = ({ id, label, file, blobSha, byteLength }) => Object.freeze({
  id: `kaykit.${id}.v1`,
  key: id,
  label,
  familyId: KAYKIT_FAMILY_ID,
  rigId: KAYKIT_RIG_ID,
  format: 'glb',
  license: KAYKIT_LICENSE,
  source: Object.freeze({
    repository: KAYKIT_SOURCE_REPOSITORY,
    revision: KAYKIT_SOURCE_REVISION,
    path: `addons/kaykit_character_pack_adventures/Characters/gltf/${file}`,
    gitBlobSha: blobSha,
    byteLength
  }),
  runtime: Object.freeze({
    url: `./simulator/assets/kaykit/${file}`,
    localPath: `apps/rinne/public/simulator/assets/kaykit/${file}`
  }),
  productionStage: 'REFERENCE',
  modelingMode: 'imported-reviewed',
  productionReady: false,
  visualApproval: 'pending',
  procedural: false
});

export const KAYKIT_MODELS = Object.freeze([
  model({ id: 'knight', label: 'Knight', file: 'Knight.glb', blobSha: '717b56ca2b5ff5392679774725201ba03a3eefab', byteLength: 3659532 }),
  model({ id: 'barbarian', label: 'Barbarian', file: 'Barbarian.glb', blobSha: '66d312ab6dc02b35fb648e7585bfdddb4e02eeef', byteLength: 3613268 }),
  model({ id: 'mage', label: 'Mage', file: 'Mage.glb', blobSha: 'c89f19f6e707f6e07e4632a08876bd6d0172b082', byteLength: 3589240 }),
  model({ id: 'rogue', label: 'Rogue', file: 'Rogue.glb', blobSha: 'c8827661105eef7b2bfbef3bc676d41a47625733', byteLength: 3616284 }),
  model({ id: 'rogue-hooded', label: 'Rogue Hooded', file: 'Rogue_Hooded.glb', blobSha: '5d2b1403240d5f9ffff12e02c007572038eca2a8', byteLength: 3597652 })
]);

export const KAYKIT_MODEL_BY_ID = Object.freeze(Object.fromEntries(KAYKIT_MODELS.map(row => [row.id, row])));
export const KAYKIT_MODEL_BY_KEY = Object.freeze(Object.fromEntries(KAYKIT_MODELS.map(row => [row.key, row])));
export const KAYKIT_DEFAULT_MODEL_ID = KAYKIT_MODEL_BY_KEY.knight.id;

export const KAYKIT_FOUNDATION = Object.freeze({
  id: KAYKIT_FAMILY_ID,
  defaultModelId: KAYKIT_DEFAULT_MODEL_ID,
  sourceRepository: KAYKIT_SOURCE_REPOSITORY,
  sourceRevision: KAYKIT_SOURCE_REVISION,
  license: KAYKIT_LICENSE,
  rigId: KAYKIT_RIG_ID,
  models: KAYKIT_MODELS
});

const hash = value => {
  let out = 2166136261;
  for (const char of String(value ?? '')) {
    out ^= char.codePointAt(0);
    out = Math.imul(out, 16777619) >>> 0;
  }
  return out >>> 0;
};

export function kaykitModel(id = KAYKIT_DEFAULT_MODEL_ID) {
  const found = KAYKIT_MODEL_BY_ID[id] || KAYKIT_MODEL_BY_KEY[id];
  if (!found) throw new Error(`Unknown KayKit foundation model: ${id}`);
  return found;
}

export function selectKaykitModel({ kind = 'actor', key = '', index = 0 } = {}) {
  if (kind === 'mother') return KAYKIT_MODEL_BY_KEY['rogue-hooded'];
  if (kind === 'hero') return KAYKIT_MODEL_BY_KEY.knight;
  const pool = kind === 'enemy'
    ? [KAYKIT_MODEL_BY_KEY.barbarian, KAYKIT_MODEL_BY_KEY.mage, KAYKIT_MODEL_BY_KEY.rogue, KAYKIT_MODEL_BY_KEY['rogue-hooded']]
    : KAYKIT_MODELS;
  return pool[(hash(`${key}:${index}`) + Math.max(0, Number(index) || 0)) % pool.length];
}

export function kaykitRuntimeAsset(modelId = KAYKIT_DEFAULT_MODEL_ID) {
  const row = kaykitModel(modelId);
  return Object.freeze({
    id: `asset.${row.id}`,
    familyId: KAYKIT_FAMILY_ID,
    modelId: row.id,
    label: row.label,
    url: row.runtime.url,
    source: row.source,
    license: row.license,
    rigId: row.rigId,
    productionStage: row.productionStage,
    modelingMode: row.modelingMode,
    usage: 'dev-runtime-foundation',
    productionReady: row.productionReady,
    visualApproval: row.visualApproval,
    procedural: row.procedural
  });
}
