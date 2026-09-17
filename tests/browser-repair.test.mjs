import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { currentPrRepair, linkedIssueNumber, parseRepairState, replaceRepairState } from '../scripts/browser-repair-state.mjs';

test('historical browser-repair marker remains readable without an active recorder', () => {
  const state = { schema: 1, scope: 'pr', sourceKey: 'pr:7', state: 'pending', attempt: 0, maxAttempts: 3 };
  const once = replaceRepairState('hello', state);
  const twice = replaceRepairState(once, { ...state, state: 'working' });
  assert.equal((twice.match(/browser-repair:v1/g) || []).length, 1);
  assert.equal(parseRepairState(twice).state, 'working');
  assert.equal(parseRepairState('ordinary issue body'), null);
});

test('historical browser repair links and exact-head matching remain parseable', () => {
  assert.equal(linkedIssueNumber('Browser-Repair-Issue: #42'), 42);
  const pr={state:'open',base:{ref:'develop'},head:{sha:'current'}};
  assert.equal(currentPrRepair(pr,'current'),true);
  assert.equal(currentPrRepair({...pr,head:{sha:'new'}},'current'),false);
});

test('retired browser repair recorder has no executable workflow or script', () => {
  assert.equal(existsSync('.github/workflows/browser-repair.yml'), false);
  assert.equal(existsSync('scripts/browser-repair-ticket.mjs'), false);
});
