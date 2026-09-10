import village from '../data/villages/foundation.json' with { type: 'json' };
import { assetById } from '@soul/assets';
export function validateWorld(data) {
  if (data.schemaVersion !== 1 || !data.id || !Number.isSafeInteger(data.revision) || data.revision < 1 || !Array.isArray(data.entities)) throw new Error('Invalid world document');
  const ids = new Set();
  for (const entity of data.entities) {
    if (!entity.id || ids.has(entity.id)) throw new Error('Duplicate/missing world entity ID');
    ids.add(entity.id);
    assetById(entity.assetId);
    for (const key of ['position', 'rotation', 'scale']) {
      if (!Array.isArray(entity[key]) || entity[key].length !== 3 || !entity[key].every(Number.isFinite)) throw new Error(`Invalid ${key}`);
    }
  }
  return data;
}
// Return copies: one game must not mutate the shared template used by another.
export function loadVillage() { return validateWorld(structuredClone(village)); }
