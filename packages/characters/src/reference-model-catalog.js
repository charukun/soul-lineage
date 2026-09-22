import { projectAssetUrl } from '../../assets/src/runtime-origin.js';
import { canonicalAppearanceParts } from './appearance-parts.js';
import { deepFreeze } from './master-character.js';
import { CHARACTER_REFERENCE_MODEL_VERSION, CHARACTER_REFERENCE_MODELS as BASE_CHARACTER_REFERENCE_MODELS } from './reference-models.js';
import { validateVisualIdentity } from './visual-identity.js';

export { CHARACTER_REFERENCE_MODEL_VERSION };
export const PROTAGONIST_VILLAGER_MODEL_ID = 'protagonist.villager.v1';
export const PROTAGONIST_VILLAGER_FEMALE_MODEL_ID = 'protagonist.villager.female.v1';

const base = BASE_CHARACTER_REFERENCE_MODELS['child-boy.reference.v1'];
const profile = canonicalAppearanceParts({
  version: 1,
  face: 'classic',
  hair: 'crop',
  body: 'compact',
  outfit: 'tunic',
  accessory: 'none'
});

const protagonist = {
  ...base,
  version: 1,
  seed: 0x50525631,
  role: 'resident',
  ageBand: 'adult',
  parts: profile,
  front: 'fringe',
  back: 'close',
  face: { ...base.face, jaw: .96, cheek: 1.04, nose: .94, eyeWidth: 1.06, eyeHeight: 1.06, eyeSpacing: 1.01, browWeight: .88, browSlant: .01, chin: .96 },
  proportions: { shoulders: .96, arms: .98, legs: .94, head: 1.12 },
  gear: 'belt',
  cloth: [.72, .66, .53],
  trim: [.30, .40, .46],
  hairValue: .90,
  id: PROTAGONIST_VILLAGER_MODEL_ID,
  label: '主人公 / KayKit Knight主軸・村人服 PRIMARY',
  kind: 'dcc-character-model',
  characterId: 'Protagonist_Villager_V1',
  assetId: 'character.protagonist-villager.v1',
  productionStage: 'PRIMARY',
  modelingMode: 'dcc-blender',
  productionReady: false,
  assetPath: './simulator/assets/PROTAGONIST_VILLAGER_V1.glb',
  integrityPath: './simulator/assets/PROTAGONIST_VILLAGER_V1.asset.json',
  dccSourcePath: 'assets/characters/protagonist/villager-v1/source/ProtagonistVillagerV1.blend',
  referencePath: 'docs/characters/references/protagonist-villager-v1.svg',
  profile,
  referenceStyle: {
    version: 1,
    design: 'protagonist-kaykit-knight-derivative',
    scale: .72,
    palette: {
      skin: [.72, .48, .34],
      hair: [.19, .14, .11],
      eyes: [.08, .07, .06],
      primary: [.72, .66, .53],
      secondary: [.30, .34, .23],
      accent: [.30, .40, .46],
      dark: [.13, .10, .08],
      metal: [.48, .46, .40],
      leather: [.23, .16, .11],
      wood: [.32, .22, .14]
    },
    armStyle: 'shirt',
    legStyle: 'pants',
    footwear: 'boots',
    prop: 'none'
  },
  production: {
    sourceSections: [...base.production.sourceSections],
    authority: {
      currentMaster: [...base.production.authority.currentMaster],
      implementedModularParts: ['kaykit-knight-identity-parts', 'kaykit-rogue-tunic-torso', 'village-material-pass'],
      proposedParts: [],
      gameEquipment: []
    },
    target: {
      formats: ['glb'],
      primaryFormat: 'glb',
      rigId: 'Rig_Medium',
      materialProfiles: ['kaykit-gradient-source', 'stylized-pbr-village-cloth'],
      preserveExpressions: false,
      preserveSpringBones: false
    },
    requirements: {
      topology: 'kaykit-source-derived',
      modularCompatibility: false,
      sourceProvenanceRequired: true,
      gameEquipmentPolicy: 'exclude-from-shared-character-asset',
      weaponSocketPolicy: 'preserve-runtime-owned-sockets',
      fallbackPolicy: 'fail-closed-on-adopted-runtime-integrity-error'
    }
  },
  note: 'KayKit Adventurers 1.0の固定revisionからKnight.glbのHead / Arm / Leg実メッシュとRig_Mediumを主人公の主軸として直接流用するDCC PRIMARY。Knight_Body固有の騎士章を削るのではなく、同じ固定CC0パックのRogue_Bodyだけを装備なし村人チュニックの胴パーツとしてRig_Mediumへ付け替える。Rogueの武器・ケープ・頭・腕・脚は持ち込まない。現在のDEV playable heroはモーションレビューと同一の固定KayKit Knight.glbを直接使用し、このDCC個体はCharacter Workshopの別候補として保持する。visualApproval=pending / productionReady=falseの品質gateは維持する。'
};

validateVisualIdentity(protagonist);
export const PROTAGONIST_VILLAGER_MODEL = deepFreeze(protagonist);

// The previous authored head/hair model was explicitly rejected. This role now
// selects the unchanged official Rogue mesh, not a new procedural approximation.
const femaleProtagonist = {
  ...protagonist,
  id: PROTAGONIST_VILLAGER_FEMALE_MODEL_ID,
  label: '主人公・女 / KayKit Rogue（公式CC0原形）',
  characterId: 'Protagonist_Villager_Female_V1',
  assetId: 'character.protagonist-villager-female.v1',
  modelingMode: 'imported-reviewed',
  productionStage: 'REFERENCE',
  productionReady: false,
  visualApproval: 'pending',
  procedural: false,
  sourceModelId: 'kaykit.rogue.v1',
  sourceDisplay: { excludeMeshNodes: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'] },
  license: 'CC0-1.0',
  assetPath: projectAssetUrl('model/c8827661105eef7b2bfbef3bc676d41a47625733/Rogue.glb'),
  integrityPath: './simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.asset.json',
  dccSourcePath: 'apps/review/public/library/model/c8827661105eef7b2bfbef3bc676d41a47625733/Rogue.glb',
  referencePath: 'apps/review/public/library/provenance/female-protagonist-rogue-v1.json',
  referenceStyle: {
    ...protagonist.referenceStyle,
    design: 'protagonist-female-kaykit-rogue-original'
  },
  production: {
    ...protagonist.production,
    authority: {
      ...protagonist.production.authority,
      implementedModularParts: ['kaykit-rogue-original-head-body-hair-clothing'],
      proposedParts: [],
      gameEquipment: []
    },
    requirements: {
      ...protagonist.production.requirements,
      topology: 'kaykit-original-unmodified',
      sourceProvenanceRequired: true
    }
  },
  note: '旧自作の頭部・顔・ボブ髪モデルは破棄。Kay Lousberg作 KayKit Adventurers 1.0 の公式CC0 Rogue.glbを固定revisionから取得し、原本の顔・髪・服・Rig_Medium・UV・埋込テクスチャ・モーションを無改変で採用。実体は自前Asset Originへ収録。旧IDは選択互換のためだけに維持し、旧モデルへfallbackしない。新規採用のためREFERENCE / visualApproval=pending / productionReady=falseを維持。装備所有・操作・当たり判定は変更しない。'
};
validateVisualIdentity(femaleProtagonist);
export const PROTAGONIST_VILLAGER_FEMALE_MODEL = deepFreeze(femaleProtagonist);

export const CHARACTER_REFERENCE_MODELS = deepFreeze({
  [PROTAGONIST_VILLAGER_MODEL_ID]: PROTAGONIST_VILLAGER_MODEL,
  [PROTAGONIST_VILLAGER_FEMALE_MODEL_ID]: PROTAGONIST_VILLAGER_FEMALE_MODEL,
  ...BASE_CHARACTER_REFERENCE_MODELS
});

export function characterReferenceModel(id) {
  const model = CHARACTER_REFERENCE_MODELS[id];
  if (!model) throw new Error(`Unknown character reference model: ${id}`);
  return model;
}
