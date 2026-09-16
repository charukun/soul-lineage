import { DEFAULT_CHARACTER_FAMILY_ID, KAYKIT_FAMILY_ID, KAYKIT_FOUNDATION } from './kaykit-foundation.js';
// Shared character descriptors. App gameplay remains outside this package.
// Only unconditional game-facing character foundations belong in the active catalog.
// Legacy Shino schema exports remain available for migration compatibility, but the
// conditional model is retired from catalog selection by CHARACTER_LICENSE_POLICY.
export const catalogVersion = 4;
export const defaultCatalogId = DEFAULT_CHARACTER_FAMILY_ID;
export const catalog = Object.freeze({ [KAYKIT_FAMILY_ID]: KAYKIT_FOUNDATION });
export * from './master-character.js';
export * from './kaykit-foundation.js';
export * from './license-policy.js';
export * from './appearance-parts.js';
export * from './character-sync.js';
export * from './presentation-resolver.js';
export * from './visual-identity.js';
export * from './reference-model-catalog.js';
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
