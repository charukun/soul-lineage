import test from 'node:test';
import assert from 'node:assert/strict';
import { firstTwoBodyLines, githubState, isVisualReview, isStaleDraft } from '../public/pr-list.js';

test('uses first two non-empty PR body lines', () => {
  assert.deepEqual(firstTwoBodyLines('\nTitle\nDetail\nMore'), { title: 'Title', detail: 'Detail' });
});

test('maps GitHub states without custom workflow states', () => {
  assert.equal(githubState({ merged_at: 'x', state: 'closed', draft: false }), 'Merged');
  assert.equal(githubState({ merged_at: null, state: 'closed', draft: false }), 'Closed');
  assert.equal(githubState({ merged_at: null, state: 'open', draft: true }), 'Draft');
  assert.equal(githubState({ merged_at: null, state: 'open', draft: false }), 'Ready');
});

test('detects Visual Review Lab separately', () => {
  assert.equal(isVisualReview({ title: 'Visual Review Lab', body: '', head: { ref: 'work/visual-review-lab-v2' } }), true);
});

test('stale draft threshold is 12 hours', () => {
  const now = Date.parse('2026-09-12T12:00:00Z');
  assert.equal(isStaleDraft({ draft: true, updated_at: '2026-09-11T23:59:59Z' }, now), true);
  assert.equal(isStaleDraft({ draft: true, updated_at: '2026-09-12T00:30:00Z' }, now), false);
});
