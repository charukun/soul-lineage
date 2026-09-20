export const contentVersion = 'foundation-1';
export const saveSchemaVersion = 1;
export const protocolVersion = 1;
export const availableLanguages = Object.freeze(['ja', 'en']);
export const deploymentRegions = Object.freeze(['auto', 'asia', 'europe', 'americas']);
export { inspirationCatalogRevision, INSPIRATION_WEAPON_ARTS, INSPIRATION_WEAPONS, INSPIRATION_MOTION_IDS, getInspirationWeaponArts, cloneInspirationWeaponArts } from './inspiration-catalog.js';
export { causalInspirationRevision, INSPIRATION_KINDS, INSPIRATION_NAME_GRADES, INSPIRATION_ATTRIBUTE_LABELS, INSPIRATION_ATTRIBUTES, INSPIRATION_TRAIT_IMPACTS, INSPIRATION_TRAIT_RARITIES, INSPIRATION_QUESTIONS, CAUSAL_ANSWERS, CAUSAL_ANSWER_BY_ID, isInspirationAttribute, normalizeInspirationAttributes, inspirationTechniqueStructureKey, inspirationTechniqueGrade, inspirationTechniqueName, inspirationTechniquePresentation, answerSignature, validateInspirationNamePolicy, validateCausalAnswers } from './causal-inspiration-catalog.js';
export function createSaveEnvelope({ gameId, playerId, revision = 0, payload, updatedAt }) {
  if (!gameId || !playerId || !Number.isSafeInteger(revision) || revision < 0 || !Number.isFinite(updatedAt)) throw new Error('Invalid save identity/revision');
  return { schemaVersion: saveSchemaVersion, gameId, playerId, revision, updatedAt, payload: structuredClone(payload) };
}
export function readSaveEnvelope(data, { gameId, playerId }) {
  if (data.schemaVersion !== saveSchemaVersion || data.gameId !== gameId || data.playerId !== playerId) throw new Error('Incompatible save');
  return createSaveEnvelope(data);
}
