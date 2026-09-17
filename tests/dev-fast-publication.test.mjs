import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const notify = readFileSync('scripts/notify-delivery.mjs', 'utf8');
const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const deploy = readFileSync('.github/workflows/deploy.yml', 'utf8');
const pulse = readFileSync('.github/workflows/ops-board.yml', 'utf8');
const pulseAudit = readFileSync('.github/workflows/pulse-environment-audit.yml', 'utf8');
const coalescer = readFileSync('.github/workflows/dev-publisher-coalescer.yml', 'utf8');
const publisher = readFileSync('scripts/deploy.mjs', 'utf8');
const validator = readFileSync('scripts/validate.mjs', 'utf8');
const contract = readFileSync('docs/DEV_PUBLICATION.md', 'utf8');

test('normal develop PR and publication omit automatic browser work without weakening Production verification', () => {
  assert.doesNotMatch(ci, /name: Affected browser smoke/);
  assert.doesNotMatch(ci, /browser-repair-dispatch:/);
  assert.doesNotMatch(ci, /npx playwright install/);
  assert.doesNotMatch(deploy, /Focused DEV browser verification after promotion/);
  assert.doesNotMatch(deploy, /name: Preserve DEV browser evidence/);
  assert.doesNotMatch(deploy, /browser_outcome:/);
  assert.doesNotMatch(deploy, /repair_scope|browser-repair-ticket\.mjs/);
  assert.match(deploy, /Validate exact DEV candidate manifest before public promotion/);
  assert.match(deploy, /Preserve blocking Production browser verification/);
  assert.match(deploy, /github\.ref == 'refs\/heads\/main'.*verify-browser/s);
});

test('develop hot path ignores non-source PR chatter and branch-push PULSE browser work', () => {
  assert.match(ci, /types: \[opened, synchronize, reopened, ready_for_review, converted_to_draft\]/);
  assert.doesNotMatch(ci, /pull_request_review:/);
  assert.doesNotMatch(ci, /edited|labeled|unlabeled/);
  assert.match(ci, /needs\.build\.result == 'success' \|\| needs\.build\.result == 'failure'/);

  const pulseTriggers = pulse.split('permissions:')[0];
  assert.doesNotMatch(pulseTriggers, /\bpush:/);
  assert.match(pulseTriggers, /workflow_dispatch:/);
  assert.match(pulseTriggers, /workflow_call:/);
  assert.match(pulse, /visual-review:[\s\S]*github\.event_name == 'workflow_dispatch'/);
  assert.match(pulse, /Publish Visual Review on explicit Ops Board dispatch/);

  const auditTriggers = pulseAudit.split('permissions:')[0];
  assert.doesNotMatch(auditTriggers, /pull_request:/);
  assert.match(auditTriggers, /workflow_dispatch:/);
});

test('automatic DEV publishers coalesce both push and Integration dispatch routes', () => {
  assert.match(coalescer, /run\.event === 'push'/);
  assert.match(coalescer, /run\.event === 'workflow_dispatch'/);
  assert.match(coalescer, /DEV Publisher \(automatic\)/);
  assert.match(coalescer, /Cancelled same-source duplicates/);
});

test('normal DEV publisher skips tests and install when no app input changed', () => {
  assert.match(publisher, /const changedDevApps = .*environment === 'dev'/);
  assert.match(publisher, /if \(full \|\| \(devOnly && changedDevApps\.length\)\)/);
  assert.match(publisher, /DEV app inputs unchanged; skip npm ci and validation\/build preparation/);
  assert.match(publisher, /if \(!entry\.legacy && !devOnly\) run\(entry\.root, 'npm', \['test'\]/);
  assert.match(publisher, /if \(!entry\.legacy && !devOnly\) run\(entry\.root, 'npm', \['run', 'test:app'/);
  assert.match(validator, /if \(dev \|\| deploy\) \{[\s\S]*tests: 0/);
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

test('the focused DEV contract makes tests/browser opt-in and preserves Production', () => {
  assert.match(contract, /`node --test`.*not prerequisites for DEV visibility/);
  assert.match(contract, /skips `npm ci` and app validation\/build preparation/);
  assert.match(contract, /Normal develop PRs do not automatically run affected-browser smoke/);
  assert.match(contract, /Normal work\/feat\/fix branch pushes do not run the PULSE browser verification workflow/);
  assert.match(contract, /Visual Review runs only from an explicit `Rinne Ops Board` workflow dispatch/);
  assert.match(contract, /full_verification=true/);
  assert.match(contract, /legacy browser repair recorder workflow\/input\/script are retired/);
  assert.match(contract, /Production remains unchanged/);
});
