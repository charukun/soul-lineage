import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dependencies, eligibility, reviewDecision } from '../scripts/integration-policy.mjs';
import { client, fastGate, integrate } from '../scripts/integration.mjs';
import { preserveProduction } from '../scripts/deploy.mjs';
const repository = 'charukun/soul-lineage';
const sha = 'a'.repeat(40);
function candidate(number = 1) {
  return { number, state: 'open', draft: false, base: { ref: 'develop', repo: { full_name: repository } },
    head: { sha, ref: `work/${number}`, repo: { full_name: repository } }, author_association: 'OWNER',
    labels: [], body: 'Depends-On: none', mergeable: true, mergeable_state: 'clean' };
}
const input = () => ({ pr: candidate(), repository, files: ['apps/rinne/src/main.js'], reviews: [], unresolved: false, dependenciesMerged: true, checksPassed: true });
test('Ready same-repo head passes; every unsafe or indeterminate prerequisite blocks', () => {
  assert.equal(eligibility(input()), null);
  const variants = [
    x => x.pr.draft = true, x => x.pr.base.ref = 'main', x => x.pr.state = 'closed',
    x => x.pr.head.repo.full_name = 'external/fork', x => x.pr.author_association = 'CONTRIBUTOR',
    x => x.pr.labels.push({name:'integration:hold'}), x => x.pr.body = 'Integration-Hold: unresolved design',
    x => x.pr.mergeable = null, x => x.pr.mergeable_state = 'dirty', x => x.pr.mergeable_state = 'blocked',
    x => x.unresolved = true, x => x.dependenciesMerged = false, x => x.checksPassed = false,
    x => x.recovery = true, x => x.files = ['scripts/deploy.mjs'], x => x.baseChanges = [...x.files],
  ];
  for (const mutate of variants) { const x = input(); mutate(x); assert.ok(eligibility(x), mutate.toString()); }
});
test('current maintainer approval, requested changes, stale approval and shared overlap', () => {
  const approval = { id: 1, user: { login: 'reviewer' }, state: 'APPROVED', commit_id: sha, author_association: 'COLLABORATOR' };
  const x = input(); x.files = ['scripts/deploy.mjs']; x.reviews = [approval];
  assert.equal(eligibility(x), null);
  x.reviews = [{ ...approval, commit_id: 'old' }]; assert.ok(eligibility(x));
  x.reviews = [approval, { ...approval, id: 2, state: 'CHANGES_REQUESTED' }]; assert.equal(reviewDecision(x.reviews, sha).rejected, true);
  x.reviews.push({ ...approval, id: 3, state: 'DISMISSED' }); assert.equal(reviewDecision(x.reviews, sha).approved, false);
  x.files = ['packages/world/src/a.js']; x.baseChanges = ['packages/world/src/b.js']; x.reviews = [];
  assert.ok(eligibility(x));
  x.baseChanges = ['packages/audio/src/b.js']; assert.equal(eligibility(x), null);
});
test('dependency parsing fails closed on ambiguous/cross-repository references', () => {
  assert.deepEqual(dependencies('Depends-On: #1, #2\nDepends-On: #1'), [1,2]);
  assert.deepEqual(dependencies('Depends-On: none'), []);
  for (const value of ['', '#2 and #3', 'owner/repo#4', '#2 maybe']) assert.throws(() => dependencies(`Depends-On: ${value}`));
});
function fake({ prs = [candidate(1), candidate(2)], failed = false, moved = false, denied = false } = {}) {
  let current = 'base'; let reads = 0; const merges = []; const closed = new Map();
  const c = {
    root: `/repos/${repository}`,
    async api(method, path, body) {
      if (denied) throw new Error('HTTP 403');
      if (path.endsWith('/branches/develop')) return {commit:{sha:current}};
      if (path === '/graphql') return {data:{repository:{pullRequest:{reviewThreads:{nodes:[],pageInfo:{hasNextPage:false}}}}}};
      if (path.includes('/compare/')) return { merge_base_commit: {sha:current}, files:[] };
      const number = Number(path.match(/\/pulls\/(\d+)/)?.[1]);
      if (method === 'PUT') {
        assert.ok(path.endsWith('/merge')); assert.equal(body.sha, sha); assert.equal(body.merge_method, 'merge');
        merges.push(number); closed.set(number,{...prs.find(p => p.number === number),merged:true,state:'closed'}); current = `merge${number}`;
        return {merged:true,sha:current};
      }
      const pr = structuredClone(closed.get(number) || prs.find(p => p.number === number));
      if (moved && ++reads >= 2) pr.head.sha = 'new-head';
      return pr;
    },
    async pages(path, key) {
      if (path.startsWith('/pulls?')) return prs;
      if (path.includes('/statuses')) return current === 'base' ? [{context:'integration/develop',state:'success'}] : [];
      if (path.endsWith('/files')) return [{filename:`docs/feature-${path.match(/\d+/)[0]}.md`}];
      if (path.endsWith('/reviews')) return [];
      if (key === 'workflow_runs') return prs.map(p=>({id:p.number,head_sha:p.head.sha,head_branch:p.head.ref,head_repository:p.head.repo,pull_requests:[]}));
      if (key === 'artifacts') return [{name:`pr-fast-${path.match(/runs\/(\d+)/)[1]}-${sha}`,expired:false}];
      if (key === 'jobs') return [{name:'Validate and build',status:'completed',conclusion:failed?'failure':'success'}];
      if (key === 'check_runs') return [{name:'Request Integration',status:'in_progress'}, {name:'Validate and build',status:'completed',conclusion:'success'}];
      throw new Error(`Unhandled ${path}`);
    },
  };
  return {c,merges};
}
test('two eligible PRs batch into one final SHA; own dispatch cannot deadlock', async () => {
  const {c,merges} = fake(); const report = await integrate(c,repository);
  assert.deepEqual(merges,[1,2]); assert.equal(report.sha,'merge2'); assert.equal(report.verified,false); assert.deepEqual(report.held,[]);
});
test('dependencies are revisited after their predecessor merges', async () => {
  const first = candidate(1); first.body = 'Depends-On: #2';
  const {c,merges} = fake({prs:[first,candidate(2)]}); await integrate(c,repository);
  assert.deepEqual(merges,[2,1]);
});
test('failed/missing fast gate, moved head and API denial cannot merge', async () => {
  for (const options of [{failed:true},{moved:true}]) { const {c,merges}=fake(options); await integrate(c,repository); assert.deepEqual(merges,[]); }
  const {c,merges}=fake({denied:true}); await assert.rejects(integrate(c,repository)); assert.deepEqual(merges,[]);
  const missing = fake(); const original=missing.c.pages; missing.c.pages=(p,k)=>k==='artifacts'?[]:original(p,k);
  assert.equal(await fastGate(missing.c,candidate()),false);
});
test('an already verified final SHA is reused', async () => {
  const {c}=fake({prs:[]}); assert.equal((await integrate(c,repository)).verified,true);
});
test('DEV-only deploy retains complete Production manifest, refusing a missing baseline', () => {
  const production = { environment:'prod',path:'prod',inputHash:'original',files:[{sha256:'original-bytes'}],version:{commit:'main-sha'} };
  const result=preserveProduction([{environment:'dev'}, {...production,inputHash:'changed'}],{entries:[production]},true);
  assert.equal(result[1],production); assert.equal(result.length,2);
  assert.throws(()=>preserveProduction([],{entries:[]},true));
});
test('workflow privilege separation and no default-branch-only trigger', () => {
  const ci = readFileSync('.github/workflows/ci.yml','utf8'), deploy=readFileSync('.github/workflows/deploy.yml','utf8');
  assert.match(ci,/name: Validate and build/); assert.match(ci,/ref: 'develop'/);
  assert.doesNotMatch(ci,/contents: write|pull-requests: write|workflow_run:|pull_request_target:/);
  assert.match(deploy,/group: pages\n  cancel-in-progress: false/);
  assert.match(deploy,/ref: \$\{\{ needs.integrate.outputs.sha/);
  assert.match(deploy,/DEPLOY_DEV_ONLY:/); assert.match(deploy,/Record final develop result/);
  assert.doesNotMatch(deploy,/ref: main[\s\S]*persist-credentials: true/);
});

test('unverified baseline is verified before any automatic merge and requests another scan', async () => {
  const {c,merges}=fake(); const original=c.pages; c.pages=(p,k)=>p.includes('/statuses')?[]:original(p,k);
  const report=await integrate(c,repository); assert.deepEqual(merges,[]); assert.equal(report.retry,true); assert.equal(report.verified,false);
});
test('failed final baseline holds ordinary PRs but allows a verified repair', async () => {
  const pr=candidate(); pr.labels=[{name:'integration:repair'}];
  const {c,merges}=fake({prs:[pr,candidate(2)]}); const original=c.pages;
  c.pages=(p,k)=>p.includes('/statuses')?[{context:'integration/develop',state:'failure'}]:original(p,k);
  const report=await integrate(c,repository); assert.deepEqual(merges,[1]); assert.equal(report.verified,false);
});
