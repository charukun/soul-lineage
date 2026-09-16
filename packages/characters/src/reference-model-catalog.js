import { canonicalAppearanceParts } from './appearance-parts.js';
import { deepFreeze } from './master-character.js';
import { CHARACTER_REFERENCE_MODEL_VERSION, CHARACTER_REFERENCE_MODELS as BASE_CHARACTER_REFERENCE_MODELS } from './reference-models.js';
import { validateVisualIdentity } from './visual-identity.js';

export { CHARACTER_REFERENCE_MODEL_VERSION };
export const PROTAGONIST_VILLAGER_MODEL_ID = 'protagonist.villager.v1';
export const RECONSTRUCTED_WAYFARER_MODEL_ID = 'reconstructed-wayfarer.reference.v1';

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
  label: '主人公 / 村人服 PRIMARY',
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
    design: 'protagonist-villager',
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
      implementedModularParts: ['face', 'hair', 'body', 'outfit', 'accessory'],
      proposedParts: [],
      gameEquipment: []
    },
    target: {
      formats: ['glb'],
      primaryFormat: 'glb',
      rigId: 'humanoid.shino-vrm1.v2',
      materialProfiles: ['stylized-pbr-fallback'],
      preserveExpressions: false,
      preserveSpringBones: false
    },
    requirements: {
      topology: 'humanoid-production',
      modularCompatibility: false,
      sourceProvenanceRequired: true,
      gameEquipmentPolicy: 'exclude-from-shared-character-asset',
      weaponSocketPolicy: 'preserve-runtime-owned-sockets',
      fallbackPolicy: 'retain-current-master-until-candidate-accepted'
    }
  },
  note: 'KayKit系NPCと同じ低ポリ世界観に合わせた主人公専用DCC PRIMARY。初期村人服のみで、鎧・兜・盾・衛兵意匠は持たない。30秒演舞を含む既存Humanoidモーション確認用。Visual Approvalまではゲーム既定モデルを置換しない。'
};

validateVisualIdentity(protagonist);
export const PROTAGONIST_VILLAGER_MODEL = deepFreeze(protagonist);

const seedKnight = BASE_CHARACTER_REFERENCE_MODELS['knight.reference.v1'];
const reconstructedProfile = canonicalAppearanceParts({
  version: 1,
  face: 'sharp',
  hair: 'crop',
  body: 'slender',
  outfit: 'tunic',
  accessory: 'scarf'
});
const reconstructedWayfarer = {
  ...seedKnight,
  version: 1,
  seed: 0x52425731,
  role: 'traveller',
  ageBand: 'adult',
  parts: reconstructedProfile,
  front: 'swept',
  back: 'layered',
  face: { ...seedKnight.face, jaw: .98, cheek: .97, nose: 1.02, eyeWidth: 1.03, eyeHeight: .98, eyeSpacing: .99, browWeight: .96, browSlant: .025, chin: 1.01 },
  proportions: { shoulders: 1.01, arms: 1.04, legs: 1.06, head: .98 },
  gear: 'satchel',
  cloth: [.18, .31, .29],
  trim: [.72, .46, .22],
  hairValue: .91,
  id: RECONSTRUCTED_WAYFARER_MODEL_ID,
  label: '再構築 Wayfarer / CC0 Seed',
  kind: 'runtime-reference-model',
  characterId: 'Reference_Reconstructed_Wayfarer',
  assetId: 'runtime.reconstructed-wayfarer.reference.v1',
  productionStage: 'BLOCKOUT',
  modelingMode: 'runtime-procedural-rebuild',
  productionReady: false,
  referencePath: 'apps/rinne/public/simulator/licenses/KAYKIT_FOUNDATION_SOURCE.txt',
  profile: reconstructedProfile,
  referenceStyle: deepFreeze({
    version: 1,
    design: 'reconstructed-wayfarer',
    scale: .88,
    palette: {
      skin: [.82, .63, .52],
      hair: [.16, .12, .10],
      eyes: [.25, .36, .34],
      primary: [.18, .31, .29],
      secondary: [.56, .50, .39],
      accent: [.72, .46, .22],
      dark: [.10, .12, .11],
      metal: [.45, .48, .46],
      leather: [.28, .17, .10],
      wood: [.34, .22, .12]
    },
    armStyle: 'shirt',
    legStyle: 'pants',
    footwear: 'boots',
    prop: 'satchel',
    topologyPreset: 'procedural-humanoid-rebuild-v1',
    surfacePreset: 'new-flat-stylized-materials-v1'
  }),
  sourceReference: deepFreeze({
    source: 'KayKit Character Pack: Adventurers / Knight.glb',
    license: 'CC0-1.0',
    provenancePath: 'apps/rinne/public/simulator/licenses/KAYKIT_FOUNDATION_SOURCE.txt',
    use: 'visual-form-seed-only',
    reusedGeometry: false,
    reusedTextures: false,
    transformation: [
      'discard-source-mesh-and-materials',
      'rebuild-on-audited-humanoid-rig',
      'replace-topology-with-runtime-procedural-geometry',
      'replace-surface-with-new-stylized-material-palette',
      'restyle-armored-knight-as-itinerant-wayfarer'
    ]
  }),
  note: 'CC0 KayKit Knightを視覚的な種だけに使い、元mesh・元texture/materialを再利用せず、監査済み共通Humanoid rig上で別Topologyのランタイム3Dへ再構築した実験モデル。鎧シルエットを旅人服・スカーフ・鞄へ変更し、表面色と材質も独自パレットへ置換する。'
};
validateVisualIdentity(reconstructedWayfarer);
export const RECONSTRUCTED_WAYFARER_MODEL = deepFreeze(reconstructedWayfarer);

export const CHARACTER_REFERENCE_MODELS = deepFreeze({
  [PROTAGONIST_VILLAGER_MODEL_ID]: PROTAGONIST_VILLAGER_MODEL,
  [RECONSTRUCTED_WAYFARER_MODEL_ID]: RECONSTRUCTED_WAYFARER_MODEL,
  ...BASE_CHARACTER_REFERENCE_MODELS
});

export function characterReferenceModel(id) {
  const model = CHARACTER_REFERENCE_MODELS[id];
  if (!model) throw new Error(`Unknown character reference model: ${id}`);
  return model;
}
