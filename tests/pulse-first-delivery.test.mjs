import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeEnvironments } from '../scripts/deploy.mjs';

test('first Integration run can initialize the approved app set with older workflow YAML', () => {
  // Empty flag represents the older YAML which predates INITIALIZE_GAME_ENVIRONMENTS.
  assert.equal(initializeEnvironments(true, ''), true);
  assert.equal(initializeEnvironments(true, 'true'), true);
});

test('explicit opt-out and every ordinary main deployment cannot bootstrap releases', () => {
  assert.equal(initializeEnvironments(true, 'false'), false);
  for (const flag of ['', 'true', 'false']) assert.equal(initializeEnvironments(false, flag), false);
});
