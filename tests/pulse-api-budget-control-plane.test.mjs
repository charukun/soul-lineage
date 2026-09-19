import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function topLevelJob(yaml, id) {
  const marker = `  ${id}:\n`;
  const start = yaml.indexOf(marker);
  assert.notEqual(start, -1, `missing workflow job: ${id}`);
  const rest = yaml.slice(start + marker.length);
  const next = rest.search(/\n  [A-Za-z0-9_-]+:\n/);
  return next >= 0 ? rest.slice(0, next) : rest;
}

test('develop handoff no longer depends on the removed request-rescue CI job', () => {
  const ci = text('.github/workflows/ci.yml');
  const wake = text('.github/workflows/pulse-events.yml');

  assert.match(ci, /branches:\s*\[main\]/);
  assert.doesNotMatch(ci, /request-rescue:/);
  assert.doesNotMatch(ci, /name:\s*Record Ready handoff/);
  assert.doesNotMatch(ci, /rescue_mode|createWorkflowDispatch/);
  assert.match(wake, /branches:\s*\[develop\]/);
  assert.match(wake, /ready_for_review/);
  assert.match(wake, /uses:\s*\.\/\.github\/workflows\/pulse-refresh\.yml/);
});

test('normal develop has no browser repair dispatch or legacy recorder workflow input', () => {
  const ci = text('.github/workflows/ci.yml');
  const deploy = text('.github/workflows/deploy.yml');
  assert.doesNotMatch(ci, /browser-repair-dispatch:|repair_scope:\s*'pr'/);
  assert.doesNotMatch(deploy, /repair-ticket:|repair_scope|repair_conclusion|repair_head_sha|repair_pr_number|repair_run_url|repair_artifact|browser-repair-ticket\.mjs/);
});

test('legacy shared DEV publisher coalescer is retired in favor of app-scoped Workers publication', () => {
  assert.equal(existsSync(new URL('../.github/workflows/dev-publisher-coalescer.yml', import.meta.url)), false);
  const workflow = text('.github/workflows/dev-app-publish.yml');
  assert.match(workflow, /group: per-app-dev-\$\{\{ matrix\.app \}\}/);
  assert.match(workflow, /cancel-in-progress: true/);
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
  const worker = text('apps/pulse/worker.mjs');
  assert.match(worker, /reconcileRetryAlarm/);
  assert.match(worker, /async alarm\(\)/);
  assert.match(worker, /refresh\('rate-limit-retry'\)/);
  assert.match(worker, /if \(!env\.OPS_GITHUB_TOKEN\) return/);
  assert.match(worker, /if \(!token\) throw githubAuthError\(source\)/);
  assert.match(worker, /if \(!token && !env\.OPS_GITHUB_TOKEN\)/);
  assert.match(worker, /if \(!state && env\.OPS_GITHUB_TOKEN\) state = await stub\.refresh\('cold-start'\)/);
  assert.doesNotMatch(worker, /await stub\.getState\(\) \|\| await stub\.refresh\(eventReason\(request\)\)/);
});

test('PULSE exposes the API budget used by the current snapshot', () => {
  const app = text('apps/pulse/public/app.js');
  assert.match(app, /api\.requests/);
  assert.match(app, /api\.maxRequests/);
  assert.match(app, /api\.cacheHits/);
  assert.match(app, /api\.remaining/);
  assert.match(app, /API \$\{api\.scope === 'authenticated' \? '認証' : '公開'\}/);
});

test('normal develop delivery uses one authenticated refresh contract without redeploying unchanged PULSE', () => {
  const opsWorkflow = text('.github/workflows/ops-board.yml');
  const refreshWorkflow = text('.github/workflows/pulse-refresh.yml');
  const devWorkflow = text('.github/workflows/dev-app-publish.yml');
  const prime = text('apps/pulse/prime.mjs');

  assert.doesNotMatch(opsWorkflow, /^  push:/m);
  assert.match(opsWorkflow, /name: Plan PULSE publication/);
  assert.match(opsWorkflow, /node ops-board\/publication-plan\.mjs/);
  assert.match(opsWorkflow, /name: Refresh existing PULSE state/);
  assert.match(opsWorkflow, /uses: \.\/\.github\/workflows\/pulse-refresh\.yml/);
  assert.match(opsWorkflow, /record_public_status: true/);

  assert.match(refreshWorkflow, /node ops-board\/refresh-client\.mjs/);
  assert.match(refreshWorkflow, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(refreshWorkflow, /context: 'ops-board\/refresh'/);
  assert.match(refreshWorkflow, /PULSE runtime unchanged; authenticated state refresh passed/);

  assert.match(prime, /refreshPulseState/);
  assert.doesNotMatch(prime, /fetch\(new URL\('api\/refresh'/);

  assert.match(devWorkflow, /name: Refresh PULSE/);
  assert.match(devWorkflow, /uses: \.\/\.github\/workflows\/ops-board\.yml/);
  assert.doesNotMatch(devWorkflow, /api\/refresh/);
});

test('Actions workflows cannot hand-roll the PULSE refresh HTTP protocol again', () => {
  const directory = new URL('../.github/workflows/', import.meta.url);
  const offenders = readdirSync(directory)
    .filter(name => /\.ya?ml$/.test(name))
    .filter(name => /api\/refresh/.test(readFileSync(new URL(name, directory), 'utf8')));
  assert.deepEqual(offenders, [], 'workflow refresh callers must use pulse-refresh.yml + refresh-client.mjs');
});