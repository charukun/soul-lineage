import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCanary } from '../scripts/integration-control-canary.mjs';

const sha = 'a'.repeat(40);
const okStatuses = [
  { context: 'integration/develop', state: 'success' },
  { context: 'ops-board/public', state: 'success' },
  { context: 'notification/ntfy', state: 'success' },
];

test('control canary requires coherent DEV, PULSE and notification evidence', () => {
  const result = evaluateCanary({ sha, manifest: { validatedDevelop: sha }, pulse: { repository: 'charukun/soul-lineage', generatedAt: new Date().toISOString() }, statuses: okStatuses });
  assert.equal(result.ok, true);
});

test('notification or source drift fails the canary without rewriting delivery truth', () => {
  const result = evaluateCanary({ sha, manifest: { validatedDevelop: 'b'.repeat(40) }, pulse: { repository: 'charukun/soul-lineage', generatedAt: new Date().toISOString() }, statuses: okStatuses.filter(s => s.context !== 'notification/ntfy') });
  assert.equal(result.ok, false);
  assert.equal(result.checks.manifest, false);
  assert.equal(result.checks.notification, false);
});
