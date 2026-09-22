import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('develop merge automation workflow is absent from the normal path', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  const deploy = readFileSync('.github/workflows/deploy.yml', 'utf8');
  assert.equal(existsSync('.github/workflows/develop-merge.yml'), false);
  assert.doesNotMatch(ci, /develop-merge\.yml|merge-ready:|request-rescue:/);
  assert.doesNotMatch(deploy, /develop-merge\.yml|queue-recovery:|merge-continuation:/);
});
