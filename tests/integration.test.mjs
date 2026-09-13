import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dependencies, eligibility, reviewDecision } from '../scripts/integration-policy.mjs';
import { client, fastGate, integrate, recordQueue, trustedReviewPrefix } from '../scripts/integration.mjs';
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
    x => x.files = ['docs/RINNE_PROJECT_EXECUTION_POLICY.md'],
  ];
  for (const mutate of variants) { const x = input(); mutate(x); assert.ok(eligibility(x), mutate.toString()); }
});
test('current maintainer or trusted exact-head bot approval works; requested/stale/fake reviews do not', () => {
  const approval = { id: 1, user: { login: 'reviewer' }, state: 'APPROVED', commit_id: sha, author_association: 'COLLABORATOR' };
  const x = input(); x.files = ['scripts/deploy.mjs']; x.reviews = [approval];
  assert.equal(eligibility(x), null);
  x.reviews = [{ ...approval, commit_id: 'old' }]; assert.ok(eligibility(x));
  x.reviews = [approval, { ...approval, id: 2, state: 'CHANGES_REQUESTED' }]; assert.equal(reviewDecision(x.reviews, sha).rejected, true);
  x.reviews.push({ ...approval, id: 3, state: 'DISMISSED' }); assert.equal(reviewDecision(x.reviews, sha).approved, false);
  const bot = { id: 4, user: { login: 'github-actions[bot]' }, state: 'APPROVED', commit_id: sha, author_association: 'NONE', body: `${trustedReviewPrefix}${sha} verified` };
  x.reviews = [bot]; assert.equal(eligibility(x), null);
  x.reviews = [{ ...bot, commit_id: 'b'.repeat(40) }]; assert.ok(eligibility(x));
  x.reviews = [{ ...bot, body: `Generic approval for ${sha}` }]; assert.ok(eligibility(x));
  x.files = ['packages/world/src/a.js']; x.baseChanges = ['packages/world/src/b.js']; x.reviews = [];
  assert.ok(eligibility(x));
  x.baseChanges = ['packages/audio/src/b.js']; assert.equal(eligibility(x), null);
});
test('dependency parsing fails closed on ambiguous/cross-repository references', () => {
  assert.deepEqual(dependencies('Depends-On: #1, #2\nDepends-On: #1'), [1,2]);
  assert.deepEqual(dependencies('Depends-On: none'), []);
  for (const value of ['', '#2 and #3', 'owner/repo#4', '#2 maybe']) assert.throws(() => dependencies(`Depends-On: ${value}`));
});
function fake({ prs = [candidate(1), candidate(2)], failed = false, moved = false, denied = false, reviewState = null } = {}) {
  let current = 'base'; let reads = 0; const merges = []; const closed = new Map();
  const reviewsByPr = new Map(prs.map(p => [p.number, reviewState ? [{ id: 1, user: {login:'reviewer'}, state: reviewState, commit_id: p.head.sha, author_association:'COLLABORATOR', body:'review' }] : []]));
  const c = {
    root: `/repos/${repository}`,
    async api(method, path, body) {
      if (denied) throw new Error('HTTP 403');
      if (path.endsWith('/branches/develop')) return {commit:{sha:current}};
      if (path === '/graphql') return {data:{repository:{pullRequest:{reviewThreads:{nodes:[],pageInfo:{hasNextPage:false}}}}}};
      if (path.includes('/compare/')) return { merge_base_commit: {sha:current}, files:[] };
      const number = Number(path.match(/\/pulls\/(\d+)/)?.[1]);
      if (method === 'POST' && path.endsWith('/reviews')) {
        const review = { id: 100 + (reviewsByPr.get(number)?.length || 0), user: {login:'github-actions[bot]'},
          state: body.event === 'APPROVE' ? 'APPROVED' : 'COMMENTED', commit_id: body.commit_id,
          author_association:'NONE', body: body.body };
        reviewsByPr.get(number).push(review); return review;
      }
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
      if (path.endsWith('/reviews')) return structuredClone(reviewsByPr.get(Number(path.match(/\/pulls\/(\d+)/)[1])) || []);
      if (key === 'workflow_runs') return prs.map(p=>({id:p.number,head_sha:p.head.sha,head_branch:p.head.ref,head_repository:p.head.repo,event:'pull_request',pull_requests:[]}));
      if (key === 'artifacts') return [{name:`pr-fast-${path.match(/runs\/(\d+)/)[1]}-${sha}`,expired:false}];
      if (key === 'jobs') return [{name:'Validate and build',status:'completed',conclusion:failed?'failure':'success'}];
      if (key === 'check_runs') return [{name:'Request Integration',status:'in_progress'}, {name:'Validate and build',status:'completed',conclusion:'success'}];
      throw new Error(`Unhandled ${path}`);
    },
  };
  return {c,merges,reviewsByPr};
}
test('two eligible PRs batch into one final SHA; own dispatch cannot deadlock', async () => {
  const {c,merges} = fake(); const report = await integrate(c,repository);
  assert.deepEqual(merges,[1,2]); assert.equal(report.sha,'merge2'); assert.equal(report.verified,false); assert.deepEqual(report.held,[]);
});
test('handoff receipt cannot block or replace exact-head build/browser gates', async () => {
  const { c } = fake({ prs: [candidate()] });
  const pages = c.pages.bind(c);
  let browser = { name: 'Affected browser smoke', status: 'completed', conclusion: 'success' };
  c.pages = async (path, key) => {
    const original = await pages(path, key);
    if (path.includes('/statuses')) return [...original, { context: 'implementation/handoff', state: 'pending' }];
    if (key === 'check_runs') return [...original, browser, { name: 'Request Rescue observation', status: 'in_progress' }];
    return original;
  };
  assert.equal(await fastGate(c, candidate()), true);
  browser = { ...browser, status: 'in_progress', conclusion: null };
  assert.equal(await fastGate(c, candidate()), false);
  browser = { ...browser, status: 'completed', conclusion: 'failure' };
  assert.equal(await fastGate(c, candidate()), false);
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
test('workflow privilege separation and publication-only serialization', () => {
  const ci = readFileSync('.github/workflows/ci.yml','utf8'), deploy=readFileSync('.github/workflows/deploy.yml','utf8');
  assert.match(ci,/name: Validate and build/); assert.match(ci,/ref: 'develop'/);
  assert.doesNotMatch(ci,/contents: write|pull-requests: write|workflow_run:|pull_request_target:/);
  assert.doesNotMatch(deploy,/^concurrency:\n\s+group: pages/m);
  assert.match(deploy,/integrate:[\s\S]*?concurrency:\n\s+group: integration-develop\n\s+cancel-in-progress: false/);
  assert.match(deploy,/publish:[\s\S]*?concurrency:\n\s+group: pages\n\s+cancel-in-progress: false/);
  assert.match(deploy,/integration-diagnostics\.json/);
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

test('successful recovery requests another scan; stable held PRs do not loop', async () => {
  const recovery = fake(); const original = recovery.c.pages;
  recovery.c.pages = (p,k) => p.includes('/statuses') ? [{context:'integration/develop',state:'failure'}] : original(p,k);
  const report = await integrate(recovery.c,repository);
  assert.deepEqual(recovery.merges,[]); assert.equal(report.retry,true);
  const held = candidate(); held.labels = [{name:'integration:hold'}];
  const stable = fake({prs:[held]}); const stopped = await integrate(stable.c,repository);
  assert.deepEqual(stable.merges,[]); assert.equal(stopped.retry,false); assert.equal(stopped.verified,true);
});
test('trusted internal control PR is exact-head reviewed then merged without weakening holds', async () => {
  const {c,merges,reviewsByPr} = fake({prs:[candidate()]}); const original=c.pages;
  c.pages=(p,k)=>p.endsWith('/files')?[{filename:'.github/workflows/deploy.yml'}]:original(p,k);
  const result=await integrate(c,repository);
  assert.deepEqual(merges,[1]); assert.deepEqual(result.held,[]); assert.deepEqual(result.trustedReviewed,[{pr:1,head:sha}]);
  assert.equal(reviewsByPr.get(1).length,1); assert.match(reviewsByPr.get(1)[0].body,/Trusted Integration Review/);
  const held=candidate(); held.labels=[{name:'integration:hold'}];
  const blocked=fake({prs:[held]}); const blockedOriginal=blocked.c.pages;
  blocked.c.pages=(p,k)=>p.endsWith('/files')?[{filename:'.github/workflows/deploy.yml'}]:blockedOriginal(p,k);
  const blockedResult=await integrate(blocked.c,repository);
  assert.deepEqual(blocked.merges,[]); assert.equal(blocked.reviewsByPr.get(1).length,0); assert.match(blockedResult.held[0].reason,/hold/);
  const rejected=fake({prs:[candidate()],reviewState:'CHANGES_REQUESTED'}); const rejectedOriginal=rejected.c.pages;
  rejected.c.pages=(p,k)=>p.endsWith('/files')?[{filename:'.github/workflows/deploy.yml'}]:rejectedOriginal(p,k);
  const rejectedResult=await integrate(rejected.c,repository);
  assert.deepEqual(rejected.merges,[]); assert.equal(rejected.reviewsByPr.get(1).length,1); assert.match(rejectedResult.held[0].reason,/requested changes/);
});
test('review wakeups have valid fast evidence and queue status cannot deadlock itself', async () => {
  for (const event of ['pull_request_review']) {
    const {c}=fake(); const original=c.pages;
    c.pages=async(p,k)=> {
      const result=await original(p,k);
      if(k==='workflow_runs') return result.map(r=>({...r,event}));
      if(p.includes('/statuses')) return [...result,{context:'integration/queue',state:'pending'}];
      return result;
    };
    assert.equal(await fastGate(c,candidate()),true);
  }
  const {c}=fake(); const original=c.pages;
  c.pages=async(p,k)=>k==='workflow_runs'?(await original(p,k)).map(r=>({...r,event:'push'})):original(p,k);
  assert.equal(await fastGate(c,candidate()),false);
});
test('transient unknown mergeability settles without another external event', async () => {
  const {c,merges}=fake({prs:[candidate()]}); const original=c.api; let reads=0, waits=0;
  c.api=async(m,p,b)=>{ const result=await original(m,p,b);
    if(m==='GET' && /\/pulls\/1$/.test(p) && ++reads===1) result.mergeable=null;
    return result;
  };
  await integrate(c,repository,async()=>{waits++;});
  assert.equal(waits,1); assert.deepEqual(merges,[1]);
});
test('batch cap resumes remaining work and never merges a draft', async () => {
  const prs=Array.from({length:10},(_,i)=>candidate(i+1)); prs[9].draft=true;
  const {c,merges}=fake({prs}); const report=await integrate(c,repository);
  assert.equal(merges.length,8); assert.equal(report.retry,true); assert.ok(!merges.includes(10));
});
test('held reasons are recorded idempotently without changing PR labels or reviews', async () => {
  const {c}=fake({prs:[candidate()]}); const original=c.api; const posts=[];
  c.api=async(m,p,b)=>{if(m==='POST'){posts.push({p,b}); return {};} return original(m,p,b);};
  const report={held:[{pr:1,reason:'explicit Integration hold'}],merged:[]};
  await recordQueue(c,report,'https://github.com/run');
  assert.equal(posts.length,1); assert.equal(posts[0].b.context,'integration/queue');
  c.pages=async()=>[posts[0].b];
  await recordQueue(c,report,'https://github.com/new-run'); assert.equal(posts.length,1);
});
test('normal DEV delivery excludes full/browser/P2P gates and verifies deployed SHA', () => {
  const workflow=readFileSync('.github/workflows/deploy.yml','utf8');
  const publish=workflow.split('  publish:')[1].split('  result:')[0];
  assert.doesNotMatch(publish,/INTEGRATION_FULL|verify-p2p/);
  assert.match(publish,/verify-live/); assert.match(publish,/github.ref == 'refs\/heads\/main'/); assert.match(workflow,/inputs.full_verification == true/);
  assert.match(workflow,/context: 'verification\/full'/);
  assert.match(readFileSync('scripts/verify-live.mjs','utf8'),/live.validatedDevelop, expected.validatedDevelop/);
});
