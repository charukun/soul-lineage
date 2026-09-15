import {
  YEAR_MS,
  appearanceForCharacter,
  identifier,
  invariant,
  validateCharacter
} from './master-character.js';
import {
  appearancePartsForCharacter,
  mergeAppearanceParts
} from './appearance-parts.js';
import { crowdPlan } from './character-sync.js';
import { CHARACTER_REFERENCE_MODELS } from './reference-models.js';
import { evaluateCharacterProduction, referenceModelProductionStage } from './production-pipeline.js';

export const CHARACTER_PRESENTATION_VERSION = 1;
export const CHARACTER_PRESENTATION_APPS = Object.freeze(['rinne', 'village', 'demon']);
export const CHARACTER_PRESENTATION_AGE_BANDS = Object.freeze(['child', 'adult', 'elder']);

const APP_IDS = new Set(CHARACTER_PRESENTATION_APPS);
const REFERENCE_MODELS = Object.freeze(Object.values(CHARACTER_REFERENCE_MODELS));

function freezeRecord(value) {
  for (const item of Object.values(value)) {
    if (item && typeof item === 'object' && !Object.isFrozen(item)) Object.freeze(item);
  }
  return Object.freeze(value);
}

function validateApp(app) {
  invariant(APP_IDS.has(app), `Unknown character presentation app: ${app}`);
  return app;
}

function validateRole(role) {
  return identifier(role || 'villager', 'character role');
}

function ageBandForYears(years) {
  if (years < 18) return 'child';
  if (years < 65) return 'adult';
  return 'elder';
}

export function characterPresentationAgeBand(character) {
  validateCharacter(character);
  return ageBandForYears(character.ageMs / YEAR_MS);
}

function roleReferenceCandidates(role, ageBand) {
  const sameRole = REFERENCE_MODELS.filter(model => model.role === role);
  const sameAge = sameRole.filter(model => model.ageBand === ageBand);
  return sameAge.length ? sameAge : sameRole;
}

function chooseRoleReference(character, role, ageBand) {
  const candidates = roleReferenceCandidates(role, ageBand);
  if (!candidates.length) return null;
  return candidates[character.seed % candidates.length];
}

function rolePatchFromReference(reference) {
  if (!reference?.parts) return null;
  return {
    outfit: reference.parts.outfit,
    accessory: reference.parts.accessory
  };
}

export function resolveCharacterRoleAppearance(character, {
  role = 'villager',
  appearanceOverrides = null
} = {}) {
  validateCharacter(character);
  const resolvedRole = validateRole(role);
  const ageBand = characterPresentationAgeBand(character);
  const reference = chooseRoleReference(character, resolvedRole, ageBand);

  let parts = appearancePartsForCharacter(character);
  const rolePatch = rolePatchFromReference(reference);
  if (rolePatch) parts = mergeAppearanceParts(parts, rolePatch);
  if (appearanceOverrides) parts = mergeAppearanceParts(parts, appearanceOverrides);

  const referenceInfo = reference ? freezeRecord({
    id: reference.id,
    label: reference.label,
    role: reference.role,
    ageBand: reference.ageBand,
    gear: reference.gear,
    productionStage: referenceModelProductionStage(reference),
    productionReady: reference.productionReady === true
  }) : null;

  return freezeRecord({
    version: CHARACTER_PRESENTATION_VERSION,
    role: resolvedRole,
    parts: Object.freeze({ ...parts }),
    gear: reference?.gear || 'none',
    reference: referenceInfo
  });
}

export function resolveCharacterBodyArchetype(character, parts = null) {
  validateCharacter(character);
  const resolvedParts = parts || appearancePartsForCharacter(character);
  const appearance = appearanceForCharacter(character);
  const ageBand = characterPresentationAgeBand(character);
  const heightMetres = appearance.adultHeightMetres * appearance.height * appearance.scale;

  return freezeRecord({
    id: `${ageBand}.${resolvedParts.body}`,
    ageBand,
    build: resolvedParts.body,
    scale: appearance.scale,
    headScale: appearance.headScale,
    height: appearance.height,
    width: appearance.width,
    adultHeightMetres: appearance.adultHeightMetres,
    heightMetres,
    gray: appearance.gray,
    stoop: appearance.stoop,
    skinAge: appearance.skinAge
  });
}

function candidateMatches(candidate, { app, role, ageBand, renderTier }) {
  const matches = (field, value) => candidate[field] == null ||
    (Array.isArray(candidate[field]) && candidate[field].includes(value));
  return matches('apps', app) && matches('roles', role) &&
    matches('ageBands', ageBand) && matches('renderTiers', renderTier);
}

function candidateRuntimeReady(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
  if (candidate.manifest) {
    try {
      return evaluateCharacterProduction(candidate.manifest, 'RUNTIME_READY').productionReady;
    } catch {
      return false;
    }
  }
  return candidate.productionStage === 'RUNTIME_READY' && candidate.productionReady === true;
}

export function selectCharacterProductionAsset(candidates = [], context) {
  invariant(Array.isArray(candidates), 'Character asset candidates must be an array');
  const selected = candidates.find(candidate => candidateRuntimeReady(candidate) && candidateMatches(candidate, context));
  if (!selected) return null;
  return freezeRecord({
    id: identifier(selected.id || selected.assetId, 'character production asset id'),
    assetId: identifier(selected.assetId || selected.id, 'character production asset id'),
    productionStage: 'RUNTIME_READY',
    productionReady: true
  });
}

function resolveOne(actor, app, render, assetCandidates) {
  invariant(actor && typeof actor === 'object' && !Array.isArray(actor), 'Invalid character presentation actor');
  validateCharacter(actor.character);
  const roleAppearance = resolveCharacterRoleAppearance(actor.character, {
    role: actor.role,
    appearanceOverrides: actor.appearanceOverrides
  });
  const bodyArchetype = resolveCharacterBodyArchetype(actor.character, roleAppearance.parts);
  const productionAsset = selectCharacterProductionAsset(actor.assetCandidates || assetCandidates, {
    app,
    role: roleAppearance.role,
    ageBand: bodyArchetype.ageBand,
    renderTier: render.tier
  });

  return freezeRecord({
    version: CHARACTER_PRESENTATION_VERSION,
    app,
    characterId: actor.character.id,
    bodyArchetype,
    roleAppearance,
    render: freezeRecord({ ...render }),
    productionAsset
  });
}

export function resolveCharacterPresentations(actors, {
  app,
  lod = {},
  assetCandidates = []
} = {}) {
  validateApp(app);
  invariant(Array.isArray(actors), 'Character presentation actors must be an array');
  const rows = actors.map(actor => {
    invariant(actor && typeof actor === 'object' && !Array.isArray(actor), 'Invalid character presentation actor');
    validateCharacter(actor.character);
    invariant(Number.isFinite(actor.distance ?? 0) && (actor.distance ?? 0) >= 0, 'Invalid character presentation distance');
    return {
      id: actor.character.id,
      distance: actor.distance ?? 0,
      visible: actor.visible ?? true,
      important: actor.important ?? false
    };
  });
  const plan = crowdPlan(rows, lod);
  const byId = new Map(plan.map(render => [render.id, render]));
  return Object.freeze(actors.map(actor => resolveOne(actor, app, byId.get(actor.character.id), assetCandidates)));
}

export function resolveCharacterPresentation({
  character,
  app,
  role = 'villager',
  distance = 0,
  visible = true,
  important = false,
  appearanceOverrides = null,
  assetCandidates = [],
  lod = {}
}) {
  return resolveCharacterPresentations([{
    character,
    role,
    distance,
    visible,
    important,
    appearanceOverrides,
    assetCandidates
  }], { app, lod })[0];
}
