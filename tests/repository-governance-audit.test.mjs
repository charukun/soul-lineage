import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBranchProtection, GOVERNANCE_CONTEXT, REQUIRED_BRANCHES } from '../scripts/repository-governance-audit.mjs';

const sha = digit => digit.repeat(40);

test('repository governance requires both develop and main to be protected', () => {
  const result = evaluateBranchProtection({
    develop: { protected: true, commit: { sha: sha('a') } },
    main: { protected: true, commit: { sha: sha('b') } },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.branches.map(item => item.name), REQUIRED_BRANCHES);
  assert.ok(result.branches.every(item => item.protected));
});

test('repository governance fails closed when either protected flag is false', () => {
  const result = evaluateBranchProtection({
    develop: { protected: false, commit: { sha: sha('a') } },
    main: { protected: true, commit: { sha: sha('b') } },
  });
  assert.equal(result.ok, false);
  assert.equal(result.branches.find(item => item.name === 'develop').protected, false);
});

test('repository governance fails closed when branch identity is incomplete', () => {
  const result = evaluateBranchProtection({ develop: { protected: true, commit: { sha: sha('a') } } });
  assert.equal(result.ok, false);
  assert.equal(result.branches.find(item => item.name === 'main').sha, null);
});

test('governance status uses a stable non-code-gate context', () => {
  assert.equal(GOVERNANCE_CONTEXT, 'governance/branch-protection');
});
