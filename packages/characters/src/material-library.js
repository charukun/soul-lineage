import { deepFreeze, invariant } from './master-character.js';

export const STYLIZED_MATERIAL_LIBRARY_VERSION = 1;

export const STYLIZED_PALETTE = deepFreeze({
  skinWarm01: '#d7b59c',
  skinLight01: '#f0d6c7',
  clothDark01: '#3d4850',
  clothMoss01: '#68745d',
  clothEmber01: '#865d50',
  woodOak01: '#81624c',
  stoneWarm01: '#c5b89d',
  iron01: '#777c82',
  foliage01: '#6f9568',
  warmLight01: '#ffc36d',
});

const token = (id, label, family, roughness, metalness, extra = {}) => ({
  id,
  label,
  family,
  roughness,
  metalness,
  preserveBaseColor: extra.preserveBaseColor ?? true,
  baseColor: extra.baseColor ?? null,
  emissive: extra.emissive ?? null,
  emissiveIntensity: extra.emissiveIntensity ?? 0,
});

/**
 * Shared material response tokens. Surface tokens intentionally preserve an
 * asset's authored base color while normalising PBR response across apps.
 * Palette-bearing tokens are available for newly-authored shared assets.
 */
export const STYLIZED_MATERIAL_TOKENS = deepFreeze({
  'surface.hero': token('surface.hero', 'Hero surface', 'character', .56, .06),
  'surface.npc': token('surface.npc', 'NPC surface', 'character', .66, .04),
  'surface.enemy': token('surface.enemy', 'Enemy surface', 'character', .74, .03),
  'surface.environment': token('surface.environment', 'Environment surface', 'world', .84, .02),
  'surface.prop': token('surface.prop', 'Prop surface', 'world', .80, .04),
  'surface.distant': token('surface.distant', 'Distant surface', 'world', .92, 0),
  'skin.warm01': token('skin.warm01', 'Warm skin 01', 'skin', .64, 0, { preserveBaseColor: false, baseColor: STYLIZED_PALETTE.skinWarm01 }),
  'cloth.linen.dark': token('cloth.linen.dark', 'Dark linen', 'cloth', .88, 0, { preserveBaseColor: false, baseColor: STYLIZED_PALETTE.clothDark01 }),
  'wood.oak.weathered': token('wood.oak.weathered', 'Weathered oak', 'wood', .86, 0, { preserveBaseColor: false, baseColor: STYLIZED_PALETTE.woodOak01 }),
  'stone.warm': token('stone.warm', 'Warm stone', 'stone', .93, 0, { preserveBaseColor: false, baseColor: STYLIZED_PALETTE.stoneWarm01 }),
  'metal.iron': token('metal.iron', 'Iron', 'metal', .52, .58, { preserveBaseColor: false, baseColor: STYLIZED_PALETTE.iron01 }),
  'foliage.green': token('foliage.green', 'Foliage green', 'foliage', .91, 0, { preserveBaseColor: false, baseColor: STYLIZED_PALETTE.foliage01 }),
  'light.warm': token('light.warm', 'Warm emissive', 'light', .62, 0, { preserveBaseColor: false, baseColor: STYLIZED_PALETTE.warmLight01, emissive: STYLIZED_PALETTE.warmLight01, emissiveIntensity: .8 }),
});

const DEFAULT_BY_PROFILE = deepFreeze({
  hero: 'surface.hero',
  npc: 'surface.npc',
  enemy: 'surface.enemy',
  environment: 'surface.environment',
  prop: 'surface.prop',
  distant: 'surface.distant',
});

export function stylizedMaterialToken(id) {
  invariant(typeof id === 'string' && Object.hasOwn(STYLIZED_MATERIAL_TOKENS, id), `Unknown stylized material token: ${id}`);
  return STYLIZED_MATERIAL_TOKENS[id];
}

export function defaultMaterialTokenForProfile(profileId) {
  invariant(Object.hasOwn(DEFAULT_BY_PROFILE, profileId), `Unknown material profile: ${profileId}`);
  return DEFAULT_BY_PROFILE[profileId];
}
