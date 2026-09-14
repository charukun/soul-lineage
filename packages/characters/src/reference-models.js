import { BASE_APPEARANCE_PARTS, canonicalAppearanceParts } from './appearance-parts.js';
import { MASTER_ID, deepFreeze } from './master-character.js';

export const CHARACTER_REFERENCE_MODEL_VERSION = 2;

const freezeModel = model => deepFreeze({
  ...model,
  profile: canonicalAppearanceParts(model.profile)
});

/**
 * Character Workshop reference-model catalog.
 * Reference sheets align review with implementation; they never replace the
 * audited MasterCharacter asset or authorize proposed/game-owned parts.
 */
export const CHARACTER_REFERENCE_MODELS = Object.freeze({
  'shino.reference.v2': freezeModel({
    id: 'shino.reference.v2',
    label: 'Shino Reference v2',
    kind: 'reference-preset',
    characterId: 'Sendagaya_Shino',
    masterId: MASTER_ID,
    assetId: MASTER_ID,
    referencePath: 'docs/characters/references/shino/shino-character-reference-sheet-v2.png',
    profile: BASE_APPEARANCE_PARTS,
    note: 'CURRENT MASTER と実装済みモジュラーパーツのみ。提案パーツやゲーム固有装備は含めない。',
    production: {
      sourceSections: ['CURRENT MASTER', 'IMPLEMENTED MODULAR PARTS', 'PROPOSED PARTS', 'GAME EQUIPMENT'],
      authority: {
        currentMaster: ['identity', 'base-mesh', 'base-rig', 'base-materials', 'expressions', 'spring-bones'],
        implementedModularParts: ['face', 'hair', 'body', 'outfit', 'accessory'],
        proposedParts: [],
        gameEquipment: []
      },
      target: {
        formats: ['vrm', 'glb'],
        primaryFormat: 'vrm',
        rigId: 'humanoid.shino-vrm1.v2',
        materialProfiles: ['mtoon-compatible', 'stylized-pbr-fallback'],
        preserveExpressions: true,
        preserveSpringBones: true
      },
      requirements: {
        topology: 'humanoid-production',
        modularCompatibility: true,
        sourceProvenanceRequired: true,
        gameEquipmentPolicy: 'exclude-from-shared-character-asset',
        weaponSocketPolicy: 'preserve-runtime-owned-sockets',
        fallbackPolicy: 'retain-current-master-until-candidate-accepted'
      }
    }
  })
});

export function characterReferenceModel(id) {
  const model = CHARACTER_REFERENCE_MODELS[id];
  if (!model) throw new Error(`Unknown character reference model: ${id}`);
  return model;
}
