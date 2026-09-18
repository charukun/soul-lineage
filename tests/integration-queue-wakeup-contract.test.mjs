import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exactDevelopAncestor, rescueRuntimeAudit, RESCUE_RUNTIME_TARGET } from '../scripts/integration-queue-recovery.mjs';

const recovery = readFileSync(new URL('../scripts/integration-queue-recovery.mjs', import.meta.url), 'utf8');
const deploy = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
const sha = c => c.repeat(40);

test('queue recovery scans the current Ready backlog in one bounded window', () => {
  assert.match(recovery, /limit = 24/);
  assert.match(recovery, /develop verification is running/);
  assert.match(recovery, /actions\/workflows\/deploy\.yml\/dispatches`, \{ ref: 'develop' \}/);
  assert.doesNotMatch(recovery, /rescue_mode:\s*'scan'/,
    'queue recovery must wake normal Integration, not recursively dispatch another recovery-only scan');
});

test('verified develop immediately requests one rescue scan when no bounded continuation is already queued', () => {
  assert.match(deploy, /else if \(process\.env\.RESULT === 'success'\)/);
  assert.match(deploy, /inputs: \{ rescue_mode: 'scan' \}/);
  assert.match(deploy, /process\.env\.RESULT === 'success' && process\.env\.RETRY === 'true'/);
});

test('only exact PR heads already contained in the same develop snapshot are superseded', () => {
  const head = sha('a'), develop = sha('b');
  const exact = { base_commit: { sha: head }, merge_base_commit: { sha: head }, head_commit: { sha: develop }, status: 'ahead', ahead_by: 5 };
  assert.equal(exactDevelopAncestor(exact, head, develop), true);
  assert.equal(exactDevelopAncestor({ base_commit: { sha: head }, merge_base_commit: { sha: head }, head_commit: { sha: head }, status: 'identical', ahead_by: 0 }, head, head), true);
  assert.equal(exactDevelopAncestor({ ...exact, merge_base_commit: { sha: sha('c') } }, head, develop), false);
  assert.equal(exactDevelopAncestor({ ...exact, head_commit: { sha: sha('d') } }, head, develop), false);
  assert.equal(exactDevelopAncestor({ ...exact, status: 'diverged' }, head, develop), false);
});

test('Rescue runtime audit distinguishes propagation from real configuration drift', () => {
  const develop = sha('d');
  const state = { schema: 1, repository: 'charukun/soul-lineage', config: { ...RESCUE_RUNTIME_TARGET }, coordinator: { develop } };
  assert.equal(rescueRuntimeAudit(state, develop).ok, true);
  const waiting = rescueRuntimeAudit({ ...state, coordinator: { develop: sha('e') }, config: { ...state.config, maxConcurrency: 4 } }, develop);
  assert.equal(waiting.pending, true, 'old coordinator snapshots are propagation, not configuration failure');
  const drift = rescueRuntimeAudit({ ...state, config: { ...state.config, maxConcurrency: 4 } }, develop);
  assert.equal(drift.pending, false);
  assert.equal(drift.ok, false);
  assert.deepEqual(drift.mismatches.map(item => item.key), ['maxConcurrency']);
});

test('queue recovery owns only bounded safe cleanup permissions', () => {
  assert.match(deploy, /queue-recovery:[\s\S]*?pull-requests: write[\s\S]*?statuses: write/);
  assert.match(recovery, /SUPERSEDED: exact PR head is already contained in develop/);
  assert.match(recovery, /context: 'integration-rescue\/config'/);
  assert.match(recovery, /fresh\.head\.sha !== pr\.head\.sha \|\| branch\.commit\.sha !== develop \|\| manualReason\(fresh\)/,
    'close must re-read mutable PR/develop state and respect holds before mutation');
});