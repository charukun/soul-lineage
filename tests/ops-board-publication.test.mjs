import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForExpectedWorkerRevision } from '../ops-board/publication-check.mjs';

const expected = '1111111111111111111111111111111111111111';
const previous = '2222222222222222222222222222222222222222';

test('PULSE publication revision retry waits for the exact new Worker revision', async () => {
  let calls = 0;
  const state = await waitForExpectedWorkerRevision(async () => {
    calls += 1;
    return { buildCommit: calls < 3 ? previous : expected };
  }, expected, { attempts: 3, delayMs: 0 });
  assert.equal(calls, 3);
  assert.equal(state.buildCommit, expected);
});

test('PULSE publication revision retry never accepts an old revision after the bound', async () => {
  await assert.rejects(
    waitForExpectedWorkerRevision(async () => ({ buildCommit: previous }), expected, { attempts: 2, delayMs: 0 }),
    /Worker revision changed after publication/,
  );
});

test('PULSE publication revision retry fails immediately when revision evidence is malformed', async () => {
  let calls = 0;
  await assert.rejects(
    waitForExpectedWorkerRevision(async () => {
      calls += 1;
      return { buildCommit: 'unknown' };
    }, expected, { attempts: 5, delayMs: 0 }),
    /missing an exact build revision/,
  );
  assert.equal(calls, 1);
});
