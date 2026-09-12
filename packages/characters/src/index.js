import { MASTER_ID, SHINO_MASTER } from './master-character.js';
// Shared character descriptors. App gameplay remains outside this package.
export const catalogVersion = 2;
export const catalog = Object.freeze({ [MASTER_ID]: SHINO_MASTER });
export * from './master-character.js';
export * from './appearance-parts.js';
export * from './character-sync.js';
