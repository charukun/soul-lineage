import { BASE_APPEARANCE_PARTS, canonicalAppearanceParts } from './appearance-parts.js';

export const CHARACTER_REFERENCE_MODEL_VERSION = 1;

const freezeModel = model => Object.freeze({
  ...model,
  profile: Object.freeze(canonicalAppearanceParts(model.profile))
});

/**
 * Character Workshop model catalog.
 * Reference sheets are alignment material only. The actual selectable profile
 * must point at already implemented MasterCharacter / modular-part contracts.
 */
export const CHARACTER_REFERENCE_MODELS = Object.freeze({
  'shino.reference.v2': freezeModel({
    id: 'shino.reference.v2',
    label: 'Shino Reference v2',
    characterId: 'Sendagaya_Shino',
    masterId: 'shino.master.v1',
    referencePath: 'docs/characters/references/shino/shino-character-reference-sheet-v2.webp',
    profile: BASE_APPEARANCE_PARTS,
    note: 'CURRENT MASTER と実装済みモジュラーパーツのみ。提案パーツやゲーム固有装備は含めない。'
  })
});

export function characterReferenceModel(id) {
  const model = CHARACTER_REFERENCE_MODELS[id];
  if (!model) throw new Error(`Unknown character reference model: ${id}`);
  return model;
}
