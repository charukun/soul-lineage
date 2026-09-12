import { canonicalAppearanceParts } from '@soul/characters';
import { serializeReviewSession, deserializeReviewSession } from './character-review-state.js';
export const WORKSPACE_KEY = 'rinne.character-studio.workspace.v1';
export const MAX_WORKSPACE_BYTES = 128 * 1024;
const check = (ok, message) => { if (!ok) throw new Error(message); };
export function serializeWorkspace(session, profiles = []) {
  const canonical = deserializeReviewSession(typeof session === 'string' ? session : serializeReviewSession(session));
  const ids = new Set(canonical.records.map(record => record.id)), seen = new Set();
  check(Array.isArray(profiles) && profiles.length <= 30, '外見データは30体までです');
  const parts = profiles.map(row => {
    check(Array.isArray(row) && row.length === 2 && ids.has(row[0]) && !seen.has(row[0]), '外見データの個体IDが不正です');
    seen.add(row[0]); return [row[0], canonicalAppearanceParts(row[1])];
  });
  const text = JSON.stringify({ format: 'shino-character-workspace', version: 1, session: JSON.parse(serializeReviewSession(canonical)), parts });
  check(new TextEncoder().encode(text).length <= MAX_WORKSPACE_BYTES, '編集データが大きすぎます');
  return text;
}
export function deserializeWorkspace(text) {
  check(typeof text === 'string' && new TextEncoder().encode(text).length <= MAX_WORKSPACE_BYTES, '編集データが大きすぎます');
  const data = JSON.parse(text);
  // Old review JSON remains readable; it never contained modular parts.
  if (data?.format === undefined) return JSON.parse(serializeWorkspace(text));
  check(data.format === 'shino-character-workspace' && data.version === 1, '未対応の編集データです');
  return JSON.parse(serializeWorkspace(data.session, data.parts));
}
export function createEditHistory(limit = 40) {
  check(Number.isInteger(limit) && limit >= 1 && limit <= 100, 'Invalid history limit');
  const past = [], future = [];
  return {
    record(before, after) { if (before === after) return; past.push(before); if (past.length > limit) past.shift(); future.length = 0; },
    undo(current) { if (!past.length) return null; future.push(current); return past.pop(); },
    redo(current) { if (!future.length) return null; past.push(current); return future.pop(); },
    get canUndo() { return past.length > 0; }, get canRedo() { return future.length > 0; }
  };
}
