export const contentVersion = 'foundation-1';
export const saveSchemaVersion = 1;
export const protocolVersion = 1;
export const availableLanguages = Object.freeze(['ja', 'en']);
export const deploymentRegions = Object.freeze(['auto', 'asia', 'europe', 'americas']);
export function createSaveEnvelope({ gameId, playerId, revision = 0, payload, updatedAt }) {
  if (!gameId || !playerId || !Number.isSafeInteger(revision) || revision < 0 || !Number.isFinite(updatedAt)) throw new Error('Invalid save identity/revision');
  return { schemaVersion: saveSchemaVersion, gameId, playerId, revision, updatedAt, payload: structuredClone(payload) };
}
export function readSaveEnvelope(data, { gameId, playerId }) {
  if (data.schemaVersion !== saveSchemaVersion || data.gameId !== gameId || data.playerId !== playerId) throw new Error('Incompatible save');
  return createSaveEnvelope(data);
}
