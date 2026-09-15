import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { trustedStackFastEvidence, stackFastContext } from '../scripts/integration-stack-fast-evidence.mjs';

const repository = 'charukun/soul-lineage';
const head = 'a'.repeat(40);
const pr = {
  number: 220,
  head: { sha: head, ref: 'feat/stack', repo: { full_name: repository } },
  base: { ref: 'develop', repo: { full_name: repository } },
};

function fixture() {
  const status = { context: stackFastContext, state: 'success', target_url: `https://github.com/${repository}/actions/runs/99` };
  const run = { id: 99, event: 'workflow_dispatch', head_branch: 'develop', path: '.github/workflows/deploy.yml', repository: { full_name: repository } };
  const artifacts = [{ name: `pr-fast-220-${head}`, expired: false }];
  const jobs = [{ name: 'Recover missed Ready CI and Integration requests / Repair executor pool / Stack Validate and build #220', status: 'completed', conclusion: 'success' }];
  const c = {
    root: `/repos/${repository}`,
    async pages(path) {
      if (path.endsWith(`/commits/${head}/statuses`)) return [status];
      if (path.endsWith('/actions/runs/99/artifacts')) return artifacts;
      if (path.includes('/actions/runs/99/jobs')) return jobs;
      throw new Error(path);
    },
    async api(method, path) {
      assert.equal(method, 'GET');
      if (path.endsWith('/actions/runs/99')) return run;
      throw new Error(path);
    },
  };
  return { c, status, run, artifacts, jobs };
}

test('trusted stack evidence is bound to exact PR head, trusted deploy run, artifact and completed build job', async () => {
  const f = fixture();
  assert.deepEqual(await trustedStackFastEvidence(f.c, pr), { pr: 220, head, runId: '99', source: 'integration-rescue-stack' });
});

test('stale, untrusted or incomplete stack evidence fails closed', async () => {
  for (const mutate of [
    f => f.status.state = 'pending',
    f => f.status.target_url = 'https://github.com/charukun/soul-lineage/actions/runs/not-a-number',
    f => f.run.path = '.github/workflows/ci.yml',
    f => f.run.head_branch = 'feat/untrusted',
    f => f.run.event = 'pull_request',
    f => f.run.repository.full_name = 'someone/else',
    f => f.artifacts[0].name = `pr-fast-220-${'b'.repeat(40)}`,
    f => f.artifacts[0].expired = true,
    f => f.jobs[0].conclusion = 'failure',
  ]) {
    const f = fixture();
    mutate(f);
    assert.equal(await trustedStackFastEvidence(f.c, pr), null, mutate.toString());
  }
});

test('Rescue workflow validates reconciled stack heads in parallel, publishes exact-head evidence and keeps browser asynchronous', () => {
  const workflow = readFileSync('.github/workflows/integration-rescue.yml', 'utf8');
  const fastLane = readFileSync('scripts/integration-fast-lane.mjs', 'utf8');
  const returned = readFileSync('scripts/integration-rescue-return.mjs', 'utf8');
  assert.match(workflow, /stack-fast:[\s\S]*Stack Validate and build[\s\S]*max-parallel: 4/);
  assert.match(workflow, /pr-fast-\$\{\{ matrix\.pr \}\}-\$\{\{ matrix\.head \}\}/);
  assert.match(workflow, /context: 'integration\/stack-fast'/);
  assert.match(workflow, /stack-browser:[\s\S]*continue-on-error: true/);
  assert.match(workflow, /stack-integration-request:[\s\S]*createWorkflowDispatch/);
  assert.match(fastLane, /trustedStackFastEvidence/);
  assert.match(returned, /stackValidationMatrix/);
  assert.match(returned, /RESCUE_STACK_RECONCILE === 'true'/);
  assert.match(returned, /stack_matrix=/);
  assert.match(workflow, /RESCUE_STACK_RECONCILE: 'true'/);
});
