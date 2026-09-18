import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Chat development canon is Connector authoring plus exact-head Actions validation', () => {
  const agents = text('AGENTS.md');
  const development = text('docs/DEVELOPMENT.md');
  const policy = text('docs/RINNE_PROJECT_EXECUTION_POLICY.md');
  const merge = text('docs/DEVELOP_MERGE.md');
  const workflow = text('.github/workflows/astra-work-validation.yml');

  assert.match(agents, /connected GitHub Connector/);
  assert.match(agents, /Contents \/ Git Data operations/);
  assert.match(agents, /`Astra Work Validation` GitHub Actions hosted runner/);
  assert.match(agents, /local clone, direct `github\.com` DNS, `git push`, or Codespaces/);
  assert.match(development, /construct the implementation commit/);
  assert.match(development, /focused test\/check\/build against that exact head in the `Astra Work Validation` GitHub Actions hosted checkout/);
  assert.match(policy, /## Canonical Chat execution path/);
  assert.match(policy, /blob, tree, commit, and ref updates/);
  assert.match(policy, /Validate the exact head in the `Astra Work Validation` GitHub Actions hosted runner/);
  assert.match(policy, /A local clone, direct `github\.com` DNS, local `git push`, and Codespaces are not prerequisites/);
  assert.match(merge, /Connector may construct the work-branch commit/);
  assert.match(merge, /`Astra Work Validation` GitHub Actions hosted runner provides the normal exact-head checkout/);

  assert.match(workflow, /name: Astra Work Validation/);
  assert.match(workflow, /'dispatch\/\*\*'/);
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /git fetch --no-tags origin develop:refs\/remotes\/origin\/develop/);
  assert.match(workflow, /Run focused changed-workspace tests/);
  assert.match(workflow, /node scripts\/validate\.mjs dev origin\/develop HEAD/);
  assert.match(workflow, /context: 'astra\/focused-validation'/);

  for (const source of [agents, development, policy]) {
    assert.doesNotMatch(source, /Edit source code, configuration, tests, and docs only in a git workspace/);
    assert.doesNotMatch(source, /Do not edit repository files through GitHub API \/ Connector/);
    assert.doesNotMatch(source, /Do not use GitHub file APIs as an implementation fallback/);
  }
});
