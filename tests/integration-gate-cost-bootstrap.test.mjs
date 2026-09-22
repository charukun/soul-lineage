import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gateCostPlan, runCheapPreflight } from '../scripts/integration-gate-cost.mjs';

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

test('cheap syntax preflight ignores deleted JS paths without weakening checks for existing JS', (t) => {
  const work = mkdtempSync(join(tmpdir(), 'gate-cost-'));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: work, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.email', 'gate@example.test');
  git('config', 'user.name', 'Gate Test');
  writeFileSync(join(work, 'removed.js'), 'const ok = true;\n');
  git('add', 'removed.js');
  git('commit', '-qm', 'base');
  const base = git('rev-parse', 'HEAD');
  unlinkSync(join(work, 'removed.js'));
  git('add', '-A');
  git('commit', '-qm', 'delete js');
  const head = git('rev-parse', 'HEAD');

  assert.deepEqual(runCheapPreflight(work, base, head, ['removed.js']), { diffCheck: true, syntaxChecked: 0 });

  writeFileSync(join(work, 'invalid.js'), 'const broken = ;\n');
  assert.throws(
    () => runCheapPreflight(work, base, head, ['invalid.js']),
    /CHEAP_SYNTAX_PREFLIGHT_FAILED/,
  );
});
