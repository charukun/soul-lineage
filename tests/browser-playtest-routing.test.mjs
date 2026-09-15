import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  BROWSER_PLAYTEST_APPS,
  parseBrowserPlaytest,
  parseBrowserPlaytestValue,
  resolveBrowserPlaytestTargets,
} from '../scripts/browser/playtest-routing.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Browser-Playtest all expands to every game', () => {
  const request = parseBrowserPlaytest('Title\nBrowser-Playtest: all\nDepends-On: none');
  assert.equal(request.declared, true);
  assert.equal(request.mode, 'all');
  assert.deepEqual(request.apps, BROWSER_PLAYTEST_APPS);
});

test('Browser-Playtest app list is normalized into canonical order', () => {
  const request = parseBrowserPlaytestValue('demon, rinne');
  assert.equal(request.mode, 'apps');
  assert.deepEqual(request.apps, ['rinne', 'demon']);
});

test('affected mode preserves normal diff-driven targeting', () => {
  const request = parseBrowserPlaytestValue('affected');
  assert.deepEqual(resolveBrowserPlaytestTargets(['village'], request), ['village']);
});

test('explicit playtest apps are added even when the diff targets another app', () => {
  const request = parseBrowserPlaytestValue('rinne,demon');
  assert.deepEqual(resolveBrowserPlaytestTargets(['village'], request), ['rinne', 'village', 'demon']);
});

test('invalid or ambiguous Browser-Playtest declarations fail closed', () => {
  assert.throws(() => parseBrowserPlaytestValue('rinne,unknown'), /unknown apps/);
  assert.throws(() => parseBrowserPlaytestValue('rinne,rinne'), /duplicate app tokens/);
  assert.throws(() => parseBrowserPlaytestValue(''), /must not be empty/);
  assert.throws(
    () => parseBrowserPlaytest('Browser-Playtest: rinne\nBrowser-Playtest: demon'),
    /exactly one Browser-Playtest line/,
  );
});

test('PR smoke reads explicit intent and writes a machine-readable receipt', async () => {
  const source = await read('scripts/browser/pr-smoke.mjs');
  assert.match(source, /GITHUB_EVENT_PATH/);
  assert.match(source, /parseBrowserPlaytest\(eventPullRequestBody\(\)\)/);
  assert.match(source, /playtest-receipt\.json/);
  assert.match(source, /resolveBrowserPlaytestTargets\(affectedApps, request\)/);
});

test('no-code develop playtest reuses the existing full verification route', async () => {
  const [deploy, verify, targets] = await Promise.all([
    read('.github/workflows/deploy.yml'),
    read('scripts/verify-browser.mjs'),
    read('scripts/browser/target-contract.mjs'),
  ]);
  assert.match(deploy, /full_verification:/);
  assert.match(deploy, /INTEGRATION_FULL: 'true'/);
  assert.match(deploy, /node scripts\/verify-browser\.mjs/);
  assert.match(verify, /full:process\.env\.INTEGRATION_FULL === 'true'/);
  assert.match(targets, /const selected=available\.filter\(e=>full\|\|changed\.includes\(e\.path\)\)/);
});
