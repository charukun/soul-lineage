import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const browser = readFileSync('scripts/verify-browser.mjs', 'utf8');
const recorder = readFileSync('scripts/browser-repair-ticket.mjs', 'utf8');
const deploy = readFileSync('.github/workflows/deploy.yml', 'utf8');
const repairWorkflow = readFileSync('.github/workflows/dev-browser-repair.yml', 'utf8');
const contract = readFileSync('docs/DEV_PUBLICATION.md', 'utf8');

test('normal develop publication bypasses heavy browser work without weakening Production verification', () => {
  assert.match(browser, /GITHUB_JOB === 'publish'/);
  assert.match(browser, /GITHUB_REF === 'refs\/heads\/develop'/);
  assert.match(browser, /DEV_BROWSER_GATE !== 'true'/);
  assert.match(browser, /browser diagnostics are not a publication gate/);
  assert.match(deploy, /Preserve blocking Production browser verification/);
  assert.match(deploy, /github\.ref == 'refs\/heads\/main'.*verify-browser/s);
});

test('a skipped DEV publisher browser step cannot manufacture repair success', () => {
  assert.match(recorder, /REPAIR_VERIFIED === 'true'/);
  assert.match(recorder, /noop-unverified-develop-success/);
  assert.match(recorder, /REPAIR_ISSUE_NUMBER/);
});

test('only an active ready develop repair launches final heavy browser verification', () => {
  assert.match(repairWorkflow, /browser-repair:v1/);
  assert.match(repairWorkflow, /state === 'ready-for-integration'/);
  assert.match(repairWorkflow, /No develop browser repair is ready for final verification; normal DEV publication stays browser-free/);
  assert.match(repairWorkflow, /INTEGRATION_FULL: 'true'/);
  assert.match(repairWorkflow, /REPAIR_VERIFIED: 'true'/);
  assert.match(repairWorkflow, /REPAIR_ISSUE_NUMBER/);
  assert.match(repairWorkflow, /Keep failed repair verification visible without blocking DEV publication/);
});

test('late repair PR browser success reconnects to the develop repair ticket after merge', () => {
  assert.match(recorder, /late-merged-repair-success/);
  assert.match(recorder, /ready-for-integration/);
  assert.match(recorder, /currentDevelopContainingMergedPr/);
});

test('the focused DEV contract keeps publication and repair as separate state machines', () => {
  assert.match(contract, /Browser\/WebGL\/gameplay scenarios are not a prerequisite for DEV visibility/);
  assert.match(contract, /Normal DEV publication does not launch a second all-app browser sweep/);
  assert.match(contract, /configured finite attempt limit/);
  assert.match(contract, /Production remains unchanged/);
});
