import { deepFreeze, invariant } from './master-character.js';

export const STYLIZED_ART_VERSION = 1;
export const STYLIZED_ART_STYLE_ID = 'stylized-low-mid-poly.v1';
export const SHINO_ART_PROFILE_ID = 'hero';

const profile = (id, label, density, radialSegmentsMax, flatShading, roughness, metalnessMax, shadow, lod) => ({
  id,
  label,
  styleId: STYLIZED_ART_STYLE_ID,
  density,
  geometry: {
    silhouettePriority: true,
    radialSegmentsMax,
    preserveDeformationLoops: id === 'hero' || id === 'npc',
    microDetail: false,
  },
  surface: {
    model: 'stylized-pbr',
    flatShading,
    roughness,
    metalnessMax,
  },
  shadow,
  lighting: {
    ambient: 'cool',
    local: 'warm',
    ao: 'restrained',
    fog: 'depth-separation',
  },
  lod,
});

/**
 * Portable visual budgets. Renderers consume these values, while gameplay and
 * character serialization remain completely independent of art direction.
 */
export const STYLIZED_ART_PROFILES = deepFreeze({
  hero: profile('hero', 'Hero / Named Character', 'mid', 16, false, [.38, .86], .35,
    { cast: true, receive: true }, [1, .72, .42]),
  npc: profile('npc', 'General NPC', 'low-mid', 12, false, [.48, .90], .28,
    { cast: true, receive: true }, [1, .58, .30]),
  enemy: profile('enemy', 'Enemy / Mob', 'low', 10, true, [.56, .94], .22,
    { cast: true, receive: true }, [1, .52, .24]),
  environment: profile('environment', 'Environment', 'low', 8, true, [.64, 1], .18,
    { cast: true, receive: true }, [1, .45, .18]),
  prop: profile('prop', 'Prop', 'low', 8, true, [.60, .98], .24,
    { cast: true, receive: true }, [1, .48, .22]),
  distant: profile('distant', 'Distant / Impostor Candidate', 'very-low', 6, true, [.70, 1], .12,
    { cast: false, receive: true }, [1, .32, .10]),
});

export function stylizedArtProfile(id) {
  invariant(typeof id === 'string' && Object.hasOwn(STYLIZED_ART_PROFILES, id), `Unknown stylized art profile: ${id}`);
  return STYLIZED_ART_PROFILES[id];
}

export function validateStylizedArtProfile(value) {
  invariant(value && value.styleId === STYLIZED_ART_STYLE_ID, 'Unsupported stylized art profile');
  invariant(Object.hasOwn(STYLIZED_ART_PROFILES, value.id), 'Unknown stylized art profile id');
  invariant(Number.isInteger(value.geometry?.radialSegmentsMax) && value.geometry.radialSegmentsMax >= 3, 'Invalid segment budget');
  invariant(Array.isArray(value.surface?.roughness) && value.surface.roughness.length === 2, 'Invalid roughness range');
  const [minRoughness, maxRoughness] = value.surface.roughness;
  invariant(minRoughness >= 0 && maxRoughness <= 1 && minRoughness <= maxRoughness, 'Invalid roughness range');
  invariant(value.surface.metalnessMax >= 0 && value.surface.metalnessMax <= 1, 'Invalid metalness cap');
  invariant(Array.isArray(value.lod) && value.lod.length === 3 && value.lod[0] === 1 && value.lod[1] > value.lod[2], 'Invalid LOD ratios');
  return value;
}

export function stylizedProfileForRole({ named = false, enemy = false, distant = false, environment = false, prop = false } = {}) {
  if (named) return STYLIZED_ART_PROFILES.hero;
  if (distant) return STYLIZED_ART_PROFILES.distant;
  if (environment) return STYLIZED_ART_PROFILES.environment;
  if (prop) return STYLIZED_ART_PROFILES.prop;
  if (enemy) return STYLIZED_ART_PROFILES.enemy;
  return STYLIZED_ART_PROFILES.npc;
}

for (const value of Object.values(STYLIZED_ART_PROFILES)) validateStylizedArtProfile(value);