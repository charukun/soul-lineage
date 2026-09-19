import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEVELOP_SUCCESS_TERMINAL,
  LEGACY_READY_TERMINAL,
  verifyDevelopCompletionContract,
} from '../scripts/develop-completion-contract.mjs';
import { REPOSITORY, CONTEXTS, json, validateRecord, validateReceipt, loadContext, appendRecord, appendReceipt, persistedReceipt, checkPriorLearning, evaluateMergeGate } from '../.autonomous/lib/contract.mjs';
import { compareReports } from '../.autonomous/lib/probes.mjs';
import { activeExperimentsFromDiff, discoverActiveExperiments, validateActiveExperiments } from '../.autonomous/lib/validation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('develop implementation success terminates only after exact-head merge',async()=>{
  assert.equal(DEVELOP_SUCCESS_TERMINAL,'MERGED_TO_DEVELOP');
  assert.equal(LEGACY_READY_TERMINAL,'READY_FOR_INTEGRATION');
  assert.equal(verifyDevelopCompletionContract(),true);

  // Synthetic negative inputs test the guard; they are NEVER execution receipts.
  const head = '1'.repeat(40), base = '2'.repeat(40), now = Date.parse('2026-09-20T00:00:00Z');
  const snapshot = { fetchedAt: new Date(now).toISOString(), expected: { headSha: head, developSha: base },
    pr: { state: 'open', draft: true, mergeable: true, base: { ref: 'develop' }, head: { sha: head, repo: { full_name: REPOSITORY } }, labels: [] },
    develop: { commit: { sha: base } }, comparison: { merge_base_commit: { sha: base }, behind_by: 0 },
    run: { id: 123, head_sha: head, status: 'completed', conclusion: 'success', event: 'push', path: '.github/workflows/astra-work-validation.yml', head_commit: { message: '[astra-validate]' } },
    statusResponse: { sha: head, statuses: CONTEXTS.map(context => ({ context, state: 'success', created_at: new Date(now).toISOString(), target_url: `https://github.com/${REPOSITORY}/actions/runs/123` })) },
    reviews: [], blockingDependencies: [] };
  assert.equal(evaluateMergeGate(snapshot, { now }).eligible, true);
  assert.equal(evaluateMergeGate(snapshot, { now: now + 120001 }).eligible, false);
  assert.equal(evaluateMergeGate({ ...snapshot, reviews: undefined }, { now }).eligible, false);
  assert.equal(evaluateMergeGate({ ...snapshot, blockingDependencies: [99] }, { now }).eligible, false);
  assert.equal(evaluateMergeGate({ ...snapshot, develop: { commit: { sha: head } } }, { now }).eligible, false);
  assert.equal(evaluateMergeGate({ ...snapshot, pr: { ...snapshot.pr, base: { ref: 'main' } } }, { now }).eligible, false);
  assert.equal(evaluateMergeGate({ ...snapshot, pr: { ...snapshot.pr, head: { ...snapshot.pr.head, sha: base } } }, { now }).eligible, false);
  assert.equal(evaluateMergeGate({ ...snapshot, pr: { ...snapshot.pr, labels: [{ name: 'do-not-merge' }] } }, { now }).eligible, false);
  assert.equal(evaluateMergeGate({ ...snapshot, reviews: [{ user: { login: 'reviewer' }, state: 'CHANGES_REQUESTED' }] }, { now }).eligible, false);
  assert.equal(evaluateMergeGate({ ...snapshot, run: { ...snapshot.run, conclusion: 'failure' } }, { now }).eligible, false);
  assert.equal(evaluateMergeGate({ ...snapshot, statusResponse: { ...snapshot.statusResponse, sha: base } }, { now }).eligible, false);
  assert.equal(evaluateMergeGate({ ...snapshot, statusResponse: { ...snapshot.statusResponse, statuses: [] } }, { now }).eligible, false);

  const record = json(resolve(root, '.autonomous/village/experiments/village-foundation-20260920.json'));
  assert.equal(validateRecord(record), true);
  assert.throws(() => validateRecord({ ...record, selfScore: 10 }), /self-rating/);
  assert.throws(() => validateRecord({ ...record, observation: { summary: 'unsupported', evidence: [] } }), /needs evidence/);
  assert.throws(() => validateRecord({ ...record, comparison: { ...record.comparison, verdict: 'supported', before: true, after: true } }), /revision-bound/);
  const badPath = structuredClone(record); badPath.implementation.paths = ['../main'];
  assert.throws(() => validateRecord(badPath), /unsafe/);
  const feedback = structuredClone(record); feedback.observation.evidence = [{ kind: 'user-feedback', statement: 'reported issue' }];
  assert.throws(() => validateRecord(feedback), /original words/);
  assert.equal(json(resolve(root, '.autonomous/schema/experiment.schema.json')).properties.schemaVersion.const, 1);
  assert.equal(json(resolve(root, '.autonomous/schema/experiment-v2.schema.json')).properties.schemaVersion.const, 2);
  assert.equal(json(resolve(root, '.autonomous/schema/receipt.schema.json')).properties.schemaVersion.const, 2);
  assert.deepEqual(activeExperimentsFromDiff('A\\t.autonomous/village/experiments/village-example-20260920.json\\nM\\tapps/village/src/game/core.js'),[{game:'village',id:'village-example-20260920'}]);

  const temp = mkdtempSync(resolve(tmpdir(), 'autonomous-ledger-'));
  try {
    cpSync(resolve(root, '.autonomous'), resolve(temp, '.autonomous'), { recursive: true });
    const rejected = structuredClone(record); rejected.id = 'rejected-repeat';
    rejected.candidates.forEach(c => { c.selected = c.id === 'full-game-refactor'; });
    assert.throws(() => checkPriorLearning(temp, rejected), /new explicit evidence/);
    assert.throws(() => appendRecord(temp, record), /immutable/);
    const beforeCount = loadContext(temp, 'village').archive.count;
    for (let i = 0; i < 13; i++) {
      const next = structuredClone(record); next.id = `synthetic-history-${i}`;
      next.validation.receipt.marker = `autonomous-receipt:village:${next.id}`;
      appendRecord(temp, next);
    }
    const after = loadContext(temp, 'village');
    assert.equal(after.recent.length, 12);
    assert.ok(after.archive.count > beforeCount);
    assert.equal(json(resolve(temp, '.autonomous/village/experiments/' + record.id + '.json')).learning.doNotRetry.length, record.learning.doNotRetry.length);
    const v2={
      schemaVersion:2,id:'synthetic-v2-ledger',game:'village',mode:'hardening',kind:'gameplay',problemKey:'synthetic-v2-root',
      observation:{summary:'fixed staging-bound observation',staging:{kind:'immutable-staging',sourceSha:base,reference:'artifact:village/web-stage/'+base,observedAt:'2026-09-20T00:00:00Z',conditions:{scenario:'synthetic'},notVerified:[]},evidence:[{kind:'source',revision:base,path:'apps/village/src/game/demography.js',symbol:'planDemographicYear',statement:'synthetic source evidence'}]},
      hypothesis:{cause:'synthetic cause',prediction:'synthetic prediction',falsifier:'synthetic falsifier'},
      candidates:[{id:'small-fix',selected:true,reason:'synthetic selected'},{id:'large-fix',selected:false,reason:'synthetic rejected'}],
      implementation:{paths:['apps/village/src/game/demography.js'],summary:'synthetic implementation'},
      evidencePlan:{objective:'reproducible-causality',focusedTests:['apps/village/tests/demography.test.mjs'],stagingAfter:'optional',limitations:['synthetic only']},
      receipt:{repository:REPOSITORY,pullRequest:123,marker:'autonomous-receipt:village:synthetic-v2-ledger'}
    };
    assert.equal(validateRecord(v2),true);appendRecord(temp,v2);
    const receipt={schemaVersion:2,marker:v2.receipt.marker,repository:REPOSITORY,experimentId:v2.id,game:'village',pullRequest:123,validatedHead:head,validationBase:base,run:{id:123,url:'https://github.com/'+REPOSITORY+'/actions/runs/123',conclusion:'success'},verdict:'supported',learning:{summary:'synthetic learning',failedApproaches:[],doNotRetry:[],unresolved:[],next:[]},merge:{state:'merged',sha:'3'.repeat(40)},notVerified:[]};
    assert.equal(validateReceipt(receipt),true);appendReceipt(temp,receipt);assert.equal(persistedReceipt(temp,'village',v2.id).verdict,'supported');
  } finally { rmSync(temp, { recursive: true, force: true }); }

  const activeExperiments=discoverActiveExperiments(root);
  if(activeExperiments.length){
    const reports = await validateActiveExperiments(root, activeExperiments);
    const { before, after } = reports[0];
    assert.equal(compareReports(after, after).changed, false);
    const otherConditions = structuredClone(after); otherConditions.conditions.seeds = [999];
    assert.throws(() => compareReports(before, otherConditions), /incomparable/);
    const otherHarness = structuredClone(after); otherHarness.harness.sha256 = 'a'.repeat(64);
    assert.throws(() => compareReports(before, otherHarness), /incomparable/);
    const missingMetric = structuredClone(after); delete missingMetric.rows[0].metrics[Object.keys(missingMetric.rows[0].metrics)[0]];
    assert.throws(() => compareReports(before, missingMetric), /metric\/scenario/);
  }
});
