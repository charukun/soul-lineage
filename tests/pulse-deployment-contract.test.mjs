import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { preserveProduction, buildEnvironmentSnapshots } from '../scripts/deploy.mjs';
import { GAME_NAMES } from '../scripts/application-catalog.mjs';
const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const entry = (app, environment, commit, pinned = false) => ({ app, environment, path: `${environment}/${app}`, pinned,
  inputHash: `${app}-${environment}-${commit}`, version: { commit, branch: pinned ? 'develop' : 'main' },
  files: [{ path: 'index.html', sha256: 'original-file-digest', size: 32 }] });
const options = { developSha: 'dev-new', productionSha: 'main-old', devOnly: true, deployedAt: '2026-09-12T09:00:00Z', workflowRunId: 'audit' };

test('DEV delivery retains exact pinned validation and Production entry objects', () => {
  const production = entry('rinne', 'prod', 'main-old');
  const staging = entry('rinne', 'staging', 'staging-old', true);
  const supplemental = entry('demon', 'prod', 'initial-release', true);
  const dev = entry('rinne', 'dev', 'dev-new');
  const previous = { entries: [entry('rinne', 'dev', 'dev-old'), production, staging, supplemental] };
  const planned = preserveProduction([dev], previous, true);
  assert.deepEqual(planned, [dev, production, staging, supplemental]);
  for (const retained of [production, staging, supplemental]) assert.ok(planned.includes(retained));
});

test('mixed-source Production cannot masquerade as a single main commit', () => {
  const old = entry('rinne', 'prod', 'main-old');
  const added = entry('demon', 'prod', 'dev-new', true);
  const previous = { entries: [old], environmentSnapshots: { prod: { commit: 'main-old', branch: 'main' } } };
  const snapshots = buildEnvironmentSnapshots(previous, [old, added], options);
  assert.equal(snapshots.prod.commit, null);
  assert.equal(snapshots.prod.source, 'mixed-entry-set');
  assert.deepEqual(snapshots.prod.sourceCommits, ['main-old', 'dev-new']);
});

test('unchanged pinned snapshots keep their real original deployment timestamp', () => {
  const staged = entry('rinne', 'staging', 'staged', true);
  const prior = { commit: 'staged', branch: 'develop', deployedAt: '2026-09-11T00:00:00Z', workflowRunId: 'older' };
  const snapshots = buildEnvironmentSnapshots({ entries: [staged], environmentSnapshots: { staging: prior } }, [staged], options);
  assert.equal(snapshots.staging, prior);
  assert.equal(snapshots.dev.commit, 'dev-new');
});

test('PULSE title, canonical names and deployment metadata are wired together', () => {
  const html = text('ops-board/public/index.html');
  assert.match(html, /<title>PULSE<\/title>/);
  assert.match(html, /<h1[^>]*>PULSE<\/h1>/);
  assert.doesNotMatch(html, /開発状況ボード|Rinne Ops Board/);
  assert.equal(GAME_NAMES.demon, '尽喰廻遊');
  assert.match(text('scripts/vite-app.mjs'), /GAME_ENVIRONMENTS\.some/);
  assert.match(text('ops-board/worker.mjs'), /buildState.*collector\.mjs/);
  assert.match(text('ops-board/collector.mjs'), /environments: \[dev, staging, prod, \.\.\.previews\]/);
  assert.equal(existsSync(new URL('../.task-tools/pulse-apply.mjs', import.meta.url)), false);
  assert.equal(existsSync(new URL('../.github/workflows/pulse-task-worker.yml', import.meta.url)), false);
});

test('delivery wiring initializes only missing releases and preserves public/browser checks', () => {
  const workflow = text('.github/workflows/deploy.yml');
  assert.match(workflow, /INITIALIZE_GAME_ENVIRONMENTS: 'true'/);
  assert.match(workflow, /refresh_staging:/);
  assert.match(workflow, /REFRESH_STAGING:/);
  assert.match(workflow, /scripts\/verify-live\.mjs/);
  assert.match(workflow, /scripts\/verify-browser\.mjs/);
  const boardWorkflow = text('.github/workflows/ops-board.yml');
  assert.match(boardWorkflow, /node ops-board\/publication-check\.mjs/);
  assert.match(text('ops-board/publication-check.mjs'), /PULSE_PUBLIC_VERIFIED/);
  assert.match(boardWorkflow, /scripts\/application-catalog\.mjs/);
  assert.doesNotMatch(boardWorkflow, /grep -q '開発状況ボード'/);
});
