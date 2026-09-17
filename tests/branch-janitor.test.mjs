import test from 'node:test';
import assert from 'node:assert/strict';
import {
  branchCandidate,
  cleanMergedBranches,
  shortLivedBranch,
} from '../scripts/branch-janitor.mjs';

const repository = 'charukun/soul-lineage';
const sha = char => char.repeat(40);

const branch = (name, commit = sha('a'), extra = {}) => ({ name, commit: { sha: commit }, protected: false, ...extra });

test('branch candidate keeps reserved, protected, open-PR and non-short-lived branches', () => {
  assert.equal(shortLivedBranch('fix/old-work'), true);
  assert.equal(shortLivedBranch('automation/integration-rescue-state'), false);
  assert.equal(branchCandidate(branch('develop'), { defaultBranch: 'develop' }).eligible, false);
  assert.equal(branchCandidate(branch('main'), { defaultBranch: 'develop' }).eligible, false);
  assert.equal(branchCandidate(branch('fix/live', sha('a'), { protected: true }), { defaultBranch: 'develop' }).eligible, false);
  assert.equal(branchCandidate(branch('fix/live'), { defaultBranch: 'develop', openHeads: new Set(['fix/live']) }).eligible, false);
  assert.equal(branchCandidate(branch('dcc/evidence'), { defaultBranch: 'develop' }).eligible, false);
  assert.equal(branchCandidate(branch('fix/merged'), { defaultBranch: 'develop' }).eligible, true);
});

test('dry-run reports only fully merged branches with merged-PR proof and no branch evidence URL', async () => {
  const develop = sha('d'), merged = sha('a'), unmerged = sha('b'), linked = sha('c');
  const branches = [branch('develop', develop), branch('fix/merged', merged), branch('fix/unmerged', unmerged), branch('docs/linked', linked)];
  const c = {
    root: `/repos/${repository}`,
    async pages(path) {
      if (path === '/branches?per_page=100') return branches;
      if (path === '/pulls?state=open&per_page=100') return [];
      if (path.includes('state=closed') && path.includes(encodeURIComponent('charukun:fix/merged'))) {
        return [{ number: 10, merged_at: '2026-09-17T00:00:00Z', body: 'merged cleanup' }];
      }
      if (path.includes('state=closed') && path.includes(encodeURIComponent('charukun:docs/linked'))) {
        return [{ number: 11, merged_at: '2026-09-17T00:00:00Z', body: 'evidence https://github.com/charukun/soul-lineage/blob/docs/linked/report.md' }];
      }
      if (path.includes('state=closed')) return [];
      throw new Error(`unexpected pages ${path}`);
    },
    async api(method, path) {
      assert.equal(method, 'GET');
      if (path === `/repos/${repository}`) return { default_branch: 'develop' };
      if (path.endsWith('/branches/develop')) return { commit: { sha: develop } };
      if (path.endsWith(`/compare/${merged}...${develop}`)) return { merge_base_commit: { sha: merged } };
      if (path.endsWith(`/compare/${unmerged}...${develop}`)) return { merge_base_commit: { sha: sha('e') } };
      if (path.endsWith(`/compare/${linked}...${develop}`)) return { merge_base_commit: { sha: linked } };
      throw new Error(`unexpected ${method} ${path}`);
    },
  };
  const report = await cleanMergedBranches(c, repository, { apply: false });
  assert.deepEqual(report.candidates, [{ branch: 'fix/merged', sha: merged, mergedPrs: [10] }]);
  assert.ok(report.skipped.some(item => item.branch === 'fix/unmerged' && item.reason === 'not-contained-in-develop'));
  assert.ok(report.skipped.some(item => item.branch === 'docs/linked' && item.reason === 'branch-linked-evidence-in-pr-body'));
});

test('apply rechecks branch ref, open PR, merged proof and develop containment immediately before delete', async () => {
  const develop = sha('d'), merged = sha('a');
  const deleted = [];
  const c = {
    root: `/repos/${repository}`,
    async pages(path) {
      if (path === '/branches?per_page=100') return [branch('fix/merged', merged)];
      if (path === '/pulls?state=open&per_page=100') return [];
      if (path.includes('state=open&head=')) return [];
      if (path.includes('state=closed&head=')) return [{ number: 20, merged_at: '2026-09-17T00:00:00Z', body: 'safe merged PR' }];
      throw new Error(`unexpected pages ${path}`);
    },
    async api(method, path) {
      if (path === `/repos/${repository}`) return { default_branch: 'develop' };
      if (path.endsWith('/branches/develop')) return { commit: { sha: develop } };
      if (path.endsWith(`/compare/${merged}...${develop}`)) return { merge_base_commit: { sha: merged } };
      if (path.endsWith('/git/ref/heads/fix/merged')) return { object: { type: 'commit', sha: merged } };
      if (method === 'DELETE' && path.endsWith('/git/refs/heads/fix/merged')) { deleted.push(path); return null; }
      throw new Error(`unexpected ${method} ${path}`);
    },
  };
  const report = await cleanMergedBranches(c, repository, { apply: true });
  assert.equal(report.deleted.length, 1);
  assert.deepEqual(deleted, [`/repos/${repository}/git/refs/heads/fix/merged`]);
});

test('apply never deletes a branch that gains an open PR before mutation', async () => {
  const develop = sha('d'), merged = sha('a');
  let deleteCalls = 0;
  const c = {
    root: `/repos/${repository}`,
    async pages(path) {
      if (path === '/branches?per_page=100') return [branch('fix/merged', merged)];
      if (path === '/pulls?state=open&per_page=100') return [];
      if (path.includes('state=open&head=')) return [{ number: 30 }];
      if (path.includes('state=closed&head=')) return [{ number: 31, merged_at: '2026-09-17T00:00:00Z', body: 'safe merged PR' }];
      throw new Error(`unexpected pages ${path}`);
    },
    async api(method, path) {
      if (path === `/repos/${repository}`) return { default_branch: 'develop' };
      if (path.endsWith('/branches/develop')) return { commit: { sha: develop } };
      if (path.endsWith(`/compare/${merged}...${develop}`)) return { merge_base_commit: { sha: merged } };
      if (path.endsWith('/git/ref/heads/fix/merged')) return { object: { type: 'commit', sha: merged } };
      if (method === 'DELETE') { deleteCalls++; return null; }
      throw new Error(`unexpected ${method} ${path}`);
    },
  };
  const report = await cleanMergedBranches(c, repository, { apply: true });
  assert.equal(deleteCalls, 0);
  assert.ok(report.skipped.some(item => item.reason === 'open-pr-head-at-delete'));
});
