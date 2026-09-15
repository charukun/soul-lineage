import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const browser = readFileSync('scripts/verify-browser.mjs', 'utf8');
const recorder = readFileSync('scripts/browser-repair-ticket.mjs', 'utf8');
const notify = readFileSync('scripts/notify-delivery.mjs', 'utf8');
const deploy = readFileSync('.github/workflows/deploy.yml', 'utf8');
const contract = readFileSync('docs/DEV_PUBLICATION.md', 'utf8');

test('normal develop publication bypasses heavy browser work without weakening Production verification', () => {
  assert.match(browser, /GITHUB_JOB === 'publish'/);
  assert.match(browser, /GITHUB_REF === 'refs\/heads\/develop'/);
  assert.match(browser, /DEV_BROWSER_GATE !== 'true'/);
  assert.match(browser, /browser diagnostics are not a publication gate/);
  assert.match(deploy, /Preserve blocking Production browser verification/);
  assert.match(deploy, /github\.ref == 'refs\/heads\/main'.*verify-browser/s);
});

test('DEV delivery cannot fake browser evidence but may complete an already-green repair', () => {
  assert.match(recorder, /REPAIR_VERIFIED === 'true'/);
  assert.match(recorder, /finalizeReadyDevelopRepairFromDelivery/);
  assert.match(recorder, /state\.state !== 'ready-for-integration'/);
  assert.match(recorder, /repairPrHead \|\| state\.headSha/);
  assert.match(recorder, /verificationMode: 'repair-pr-browser\+dev-delivery'/);
  assert.match(recorder, /noop-dev-delivery-without-ready-repair/);
});

test('late repair PR browser success reconnects to the develop repair ticket after merge', () => {
  assert.match(recorder, /late-merged-repair-success/);
  assert.match(recorder, /ready-for-integration/);
  assert.match(recorder, /currentDevelopContainingMergedPr/);
  assert.match(recorder, /close when the repaired head is confirmed in published DEV/);
});

test('DEV_DEPLOYED copy and final status do not claim browser certification', () => {
  assert.match(notify, /Fast checks \/ DEV publication \/ HTTP-source verification passed/);
  assert.match(notify, /Browser diagnostics are asynchronous/);
  assert.match(notify, /DEV published; HTTP\/source verified; browser diagnostics are asynchronous/);
  assert.doesNotMatch(notify, /focused browser passed/);
});

test('the focused DEV contract keeps publication and repair as separate state machines', () => {
  assert.match(contract, /Browser\/WebGL\/gameplay scenarios are not a prerequisite for DEV visibility/);
  assert.match(contract, /Normal DEV publication does not launch a second all-app browser sweep/);
  assert.match(contract, /repair PR's browser verification is green/);
  assert.match(contract, /configured finite attempt limit/);
  assert.match(contract, /Production remains unchanged/);
});
