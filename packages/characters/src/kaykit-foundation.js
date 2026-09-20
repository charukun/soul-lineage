export const KAYKIT_FAMILY_ID = 'kaykit.adventurers.v1';
export const DEFAULT_CHARACTER_FAMILY_ID = KAYKIT_FAMILY_ID;
export const KAYKIT_SOURCE_REPOSITORY = 'KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0';
export const KAYKIT_SOURCE_REVISION = '672074b73ba276876a19e8816ecdc5241817ab47';
export const KAYKIT_LICENSE = 'CC0-1.0';
export const KAYKIT_RIG_ID = 'Rig_Medium';
const reviewThumbnailUrl=id=>`./review/catalog-thumbnails.svg#${id}`;

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
  procedural: false,
  thumbnailUrl: reviewThumbnailUrl(`kaykit.${id}.v1`)
});

const equipmentFile=({id,label,file,blobSha,byteLength})=>Object.freeze({
  id:`kaykit.equipment.${id}.v1`,label,license:KAYKIT_LICENSE,
  source:Object.freeze({repository:KAYKIT_SOURCE_REPOSITORY,revision:KAYKIT_SOURCE_REVISION,path:`addons/kaykit_character_pack_adventures/Assets/gltf/${file}`,gitBlobSha:blobSha,byteLength}),
  runtime:Object.freeze({url:`./simulator/assets/kaykit/${file}`,localPath:`apps/rinne/public/simulator/assets/kaykit/${file}`})
});

export const KAYKIT_MODELS = Object.freeze([
  model({ id: 'knight', label: 'Knight', file: 'Knight.glb', blobSha: '717b56ca2b5ff5392679774725201ba03a3eefab', byteLength: 3659532 }),
  model({ id: 'barbarian', label: 'Barbarian', file: 'Barbarian.glb', blobSha: '66d312ab6dc02b35fb648e7585bfdddb4e02eeef', byteLength: 3613268 }),
  model({ id: 'mage', label: 'Mage', file: 'Mage.glb', blobSha: 'c89f19f6e707f6e07e4632a08876bd6d0172b082', byteLength: 3589240 }),
  model({ id: 'rogue', label: 'Rogue', file: 'Rogue.glb', blobSha: 'c8827661105eef7b2bfbef3bc676d41a47625733', byteLength: 3616284 }),
  model({ id: 'rogue-hooded', label: 'Rogue Hooded', file: 'Rogue_Hooded.glb', blobSha: '5d2b1403240d5f9ffff12e02c007572038eca2a8', byteLength: 3597652 })
]);

export const KAYKIT_REVIEW_EQUIPMENT_FILES=Object.freeze([
  equipmentFile({id:'dagger-gltf',label:'Dagger glTF',file:'dagger.gltf',blobSha:'f090037e4ecdd0e6e891a412b2c4a9409226825e',byteLength:3065}),
  equipmentFile({id:'dagger-bin',label:'Dagger geometry',file:'dagger.bin',blobSha:'8825c09e4f6cf6cba918770082505ab9cc5d9a48',byteLength:7656}),
  equipmentFile({id:'sword-1h-gltf',label:'One-handed sword glTF',file:'sword_1handed.gltf',blobSha:'ea5115c52ee9c07b2128105c0701fe706add7593',byteLength:3080}),
  equipmentFile({id:'sword-1h-bin',label:'One-handed sword geometry',file:'sword_1handed.bin',blobSha:'1aca5d22ca1dbae65756af6c0b438f251c2c7e45',byteLength:13256}),
  equipmentFile({id:'shield-badge-gltf',label:'Knight shield glTF',file:'shield_badge.gltf',blobSha:'ea24d093f903e4b0eec8131a112e3699c6297da9',byteLength:3080}),
  equipmentFile({id:'shield-badge-bin',label:'Knight shield geometry',file:'shield_badge.bin',blobSha:'b035daa7c9aff96d3a87d2f82da1d4ca3655954d',byteLength:10628}),
  equipmentFile({id:'rogue-texture',label:'Rogue equipment texture',file:'rogue_texture.png',blobSha:'542954baba7281f028f93306943fc780b1ebcf55',byteLength:16670}),
  equipmentFile({id:'knight-texture',label:'Knight equipment texture',file:'knight_texture.png',blobSha:'a56eae7514f908862e304620b89dc2d0cb9f362f',byteLength:14172})
]);

export const KAYKIT_MODEL_BY_ID = Object.freeze(Object.fromEntries(KAYKIT_MODELS.map(row => [row.id, row])));
export const KAYKIT_MODEL_BY_KEY = Object.freeze(Object.fromEntries(KAYKIT_MODELS.map(row => [row.key, row])));
// The Rinne title reference favors a hair-visible, lightly equipped young adventurer silhouette.
// Rogue is already pinned, CC0, Rig_Medium-compatible and repository-local, so no mutable external runtime URL is introduced.
export const KAYKIT_DEFAULT_MODEL_ID = KAYKIT_MODEL_BY_KEY.rogue.id;

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
  if (kind === 'hero') return KAYKIT_MODEL_BY_KEY.rogue;
  const pool = kind === 'enemy'
    ? [KAYKIT_MODEL_BY_KEY.knight, KAYKIT_MODEL_BY_KEY.barbarian, KAYKIT_MODEL_BY_KEY.mage, KAYKIT_MODEL_BY_KEY['rogue-hooded']]
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
