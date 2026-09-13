import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handoffSnapshot, recordHandoff, notifyStage, WORKER_CI_RULES } from '../scripts/implementation-handoff.mjs';
import { deliveryMessage } from '../scripts/notify-delivery.mjs';
import { sensitive } from '../scripts/integration-policy.mjs';
import { buildDispatchPrompt } from '../scripts/rinne-dispatch-prompt.mjs';
import { workerPrompt } from '../scripts/integration-rescue-worker.mjs';
import { compactPull } from '../ops-board/pulls.mjs';
import { classifyPull } from '../ops-board/model.mjs';

const repository = 'charukun/soul-lineage', sha = 'a'.repeat(40);
const pull = () => ({ number: 129, title: 'No CI waiting', state: 'open', draft: false, author_association: 'OWNER',
  html_url: `https://github.com/${repository}/pull/129`, labels: [], body: 'Title\nDetail',
  base: { ref: 'develop' }, head: { ref: 'work/handoff', sha, repo: { full_name: repository } } });
function fixture({ changeOnSecondRead, notificationFailure = false } = {}) {
  let pr = pull(), reads = 0, sent = 0;
  const comments = [], statuses = [];
  const github = { rest: {
    pulls: { get: async () => { if (++reads === 2) changeOnSecondRead?.(pr); return { data: structuredClone(pr) }; } },
    repos: { createCommitStatus: async status => statuses.push(status) },
    issues: {
      listComments: async () => ({ data: structuredClone(comments) }),
      createComment: async ({ body }) => comments.push({ id: 1, user: { login: 'github-actions[bot]' }, body }),
      updateComment: async ({ body }) => { comments[0].body = body; },
    },
    // Any Actions access throws: CI can remain Running forever without affecting handoff.
    actions: new Proxy({}, { get: () => { throw new Error('CI completion must not be read'); } }),
  } };
  const options = { github, repo: { owner: 'charukun', repo: 'soul-lineage' }, number: 129, expectedHead: sha,
    runUrl: 'https://github.com/charukun/soul-lineage/actions/runs/123', notification: {
      url: 'https://ntfy.example/configured-topic', request: async () => { sent++; return { ok: !notificationFailure, status: 503 }; },
    } };
  return { options, comments, statuses, sent: () => sent };
}

test('Ready hands off immediately even if Actions/browser never complete; same head receipt deduplicates notification', { timeout: 1000 }, async () => {
  const f = fixture();
  const result = await recordHandoff(f.options);
  assert.equal(result.stage, 'READY_FOR_INTEGRATION');
  assert.equal(result.workerEnded, true);
  assert.equal(result.monitoringOwner, 'Integration');
  assert.equal(f.statuses[0].sha, sha);
  assert.equal(f.statuses[0].context, 'implementation/handoff');
  assert.match(f.comments[0].body, /Ready for review: true/);
  assert.match(f.comments[0].body, /not CI success/);
  await recordHandoff(f.options);
  assert.equal(f.comments.length, 1);
  assert.equal(f.sent(), 1);
});

test('Draft, stale head, wrong base, closed, foreign, untrusted and independent Lab are never received', async () => {
  for (const mutate of [p => p.draft = true, p => p.state = 'closed', p => p.base.ref = 'main',
    p => p.head.sha = 'b'.repeat(40), p => p.head.repo.full_name = 'external/fork',
    p => p.author_association = 'CONTRIBUTOR', p => p.head.ref = 'work/visual-review-lab-v2']) {
    const p = pull(); mutate(p);
    assert.equal(handoffSnapshot(p, repository, sha), null);
    const f = fixture({ changeOnSecondRead: mutate });
    assert.deepEqual(await recordHandoff(f.options), { skipped: true });
    assert.equal(f.statuses.length, 0);
    assert.equal(f.sent(), 0);
  }
});

test('explicit hold is retained while responsibility transfers; receipt never grants merge authorization', async () => {
  const p = pull(); p.labels = [{ name: 'integration:hold' }];
  assert.equal(handoffSnapshot(p, repository, sha).stage, 'READY_FOR_INTEGRATION');
  assert.equal(classifyPull(p).stage, 'HOLD');
  assert.equal(classifyPull(p).monitoringOwner, 'Integration');
});

test('failed or absent external notification does not masquerade as delivery or prevent handoff', async () => {
  const f = fixture({ notificationFailure: true });
  const result = await recordHandoff(f.options);
  assert.equal(result.notification, 'failed');
  assert.equal(result.stage, 'READY_FOR_INTEGRATION');
  assert.match(f.comments[0].body, /notification: failed/);
  f.options.notification = {};
  const next = await recordHandoff(f.options);
  assert.equal(next.notification, 'not-configured');
  assert.equal(f.comments.length, 1);
  assert.equal(await notifyStage('message'), 'not-configured');
  await assert.rejects(notifyStage('message', { url: 'http://invalid/topic' }), /HTTPS_REQUIRED/);
});

test('delivery stages are distinct and no-merge scans do not emit integrated success', () => {
  const input = { sha, repository, runUrl: 'https://github.com/run', report: { merged: [] } };
  assert.equal(deliveryMessage('INTEGRATED', input), null);
  input.report.merged.push({ pr: 129, merge: sha });
  assert.match(deliveryMessage('INTEGRATED', input), /\nINTEGRATED\n/);
  assert.match(deliveryMessage('DEV_DEPLOYED', input), /\nDEV_DEPLOYED\n/);
  assert.throws(() => deliveryMessage('DEV_DEPLOYED', { ...input, sha: undefined }), /INVALID/);
});

test('generated Dispatch and Rescue prompts share mandatory no-wait contract above task data', () => {
  const prompt = buildDispatchPrompt({ repository, number: 129, head: 'dispatch/x', base: 'develop',
    body: 'Title\nDetail\nRINNE-Dispatch: implementation\n\n## Request\nDo work' });
  const rescue = workerPrompt({ pr: 129, scope: { files: [] } }, pull(), []);
  for (const value of [prompt, rescue]) {
    assert.ok(value.includes(WORKER_CI_RULES));
    assert.match(value, /Running \/ Queued \/ Pending means hand off without waiting/);
  }
  assert.ok(prompt.indexOf(WORKER_CI_RULES) < prompt.indexOf('<rinne_request>'));
  assert.ok(rescue.indexOf(WORKER_CI_RULES) < rescue.indexOf('untrusted task DATA'));
});

test('PULSE exposes owner without adding worker heartbeat alerts after Ready, including indefinitely running CI', () => {
  const p = pull(); p.updated_at = '2020-01-01T00:00:00Z';
  const ready = compactPull(p);
  assert.equal(ready.deliveryStage, 'READY_FOR_INTEGRATION');
  assert.equal(ready.workerEnded, true);
  assert.equal(ready.staleDraft, false);
  const ci = classifyPull(p, [{ name: 'CI', head_sha: sha, status: 'in_progress' }]);
  assert.equal(ci.monitoringOwner, 'Integration');
  assert.equal(ci.workerEnded, true);
  p.draft = true;
  assert.equal(compactPull(p).workerEnded, false);
  assert.equal(compactPull(p).staleDraft, true);
});

test('workflow boundary is independent of build/browser; Dispatch ends after Ready without monitoring', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  const immediate = ci.split('  request-rescue:')[1].split('  draft-check:')[0];
  assert.doesNotMatch(immediate, /needs:/);
  assert.match(immediate, /ref: develop/);
  assert.match(immediate, /recordHandoff/);
  assert.match(immediate, /workflow_id: 'deploy.yml'.*rescue_mode: 'scan'/);
  const dispatch = readFileSync('.github/workflows/rinne-dispatch.yml', 'utf8');
  assert.match(dispatch, /secrets.DISPATCH_GITHUB_TOKEN \|\| secrets.RESCUE_GITHUB_TOKEN/);
  assert.ok(dispatch.indexOf('gh pr ready') < dispatch.indexOf("echo 'handed_off=true'"));
  assert.match(dispatch, /if: failure\(\) && steps.ready.outputs.handed_off != 'true'/);
  assert.doesNotMatch(dispatch, /gh run watch|gh pr checks|sleep\s|gh api[^\n]*actions\/runs/);
  assert.equal(sensitive('docs/RINNE_PROJECT_EXECUTION_POLICY.md'), true);
});
