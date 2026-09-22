import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AUTHENTICATED_STATE_READ_REFRESH_MS,
  PUBLIC_STATE_READ_REFRESH_MS,
  stateReadRefreshMode,
} from '../ops-board/refresh-policy.mjs';

const NOW = Date.parse('2026-09-23T00:00:00Z');
const stateAtAge = age => ({ generatedAt: new Date(NOW - age).toISOString() });

test('authenticated PULSE state becomes read-through refreshable before the browser poll interval', () => {
  assert.ok(AUTHENTICATED_STATE_READ_REFRESH_MS < 60_000);
  assert.equal(stateReadRefreshMode(stateAtAge(AUTHENTICATED_STATE_READ_REFRESH_MS - 1), { authenticated: true, now: NOW }), null);
  assert.equal(stateReadRefreshMode(stateAtAge(AUTHENTICATED_STATE_READ_REFRESH_MS), { authenticated: true, now: NOW }), 'authenticated');
});

test('public recovery stays bounded while still healing a stale board faster than the cron backup', () => {
  assert.ok(PUBLIC_STATE_READ_REFRESH_MS < 30 * 60_000);
  assert.equal(stateReadRefreshMode(stateAtAge(PUBLIC_STATE_READ_REFRESH_MS - 1), { authenticated: false, now: NOW }), null);
  assert.equal(stateReadRefreshMode(stateAtAge(PUBLIC_STATE_READ_REFRESH_MS), { authenticated: false, now: NOW }), 'public');
});

test('missing snapshot time fails closed into a refresh instead of serving an indefinitely stale PULSE board', () => {
  assert.equal(stateReadRefreshMode({ generatedAt: null }, { authenticated: true, now: NOW }), 'authenticated');
  assert.equal(stateReadRefreshMode({ generatedAt: 'broken' }, { authenticated: false, now: NOW }), 'public');
});

test('PULSE /api/state wires stale reads to the shared refresh paths without restoring Actions sync workflows', () => {
  const worker = readFileSync(new URL('../ops-board/worker.mjs', import.meta.url), 'utf8');
  assert.match(worker, /stateReadRefreshMode\(state, \{ authenticated: Boolean\(env\.OPS_GITHUB_TOKEN\) \}\)/);
  assert.match(worker, /stub\.refresh\('state-read-stale'\)/);
  assert.match(worker, /stub\.recoverPublic\('state-read-stale-public'\)/);
});
