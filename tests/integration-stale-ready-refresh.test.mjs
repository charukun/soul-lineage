import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reconcileNonOverlappingReady,
  refreshStaleReady,
  staleReadyCandidate,
} from '../scripts/integration-stale-ready-refresh.mjs';

const repository = 'charukun/soul-lineage';
const sha = char => char.repeat(40);

function pr(number, { body = 'Depends-On: none', draft = false, head = sha('a'), mergeable = true, mergeableState = 'behind', labels = [] } = {}) {
  return {
    number,
    state: 'open',
    draft,
    body,
    labels: labels.map(name => ({ name })),
    author_association: 'OWNER',
    mergeable,
    mergeable_state: mergeableState,
    base: { ref: 'develop', repo: { full_name: repository } },
    head: { ref: `fix/p${number}`, sha: head, repo: { full_name: repository } },
  };
}

test('stale Ready candidate accepts only trusted dependency-free Ready develop PRs', () => {
  assert.equal(staleReadyCandidate(pr(1), repository), true);
  assert.equal(staleReadyCandidate(pr(2, { body: 'Depends-On: #1' }), repository), false);
  assert.equal(staleReadyCandidate(pr(3, { draft: true }), repository), false);
  assert.equal(staleReadyCandidate(pr(4, { body: 'Depends-On: garbage' }), repository), false);
  const external = pr(5); external.head.repo.full_name = 'someone/fork';
  assert.equal(staleReadyCandidate(external, repository), false);
});

test('dependency-free non-overlapping develop drift is merge-forwarded without force or semantic rewrite', async () => {
  const develop = sha('d'), base = sha('b'), original = sha('a'), repaired = sha('c');
  const current = pr(12, { head: original });
  let merged = false, pullReads = 0;
  const c = {
    root: `/repos/${repository}`,
    async pages(path) {
      if (path.endsWith('/pulls/12/files')) return [{ filename: 'apps/rinne/src/rebuild/runtime.js' }];
      if (path.endsWith('/pulls/12/reviews')) return [];
      throw new Error(`unexpected pages ${path}`);
    },
    async api(method, path, body) {
      if (path.endsWith('/pulls/12')) {
        pullReads++;
        const value = structuredClone(current);
        if (merged && pullReads >= 3) value.head.sha = repaired;
        return value;
      }
      if (path.endsWith(`/compare/${develop}...${original}`)) {
        return { merge_base_commit: { sha: base }, files: [] };
      }
      if (path.endsWith(`/compare/${base}...${develop}`)) {
        return { merge_base_commit: { sha: base }, files: [{ filename: 'apps/demon/src/main.js' }], ahead_by: 1, status: 'ahead' };
      }
      if (path.endsWith('/branches/develop')) return { commit: { sha: develop } };
      if (path === '/graphql') return { data: { repository: { pullRequest: { reviewThreads: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } } } };
      if (path.endsWith('/merges')) {
        assert.equal(method, 'POST');
        assert.deepEqual(body, {
          base: current.head.ref,
          head: develop,
          commit_message: `Merge develop into ${current.head.ref} after non-overlapping develop drift`,
        });
        merged = true;
        return { sha: repaired };
      }
      throw new Error(`unexpected ${method} ${path}`);
    },
  };

  assert.deepEqual(await reconcileNonOverlappingReady(c, current, develop, { repository }), {
    state: 'merged-forward',
    sha: repaired,
    previousHead: original,
    base,
    develop,
    reason: 'non-overlapping-base-refresh',
  });
});

test('overlapping develop drift is never merge-forwarded by stale Ready refresh', async () => {
  const develop = sha('d'), base = sha('b'), original = sha('a');
  const current = pr(13, { head: original });
  let mergeCalls = 0;
  const c = {
    root: `/repos/${repository}`,
    async pages(path) {
      if (path.endsWith('/pulls/13/files')) return [{ filename: 'apps/rinne/src/rebuild/runtime.js' }];
      throw new Error(`unexpected pages ${path}`);
    },
    async api(method, path) {
      if (path.endsWith('/pulls/13')) return structuredClone(current);
      if (path.endsWith(`/compare/${develop}...${original}`)) return { merge_base_commit: { sha: base }, files: [] };
      if (path.endsWith(`/compare/${base}...${develop}`)) {
        return { merge_base_commit: { sha: base }, files: [{ filename: 'apps/rinne/src/rebuild/runtime.js' }], ahead_by: 1, status: 'ahead' };
      }
      if (path.endsWith('/merges')) { mergeCalls++; return { sha: sha('c') }; }
      throw new Error(`unexpected ${method} ${path}`);
    },
  };
  assert.deepEqual(await reconcileNonOverlappingReady(c, current, develop, { repository }), {
    state: 'semantic-overlap', base, develop,
  });
  assert.equal(mergeCalls, 0);
});

test('stale Ready scan is bounded and ignores stacked or Draft PRs', async () => {
  const develop = sha('d');
  const a = pr(20, { head: sha('1') });
  const b = pr(21, { head: sha('2') });
  const stacked = pr(22, { body: 'Depends-On: #20', head: sha('3') });
  const draft = pr(23, { draft: true, head: sha('4') });
  const calls = [];
  const c = {
    root: `/repos/${repository}`,
    async pages(path) {
      assert.match(path, /^\/pulls\?/);
      return [a, stacked, b, draft];
    },
    async api(method, path) {
      assert.equal(method, 'GET');
      if (path.endsWith('/branches/develop')) return { commit: { sha: develop } };
      if (path.endsWith('/pulls/20')) return structuredClone(a);
      if (path.endsWith('/pulls/21')) return structuredClone(b);
      throw new Error(path);
    },
  };
  const report = await refreshStaleReady(c, repository, {
    limit: 1,
    reconcile: async (_c, current, baseSha) => {
      calls.push(current.number);
      return { state: 'merged-forward', sha: sha('c'), previousHead: current.head.sha, develop: baseSha };
    },
  });
  assert.equal(report.refreshed, 1);
  assert.equal(report.evaluated, 1);
  assert.deepEqual(calls, [20]);
});
