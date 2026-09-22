import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('develop PRs do not trigger GitHub CI while main PR validation remains', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(ci, /branches: \[main\]/);
  assert.match(ci, /name: Validate and build/);
  assert.doesNotMatch(ci, /branches: \[develop, main\]|merge-ready:|request-rescue:/);
  assert.match(ci, /Production PR validation only/);
  assert.match(ci, /develop PRs intentionally do not trigger GitHub CI/);
});
