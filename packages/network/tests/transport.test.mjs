import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/index.js';
test('transport uses injected platform and cannot escape configured service', async () => {
  let received;
  const client = createApiClient({ contractVersion: 1, network: { request: async req => { received = req; return { status: 200, body: '{}' }; } } }, 'https://example.com/api/');
  assert.equal((await client.request('worlds')).status, 200); assert.equal(received.url, 'https://example.com/api/worlds');
  await assert.rejects(client.request('https://attacker.invalid/')); await assert.rejects(client.request('../escape'));
});
