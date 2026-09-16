import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gateCostPlan, syntaxPreflightPaths } from '../scripts/integration-gate-cost.mjs';

test('gate cost optimizer preserves full fast/browser contract while ordering cheap checks first', () => {
  const control = gateCostPlan(['scripts/integration.mjs', '.github/workflows/deploy.yml']);
  assert.equal(control.profile, 'control');
  assert.equal(control.order[0], 'diff-check');
  assert.equal(control.order[1], 'syntax');
  assert.ok(control.order.includes('fast'));
  assert.ok(control.order.includes('browser'));
});

test('historical browser failures keep browser in the plan', () => {
  const plan = gateCostPlan(['scripts/foo.mjs'], { fingerprints: { a: { kind: 'browser-gate', count: 3 } } });
  assert.ok(plan.order.includes('browser'));
});

test('syntax preflight checks present JavaScript files and ignores deleted paths', async t => {
  const work = await mkdtemp(join(tmpdir(), 'integration-gate-cost-'));
  t.after(() => rm(work, { recursive: true, force: true }));
  await writeFile(join(work, 'present.mjs'), 'export const ready = true;\n');

  assert.deepEqual(
    syntaxPreflightPaths(work, ['present.mjs', 'deleted.mjs', 'bundle.min.js', 'notes.md']),
    ['present.mjs'],
  );
});
