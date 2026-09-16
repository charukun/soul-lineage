import { MASTER_ID, SHINO_MASTER } from './master-character.js';
import { DEFAULT_CHARACTER_FAMILY_ID, KAYKIT_FAMILY_ID, KAYKIT_FOUNDATION } from './kaykit-foundation.js';
// Shared character descriptors. App gameplay remains outside this package.
// KayKit is the game-facing default; Shino remains registered for compatibility.
export const catalogVersion = 3;
export const defaultCatalogId = DEFAULT_CHARACTER_FAMILY_ID;
export const catalog = Object.freeze({ [KAYKIT_FAMILY_ID]: KAYKIT_FOUNDATION, [MASTER_ID]: SHINO_MASTER });
export * from './master-character.js';
export * from './kaykit-foundation.js';
export * from './appearance-parts.js';
export * from './character-sync.js';
export * from './presentation-resolver.js';
export * from './visual-identity.js';
export * from './reference-models.js';
export * from './model-builder.js';
export * from './refinement-policy.js';
export * from './age-identity-continuity.js';
export * from './reference-archetypes.js';
export * from './reference-intelligence.js';
export * from './production-pipeline.js';
export * from './runtime-asset-audit.js';
export * from './art-direction.js';
export * from './material-library.js';
