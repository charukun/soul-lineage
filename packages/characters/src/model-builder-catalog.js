import { deepFreeze } from './master-character.js';
import {
  createCharacterModelBuildRequest as createBaseCharacterModelBuildRequest,
  validateCharacterModelBuildRequest
} from './model-builder.js';
import { characterReferenceModel, PROTAGONIST_VILLAGER_MODEL_ID } from './reference-model-catalog.js';
import { BLOCKED_RERIG_CHARACTER_IDS, RETIRED_CONDITIONAL_CHARACTER_IDS } from './license-policy.js';

const clone = value => JSON.parse(JSON.stringify(value));

function rejectConditionalReference(referenceId) {
  if (RETIRED_CONDITIONAL_CHARACTER_IDS.includes(referenceId) || BLOCKED_RERIG_CHARACTER_IDS.includes(referenceId)) {
    throw new Error(`Character reference model is retired pending unconditional replacement: ${referenceId}`);
  }
}

/** Keep the normal build-request API license-clean. Conditional and carrier-rig
 * references must be re-authored on the CC0/RINNE foundation before generation. */
export function createCharacterModelBuildRequest(referenceId, options = {}) {
  rejectConditionalReference(referenceId);
  if (referenceId !== PROTAGONIST_VILLAGER_MODEL_ID) return createBaseCharacterModelBuildRequest(referenceId, options);

  const template = clone(createBaseCharacterModelBuildRequest('child-boy.reference.v1', options));
  const reference = characterReferenceModel(referenceId);
  template.id = `request.${reference.id}`;
  template.reference = {
    ...template.reference,
    id: reference.id,
    label: reference.label,
    characterId: reference.characterId,
    masterId: reference.masterId,
    fallbackAssetId: reference.masterId,
    referencePath: reference.referencePath,
    profile: clone(reference.profile)
  };
  template.sourceSections = clone(reference.production.sourceSections);
  template.authority = clone(reference.production.authority);
  template.target = clone(reference.production.target);
  template.requirements = {
    ...clone(reference.production.requirements),
    refinement: template.requirements.refinement
  };
  validateCharacterModelBuildRequest(template);
  return deepFreeze(template);
}
