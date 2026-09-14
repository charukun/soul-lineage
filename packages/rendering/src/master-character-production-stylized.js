export * from './master-character-production.js';

import { createShinoProductionPool as createBasePool } from './master-character-production.js';
import { applyStylizedArtProfile } from './stylized-art.js';

function profileForActorId(id) {
  const value = String(id || '');
  if (value.startsWith('review.') || value.includes('Sendagaya_Shino') || value.includes('sendagaya-shino')) return 'hero';
  return 'npc';
}

/**
 * Shared production-pool adapter. Review Shino receives the hero Mid Poly
 * presentation target, while population instances keep the cheaper NPC target.
 * Pooling, rigging, motion, audit and gameplay state stay in the base module.
 */
export function createShinoProductionPool(options) {
  const pool = createBasePool(options);
  const spawn = pool.spawn.bind(pool);
  pool.spawn = (id, ...args) => {
    const actor = spawn(id, ...args);
    const profileId = profileForActorId(id);
    if (actor.root?.userData?.stylizedArt?.profileId !== profileId) {
      applyStylizedArtProfile(actor.root, profileId, { cloneMaterials: false });
    }
    actor.root.userData.stylizedCharacterRole = profileId;
    return actor;
  };
  return pool;
}