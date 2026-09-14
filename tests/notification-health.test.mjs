import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationStatus } from '../scripts/notify-delivery.mjs';

test('notification health distinguishes confirmed, missing and failed smartphone delivery', () => {
  assert.equal(notificationStatus('ntfy').state, 'success');
  assert.equal(notificationStatus('not-configured').state, 'error');
  assert.equal(notificationStatus('failed').state, 'failure');
  assert.equal(notificationStatus('skipped').state, 'success');
});
