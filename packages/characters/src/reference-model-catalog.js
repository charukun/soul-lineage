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
  note: 'KayKit Adventurers 1.0の固定revisionからKnight.glbのHead / Arm / Leg実メッシュとRig_Mediumを主人公の主軸として直接流用するDCC PRIMARY。Knight_Body固有の騎士章を削るのではなく、同じ固定CC0パックのRogue_Bodyだけを装備なし村人チュニックの胴パーツとしてRig_Mediumへ付け替える。Rogueの武器・ケープ・頭・腕・脚は持ち込まない。ユーザー確認を受けDEV runtime主人公として採用するが、visualApproval=pending / productionReady=falseの品質gateは維持する。'
};

validateVisualIdentity(protagonist);
export const PROTAGONIST_VILLAGER_MODEL = deepFreeze(protagonist);

const seedKnight = BASE_CHARACTER_REFERENCE_MODELS['knight.reference.v1'];
const reconstructedProfile = canonicalAppearanceParts({
  version: 1,
  face: 'round',
  hair: 'bob',
  body: 'compact',
  outfit: 'tunic',
  accessory: 'scarf'
});
const MESHY_WAYFARER_SOURCE_URL = 'https://www.meshy.ai/3d-models/A-stylized-3D-model-of-a-chibistyle-female-adventurer-A-young-hero-with-a-short-green-hoodie-under-a-light-brown-leather-tunic-dark-short-skirt-leather-boots-and-a-simple-belt-Tousled-long-brown-hair-and-expressive-bright-blue-eyes-Confident-pose-stylized-for-a-fantasy-actionadventure-gameStylized-Fantasy-Game-Assets-Legend-of-Zelda-Pixar-Style-World-of-Warcraft-Chibi-Full-Body-APose-v2-0196ad16-605f-735d-9d1c-ec04032a2e02';
const reconstructedWayfarer = {
  ...seedKnight,
  version: 1,
  seed: 0x4d575632,
  role: 'traveller',
  ageBand: 'adult',
  parts: reconstructedProfile,
  front: 'swept',
  back: 'layered',
  face: { ...seedKnight.face, jaw: .91, cheek: 1.08, nose: .91, eyeWidth: 1.12, eyeHeight: 1.13, eyeSpacing: 1.03, browWeight: .82, browSlant: .012, chin: .92 },
  proportions: { shoulders: .90, arms: .95, legs: .90, head: 1.18 },
  gear: 'satchel',
  cloth: [.43, .29, .18],
  trim: [.73, .65, .50],
  hairValue: .94,
  id: RECONSTRUCTED_WAYFARER_MODEL_ID,
  label: '再構築 Wayfarer / Meshy CC0 Seed',
  kind: 'runtime-reference-model',
  characterId: 'Reference_Reconstructed_Wayfarer',
  assetId: 'runtime.reconstructed-wayfarer.reference.v1',
  productionStage: 'BLOCKOUT',
  modelingMode: 'runtime-procedural',
  productionReady: false,
  referencePath: MESHY_WAYFARER_SOURCE_URL,
  profile: reconstructedProfile,
  referenceStyle: deepFreeze({
    version: 2,
    design: 'meshy-seed-rinne-wayfarer',
    scale: .78,
    palette: {
      skin: [.91, .70, .59],
      hair: [.30, .18, .11],
      eyes: [.20, .48, .72],
      primary: [.43, .29, .18],
      secondary: [.22, .35, .19],
      accent: [.73, .65, .50],
      dark: [.13, .12, .15],
      metal: [.46, .48, .50],
      leather: [.29, .17, .10],
      wood: [.34, .23, .14]
    },
    armStyle: 'shirt',
    legStyle: 'bare',
    footwear: 'boots',
    prop: 'satchel',
    topologyPreset: 'procedural-humanoid-rebuild-v2-meshy-visual-seed',
    surfacePreset: 'rinne-flat-cloth-leather-v2',
    designDna: [
      'compact-chibi-proportions',
      'short-green-hood',
      'layered-leather-tunic',
      'short-dark-skirt',
      'simple-utility-belt',
      'tousled-brown-hair',
      'bright-blue-eyes',
      'leather-boots'
    ]
  }),
  sourceReference: deepFreeze({
    provider: 'Meshy',
    source: 'Meshy Community / chibi-style female adventurer',
    author: 'ktmarine1999',
    modelId: '0196ad16-605f-735d-9d1c-ec04032a2e02',
    url: MESHY_WAYFARER_SOURCE_URL,
    license: 'CC0',
    use: 'public-preview-visual-form-seed-only',
    reusedGeometry: false,
    reusedTextures: false,
    transformation: [
      'observe-public-preview-and-prompt-only',
      'discard-source-geometry-and-textures',
      'rebuild-topology-on-audited-humanoid-rig',
      'redesign-proportions-and-silhouette-for-rinne',
      'replace-surface-with-rinne-stylized-material-palette',
      'reinterpret-chibi-adventurer-as-rinne-wayfarer'
    ]
  }),
  note: 'Meshy Communityの公開CC0モデル（@ktmarine1999 / 0196ad16-605f-735d-9d1c-ec04032a2e02）を視覚的な種としてのみ参照するBLOCKOUT実験。公開プレビューと公開promptから、コンパクトな頭身、短い緑フード、革チュニック、暗色ショートスカート、簡素なベルト、茶髪、青い瞳、革ブーツというDesign DNAだけを抽出する。元mesh・texture/materialは再利用せず、共通Humanoid rig上でTopologyと表面材質を組み直し、顔・輪郭・装備配置を輪廻転焦の旅人へ再設計する。'
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
