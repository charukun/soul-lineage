import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reconcileStackFast } from '../scripts/integration-repair-fast.mjs';
import { dependencyState } from '../scripts/integration-dependency-state.mjs';
import { eligibility } from '../scripts/integration-policy.mjs';

const repository = 'charukun/soul-lineage';
const sha = char => char.repeat(40);

function stackedPr(head) {
  return {
    number: 9,
    state: 'open',
    draft: false,
    body: 'Depends-On: #8',
    labels: [],
    author_association: 'OWNER',
    mergeable: true,
    mergeable_state: 'behind',
    base: { ref: 'develop', repo: { full_name: repository } },
    head: { ref: 'work/stacked', sha: head, repo: { full_name: repository } },
  };
}

test('dependency ancestry becomes idempotent after the first merge-forward', async () => {
  const develop = sha('d');
  const dependencyMerge = sha('8');
  const original = sha('a');
  const repaired = sha('c');
  let currentHead = original;
  let mergePushes = 0;
  const c = {
    root: `/repos/${repository}`,
    async pages(path) {
      if (path.endsWith('/pulls/9/reviews')) return [];
      throw new Error(`unexpected pages ${path}`);
    },
    async api(method, path, body) {
      if (path.endsWith('/pulls/8')) {
        return {
          number: 8,
          merged: true,
          merge_commit_sha: dependencyMerge,
          base: { ref: 'develop', repo: { full_name: repository } },
        };
      }
      if (path.endsWith('/pulls/9')) return stackedPr(currentHead);
      if (path.includes(`/compare/${dependencyMerge}...`)) {
        return { status: currentHead === repaired ? 'ahead' : 'diverged' };
      }
      if (path.endsWith('/branches/develop')) return { commit: { sha: develop } };
      if (path === '/graphql') {
        return { data: { repository: { pullRequest: { reviewThreads: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } } } };
      }
      if (path.endsWith('/merges')) {
        assert.equal(method, 'POST');
        assert.deepEqual(body, {
          base: 'work/stacked',
          head: develop,
          commit_message: 'Merge develop into work/stacked after dependencies #8',
        });
        mergePushes++;
        currentHead = repaired;
        return { sha: repaired };
      }
      throw new Error(`unexpected ${method} ${path}`);
    },
  };

  const first = await reconcileStackFast(c, stackedPr(original), develop, { repository });
  assert.equal(first.state, 'merged-forward');
  assert.equal(mergePushes, 1);

  const second = await reconcileStackFast(c, stackedPr(repaired), develop, { repository });
  assert.deepEqual(second, { state: 'dependency-current', dependencies: [8] });
  assert.equal(mergePushes, 1, 'later scans must not push the branch again');
});

test('dependency state fails closed until the declared merge commit is in head ancestry', async () => {
  const dependencyMerge = sha('8');
  const head = sha('9');
  let status = 'diverged';
  const pr = stackedPr(head);
  const c = {
    root: `/repos/${repository}`,
    async api(method, path) {
      assert.equal(method, 'GET');
      if (path.endsWith('/pulls/8')) {
        return { merged: true, merge_commit_sha: dependencyMerge, base: { ref: 'develop', repo: { full_name: repository } } };
      }
      if (path.includes(`/compare/${dependencyMerge}...${head}`)) return { status };
      throw new Error(path);
    },
  };

  assert.deepEqual(await dependencyState(c, pr), { numbers: [8], merged: true, incorporated: false, missing: [8] });
  status = 'ahead';
  assert.deepEqual(await dependencyState(c, pr), { numbers: [8], merged: true, incorporated: true, missing: [] });
});

test('Fast Lane may accept a behind PR only after dependency ancestry is current', () => {
  const pr = stackedPr(sha('9'));
  const input = {
    pr,
    repository,
    files: ['packages/world/src/example.js'],
    reviews: [],
    unresolved: false,
    dependenciesMerged: true,
    dependenciesCurrent: false,
    checksPassed: true,
    baseChanges: ['packages/audio/src/unrelated.js'],
  };
  assert.equal(eligibility(input), 'dependency merge-forward required');
  assert.equal(eligibility({ ...input, dependenciesCurrent: true }), null);
});

test('Fast Lane routes missing dependency ancestry before CI failure handoff', () => {
  const source = readFileSync('scripts/integration-fast-lane.mjs', 'utf8');
  const dependencyGuard = source.indexOf("if (!dependency.incorporated");
  const ciFailureGate = source.indexOf('if (!checksPassed)');
  assert.ok(dependencyGuard >= 0);
  assert.ok(ciFailureGate > dependencyGuard);
});
