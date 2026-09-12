import { deepFreeze, finite, integer, invariant, validateCharacter, YEAR_MS } from './master-character.js';
import { canonicalAppearanceParts } from './appearance-parts.js';

/** Renderer-only derivation. Never serialized into the Character or used by gameplay RNG. */
export const VISUAL_IDENTITY_VERSION = 1;
export const VISUAL_ROLES = deepFreeze({
  resident: '一般住民', mayor: '村長', guard: '護衛', artisan: '職人', laborer: '労働者',
  elder: '高齢者', child: '子供', knight: '騎士', hunter: '狩人', arcanist: '術師',
  smith: '鍛冶職人', acolyte: '侍祭', gravekeeper: '墓守', bellkeeper: '鐘守', traveller: '旅人'
});
export const HAIR_FRONTS = Object.freeze(['parted', 'swept', 'fringe', 'open']);
export const HAIR_BACKS = Object.freeze(['close', 'layered', 'tied']);
const OUTFITS = Object.freeze({ resident: 'tunic', mayor: 'mantle', guard: 'tunic', artisan: 'apron',
  laborer: 'tunic', elder: 'mantle', child: 'tunic', knight: 'mantle', hunter: 'tunic', arcanist: 'mantle',
  smith: 'apron', acolyte: 'mantle', gravekeeper: 'tunic', bellkeeper: 'mantle', traveller: 'tunic' });
const GEAR = Object.freeze({ resident: 'belt', mayor: 'chain', guard: 'pauldron', artisan: 'tools', laborer: 'pack',
  elder: 'shawl', child: 'none', knight: 'armor', hunter: 'quiver', arcanist: 'cowl', smith: 'tools',
  acolyte: 'stole', gravekeeper: 'pack', bellkeeper: 'chain', traveller: 'satchel' });
const jobRoles = Object.freeze({
  guardpost: 'guard', guardhome: 'guard', barracks: 'guard', watchtower: 'guard', dojo: 'guard',
  smith: 'smith', carpenter: 'artisan', weapons: 'artisan', armor: 'artisan', jeweler: 'artisan', tools: 'artisan', furniture: 'artisan',
  logging: 'laborer', quarry: 'laborer', clay: 'laborer', wheat: 'laborer', farm: 'laborer', orchard: 'laborer', storage: 'laborer', harbor: 'laborer',
  hunting: 'hunter', chapel: 'acolyte', school: 'arcanist', clinic: 'acolyte', market: 'traveller', inn: 'artisan', diner: 'artisan', restaurant: 'artisan', tavern: 'artisan'
});
const CLOTH = deepFreeze([[.30,.43,.37], [.35,.40,.51], [.58,.38,.27], [.55,.48,.34], [.39,.29,.40], [.56,.57,.51]]);
const TRIM = deepFreeze([[.64,.53,.31], [.33,.24,.16], [.53,.57,.59], [.72,.64,.48]]);
function mix(seed, salt) {
  let x = (seed ^ salt) >>> 0;
  x = Math.imul(x ^ x >>> 16, 0x7feb352d); x = Math.imul(x ^ x >>> 15, 0x846ca68b);
  return (x ^ x >>> 16) >>> 0;
}
const channel = (seed, salt) => mix(seed, salt) / 4294967296;
const bin = (x, n) => Math.min(n - 1, Math.floor(x * n));
const mean = (c, key) => (c.genome[key][0] + c.genome[key][1]) / 131070;
const round = x => Math.round(x * 100000) / 100000;

/** Existing role and workplace remain authoritative. This returns a display category only. */
export function visualRole(role = 'resident', workplace = '', years = 22) {
  finite(years, 0, 90, 'visual age');
  if (years < 14) return 'child';
  let value = Object.hasOwn(VISUAL_ROLES, role) ? role : 'resident';
  if (value === 'child' || value === 'elder') value = 'resident';
  if (value === 'resident' && Object.hasOwn(jobRoles, workplace)) value = jobRoles[workplace];
  return years >= 65 && value === 'resident' ? 'elder' : value;
}

/** Named independent channels keep identity stable when unrelated features are added.
 * Shape uses existing allele means, not clothing or role; grooming uses the persisted seed.
 * Explicit v1 part choices always win. The original v1 generator/catalog is unchanged.
 */
export function visualIdentityForCharacter(character, { role = 'resident', workplace = '', parts = null } = {}) {
  validateCharacter(character);
  const years = character.ageMs / YEAR_MS, seed = character.seed, occupation = visualRole(role, workplace, years);
  const height = mean(character, 'height'), build = mean(character, 'build'), eye = mean(character, 'eyes');
  const eyePair = character.genome.eyes, eyeAspect = (Math.min(...eyePair) + Math.max(...eyePair) * .4) / 91749;
  const child = Math.max(0, 1 - years / 18), elderly = Math.min(1, Math.max(0, (years - 55) / 35));
  const generated = {
    version: 1,
    face: ['round','classic','sharp','long'][bin((height + build) * .5, 4)],
    hair: ['bob','crop','tail'][mix(seed, 0x5821) % 3],
    body: height < .32 ? 'compact' : build > .64 ? 'sturdy' : build < .37 ? 'slender' : 'balanced',
    outfit: OUTFITS[occupation],
    accessory: occupation === 'child' ? 'none' : occupation === 'artisan' || occupation === 'smith' ? 'headband'
      : occupation === 'elder' || occupation === 'arcanist' ? 'glasses' : mix(seed, 0x7199) % 4 === 0 ? 'scarf' : 'none'
  };
  const profile = canonicalAppearanceParts(parts ?? generated);
  const face = {
    jaw: .84 + build * .30 + child * .05,
    cheek: .94 + (1 - height) * .12 + child * .025,
    nose: .92 + height * .16,
    eyeWidth: .86 + eye * .26,
    eyeHeight: .80 + eyeAspect * .34 + child * .045 - elderly * .07,
    eyeSpacing: .92 + eye * .16,
    browWeight: .74 + build * .52,
    browSlant: (eye - .5) * .20,
    chin: .96 + height * .09 - child * .04
  };
  const proportions = { shoulders: .93 + build * .14,
    arms: .96 + height * .08 - child * .025, legs: .96 + height * .08 - child * .04,
    head: 1 + child * .035 - elderly * .018 };
  const clothIndex = occupation === 'guard' || occupation === 'knight' ? 1 : occupation === 'hunter' ? 0
    : occupation === 'arcanist' ? 4 : occupation === 'smith' ? 2 : mix(seed, 0x7137) % CLOTH.length;
  const gear = years < 7 || profile.outfit === 'uniform' ? 'none' : GEAR[occupation];
  const result = {
    version: VISUAL_IDENTITY_VERSION, seed, role: occupation, ageBand: years < 14 ? 'child' : years >= 65 ? 'elder' : 'adult',
    parts: profile, front: HAIR_FRONTS[mix(seed, 0x9201) % HAIR_FRONTS.length], back: HAIR_BACKS[mix(seed, 0x1123) % HAIR_BACKS.length],
    face: Object.fromEntries(Object.entries(face).map(([k, v]) => [k, round(v)])),
    proportions: Object.fromEntries(Object.entries(proportions).map(([k, v]) => [k, round(v)])),
    gear, cloth: [...CLOTH[clothIndex]], trim: [...TRIM[mix(seed, 0x3981) % TRIM.length]],
    hairValue: round(.82 + channel(seed, 0x7803) * .30)
  };
  validateVisualIdentity(result); return deepFreeze(result);
}

export function validateVisualIdentity(value) {
  invariant(value && value.version === VISUAL_IDENTITY_VERSION, 'Unsupported visual identity');
  integer(value.seed, 0, 0xffffffff, 'visual seed');
  invariant(Object.hasOwn(VISUAL_ROLES, value.role), 'Invalid visual role');
  invariant(['child','adult','elder'].includes(value.ageBand), 'Invalid age band');
  canonicalAppearanceParts(value.parts);
  invariant(HAIR_FRONTS.includes(value.front) && HAIR_BACKS.includes(value.back), 'Invalid coiffure');
  invariant(['none', ...Object.values(GEAR)].includes(value.gear), 'Invalid role gear');
  for (const key of ['jaw','cheek','nose','eyeWidth','eyeHeight','eyeSpacing','browWeight','chin']) finite(value.face?.[key], .65, 1.35, `face ${key}`);
  finite(value.face?.browSlant, -.2, .2, 'brow slant');
  for (const key of ['shoulders','arms','legs','head']) finite(value.proportions?.[key], .88, 1.12, `proportion ${key}`);
  for (const key of ['cloth','trim']) { invariant(Array.isArray(value[key]) && value[key].length === 3, `Invalid ${key}`); value[key].forEach(x => finite(x, 0, 1, key)); }
  finite(value.hairValue, .8, 1.2, 'hair value'); return value;
}

/** Coarse, color-independent QC. Distinct signatures are NOT a visual approval. */
export function visualSilhouetteKey(identity) {
  validateVisualIdentity(identity);
  return [identity.ageBand, identity.parts.hair, identity.front, identity.back,
    identity.parts.body, identity.parts.outfit, identity.gear].join('/');
}
export function compareVisualIdentities(rows) {
  invariant(Array.isArray(rows) && rows.length <= 30, 'Inspect at most 30 characters');
  const groups = new Map(), heads = new Set(), faces = new Set(), roles = new Set();
  rows.forEach(({ id, identity }) => {
    const key = visualSilhouetteKey(identity);
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push(id);
    heads.add(`${identity.parts.hair}/${identity.front}/${identity.back}`);
    faces.add(`${identity.parts.face}/${Math.round(identity.face.jaw * 10)}/${Math.round(identity.face.eyeHeight * 10)}`);
    roles.add(identity.role);
  });
  return { count: rows.length, silhouettes: groups.size, hairstyles: heads.size, faceGroups: faces.size, roles: roles.size,
    similar: [...groups.values()].filter(ids => ids.length > 1), visualApproval: 'requires-rendered-review' };
}
