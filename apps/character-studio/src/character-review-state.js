import { createCharacter, characterData, validateCharacter, GENES, MAX_CHARACTERS, MASTER_ID, CHARACTER_CONTENT, YEAR_MS } from '@soul/characters';

export const REVIEW_SCHEMA = 1;
export const MAX_MODEL_BYTES = 128 * 1024 * 1024;
export const MAX_SESSION_BYTES = 64 * 1024;
export const DEFAULT_SETTINGS = Object.freeze({ seed: 1000, count: 6, age: 22, ages: 'mixed', outfit: 'mixed',
  ancestry: 'independent', selected: 0, view: 'crowd', motion: 'idle', expression: '', expressionMode: 'selected',
  expressionWeight: 1, blink: true, springs: 'auto', rotate: false, paused: false, background: 'slate' });
const check = (ok, message) => { if (!ok) throw new Error(message); };
const range = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const options = { ages: ['mixed', 'fixed'], outfit: ['mixed', 'original', 'moss', 'ember'], ancestry: ['independent', 'family'],
  view: ['crowd', 'single'], motion: ['rest', 'idle', 'walk'], expressionMode: ['selected', 'mixed', 'all'],
  springs: ['auto', 'all', 'off'], background: ['slate', 'white', 'black'] };

export function reviewSettings(input = {}) {
  check(input && typeof input === 'object' && !Array.isArray(input), 'Invalid simulator settings');
  const s = Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => [key, input[key] ?? fallback]));
  check(Number.isInteger(s.seed) && range(s.seed, 0, 0xffffffff), 'Seedは0〜4294967295の整数です');
  check(Number.isInteger(s.count) && range(s.count, 1, MAX_CHARACTERS), '表示数は1〜30体です');
  check(Number.isInteger(s.selected) && range(s.selected, 0, MAX_CHARACTERS - 1), 'Invalid selected character');
  check(range(s.age, 0, 90) && Number.isInteger(s.age * 10), '年齢は0〜90歳です');
  check(range(s.expressionWeight, 0, 1), 'Invalid expression weight');
  for (const [key, allowed] of Object.entries(options)) check(allowed.includes(s[key]), `Invalid ${key}`);
  for (const key of ['blink', 'rotate', 'paused']) check(typeof s[key] === 'boolean', `Invalid ${key}`);
  check(typeof s.expression === 'string' && s.expression.length <= 96, 'Invalid expression name');
  s.selected = Math.min(s.selected, s.count - 1);
  return s;
}

/** Review generation uses the exact portable production genetics contract. No save writes. */
export function createReviewCohort(input = {}) {
  const s = reviewSettings(input), result = [];
  for (let i = 0; i < MAX_CHARACTERS; i++) {
    const seed = (s.seed + i) >>> 0;
    const parents = s.ancestry === 'family' && i > 1 ? [result[0], result[1]] : [];
    const age = s.ages === 'fixed' ? s.age : s.ancestry === 'family' ? (i < 2 ? 35 : [0, 7, 18, 22][i % 4]) : [0, 7, 22, 55, 85][i % 5];
    const outfit = s.outfit === 'mixed' ? ['original', 'moss', 'ember'][i % 3] : s.outfit;
    result.push(createCharacter({ id: `review.${s.seed}.${i}`, seed, parents, ageMs: Math.round(age * YEAR_MS), outfitId: `shino.uniform.${outfit}.v1` }));
  }
  return result;
}

export function canonicalCohort(rows) {
  check(Array.isArray(rows) && rows.length >= 1 && rows.length <= MAX_CHARACTERS, '個体データは1〜30体が必要です');
  const result = rows.map(characterData);
  check(new Set(result.map(c => c.id)).size === result.length, '個体IDが重複しています');
  return result;
}

export function editReviewCharacter(record, changes) {
  const next = characterData(record);
  check(changes && typeof changes === 'object', 'Invalid review edit');
  if (changes.age !== undefined) {
    check(range(changes.age, 0, 90), 'Invalid review age'); next.ageMs = Math.round(changes.age * YEAR_MS);
    // A reversible inspection slider is not a live-world resurrection or clock update.
    next.lifeState = next.ageMs === 90 * YEAR_MS ? 'dead' : 'alive';
  }
  if (changes.outfit !== undefined) {
    check(['original', 'moss', 'ember'].includes(changes.outfit), 'Invalid outfit'); next.outfitId = `shino.uniform.${changes.outfit}.v1`;
  }
  for (const gene of GENES) if (changes[gene] !== undefined) {
    check(range(changes[gene], 0, 1), 'Invalid gene inspection value'); const allele = Math.round(changes[gene] * 65535);
    next.genome[gene] = [allele, allele];
  }
  next.revision++; validateCharacter(next); return next;
}

export function serializeReviewSession({ settings, records, note = '', metrics = null }) {
  const s = reviewSettings(settings), cohort = canonicalCohort(records);
  check(s.count <= cohort.length, '表示数が個体数を超えています');
  check(typeof note === 'string' && note.length <= 2000, 'メモは2000文字以内です');
  // Metrics are diagnostic output, never trusted when importing or treated as acceptance.
  const result = JSON.stringify({ schemaVersion: REVIEW_SCHEMA, masterId: MASTER_ID, contentVersion: CHARACTER_CONTENT,
    settings: s, records: cohort, note, metrics }, null, 2);
  check(new TextEncoder().encode(result).length <= MAX_SESSION_BYTES, '検査データが大きすぎます'); return result;
}

export function deserializeReviewSession(text) {
  check(typeof text === 'string' && text.length <= MAX_SESSION_BYTES && new TextEncoder().encode(text).length <= MAX_SESSION_BYTES, '検査データが大きすぎます');
  const data = JSON.parse(text);
  check(data?.schemaVersion === REVIEW_SCHEMA && data.masterId === MASTER_ID && data.contentVersion === CHARACTER_CONTENT, '検査データのバージョンが一致しません');
  const settings = reviewSettings(data.settings), records = canonicalCohort(data.records);
  check(settings.count <= records.length, '表示数が個体数を超えています');
  check(typeof data.note === 'string' && data.note.length <= 2000, 'Invalid review note');
  return { settings, records, note: data.note };
}

/** Validate the entire GLB container before handing it to the loader. */
export function reviewGlbDocument(bytes) {
  check(bytes instanceof ArrayBuffer && bytes.byteLength >= 28 && bytes.byteLength <= MAX_MODEL_BYTES, 'モデルサイズが不正です');
  const view = new DataView(bytes);
  check(view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2 && view.getUint32(8, true) === bytes.byteLength, 'GLBヘッダーが不正です');
  let offset = 12, document = null, binaryLength = null;
  while (offset < bytes.byteLength) {
    check(offset + 8 <= bytes.byteLength, 'GLBチャンクが途中で切れています');
    const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
    check(length % 4 === 0 && offset + 8 + length <= bytes.byteLength, 'GLBチャンク長が不正です');
    if (offset === 12) {
      check(type === 0x4e4f534a && length > 0, 'GLBの先頭にJSONが必要です');
      document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes, offset + 8, length)));
    } else if (type === 0x4e4f534a) throw new Error('GLBにJSONチャンクが重複しています');
    else if (type === 0x004e4942) { check(binaryLength === null, 'GLBにBINチャンクが重複しています'); binaryLength = length; }
    offset += 8 + length;
  }
  check(document && !Array.isArray(document) && typeof document === 'object' && document.asset?.version === '2.0', 'Invalid glTF document');
  check(!(document.buffers ?? []).some(b => b.uri) && !(document.images ?? []).some(i => i.uri), '外部リソース参照は許可されていません');
  if (document.buffers?.length) {
    check(document.buffers.length === 1 && Number.isInteger(document.buffers[0].byteLength) && document.buffers[0].byteLength >= 0 && binaryLength !== null &&
      binaryLength >= document.buffers[0].byteLength && binaryLength - document.buffers[0].byteLength <= 3, 'GLBのBINサイズが一致しません');
  }
  return document;
}
