/** Portable, versioned character data. No renderer, wall clock or platform globals. */
export const CHARACTER_SCHEMA = 1;
export const MASTER_ID = 'character.sendagaya-shino.v1';
export const CHARACTER_CONTENT = 'shino-production-contract.1';
export const MAX_CHARACTERS = 30;
export const YEAR_MS = 60_000;
export const LIFESPAN_MS = 90 * YEAR_MS;
export const GENES = Object.freeze(['height', 'build', 'hair', 'eyes', 'skin']);
export const REQUIRED_BONES = Object.freeze(['hips', 'spine', 'head',
  ...['left', 'right'].flatMap(side => ['UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg', 'Foot'].map(part => side + part))]);
export function invariant(condition, message) { if (!condition) throw new Error(message); }
export function integer(n, min, max, name) {
  invariant(Number.isSafeInteger(n) && n >= min && n <= max, `Invalid ${name}`); return n;
}
export function finite(n, min, max, name) {
  invariant(typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max, `Invalid ${name}`); return n;
}
export function identifier(s, name = 'identifier') {
  invariant(typeof s === 'string' && /^[a-zA-Z0-9._:-]{1,96}$/.test(s), `Invalid ${name}`); return s;
}
export function deepFreeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}
export const SHINO_MASTER = deepFreeze({
  id: MASTER_ID, schemaVersion: CHARACTER_SCHEMA, contentVersion: CHARACTER_CONTENT,
  rigId: 'humanoid.shino-vrm1.v2', adultHeightMetres: 2.02,
  supportedBody: { height: [.9, 1.1], width: [.88, 1.12] },
  wardrobeMode: 'complete-outfit',
  source: {
    repository: 'yw0nam/YUI', commit: '9bce6c36d28f58693db3ce6f4203871ab1c11b76',
    path: 'resources/vrms/Sendagaya_Shino.vrm',
    url: 'https://raw.githubusercontent.com/yw0nam/YUI/9bce6c36d28f58693db3ce6f4203871ab1c11b76/resources/vrms/Sendagaya_Shino.vrm',
    sha256: 'fab70124f0025e444a6eef84d6ab3a04e78c0adb626099e54b55287d0f083a47',
    reviewSha256: '83843ade7dbdfaacc9d601bda099fcb5757527e339b9c5deb223a2c2f5eb28ca'
  },
  license: {
    original: 'CC0-1.0', conversion: 'VRM-Public-License-1.0', reviewedOn: '2026-09-11',
    authors: ['VRoid Project / pixiv Inc.', 'Coatie (coati), VRM 1.0 conversion'],
    originalTerms: 'https://vroid.pixiv.help/hc/en-us/articles/360013482714-Sendagaya-Shino',
    conversionTerms: 'https://hub.vroid.com/en/characters/4593660874193246717/models/7956589129305596116',
    licenseUrl: 'https://vrm.dev/licenses/1.0/',
    redistribution: true, modification: true, commercial: 'corporation', creditRequired: false
  },
  // The source has a clothed body, NOT a complete nude body underneath its clothes.
  // More shapes must be authored as validated complete outfits, not hidden material hacks.
  outfits: {
    'shino.uniform.original.v1': { assetId: MASTER_ID, rigId: 'humanoid.shino-vrm1.v2', coverage: 'complete', dye: [1, 1, 1] },
    'shino.uniform.moss.v1': { assetId: MASTER_ID, rigId: 'humanoid.shino-vrm1.v2', coverage: 'complete', dye: [.56, .77, .62] },
    'shino.uniform.ember.v1': { assetId: MASTER_ID, rigId: 'humanoid.shino-vrm1.v2', coverage: 'complete', dye: [.9, .55, .44] }
  }
});
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const smooth = (lo, hi, x) => { const t = clamp((x - lo) / (hi - lo), 0, 1); return t * t * (3 - 2 * t); };
const sizeKeys = [[0, .4], [3, .49], [7, .64], [12, .8], [18, .98], [22, 1], [50, 1], [65, .985], [80, .955], [90, .935]];
/** Matches the existing Lifecycle handoff curve. Appearance never advances world time. */
export function ageAppearance(years) {
  finite(years, 0, 90, 'age');
  let scale = sizeKeys.at(-1)[1];
  for (let i = 1; i < sizeKeys.length; i++) if (years <= sizeKeys[i][0]) {
    const [a, x] = sizeKeys[i - 1], [b, y] = sizeKeys[i]; scale = x + (y - x) * smooth(a, b, years); break;
  }
  return { scale, headScale: 1 + .22 * (1 - smooth(0, 18, years)),
    gray: smooth(42, 82, years), stoop: .25 * smooth(55, 90, years),
    skinAge: smooth(50, 90, years), canEquipWeapon: years >= 7 };
}
/** Defined integer PRNG. Serialized alleles, not PRNG execution on peers, are authoritative. */
function rng(seed) {
  let state = integer(seed, 0, 0xffffffff, 'seed') >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function validateGenome(genome) {
  invariant(genome && typeof genome === 'object' && Object.keys(genome).length === GENES.length, 'Invalid genome');
  for (const gene of GENES) {
    invariant(Array.isArray(genome[gene]) && genome[gene].length === 2, `Invalid allele pair ${gene}`);
    genome[gene].forEach(a => integer(a, 0, 65535, `allele ${gene}`));
  }
}
export function createCharacter({ id, seed, parents = [], ageMs = 0, outfitId = 'shino.uniform.original.v1' }) {
  identifier(id); integer(seed, 0, 0xffffffff, 'seed'); integer(ageMs, 0, LIFESPAN_MS, 'ageMs');
  invariant(Array.isArray(parents) && (parents.length === 0 || parents.length === 2), 'Supply zero or two parents');
  parents.forEach(validateCharacter);
  invariant(parents.every(p => p.id !== id) && new Set(parents.map(p => p.id)).size === parents.length, 'Invalid parents');
  const random = rng(seed), genome = {};
  for (const gene of GENES) genome[gene] = [0, 1].map(i => {
    if (!parents.length) return Math.floor(random() * 65536);
    const inherited = parents[i].genome[gene][random() < .5 ? 0 : 1];
    // 1% bounded variation, deterministic and separate from gameplay stats.
    return random() < .01 ? clamp(inherited + Math.floor(random() * 513) - 256, 0, 65535) : inherited;
  });
  const record = { schemaVersion: CHARACTER_SCHEMA, contentVersion: CHARACTER_CONTENT, masterId: MASTER_ID,
    id, seed, revision: 0, parents: parents.map(p => p.id), genome, ageMs,
    lifeState: ageMs === LIFESPAN_MS ? 'dead' : 'alive', outfitId };
  validateCharacter(record); return record;
}
export function validateCharacter(c) {
  invariant(c && typeof c === 'object', 'Missing character');
  invariant(c.schemaVersion === CHARACTER_SCHEMA && c.contentVersion === CHARACTER_CONTENT && c.masterId === MASTER_ID, 'Incompatible character version');
  identifier(c.id); integer(c.seed, 0, 0xffffffff, 'seed'); integer(c.revision, 0, Number.MAX_SAFE_INTEGER, 'revision');
  integer(c.ageMs, 0, LIFESPAN_MS, 'ageMs');
  invariant(['alive', 'dead'].includes(c.lifeState) && (c.ageMs < LIFESPAN_MS || c.lifeState === 'dead'), 'Invalid life state');
  invariant(Array.isArray(c.parents) && (c.parents.length === 0 || c.parents.length === 2), 'Invalid parents');
  c.parents.forEach(p => { identifier(p); invariant(p !== c.id, 'Self ancestry'); });
  invariant(new Set(c.parents).size === c.parents.length, 'Duplicate parents');
  validateGenome(c.genome);
  invariant(typeof c.outfitId === 'string' && Object.hasOwn(SHINO_MASTER.outfits, c.outfitId), 'Unknown outfit');
  return c;
}
/** Canonical serialization strips unknown/private fields, without changing known state. */
export function characterData(c) {
  validateCharacter(c);
  return { schemaVersion: c.schemaVersion, contentVersion: c.contentVersion, masterId: c.masterId,
    id: c.id, seed: c.seed, revision: c.revision, parents: [...c.parents],
    genome: Object.fromEntries(GENES.map(g => [g, [...c.genome[g]]])), ageMs: c.ageMs,
    lifeState: c.lifeState, outfitId: c.outfitId };
}
export function serializeCharacter(c) { return JSON.stringify(characterData(c)); }
export function deserializeCharacter(json) {
  invariant(typeof json === 'string' && json.length <= 4096, 'Character payload too large');
  return characterData(JSON.parse(json));
}
/** Input is already-scaled authoritative simulation milliseconds. Never multiply it twice. */
export function advanceCharacter(c, worldDeltaMs, running = true) {
  validateCharacter(c); integer(worldDeltaMs, 0, LIFESPAN_MS, 'worldDeltaMs');
  invariant(typeof running === 'boolean', 'Invalid running flag');
  const next = characterData(c);
  if (!running || c.lifeState === 'dead' || worldDeltaMs === 0) return { character: next, died: false, birthdays: 0 };
  integer(c.revision + 1, 0, Number.MAX_SAFE_INTEGER, 'next revision');
  next.ageMs = Math.min(LIFESPAN_MS, c.ageMs + worldDeltaMs); next.revision++;
  const died = next.ageMs === LIFESPAN_MS; if (died) next.lifeState = 'dead';
  return { character: next, died, birthdays: Math.floor(next.ageMs / YEAR_MS) - Math.floor(c.ageMs / YEAR_MS) };
}
export function setOutfit(c, outfitId) {
  const next = characterData(c); next.outfitId = outfitId; next.revision++; validateCharacter(next); return next;
}
export function appearanceForCharacter(c) {
  validateCharacter(c); const age = ageAppearance(c.ageMs / YEAR_MS);
  const gene = name => (c.genome[name][0] + c.genome[name][1]) / 131070;
  const height = .9 + .2 * gene('height'), width = .88 + .24 * gene('build');
  const pick = (name, palette) => [...palette[Math.min(palette.length - 1, Math.floor(gene(name) * palette.length))]];
  return { ...age, height, width, adultHeightMetres: SHINO_MASTER.adultHeightMetres,
    hair: pick('hair', [[.14, .1, .08], [.29, .15, .08], [.62, .47, .25], [.18, .17, .25]]),
    eyes: pick('eyes', [[.35, .2, .1], [.18, .3, .42], [.22, .36, .22], [.4, .24, .36]]),
    skin: pick('skin', [[1, 1, 1], [.94, .89, .82], [.84, .73, .64], [.7, .57, .47]]),
    dye: [...SHINO_MASTER.outfits[c.outfitId].dye], dead: c.lifeState === 'dead' };
}
/** Handoff save importer; it does not replace or write the original game save. */
export function importLifecycleCharacter(saved, identity) {
  invariant(saved?.version === 1, 'Unsupported lifecycle save');
  finite(saved.ageSeconds, 0, 5400, 'ageSeconds');
  return createCharacter({ ...identity, ageMs: Math.round(saved.ageSeconds * 1000) });
}
/** Unknown bytes are NEVER authorized just because their embedded metadata claims permission. */
export function auditShinoDocument(document, sha256) {
  const errors = [], meta = document?.extensions?.VRMC_vrm?.meta;
  if (![SHINO_MASTER.source.sha256, SHINO_MASTER.source.reviewSha256].includes(sha256)) errors.push('unapproved-content-hash');
  if (document?.asset?.version !== '2.0' || document?.extensions?.VRMC_vrm?.specVersion !== '1.0') errors.push('unsupported-format');
  if (meta?.name !== 'Sendagaya_Shino' || meta?.version !== 'v2.0' || !meta?.authors?.includes('coati')) errors.push('source-identity-mismatch');
  if (meta?.commercialUsage !== 'corporation' || meta?.allowRedistribution !== true ||
      meta?.modification !== 'allowModificationRedistribution' || meta?.avatarPermission !== 'everyone' ||
      meta?.allowExcessivelyViolentUsage !== true || meta?.licenseUrl !== SHINO_MASTER.license.licenseUrl) errors.push('incompatible-license');
  if ((document?.buffers || []).some(b => b.uri) || (document?.images || []).some(i => i.uri)) errors.push('external-resource');
  const bones = document?.extensions?.VRMC_vrm?.humanoid?.humanBones || {};
  if (REQUIRED_BONES.some(name => !Number.isInteger(bones[name]?.node) || !document?.nodes?.[bones[name].node])) errors.push('incomplete-humanoid');
  return { approved: errors.length === 0, errors, sha256, license: SHINO_MASTER.license };
}
