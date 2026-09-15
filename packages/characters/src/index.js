import { MASTER_ID, SHINO_MASTER } from './master-character.js';
// Shared character descriptors. App gameplay remains outside this package.
export const catalogVersion = 2;
export const catalog = Object.freeze({ [MASTER_ID]: SHINO_MASTER });
export * from './master-character.js';
export * from './appearance-parts.js';
export * from './character-sync.js';
export * from './presentation-resolver.js';
export * from './visual-identity.js';
export * from './reference-models.js';
export * from './model-builder.js';
export * from './age-identity-continuity.js';
export * from './reference-archetypes.js';
export * from './reference-intelligence.js';
export * from './production-pipeline.js';
export * from './runtime-asset-audit.js';
export * from './art-direction.js';
export * from './material-library.js';
