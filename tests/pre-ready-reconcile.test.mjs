import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = resolve(dirname(fileURLToPath(import.meta.url)), '../scripts/pre-ready-reconcile.mjs');

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function runScript(cwd, mode) {
  return spawnSync(process.execPath, [script, mode], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, PRE_READY_REMOTE: 'origin', PRE_READY_BASE: 'develop' },
  });
}

function commitFile(cwd, name, content, message) {
  const path = join(cwd, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  git(cwd, ['add', name]);
  git(cwd, ['commit', '-m', message]);
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'pre-ready-reconcile-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const remote = join(root, 'remote.git');
  const seed = join(root, 'seed');
  const work = join(root, 'work');
  const upstream = join(root, 'upstream');

  mkdirSync(seed);
  git(seed, ['init', '-b', 'develop']);
  git(seed, ['config', 'user.name', 'Fixture']);
  git(seed, ['config', 'user.email', 'fixture@example.test']);
  commitFile(seed, 'base.txt', 'base\n', 'base');
  git(root, ['init', '--bare', remote]);
  git(seed, ['remote', 'add', 'origin', remote]);
  git(seed, ['push', '-u', 'origin', 'develop']);

  git(root, ['clone', '--branch', 'develop', remote, work]);
  git(root, ['clone', '--branch', 'develop', remote, upstream]);
  for (const repo of [work, upstream]) {
    git(repo, ['config', 'user.name', 'Fixture']);
    git(repo, ['config', 'user.email', 'fixture@example.test']);
  }

  git(work, ['switch', '-c', 'work/task']);
  return { remote, root, upstream, work };
}

test('sync merge-forwards current develop and verify accepts the reconciled head', (t) => {
  const { upstream, work } = fixture(t);
  commitFile(work, 'feature.txt', 'feature\n', 'feature');
  commitFile(upstream, 'develop-only.txt', 'develop\n', 'advance develop');
  git(upstream, ['push', 'origin', 'develop']);

  const synced = runScript(work, 'sync');
  assert.equal(synced.status, 0, synced.stderr);
  assert.match(synced.stdout, /PRE_READY_SYNCED/);
  assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', 'origin/develop', 'HEAD'], { cwd: work }).status, 0);
  assert.equal(git(work, ['rev-list', '--parents', '-n', '1', 'HEAD']).split(/\s+/).length, 3);

  const verified = runScript(work, 'verify');
  assert.equal(verified.status, 0, verified.stderr);
  assert.match(verified.stdout, /PRE_READY_FRESH/);
});

test('verify rejects a head when develop advanced after the previous reconciliation', (t) => {
  const { upstream, work } = fixture(t);
  commitFile(work, 'feature.txt', 'feature\n', 'feature');

  const first = runScript(work, 'verify');
  assert.equal(first.status, 0, first.stderr);

  commitFile(upstream, 'later.txt', 'later\n', 'advance later');
  git(upstream, ['push', 'origin', 'develop']);

  const stale = runScript(work, 'verify');
  assert.equal(stale.status, 2);
  assert.match(stale.stderr, /PRE_READY_STALE/);
});

test('sync leaves a true merge conflict unresolved instead of choosing a side', (t) => {
  const { upstream, work } = fixture(t);
  commitFile(work, 'shared.txt', 'work\n', 'work version');
  commitFile(upstream, 'shared.txt', 'develop\n', 'develop version');
  git(upstream, ['push', 'origin', 'develop']);

  const conflicted = runScript(work, 'sync');
  assert.equal(conflicted.status, 3);
  assert.match(conflicted.stderr, /PRE_READY_CONFLICT/);
  assert.match(git(work, ['status', '--porcelain']), /^AA shared\.txt$/m);
});

test('sync refuses a dirty worktree', (t) => {
  const { work } = fixture(t);
  writeFileSync(join(work, 'uncommitted.txt'), 'dirty\n');

  const dirty = runScript(work, 'sync');
  assert.equal(dirty.status, 1);
  assert.match(dirty.stderr, /PRE_READY_CLEAN_WORKTREE_REQUIRED/);
});
