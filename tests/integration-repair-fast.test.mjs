import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileStackFast, repairReadyStacks, repairValidationMatrix } from '../scripts/integration-repair-fast.mjs';

const repository = 'charukun/soul-lineage';
const sha = char => char.repeat(40);

function pr(number, { body = 'Depends-On: none', draft = false, head = sha(String(number).slice(-1)), mergeable = true, mergeableState = 'behind', labels = [] } = {}) {
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
    head: { ref: `feat/p${number}`, sha: head, repo: { full_name: repository } },
  };
}

test('fast repair touches only current trusted stacked Ready PRs and immediately emits exact-head validation work', async () => {
  const develop = sha('b');
  const stacked = pr(2, { body: 'Depends-On: #1', head: sha('2') });
  const ordinary = pr(3, { body: 'Depends-On: none', head: sha('3') });
  const draft = pr(4, { body: 'Depends-On: #1', draft: true, head: sha('4') });
  const calls = [];
  const c = {
    root: `/repos/${repository}`,
    async pages(path) {
      assert.match(path, /^\/pulls\?/);
      return [ordinary, stacked, draft];
    },
    async api(method, path) {
      assert.equal(method, 'GET');
      if (path.endsWith('/branches/develop')) return { commit: { sha: develop } };
      if (path.endsWith('/pulls/2')) return structuredClone(stacked);
      throw new Error(`unexpected ${method} ${path}`);
    },
  };
  const reconcile = async (_c, current, base, options) => {
    calls.push({ pr: current.number, base, options });
    return { state: 'merged-forward', sha: sha('c'), previousHead: current.head.sha, develop: base, dependencies: [1] };
  };

  const report = await repairReadyStacks(c, repository, { reconcile });
  assert.equal(report.mode, 'FAST_REPAIR');
  assert.equal(report.evaluated, 1);
  assert.deepEqual(calls, [{ pr: 2, base: develop, options: { repository } }]);
  assert.deepEqual(report.matrix, [{ pr: 2, head: sha('c'), base: develop }]);
});

test('fast repair fails closed when develop moves before mutation', async () => {
  const first = sha('a'), moved = sha('b');
  const stacked = pr(7, { body: 'Depends-On: #6', head: sha('7') });
  let branchReads = 0, reconciles = 0;
  const c = {
    root: `/repos/${repository}`,
    async pages() { return [stacked]; },
    async api(method, path) {
      assert.equal(method, 'GET');
      if (path.endsWith('/branches/develop')) return { commit: { sha: branchReads++ === 0 ? first : moved } };
      if (path.endsWith('/pulls/7')) return structuredClone(stacked);
      throw new Error(path);
    },
  };
  const report = await repairReadyStacks(c, repository, { reconcile: async () => { reconciles++; } });
  assert.equal(reconciles, 0);
  assert.deepEqual(report.matrix, []);
  assert.equal(report.results[0].reason, 'DEVELOP_CHANGED_BEFORE_FAST_REPAIR');
});

test('mechanical stack repair explicitly accepts behind but preserves holds, review threads and exact-head fences', async () => {
  const develop = sha('d'), original = sha('a'), repaired = sha('c');
  const stacked = pr(9, { body: 'Depends-On: #8', head: original, mergeableState: 'behind' });
  let pullReads = 0;
  const c = {
    root: `/repos/${repository}`,
    async pages(path) {
      if (path.endsWith('/pulls/9/reviews')) return [];
      throw new Error(path);
    },
    async api(method, path, body) {
      if (path.endsWith('/pulls/8')) return { number: 8, merged: true, base: { ref: 'develop', repo: { full_name: repository } } };
      if (path.endsWith('/pulls/9')) {
        pullReads++;
        return structuredClone(pullReads >= 3 ? { ...stacked, head: { ...stacked.head, sha: repaired } } : stacked);
      }
      if (path.endsWith('/branches/develop')) return { commit: { sha: develop } };
      if (path === '/graphql') return { data: { repository: { pullRequest: { reviewThreads: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } } } };
      if (path.endsWith('/merges')) {
        assert.equal(method, 'POST');
        assert.deepEqual(body, { base: stacked.head.ref, head: develop, commit_message: 'Merge develop into feat/p9 after dependencies #8' });
        return { sha: repaired };
      }
      throw new Error(`${method} ${path}`);
    },
  };
  assert.deepEqual(await reconcileStackFast(c, stacked, develop, { repository }), {
    state: 'merged-forward', sha: repaired, previousHead: original, develop, dependencies: [8],
  });

  const held = pr(10, { body: 'Depends-On: #8', head: sha('1'), labels: ['integration:hold'] });
  const heldClient = {
    root: `/repos/${repository}`,
    async api(method, path) {
      if (path.endsWith('/pulls/8')) return { merged: true, base: { ref: 'develop', repo: { full_name: repository } } };
      if (path.endsWith('/pulls/10')) return structuredClone(held);
      throw new Error(`${method} ${path}`);
    },
    async pages() { throw new Error('reviews must not be fetched after explicit hold'); },
  };
  assert.deepEqual(await reconcileStackFast(heldClient, held, develop, { repository }), { state: 'safety-hold' });
});

test('repair validation matrix rejects malformed or non-repaired entries', () => {
  assert.deepEqual(repairValidationMatrix([
    { pr: 1, state: 'conflict', sha: sha('a'), develop: sha('b') },
    { pr: 2, state: 'merged-forward', sha: 'short', develop: sha('b') },
    { pr: 3, state: 'merged-forward', sha: sha('c'), develop: sha('d') },
  ]), [{ pr: 3, head: sha('c'), base: sha('d') }]);
});

test('a successful merge with stale PR metadata still schedules exact-head validation when the branch ref proves it', async () => {
  const develop=sha('d'), original=sha('a'), repaired=sha('c');
  const stacked=pr(9,{body:'Depends-On: #8',head:original});
  for (const variation of ['lag', 'other-writer', 'stale-ref', 'draft', 'hold', 'body']) {
    let merged=false, refReads=0;
    const c={
      root:`/repos/${repository}`,
      async pages(){return [];},
      async api(method,path){
        if(path.endsWith('/pulls/8'))return {merged:true,base:{ref:'develop',repo:{full_name:repository}}};
        if(path.endsWith('/pulls/9')){
          const value=structuredClone(stacked);
          if(merged){
            if(variation==='other-writer')value.head.sha=sha('e');
            if(variation==='draft')value.draft=true;
            if(variation==='hold')value.labels=[{name:'integration:hold'}];
            if(variation==='body')value.body='Depends-On: #7';
          }
          return value;
        }
        if(path.endsWith('/branches/develop'))return {commit:{sha:develop}};
        if(path==='/graphql')return {data:{repository:{pullRequest:{reviewThreads:{nodes:[],pageInfo:{hasNextPage:false}}}}}};
        if(path.endsWith('/merges')){assert.equal(method,'POST');merged=true;return {sha:repaired};}
        if(path.endsWith('/git/ref/heads/feat/p9')){refReads++;return {object:{type:'commit',sha:variation==='stale-ref'?original:repaired}};}
        throw new Error(`${method} ${path}`);
      },
    };
    const result=await reconcileStackFast(c,stacked,develop,{repository});
    const matrix=repairValidationMatrix([{pr:9,...result}]);
    if(variation==='lag'){
      assert.equal(result.state,'merged-forward');assert.equal(refReads,1);
      assert.deepEqual(matrix,[{pr:9,head:repaired,base:develop}]);
    }else{
      assert.equal(result.state,'changed',variation);assert.deepEqual(matrix,[],variation);
      assert.equal(refReads,variation==='stale-ref'?1:0,variation);
    }
  }
});
