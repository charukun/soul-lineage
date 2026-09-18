import { deepFreeze, invariant } from './master-character.js';

export const STYLIZED_ART_VERSION = 1;
export const STYLIZED_ART_STYLE_ID = 'stylized-low-mid-poly.v1';
export const SHINO_ART_PROFILE_ID = 'hero';

const profile = (id, label, density, radialSegmentsMax, flatShading, roughness, metalnessMax, shadow, lod, performance, effects) => ({
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
  performance,
  effects,
});

const perf = (triangles, materials, drawCalls, lodDistances, densityDistances) => ({
  softTriangleBudget: triangles,
  softMaterialBudget: materials,
  softDrawCallBudget: drawCalls,
  lodDistances,
  densityDistances,
});

const fx = (scale, maxParticles, trailSegments) => ({ scale, maxParticles, trailSegments });

/**
 * Portable visual budgets. Renderers consume these values, while gameplay and
 * character serialization remain completely independent of art direction.
 * Budgets are soft review gates, not destructive runtime limits.
 */
export const STYLIZED_ART_PROFILES = deepFreeze({
  hero: profile('hero', 'Hero / Named Character', 'mid', 16, false, [.38, .86], .35,
    { cast: true, receive: true }, [1, .72, .42], perf(120000, 24, 36, [0, 24, 52], [0, 35, 70]), fx(1, 900, 48)),
  npc: profile('npc', 'General NPC', 'low-mid', 12, false, [.48, .90], .28,
    { cast: true, receive: true }, [1, .58, .30], perf(50000, 14, 20, [0, 18, 42], [0, 28, 58]), fx(.62, 360, 24)),
  enemy: profile('enemy', 'Enemy / Mob', 'low', 10, true, [.56, .94], .22,
    { cast: true, receive: true }, [1, .52, .24], perf(32000, 12, 18, [0, 20, 46], [0, 30, 62]), fx(.9, 720, 40)),
  environment: profile('environment', 'Environment', 'low', 8, true, [.64, 1], .18,
    { cast: true, receive: true }, [1, .45, .18], perf(24000, 10, 14, [0, 48, 112], [0, 55, 120]), fx(.35, 180, 12)),
  prop: profile('prop', 'Prop', 'low', 8, true, [.60, .98], .24,
    { cast: true, receive: true }, [1, .48, .22], perf(9000, 6, 8, [0, 30, 72], [0, 34, 78]), fx(.3, 140, 10)),
  distant: profile('distant', 'Distant / Impostor Candidate', 'very-low', 6, true, [.70, 1], .12,
    { cast: false, receive: true }, [1, .32, .10], perf(2500, 3, 4, [0, 18, 42], [0, 18, 42]), fx(.1, 40, 4)),
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
  invariant(Array.isArray(value.performance?.lodDistances) && value.performance.lodDistances.length === 3 && value.performance.lodDistances[0] === 0 && value.performance.lodDistances[1] < value.performance.lodDistances[2], 'Invalid LOD distances');
  invariant(Array.isArray(value.performance?.densityDistances) && value.performance.densityDistances.length === 3 && value.performance.densityDistances[0] === 0 && value.performance.densityDistances[1] < value.performance.densityDistances[2], 'Invalid density distances');
  invariant(Number.isInteger(value.performance.softTriangleBudget) && value.performance.softTriangleBudget > 0, 'Invalid triangle budget');
  invariant(Number.isInteger(value.performance.softMaterialBudget) && value.performance.softMaterialBudget > 0, 'Invalid material budget');
  invariant(Number.isInteger(value.performance.softDrawCallBudget) && value.performance.softDrawCallBudget > 0, 'Invalid draw-call budget');
  invariant(value.effects?.scale >= 0 && value.effects.scale <= 1, 'Invalid effects scale');
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

/**
 * Multiplayer/presence visual policy. The local player always keeps hero
 * presentation. Remote players keep a readable near profile, then degrade to
 * population/distant profiles without changing network or gameplay state.
 */
export function stylizedProfileForPresence({ local = false, enemy = false, distance = 0 } = {}) {
  invariant(typeof distance === 'number' && Number.isFinite(distance) && distance >= 0, 'Invalid presence distance');
  if (local) return STYLIZED_ART_PROFILES.hero;
  if (distance >= 60) return STYLIZED_ART_PROFILES.distant;
  if (enemy) return distance >= 28 ? STYLIZED_ART_PROFILES.distant : STYLIZED_ART_PROFILES.enemy;
  return distance >= 26 ? STYLIZED_ART_PROFILES.npc : STYLIZED_ART_PROFILES.hero;
}

/** Set-dressing density tier for environment population decisions. */
export function stylizedDensityForDistance(profileId, distance) {
  const p = stylizedArtProfile(profileId);
  invariant(typeof distance === 'number' && Number.isFinite(distance) && distance >= 0, 'Invalid density distance');
  const [, mid, far] = p.performance.densityDistances;
  if (distance >= far) return .2;
  if (distance >= mid) return .55;
  return 1;
}

for (const value of Object.values(STYLIZED_ART_PROFILES)) validateStylizedArtProfile(value);