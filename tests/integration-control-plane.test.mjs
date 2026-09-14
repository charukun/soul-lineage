import test from 'node:test';
import assert from 'node:assert/strict';
import { controlPlaneScope, isControlPlanePath } from '../scripts/integration-control-plane.mjs';

test('trusted control plane accepts only automation / integration / PULSE governance files', () => {
  const scope = controlPlaneScope([
    '.github/workflows/ci.yml',
    'scripts/integration-wakeup.mjs',
    'ops-board/rescue.mjs',
    'tests/integration-control-plane.test.mjs',
    'docs/INTEGRATION.md',
    '.task-start/integration-control-plane-v2.md',
  ]);
  assert.equal(scope.trusted, true);
  assert.deepEqual(scope.rejected, []);
});

test('one product or shared package file disables control-plane fast lane', () => {
  for (const path of ['apps/village/src/main.js', 'packages/world/src/mura/index.js', 'portal/public/app.js']) {
    const scope = controlPlaneScope(['scripts/integration.mjs', path]);
    assert.equal(scope.trusted, false, path);
    assert.deepEqual(scope.rejected, [path]);
  }
});

test('empty and broad unrelated script scopes fail closed', () => {
  assert.equal(controlPlaneScope([]).trusted, false);
  assert.equal(isControlPlanePath('scripts/generate-character.mjs'), false);
  assert.equal(isControlPlanePath('AGENTS.md'), true);
});
