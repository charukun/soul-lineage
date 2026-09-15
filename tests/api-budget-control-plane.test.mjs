import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Ready handoff no longer duplicates the normal Fast Lane wake', () => {
  const ci = text('.github/workflows/ci.yml');
  const handoff = ci.split('  request-rescue:')[1].split('\n  draft-check:')[0];
  assert.match(handoff, /name: Record Ready handoff/);
  assert.match(handoff, /\["opened","synchronize","reopened","ready_for_review"\]/);
  assert.doesNotMatch(handoff, /rescue_mode|createWorkflowDispatch/);
  assert.doesNotMatch(handoff, /actions: write/);
});

test('browser repair records its result without a compatibility Integration wake', () => {
  const ci = text('.github/workflows/ci.yml');
  const repair = ci.split('  browser-repair-dispatch:')[1];
  assert.equal((repair.match(/createWorkflowDispatch/g) || []).length, 1);
  assert.doesNotMatch(repair, /Compatibility wake|harmless\s+extra event/);
});

test('publisher coalescing reads one bounded workflow snapshot', () => {
  const workflow = text('.github/workflows/dev-publisher-coalescer.yml');
  assert.equal((workflow.match(/listWorkflowRuns/g) || []).length, 1);
  assert.match(workflow, /activeStates = new Set/);
  assert.doesNotMatch(workflow, /for \(const status of/);
});

test('missed-wake watchdog is hourly and dispatches only after a Ready scan', () => {
  const config = text('wrangler.rescue-watchdog.jsonc');
  const worker = text('scripts/integration-rescue-watchdog-worker.mjs');
  assert.match(config, /"17 \* \* \* \*"/);
  assert.doesNotMatch(config, /\*\/10/);
  assert.ok(worker.indexOf('/pulls?state=open&base=develop') < worker.indexOf('/actions/workflows/deploy.yml/dispatches'));
  assert.match(worker, /if \(!ready\.length\) return \{ dispatched: false, ready: 0 \}/);
});

test('PULSE retries rate limits exactly and rejects anonymous event refreshes', () => {
  const worker = text('ops-board/worker.mjs');
  assert.match(worker, /reconcileRetryAlarm/);
  assert.match(worker, /async alarm\(\)/);
  assert.match(worker, /refresh\('rate-limit-retry'\)/);
  assert.match(worker, /if \(!token && !env\.OPS_GITHUB_TOKEN\)/);
  assert.match(worker, /await stub\.getState\(\) \|\| await stub\.refresh\(eventReason\(request\)\)/);
});
