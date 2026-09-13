import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, chmodSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { runValidation } from '../scripts/integration-rescue-worker.mjs';
import { notifyOutbox } from '../scripts/integration-rescue-return.mjs';

test('validation pins cwd and rejects an unreadable/missing lock before npm', async () => {
  const work = mkdtempSync(join(tmpdir(), 'rescue-runtime-'));
  const probe = resolve('scripts/integration-rescue-validation.mjs');
  try {
    writeFileSync(join(work, 'package.json'), '{}');
    await assert.rejects(runValidation(process.execPath, [probe, work], work), /VALIDATION_FAILED/);
    writeFileSync(join(work, 'package-lock.json'), '{"lockfileVersion":3}');
    let output = '';
    await runValidation(process.execPath, [probe, work], work, b => { output += b; });
    assert.equal(JSON.parse(output).validationCwd, work);
    assert.equal(JSON.parse(output).lockfileVersion, 3);
  } finally { rmSync(work, { recursive: true, force: true }); }
});

// This environment cannot switch UID locally. The regular GitHub-hosted fast
// gate runs this real sudo/npm regression; an already-unprivileged Rescue gate
// must not try to escalate again.
test('GitHub runner can run the pinned npm project under an unprivileged UID', {
  skip: process.env.GITHUB_ACTIONS !== 'true' || process.getuid?.() === 0 || !!process.env.RESCUE_VALIDATION_USER,
}, async () => {
  const root = mkdtempSync(join(tmpdir(), 'rescue-uid-'));
  const work = join(root, 'work');
  mkdirSync(work); chmodSync(work, 0o777);
  const probe = join(root, 'validation.mjs');
  copyFileSync(resolve('scripts/integration-rescue-validation.mjs'), probe);
  const previous = process.env.RESCUE_VALIDATION_USER;
  try {
    writeFileSync(join(work, 'package.json'), '{"name":"rescue-runtime-probe","version":"1.0.0"}');
    writeFileSync(join(work, 'package-lock.json'), JSON.stringify({ name: 'rescue-runtime-probe', version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'rescue-runtime-probe', version: '1.0.0' } } }));
    process.env.RESCUE_VALIDATION_USER = 'nobody';
    await assert.rejects(runValidation(process.execPath, [probe, work], work), /VALIDATION_FAILED/);
    // Reproduce the private runner ancestor, then add only traversal, just as
    // the live workflow does. This does not alter the actual CI checkout.
    chmodSync(root, 0o711);
    let output = '';
    await runValidation(process.execPath, [probe, work], work, b => { output += b; });
    assert.notEqual(JSON.parse(output).uid, process.getuid());
    await runValidation('npm', ['--prefix', work, '--cache', join(work, '.cache'), 'ci', '--no-audit', '--no-fund'], work);
  } finally {
    await runValidation(process.execPath, ['-e', 'for (const path of [".cache", "node_modules"]) require("node:fs").rmSync(path, {recursive:true, force:true})'], work);
    if (previous === undefined) delete process.env.RESCUE_VALIDATION_USER; else process.env.RESCUE_VALIDATION_USER = previous;
    rmSync(root, { recursive: true, force: true });
  }
});

test('a notification 403 remains unsent and cannot prevent other notifications or repair finalization', async () => {
  const state = { outbox: [
    { id: 'manual:121', type: 'manual', pr: 121, attempt: 1, maxAttempts: 3, reason: 'SEMANTIC_CONFLICT' },
    { id: 'wave:1', type: 'wave', wave: 'wave:1', prs: [139], manual: [121] },
  ] };
  const store = { read: async () => ({ state: structuredClone(state) }), mutate: async fn => fn(state) };
  let requests = 0;
  const c = { root: '/repos/charukun/soul-lineage', pages: async () => [], api: async () => { requests++; throw new Error('GitHub POST /issues/121/comments: HTTP 403'); } };
  await notifyOutbox(c, store);
  assert.equal(state.outbox[0].sentAt, undefined);
  assert.equal(state.outbox[0].notificationAttempts, 1);
  assert.match(state.outbox[0].notificationError, /HTTP 403/);
  assert.ok(state.outbox[1].sentAt);
  await notifyOutbox(c, store);
  assert.equal(requests, 1, 'retry backoff prevents a burst');
  state.outbox[0].notificationAttempts = 3;
  state.outbox[0].nextNotificationAt = '2020-01-01T00:00:00Z';
  await notifyOutbox(c, store);
  assert.equal(requests, 1, 'notification attempts remain bounded');
});
