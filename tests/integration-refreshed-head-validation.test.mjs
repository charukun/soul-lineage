import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync('.github/workflows/integration-controller.yml', 'utf8');
const rescue = readFileSync('.github/workflows/integration-rescue.yml', 'utf8');
const validator = readFileSync('.github/workflows/integration-exact-head-validation.yml', 'utf8');

test('dependency-free stale refresh validates exact heads before waking Fast Lane', () => {
  assert.match(controller, /stale-ready-validate:/);
  assert.match(controller, /uses: \.\/\.github\/workflows\/integration-exact-head-validation\.yml/);
  assert.match(controller, /needs: \[stale-ready-refresh, stale-ready-validate\]/);
  assert.doesNotMatch(controller, /Wake Fast Lane for refreshed exact heads/);
});

test('dependent Fast Repair also validates exact heads before returning to Fast Lane', () => {
  assert.match(rescue, /stack-validate:/);
  assert.match(rescue, /uses: \.\/\.github\/workflows\/integration-exact-head-validation\.yml/);
  assert.match(rescue, /needs: \[repair, stack-validate\]/);
  assert.doesNotMatch(rescue, /without CI repair/);
});

test('trusted refreshed-head validation preserves current-state and exact-head evidence gates', () => {
  assert.match(validator, /Reconfirm current PR, exact head and develop/);
  assert.match(validator, /REFRESHED_HEAD_PR_CHANGED/);
  assert.match(validator, /REFRESHED_HEAD_DEVELOP_CHANGED/);
  assert.match(validator, /validate\.mjs dev/);
  assert.match(validator, /pr-fast-\$\{\{ inputs\.pr \}\}-\$\{\{ inputs\.head \}\}/);
  assert.match(validator, /context: 'integration\/stack-fast'/);
  assert.match(validator, /Stack Validate and build #\$\{\{ inputs\.pr \}\}/);
});
