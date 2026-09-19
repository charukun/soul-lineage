import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileRetryAlarm, retryAlarmAt } from '../ops-board/retry-alarm.mjs';

const now = Date.parse('2026-09-16T00:00:00Z');

test('retry alarm only accepts a future retry timestamp', () => {
  assert.equal(retryAlarmAt({ nextRetryAt: '2026-09-16T00:01:00Z' }, now), now + 60_000);
  assert.equal(retryAlarmAt({ nextRetryAt: '2026-09-15T23:59:00Z' }, now), null);
  assert.equal(retryAlarmAt({ nextRetryAt: 'invalid' }, now), null);
});

test('rate-limit state schedules the exact reset and healthy state clears it', async () => {
  let alarm = null;
  const storage = {
    async getAlarm() { return alarm; },
    async setAlarm(value) { alarm = value; },
    async deleteAlarm() { alarm = null; },
  };
  const retryAt = now + 90_000;
  assert.equal(await reconcileRetryAlarm(storage, { nextRetryAt: new Date(retryAt).toISOString() }, now), retryAt);
  assert.equal(alarm, retryAt);
  assert.equal(await reconcileRetryAlarm(storage, { nextRetryAt: null }, now), null);
  assert.equal(alarm, null);
});
