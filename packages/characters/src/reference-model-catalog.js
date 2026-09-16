import { canonicalAppearanceParts } from './appearance-parts.js';
import { deepFreeze } from './master-character.js';
import { CHARACTER_REFERENCE_MODEL_VERSION, CHARACTER_REFERENCE_MODELS as BASE_CHARACTER_REFERENCE_MODELS } from './reference-models.js';
import { validateVisualIdentity } from './visual-identity.js';

export { CHARACTER_REFERENCE_MODEL_VERSION };
export const PROTAGONIST_VILLAGER_MODEL_ID = 'protagonist.villager.v1';

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
  version: 2,
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
  label: '主人公 / KayKit Knight派生・村人服 PRIMARY',
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
    version: 2,
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
      implementedModularParts: ['kaykit-knight-source-parts', 'village-material-pass'],
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
      fallbackPolicy: 'retain-current-master-until-candidate-accepted'
    }
  },
  note: 'KayKit Adventurers 1.0の固定revisionからKnight.glbの実メッシュとRig_Mediumを直接流用する主人公DCC PRIMARY。剣・盾・兜・肩軍装を外し、残したKnightパーツを布・革・オリーブ系の村人服へ再構成する。Knightに髪が無い場合のみ同一CC0パックのRogue髪パーツを使用する。30秒演舞を含む既存Humanoidモーション確認用で、Visual Approvalまではゲーム既定モデルを置換しない。'
};

validateVisualIdentity(protagonist);
export const PROTAGONIST_VILLAGER_MODEL = deepFreeze(protagonist);

export const CHARACTER_REFERENCE_MODELS = deepFreeze({
  [PROTAGONIST_VILLAGER_MODEL_ID]: PROTAGONIST_VILLAGER_MODEL,
  ...BASE_CHARACTER_REFERENCE_MODELS
});

export function characterReferenceModel(id) {
  const model = CHARACTER_REFERENCE_MODELS[id];
  if (!model) throw new Error(`Unknown character reference model: ${id}`);
  return model;
}
