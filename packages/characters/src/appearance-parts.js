import { integer, invariant, validateCharacter } from './master-character.js';

export const APPEARANCE_PARTS_VERSION = 1;

const freezeCatalog = rows => Object.freeze(rows.map(row => Object.freeze({ ...row })));
export const APPEARANCE_PARTS = Object.freeze({
  face: freezeCatalog([
    { id: 'classic', label: '標準' },
    { id: 'round', label: '丸顔' },
    { id: 'sharp', label: 'シャープ' },
    { id: 'long', label: '面長' }
  ]),
  hair: freezeCatalog([
    { id: 'original', label: 'Shino' },
    { id: 'bob', label: 'ボブ' },
    { id: 'crop', label: 'ショート' },
    { id: 'tail', label: 'テール' }
  ]),
  body: freezeCatalog([
    { id: 'balanced', label: '標準' },
    { id: 'slender', label: '細身' },
    { id: 'sturdy', label: 'がっしり' },
    { id: 'compact', label: '小柄' }
  ]),
  outfit: freezeCatalog([
    { id: 'uniform', label: '制服' },
    { id: 'tunic', label: 'チュニック' },
    { id: 'mantle', label: 'マント' },
    { id: 'apron', label: 'エプロン' }
  ]),
  accessory: freezeCatalog([
    { id: 'none', label: 'なし' },
    { id: 'glasses', label: '眼鏡' },
    { id: 'headband', label: 'ヘッドバンド' },
    { id: 'scarf', label: 'スカーフ' }
  ])
});

export const BASE_APPEARANCE_PARTS = Object.freeze({
  version: APPEARANCE_PARTS_VERSION,
  face: 'classic', hair: 'original', body: 'balanced', outfit: 'uniform', accessory: 'none'
});

const SLOT_NAMES = Object.freeze(Object.keys(APPEARANCE_PARTS));
const allowed = Object.freeze(Object.fromEntries(SLOT_NAMES.map(slot => [slot, new Set(APPEARANCE_PARTS[slot].map(row => row.id))])));

function mix(seed, salt) {
  let x = (seed ^ salt) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

export function validateAppearanceParts(input) {
  invariant(input && typeof input === 'object' && !Array.isArray(input), 'Invalid appearance parts');
  invariant((input.version ?? APPEARANCE_PARTS_VERSION) === APPEARANCE_PARTS_VERSION, 'Unsupported appearance parts version');
  for (const slot of SLOT_NAMES) invariant(typeof input[slot] === 'string' && allowed[slot].has(input[slot]), `Invalid appearance part ${slot}`);
  return input;
}

export function canonicalAppearanceParts(input = BASE_APPEARANCE_PARTS) {
  validateAppearanceParts(input);
  return { version: APPEARANCE_PARTS_VERSION, ...Object.fromEntries(SLOT_NAMES.map(slot => [slot, input[slot]])) };
}

export function mergeAppearanceParts(base, patch = {}) {
  const source = canonicalAppearanceParts(base);
  invariant(patch && typeof patch === 'object' && !Array.isArray(patch), 'Invalid appearance parts patch');
  for (const key of Object.keys(patch)) invariant(key === 'version' || SLOT_NAMES.includes(key), `Unknown appearance slot ${key}`);
  return canonicalAppearanceParts({ ...source, ...patch, version: APPEARANCE_PARTS_VERSION });
}

export function appearancePartsForSeed(seed) {
  integer(seed, 0, 0xffffffff, 'appearance seed');
  const result = { version: APPEARANCE_PARTS_VERSION };
  SLOT_NAMES.forEach((slot, index) => {
    const rows = APPEARANCE_PARTS[slot];
    result[slot] = rows[mix(seed, 0x9e3779b9 + index * 0x45d9f3b) % rows.length].id;
  });
  return canonicalAppearanceParts(result);
}

export function appearancePartsForCharacter(character, overrides = null) {
  validateCharacter(character);
  const generated = appearancePartsForSeed((character.seed ^ 0xa511e9b3) >>> 0);
  return overrides ? mergeAppearanceParts(generated, overrides) : generated;
}

export function nextAppearanceParts(character, generation = 1) {
  validateCharacter(character); integer(generation, 0, 0xffff, 'appearance generation');
  return appearancePartsForSeed((character.seed + Math.imul(generation, 0x9e3779b1)) >>> 0);
}
