const bytes = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;
export function validateVillageCheckpoint(value, { maxBytes = 1_500_000, maxEntities = 12_000 } = {}) {
  if (!value || value.schemaVersion !== 1 || !Number.isSafeInteger(value.worldTimeMs) || value.worldTimeMs < 0) throw new Error('Invalid village checkpoint');
  if (!Array.isArray(value.characters) || !Array.isArray(value.npcs) || value.characters.length + value.npcs.length > maxEntities) throw new Error('Checkpoint entity budget exceeded');
  const ids = new Set();
  for (const entity of [...value.characters, ...value.npcs]) {
    if (!entity?.id || ids.has(entity.id) || !Array.isArray(entity.position) || entity.position.length !== 3 || !entity.position.every(Number.isFinite)) throw new Error('Invalid checkpoint entity');
    ids.add(entity.id);
  }
  if (bytes(value) > maxBytes) throw new Error('Checkpoint byte budget exceeded');
  return value;
}
export function createVillageCheckpoint({ worldTimeMs, world, characters = [], npcs = [], randomState = null }) {
  return validateVillageCheckpoint({ schemaVersion: 1, worldTimeMs, world: clone(world), characters: clone(characters), npcs: clone(npcs), randomState: clone(randomState) });
}
const clone = value => structuredClone(value);
