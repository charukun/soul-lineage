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
  note: 'KayKit Adventurers 1.0の固定revisionからKnight.glbのHead / Arm / Leg実メッシュとRig_Mediumを主人公の主軸として直接流用するDCC PRIMARY。Knight_Body固有の騎士章を削るのではなく、同じ固定CC0パックのRogue_Bodyだけを装備なし村人チュニックの胴パーツとしてRig_Mediumへ付け替える。Rogueの武器・ケープ・頭・腕・脚は持ち込まない。DEV playable heroはこのDCC個体を維持し、モーションレビューの既定確認モデルにも同じGLBを使用する。visualApproval=pending / productionReady=falseの品質gateは維持する。'
};

validateVisualIdentity(protagonist);
export const PROTAGONIST_VILLAGER_MODEL = deepFreeze(protagonist);

const femaleProtagonist = {
  ...protagonist,
  id: PROTAGONIST_VILLAGER_FEMALE_MODEL_ID,
  label: '主人公・女の子 / 村人服 PRIMARY',
  characterId: 'Protagonist_Villager_Female_V1',
  assetId: 'character.protagonist-villager-female.v1',
  assetPath: './simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.glb',
  integrityPath: './simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.asset.json',
  dccSourcePath: 'assets/characters/protagonist/villager-female-v1/source/ProtagonistVillagerFemaleV1.blend',
  referencePath: 'docs/characters/references/protagonist-villager-female-v1.svg',
  front: 'fringe',
  back: 'tied',
  face: { ...protagonist.face, jaw: .92, cheek: 1.08, eyeWidth: 1.08, eyeHeight: 1.08, chin: .92 },
  proportions: { shoulders: .90, arms: .96, legs: .95, head: 1.12 },
  cloth: [.73, .66, .52],
  trim: [.23, .34, .27],
  hairValue: .82,
  referenceStyle: {
    ...protagonist.referenceStyle,
    design: 'protagonist-female-kaykit-derivative',
    palette: {
      ...protagonist.referenceStyle.palette,
      hair: [.16, .085, .045],
      primary: [.73, .66, .52],
      secondary: [.23, .34, .27],
      accent: [.50, .34, .19]
    }
  },
  production: {
    ...protagonist.production,
    authority: {
      ...protagonist.production.authority,
      implementedModularParts: [
        'protagonist-villager-v1-base',
        'female-silhouette-dcc-pass',
        'female-bob-braid-hair',
        'female-village-waist-cloth'
      ]
    }
  },
  note: '既存主人公のKayKit Rig_Medium互換DCC sourceを正本として、肩/腰/脚のシルエット、ボブ＋後ろ髪、村人腰布と配色を女主人公向けに再構成した別実モデル。操作・モーション・武器ソケット・当たり判定契約は共通。PRIMARYでありvisualApproval / RUNTIME_READYは未昇格。'
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
