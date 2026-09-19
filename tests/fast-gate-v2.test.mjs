import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fastGateScope, requiresRinneRigQa, splitFastTests } from '../scripts/fast-gate-v2.mjs';
import { countFastDevTests } from '../scripts/fast-dev-contract.mjs';

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

test('broad validation never drops a test outside DEV mode', () => {
  const tests = ['tests/control.test.mjs', ...heavy];
  const plan = splitFastTests(tests, ['scripts/validate.mjs'], { broad: true });
  assert.deepEqual(plan.light, tests);
  assert.deepEqual(plan.heavy, []);
  assert.deepEqual(plan.skippedHeavy, []);
});

test('validator uses trusted current-develop helpers for DEV while preserving repository helpers elsewhere', () => {
  const validate = source('scripts/validate.mjs');
  const check = source('scripts/check.mjs');
  assert.match(validate, /const trustedControlDir = dirname\(fileURLToPath\(import\.meta\.url\)\)/);
  assert.match(validate, /const scriptPath = name => dev \? resolve\(trustedControlDir, name\) : `scripts\/\$\{name\}`/);
  assert.match(validate, /\[scriptPath\('affected\.mjs'\), \.\.\.affectedArgs\]/);
  assert.match(validate, /\(dev \|\| narrowFast\) \? \[scriptPath\('check\.mjs'\), '--direct'/);
  assert.match(validate, /scriptPath\('visual-budget\.mjs'\)/);
  assert.match(validate, /scriptPath\('code-health\.mjs'\)/);
  assert.match(validate, /gateCostPlan\(plan\.paths \|\| \[\]\)\.profile/);
  assert.match(validate, /fastGateScope\(plan, profile\)/);
  assert.match(validate, /splitFastTests\(uniqueTests, plan\.paths/);
  assert.match(check, /requested\[0\] === '--direct'/);
  assert.match(check, /if \(!direct\) for \(const file of readdirSync\('scripts'/);
  const contract = source('scripts/fast-dev-contract.mjs');
  const astra = source('.github/workflows/astra-work-validation.yml');
  assert.equal(countFastDevTests("test('a',()=>{})\n test.skip('b',()=>{})"),2);
  assert.match(contract,/TEST_INVENTORY_EXPANDED/);
  assert.match(contract,/FAST_DEV_LIFECYCLE_CHANGED/);
  assert.match(contract,/ACTIONS_WORKFLOW_CHANGED/);
  assert.match(astra,/git show origin\/develop:scripts\/fast-dev-contract\.mjs/);
  assert.match(astra,/npm ci --ignore-scripts/);
  assert.match(astra,/astra\/fast-dev-contract/);

});

test('DEV PR and normal DEV publication both record zero tests', () => {
  const validate = source('scripts/validate.mjs');
  assert.match(validate, /const dev = mode === 'dev'/);
  assert.match(validate, /const deploy = mode === 'deploy'/);
  assert.match(validate, /if \(dev \|\| deploy\) \{[\s\S]*tests: 0[\s\S]*\} else \{/);
  assert.match(validate, /else \{[\s\S]*splitFastTests\(uniqueTests[\s\S]*\['--test', \.\.\.split\.light\]/);
});

test('develop CI plans and validates with trusted control checkout while main keeps PR fast validation', () => {
  const workflow = source('.github/workflows/ci.yml');
  const build = workflow.slice(workflow.indexOf('\n  build:'), workflow.indexOf('\n  integration-request:'));
  assert.match(build, /TARGET_BASE: \$\{\{ github\.event\.pull_request\.base\.ref \}\}[\s\S]*node \.\.\/control\/scripts\/affected\.mjs "\$BASE_SHA" "\$HEAD_SHA" dev/);
  assert.match(build, /if \[ "\$TARGET_BASE" = "develop" \]; then[\s\S]*node \.\.\/control\/scripts\/validate\.mjs dev "\$BASE_SHA" "\$HEAD_SHA"[\s\S]*else[\s\S]*node scripts\/validate\.mjs fast "\$BASE_SHA" "\$HEAD_SHA"/);
  assert.match(build, /github\.event\.pull_request\.base\.ref == 'main' \|\| steps\.plan\.outputs\.has_apps == 'true' \|\| steps\.plan\.outputs\.infrastructure == 'true'/);
  assert.doesNotMatch(build, /has_packages == 'true'/);
  assert.match(build, /Bind trusted DEV validator to exact PR dependencies[\s\S]*ln -s \.\.\/work\/node_modules control\/node_modules/);
  assert.ok(build.indexOf('Bind trusted DEV validator to exact PR dependencies') < build.indexOf('DEV no-test validation or main fast verification'));
});

test('Ready validation checkout is shallow and fetches only the resolved exact base', () => {
  const workflow = source('.github/workflows/ci.yml');
  const build = workflow.slice(workflow.indexOf('\n  build:'), workflow.indexOf('\n  integration-request:'));
  assert.match(build, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}[\s\S]*?fetch-depth: 1/);
  assert.doesNotMatch(build, /fetch-depth: 0/);
  assert.match(build, /name: Fetch exact validation base only/);
  assert.match(build, /git fetch --no-tags --depth=1 origin "\$BASE_SHA"/);
  assert.match(build, /grep -Fq '\$\{base\}\.\.\.\$\{head\}' \.\.\/control\/scripts\/integration-gate-cost\.mjs/);
  assert.match(build, /git fetch --no-tags --deepen="\$depth" origin "\$HEAD_SHA"/);
  assert.match(build, /if \[ "\$depth" -gt 256 \]; then/);
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
