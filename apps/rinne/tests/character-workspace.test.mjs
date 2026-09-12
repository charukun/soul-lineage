import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_APPEARANCE_PARTS } from '@soul/characters';
import { createReviewCohort, reviewSettings, serializeReviewSession } from '../src/character-review-state.js';
import { serializeWorkspace, deserializeWorkspace, createEditHistory, MAX_WORKSPACE_BYTES, WORKSPACE_KEY } from '../src/character-workspace-state.js';
const settings = reviewSettings({ view: 'single', age:22, ages:'fixed' });
const session = () => ({settings,records:createReviewCohort(settings),note:'検査メモ'});
test('workspace round-trips all 30 records, edited parts and notes without performance authority', () => {
  const s=session(), profile={...BASE_APPEARANCE_PARTS,hair:'bob',outfit:'mantle'};
  const text=serializeWorkspace(s,[[s.records[0].id,profile]]), result=deserializeWorkspace(text);
  assert.deepEqual(result.parts,[[s.records[0].id,profile]]); assert.deepEqual(result.session.records,s.records);
  assert.equal(result.session.note,s.note); assert.equal(result.session.metrics,null);
  assert.ok(text.length<MAX_WORKSPACE_BYTES);
});
test('legacy review JSON remains importable without fabricated part edits', () => {
  const restored=deserializeWorkspace(serializeReviewSession(session()));
  assert.deepEqual(restored.parts,[]); assert.equal(restored.session.records.length,30);
});
test('invalid versions, unknown parts, duplicate IDs and excessive input reject before application', () => {
  const s=session(), id=s.records[0].id;
  assert.throws(()=>serializeWorkspace(s,[[id,{...BASE_APPEARANCE_PARTS,hair:'unknown'}]]));
  assert.throws(()=>serializeWorkspace(s,[['missing',BASE_APPEARANCE_PARTS]]));
  assert.throws(()=>serializeWorkspace(s,[[id,BASE_APPEARANCE_PARTS],[id,BASE_APPEARANCE_PARTS]]));
  const d=JSON.parse(serializeWorkspace(s));d.version=2;assert.throws(()=>deserializeWorkspace(JSON.stringify(d)));
  assert.throws(()=>deserializeWorkspace(' '.repeat(MAX_WORKSPACE_BYTES+1)));
  assert.throws(()=>deserializeWorkspace('{invalid'));
});
test('undo/redo retains edits across display changes; a new edit clears redo', () => {
  const h=createEditHistory(2); h.record('a','b');h.record('b','c');
  assert.equal(h.undo('c'),'b');assert.equal(h.redo('b'),'c');assert.equal(h.undo('c'),'b');
  h.record('b','d');assert.equal(h.canRedo,false);assert.equal(h.undo('d'),'b');assert.equal(h.undo('b'),'a');assert.equal(h.undo('a'),null);
});
test('history is bounded and editor storage has its own namespace', () => {
  const h=createEditHistory(2);h.record('a','b');h.record('b','c');h.record('c','d');
  assert.equal(h.undo('d'),'c');assert.equal(h.undo('c'),'b');assert.equal(h.undo('b'),null);
  assert.equal(WORKSPACE_KEY,'rinne.character-studio.workspace.v1');
});
