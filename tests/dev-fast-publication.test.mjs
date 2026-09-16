import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const notify = readFileSync('scripts/notify-delivery.mjs', 'utf8');
const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const deploy = readFileSync('.github/workflows/deploy.yml', 'utf8');
const contract = readFileSync('docs/DEV_PUBLICATION.md', 'utf8');

test('normal develop PR and publication omit automatic browser work without weakening Production verification', () => {
  assert.doesNotMatch(ci, /name: Affected browser smoke/);
  assert.doesNotMatch(ci, /browser-repair-dispatch:/);
  assert.doesNotMatch(ci, /npx playwright install/);
  assert.doesNotMatch(deploy, /Focused DEV browser verification after promotion/);
  assert.doesNotMatch(deploy, /name: Preserve DEV browser evidence/);
  assert.doesNotMatch(deploy, /browser_outcome:/);
  assert.doesNotMatch(deploy, /browser-repair-state:/);
  assert.match(deploy, /Validate exact DEV candidate manifest before public promotion/);
  assert.match(deploy, /Preserve blocking Production browser verification/);
  assert.match(deploy, /github\.ref == 'refs\/heads\/main'.*verify-browser/s);
});

test('explicit full verification retains public browser/WebGL diagnostics outside the DEV delivery gate', () => {
  const full = deploy.split('  full-verification:')[1];
  assert.match(full, /inputs\.full_verification == true/);
  assert.match(full, /Public Chromium \/ WebGL2/);
  assert.match(full, /verify-browser\.mjs/);
  assert.match(full, /verification\/full/);
  assert.match(full, /separate from DEV delivery/);
});

test('DEV_DEPLOYED copy does not claim browser certification', async () => {
  const { deliveryMessage } = await import('../scripts/notify-delivery.mjs');
  const message = deliveryMessage('DEV_DEPLOYED', { sha: 'a'.repeat(40), runUrl: 'https://github.com/run' });
  assert.match(message, /^verification: FAST_CHECKS\+DEV_PUBLIC\+HTTP_SOURCE$/m);
  assert.doesNotMatch(message, /FOCUSED_BROWSER/);
  assert.doesNotMatch(notify, /focused browser passed/);
  assert.ok(notify.indexOf('const status = await recordDevelopDeliveryStatus({') < notify.indexOf('channel = await notifyStage('),
    'GitHub delivery status must be recorded before advisory smartphone notification');
});

test('the focused DEV contract makes browser verification opt-in and preserves Production', () => {
  assert.match(contract, /Browser\/WebGL\/gameplay scenarios are not a prerequisite for DEV visibility/);
  assert.match(contract, /Normal develop PRs do not automatically run affected-browser smoke/);
  assert.match(contract, /full_verification=true/);
  assert.match(contract, /Historical `browser-repair:v1` records/);
  assert.match(contract, /Production remains unchanged/);
});
