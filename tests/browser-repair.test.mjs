import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimForWork,
  onBrowserFailure,
  onDevelopBrowserSuccess,
  onPrBrowserSuccess,
  parseRepairState,
  replaceRepairState,
  workShouldStart,
} from '../scripts/browser-repair-state.mjs';

test('browser repair ticket prevents duplicate Work triggers while claimed', () => {
  const initial = { schema: 1, scope: 'pr', sourceKey: 'pr:42', state: 'pending', attempt: 0, maxAttempts: 3 };
  assert.equal(workShouldStart(initial), true);
  const claimed = claimForWork(initial, 'test-work');
  assert.equal(claimed.state, 'working');
  assert.equal(claimed.attempt, 1);
  assert.equal(workShouldStart(claimed), false);
  const failedAgain = onBrowserFailure(claimed, { headSha: 'abc' });
  assert.equal(failedAgain.state, 'pending');
  assert.equal(workShouldStart(failedAgain), true);
});

test('automatic repair stops after bounded attempts', () => {
  let state = { schema: 1, scope: 'pr', sourceKey: 'pr:42', state: 'pending', attempt: 2, maxAttempts: 3 };
  state = claimForWork(state, 'test-work');
  assert.equal(state.attempt, 3);
  state = onBrowserFailure(state, { headSha: 'def' });
  assert.equal(state.state, 'human-required');
  assert.equal(workShouldStart(state), false);
});

test('develop repair returns through Integration before final verification', () => {
  let state = { schema: 1, scope: 'develop', sourceKey: 'develop:deadbeef', state: 'pending', attempt: 0, maxAttempts: 3 };
  state = claimForWork(state, 'test-work');
  state = onPrBrowserSuccess(state, { headSha: 'repair-head' });
  assert.equal(state.state, 'ready-for-integration');
  state = onDevelopBrowserSuccess(state, { headSha: 'develop-head' });
  assert.equal(state.state, 'verified');
});

test('machine marker round-trips without duplicating blocks', () => {
  const state = { schema: 1, scope: 'pr', sourceKey: 'pr:7', state: 'pending', attempt: 0, maxAttempts: 3 };
  const once = replaceRepairState('hello', state);
  const twice = replaceRepairState(once, { ...state, state: 'working' });
  assert.equal((twice.match(/browser-repair:v1/g) || []).length, 1);
  assert.equal(parseRepairState(twice).state, 'working');
});
