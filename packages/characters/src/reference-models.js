import { BASE_APPEARANCE_PARTS, canonicalAppearanceParts } from './appearance-parts.js';
import { MASTER_ID } from './master-character.js';

export const CHARACTER_REFERENCE_MODEL_VERSION = 2;

const freezeModel = model => Object.freeze({
  ...model,
  profile: Object.freeze(canonicalAppearanceParts(model.profile))
});

/**
 * Character Workshop reference-model catalog.
 * A DCC asset remains non-production until the staged production manifest reaches
 * RUNTIME_READY with explicit visual approval.
 */
export const CHARACTER_REFERENCE_MODELS = Object.freeze({
  'shino.reference.v2': freezeModel({
    id: 'shino.reference.v2',
    label: 'Shino Reference v2 / DCC',
    kind: 'dcc-character-model',
    productionStage: 'PRIMARY',
    modelingMode: 'dcc-blender',
    productionReady: false,
    characterId: 'Sendagaya_Shino',
    masterId: MASTER_ID,
    assetId: 'character.shino-reference-v2.dcc.v1',
    assetPath: './simulator/assets/SHINO_REFERENCE_V2.vrm',
    integrityPath: './simulator/assets/SHINO_REFERENCE_V2.asset.json',
    dccSourcePath: 'assets/characters/shino/reference-v2/source/ShinoReferenceV2.blend',
    referencePath: 'docs/characters/references/shino/shino-character-reference-sheet-v2.png',
    profile: BASE_APPEARANCE_PARTS,
    note: 'キャラクターリファレンスを正本にBlenderで専用造形したDCC PRIMARYモデル。旧Shinoの色替え/primitive blockoutではない。DEFORMATION以降と明示Visual Approvalは未完了。'
  })
});

export function characterReferenceModel(id) {
  const model = CHARACTER_REFERENCE_MODELS[id];
  if (!model) throw new Error(`Unknown character reference model: ${id}`);
  return model;
}
