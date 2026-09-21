import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindImmutableVersion,isolatedPublicationPlan,nextIteration,verifyImmutableVersion} from '../scripts/autonomous-run-controller.mjs';

const SHA='0123456789abcdef0123456789abcdef01234567';
const VERSION='12345678-1234-1234-1234-123456789abc';

test('publication plan pins exact source and reuses the existing per-app DEV workflow',()=>{
  const plan=isolatedPublicationPlan({game:'kuumetsu',sourceSha:SHA,runKey:'run-20260921-a',iteration:2,iterations:3,phase:'before'});
  assert.equal(plan.app,'demon');
  assert.equal(plan.sourceSha,SHA);
  assert.equal(plan.dispatch.workflow,'dev-app-publish.yml');
  assert.deepEqual(plan.dispatch.inputs,{app:'demon',source_sha:SHA});
  assert.equal(plan.dispatch.retrySameSourceIfCancelled,true);
  assert.equal(plan.isolation.mutableLatestDevForbidden,true);
});

test('immutable Cloudflare version preview is bound after publication',()=>{
  const plan=isolatedPublicationPlan({game:'village',sourceSha:SHA,runKey:'village-run',iteration:1,iterations:1,phase:'after'});
  const staged=bindImmutableVersion({plan,versionId:VERSION});
  assert.equal(staged.reference,'https://12345678-soul-lineage-village-dev.c-okamoto.workers.dev/');
  assert.equal(staged.verifiedSourceSha,SHA);
  assert.equal(staged.immutable,true);
});

test('immutable preview verification rejects source drift and emits experiment-ready observation',async()=>{
  const plan=isolatedPublicationPlan({game:'kuumetsu',sourceSha:SHA,runKey:'verify-run',phase:'before'});
  const binding=bindImmutableVersion({plan,versionId:VERSION});
  const verified=await verifyImmutableVersion({
    binding,
    observedAt:'2026-09-22T00:00:00.000Z',
    conditions:{viewport:'673x841'},
    notVerified:['physical device'],
    fetchImpl:async url=>({
      ok:true,
      async json(){
        assert.equal(url,'https://12345678-soul-lineage-demon-dev.c-okamoto.workers.dev/version.json');
        return {commit:SHA,environment:'dev'};
      },
    }),
  });
  assert.equal(verified.sourceSha,SHA);
  assert.equal(verified.verification.commit,SHA);
  assert.equal(verified.verification.matched,true);
  assert.equal(verified.reference,binding.reference);
  assert.equal(verified.phase,'before');
  assert.deepEqual(verified.conditions,{viewport:'673x841'});
  await assert.rejects(
    ()=>verifyImmutableVersion({binding,fetchImpl:async()=>({ok:true,json:async()=>({commit:'f'.repeat(40)})})}),
    /version\.json\.commit mismatch/
  );
});

test('next iteration is serial and starts from the previous merge SHA',()=>{
  const state=isolatedPublicationPlan({game:'village',sourceSha:SHA,runKey:'serial-run',iteration:1,iterations:3,phase:'after'});
  const mergeSha='abcdef0123456789abcdef0123456789abcdef01';
  const next=nextIteration({state,mergeSha});
  assert.equal(next.iteration,2);
  assert.equal(next.phase,'before');
  assert.equal(next.sourceSha,mergeSha);
  assert.equal(next.runKey,'serial-run');
});

test('existing DEV workflow supports exact source dispatch without changing its push lane',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/dev-app-publish.yml',import.meta.url),'utf8');
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/source_sha:/);
  assert.match(workflow,/ref:\s*\$\{\{ inputs\.source_sha \|\| github\.sha \}\}/);
  assert.match(workflow,/wrangler@4 deploy/);
  assert.match(workflow,/verify-published-app/);
});

test('controller requires immutable version previews for evidence',()=>{
  const source=readFileSync(new URL('../scripts/autonomous-run-controller.mjs',import.meta.url),'utf8');
  assert.match(source,/cloudflare-worker-version-preview/);
  assert.match(source,/mutableLatestDevForbidden:true/);
  assert.match(source,/workerPreviewUrl/);
});
