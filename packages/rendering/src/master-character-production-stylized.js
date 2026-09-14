export * from './master-character-production.js';

import { createShinoProductionPool as createBasePool } from './master-character-production.js';
import { applyStylizedArtProfile } from './stylized-art.js';

export function productionArtProfileForActorId(id) {
  const value = String(id || '');
  if (value.includes('Sendagaya_Shino') || value.includes('sendagaya-shino')) return 'hero';
  // Character Workshop keeps the first review subject as its Shino reference
  // target while the rest of the cohort stays representative of population cost.
  if (/^review\.[^.]+\.0$/.test(value)) return 'hero';
  return 'npc';
}

function applyProfile(root, profileId) {
  if (!root?.traverse || root.userData?.stylizedArt?.profileId === profileId) return;
  // Hero/reference instances isolate their materials so later population
  // styling cannot overwrite the hero target through a shared pool material.
  applyStylizedArtProfile(root, profileId, { cloneMaterials: profileId === 'hero' });
}

/**
 * Shared production-pool adapter. The Shino reference receives the hero Mid
 * Poly target, while population instances keep the cheaper NPC target.
 * Pooling, rigging, motion, audit and gameplay state stay in the base module.
 */
export function createShinoProductionPool(options) {
  const pool = createBasePool(options);
  const spawn = pool.spawn.bind(pool);
  pool.spawn = (id, ...args) => {
    const actor = spawn(id, ...args);
    const profileId = productionArtProfileForActorId(id);
    applyProfile(actor.root, profileId);
    applyProfile(actor.attachments, profileId);
    actor.root.userData.stylizedCharacterRole = profileId;
    if (actor.attachments) actor.attachments.userData.stylizedCharacterRole = profileId;
    return actor;
  };
  return pool;
}