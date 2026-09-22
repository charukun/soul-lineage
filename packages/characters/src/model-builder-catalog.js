import { createCharacterModelBuildRequest as createBaseCharacterModelBuildRequest } from './model-builder.js';
import { BLOCKED_RERIG_CHARACTER_IDS, RETIRED_CONDITIONAL_CHARACTER_IDS } from './license-policy.js';

function rejectConditionalReference(referenceId) {
  if (RETIRED_CONDITIONAL_CHARACTER_IDS.includes(referenceId) || BLOCKED_RERIG_CHARACTER_IDS.includes(referenceId)) {
    throw new Error(`Character reference model is retired pending unconditional replacement: ${referenceId}`);
  }
}

/** Keep the normal build-request API license-clean. Conditional and carrier-rig
 * references must be re-authored on the CC0/RINNE foundation before generation. */
export function createCharacterModelBuildRequest(referenceId, options = {}) {
  rejectConditionalReference(referenceId);
  return createBaseCharacterModelBuildRequest(referenceId, options);
}
