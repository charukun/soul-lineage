import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exactHeadFastGate } from '../scripts/integration-fast-lane.mjs';

const sha = 'a'.repeat(40);
const pr = {
  number: 275,
  head: { sha, ref: 'fix/example', repo: { full_name: 'charukun/soul-lineage' } },
};

function fakeClient({ artifact = true, build = 'success', browser = 'failure' } = {}) {
  return {
    async pages(path, key) {
      if (path.startsWith('/actions/workflows/ci.yml/runs')) {
        return [{
          id: 11,
          event: 'pull_request',
          display_title: 'CI validation',
          head_sha: sha,
          head_branch: 'fix/example',
          head_repository: { full_name: 'charukun/soul-lineage' },
        }];
      }
      if (path === '/actions/runs/11/artifacts') {
        return artifact ? [{ name: `pr-fast-275-${sha}`, expired: false }] : [];
      }
      if (path === '/actions/runs/11/jobs?filter=latest') {
        return [
          { name: 'Validate and build', status: 'completed', conclusion: build },
          { name: 'Affected browser smoke', status: 'completed', conclusion: browser },
        ];
      }
      if (path.endsWith('/statuses')) return [];
      throw new Error(`Unexpected pages route ${path} ${key || ''}`);
    },
  };
}

test('exact-head Fast Lane accepts successful build artifact even when browser smoke failed', async () => {
  assert.equal(await exactHeadFastGate(fakeClient(), pr), true);
});

test('exact-head Fast Lane rejects missing artifact or failed build', async () => {
  assert.equal(await exactHeadFastGate(fakeClient({ artifact: false }), pr), false);
  assert.equal(await exactHeadFastGate(fakeClient({ build: 'failure' }), pr), false);
});

test('CI wakes Integration from build without waiting for browser', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  const request = ci.split('  integration-request:')[1]?.split('\n  browser:')[0] || '';
  assert.match(request, /needs: \[readiness, build\]/);
  assert.match(request, /needs\.build\.result == 'success'/);
  assert.doesNotMatch(request, /needs\.browser/);
});

test('Fast Lane has no develop-delivery global lock and keeps expected-head serialization', () => {
  const source = readFileSync('scripts/integration-fast-lane.mjs', 'utf8');
  const controller = readFileSync('.github/workflows/integration-controller.yml', 'utf8');
  assert.doesNotMatch(source, /integration\/develop/);
  assert.doesNotMatch(source, /activeDevelopVerification/);
  assert.match(source, /sha: fresh\.head\.sha/);
  assert.match(source, /develop moved outside this Fast Lane batch/);
  assert.match(controller, /group: integration-controller-develop/);
  assert.match(controller, /cancel-in-progress: false/);
  assert.doesNotMatch(controller, /virtual-train:/);
});

test('Fast Lane reuses complete fail-closed tree comparison instead of holding every 300-file base drift', () => {
  const source = readFileSync('scripts/integration-fast-lane.mjs', 'utf8');
  assert.match(source, /comparison as completeComparison/);
  assert.match(source, /completeComparison\(c, base, expected\)/);
  assert.match(source, /baseChanges: baseComparison\.files/);
  assert.doesNotMatch(source, /Large base comparison needs manual Integration review/);
});

test('DEV coalescer only cancels stale push publishers and keeps Production gates', () => {
  const coalescer = readFileSync('.github/workflows/dev-publisher-coalescer.yml', 'utf8');
  const deploy = readFileSync('.github/workflows/deploy.yml', 'utf8');
  assert.match(coalescer, /run\.event === 'push' && run\.head_sha !== latestSha/);
  assert.match(coalescer, /workflow_id: 'deploy\.yml'/);
  assert.match(deploy, /Preserve blocking Production browser verification/);
  assert.match(deploy, /github\.ref == 'refs\/heads\/main'/);
});
