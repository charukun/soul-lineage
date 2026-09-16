import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fastGateScope, requiresRinneRigQa, splitFastTests } from '../scripts/fast-gate-v2.mjs';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const heavy = [
  'apps/rinne/tests/motion-continuity-rig.test.mjs',
  'apps/rinne/tests/motion-quality-rig.test.mjs',
];

test('Fast Gate scope separates app, shared and fail-closed infrastructure changes', () => {
  assert.equal(fastGateScope({ apps: ['rinne'], packages: [], infrastructure: false }), 'app');
  assert.equal(fastGateScope({ apps: ['rinne'], packages: ['@soul/characters'], infrastructure: false }), 'shared');
  assert.equal(fastGateScope({ apps: ['rinne'], packages: [], infrastructure: true }), 'broad');
  assert.equal(fastGateScope({ apps: ['rinne'], packages: [], infrastructure: false }, 'control'), 'broad');
  assert.equal(fastGateScope({ apps: ['rinne'], packages: [], infrastructure: false }, 'shared'), 'shared');
  assert.equal(fastGateScope({ apps: [], packages: [], infrastructure: false }), 'none');
});

test('unrelated Rinne UI changes skip rig QA while motion and shared character changes retain it', () => {
  assert.equal(requiresRinneRigQa(['apps/rinne/src/main.js', 'apps/rinne/index.html']), false);
  assert.equal(requiresRinneRigQa(['apps/rinne/src/humanoid-life.js']), true);
  assert.equal(requiresRinneRigQa(['apps/rinne/src/rebuild/runtime-character-stage.js']), true);
  assert.equal(requiresRinneRigQa(['packages/characters/src/index.js']), true);
  const unrelated = splitFastTests(['apps/rinne/tests/title.test.mjs', ...heavy], ['apps/rinne/src/main.js']);
  assert.deepEqual(unrelated.light, ['apps/rinne/tests/title.test.mjs']);
  assert.deepEqual(unrelated.heavy, []);
  assert.deepEqual(unrelated.skippedHeavy, heavy);
  const related = splitFastTests(['apps/rinne/tests/title.test.mjs', ...heavy], ['packages/animations/src/runtime.js']);
  assert.deepEqual(related.heavy, heavy);
  assert.deepEqual(related.skippedHeavy, []);
});

test('broad validation never drops a test', () => {
  const tests = ['tests/control.test.mjs', ...heavy];
  const plan = splitFastTests(tests, ['scripts/validate.mjs'], { broad: true });
  assert.deepEqual(plan.light, tests);
  assert.deepEqual(plan.heavy, []);
  assert.deepEqual(plan.skippedHeavy, []);
});

test('validator uses gate-cost profile and direct workspace checks for narrow fast scope', () => {
  const validate = source('scripts/validate.mjs');
  const check = source('scripts/check.mjs');
  assert.match(validate, /gateCostPlan\(plan\.paths \|\| \[\]\)\.profile/);
  assert.match(validate, /fastGateScope\(plan, profile\)/);
  assert.match(validate, /narrowFast \? \['scripts\/check\.mjs', '--direct'/);
  assert.match(validate, /splitFastTests\(uniqueTests, plan\.paths/);
  assert.match(validate, /plan\.infrastructure/);
  assert.match(check, /requested\[0\] === '--direct'/);
  assert.match(check, /if \(!direct\) for \(const file of readdirSync\('scripts'/);
});

test('Ready validation checkout is shallow and fetches only the resolved exact base', () => {
  const workflow = source('.github/workflows/ci.yml');
  const build = workflow.slice(workflow.indexOf('\n  build:'), workflow.indexOf('\n  integration-request:'));
  assert.match(build, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}[\s\S]*?fetch-depth: 1/);
  assert.doesNotMatch(build, /fetch-depth: 0/);
  assert.match(build, /name: Fetch exact validation base only/);
  assert.match(build, /git fetch --no-tags --depth=1 origin "\$BASE_SHA"/);
});

test('Fast Gate guards compare exact trees without merge-base history', () => {
  const gate = source('scripts/integration-gate-cost.mjs');
  const visual = source('scripts/visual-budget.mjs');
  const health = source('scripts/code-health.mjs');
  assert.match(gate, /\['diff', '--name-only', base, head\]/);
  assert.match(gate, /\['diff', '--check', base, head\]/);
  assert.match(visual, /\['diff','--name-only','--diff-filter=AM',base,head\]/);
  assert.match(health, /\['diff', '--name-status', '--find-renames', base, head\]/);
  for (const text of [gate, visual, health]) assert.doesNotMatch(text, /\$\{base\}\.\.\.\$\{head\}/);
});
