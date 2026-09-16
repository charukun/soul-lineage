import { DEFAULT_CHARACTER_FAMILY_ID, KAYKIT_FAMILY_ID, KAYKIT_FOUNDATION } from './kaykit-foundation.js';
import { BLOCKED_RERIG_CHARACTER_IDS, RETIRED_CONDITIONAL_CHARACTER_IDS } from './license-policy.js';
import {
  CHARACTER_REFERENCE_MODEL_VERSION,
  CHARACTER_REFERENCE_MODELS as REGISTERED_REFERENCE_MODELS,
  PROTAGONIST_VILLAGER_MODEL,
  PROTAGONIST_VILLAGER_MODEL_ID
} from './reference-model-catalog.js';

// Shared character descriptors. App gameplay remains outside this package.
// Only unconditional game-facing character foundations belong in the active catalog.
// Legacy Shino schema exports remain available for save/migration compatibility, but
// conditional or Shino-rigged model assets are excluded from active selection.
export const catalogVersion = 4;
export const defaultCatalogId = DEFAULT_CHARACTER_FAMILY_ID;
export const catalog = Object.freeze({ [KAYKIT_FAMILY_ID]: KAYKIT_FOUNDATION });

const inactiveReferenceIds = new Set([...RETIRED_CONDITIONAL_CHARACTER_IDS, ...BLOCKED_RERIG_CHARACTER_IDS]);
export const CHARACTER_REFERENCE_MODELS = Object.freeze(Object.fromEntries(
  Object.entries(REGISTERED_REFERENCE_MODELS).filter(([id]) => !inactiveReferenceIds.has(id))
));
export function characterReferenceModel(id) {
  const model = CHARACTER_REFERENCE_MODELS[id];
  if (!model) throw new Error(`Character reference model is retired or unavailable: ${id}`);
  return model;
}
export { CHARACTER_REFERENCE_MODEL_VERSION, PROTAGONIST_VILLAGER_MODEL, PROTAGONIST_VILLAGER_MODEL_ID };

export * from './master-character.js';
export * from './kaykit-foundation.js';
export * from './license-policy.js';
export * from './appearance-parts.js';
export * from './character-sync.js';
export * from './presentation-resolver.js';
export * from './visual-identity.js';
export * from './model-builder.js';
export { createCharacterModelBuildRequest } from './model-builder-catalog.js';
export * from './refinement-policy.js';
export * from './age-identity-continuity.js';
export * from './reference-archetypes.js';
export * from './reference-intelligence.js';
export * from './production-pipeline.js';
export * from './runtime-asset-audit.js';
export * from './art-direction.js';
export * from './material-library.js';
