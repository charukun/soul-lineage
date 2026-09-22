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
  assert.equal(GAME_NAMES.demon, '喰滅廻遊');
  assert.match(text('scripts/vite-app.mjs'), /GAME_ENVIRONMENTS\.some/);
  assert.match(text('ops-board/worker.mjs'), /buildState.*collector\.mjs/);
  assert.match(text('ops-board/collector.mjs'), /environments: \[dev, staging, prod, \.\.\.previews\]/);
  assert.equal(existsSync(new URL('../.task-tools/pulse-apply.mjs', import.meta.url)), false);
  assert.equal(existsSync(new URL('../.github/workflows/pulse-task-worker.yml', import.meta.url)), false);
});

test('delivery wiring keeps Fast DEV independent from PULSE while Production stays blocking', () => {
  const devWorkflow = text('.github/workflows/dev-app-publish.yml');
  const pagesWorkflow = text('.github/workflows/deploy.yml');
  assert.match(devWorkflow, /branches: \[develop\]/);
  assert.match(devWorkflow, /wrangler@4 deploy --config "wrangler\.dev\.\$APP\.jsonc"/);
  assert.doesNotMatch(devWorkflow, /PULSE|ops-board\.yml/);
  assert.match(pagesWorkflow, /branches: \[main\]/);
  assert.doesNotMatch(pagesWorkflow, /push:[\s\S]*branches: \[develop\]/);
  assert.doesNotMatch(pagesWorkflow, /integration-rescue|rescue_mode/);
  assert.match(pagesWorkflow, /PAGES_DEV_RETIRED: 'true'/);
  assert.match(pagesWorkflow, /scripts\/verify-live\.mjs/);
  assert.match(pagesWorkflow, /scripts\/verify-browser\.mjs/);
  assert.match(pagesWorkflow, /format\('\{0\}prod\/', steps\.deployment\.outputs\.page_url\)/);
  const deployScript = text('scripts/deploy.mjs');
  assert.match(deployScript, /RETIRE_PAGES_DEV_ONLY/);
  assert.match(deployScript, /content="0;url=prod\//);
  assert.match(text('ops-board/publication-check.mjs'), /PULSE_PUBLIC_VERIFIED/);
  assert.equal(existsSync(new URL('../.github/workflows/ops-board.yml', import.meta.url)), false);
  assert.equal(existsSync(new URL('../.github/workflows/pulse-refresh.yml', import.meta.url)), false);
});
