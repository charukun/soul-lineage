import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectCompletionEvidence, evidenceHtml, evidenceMarkdown } from '../scripts/completion-evidence.mjs';
import { recordCompletionEvidence } from '../scripts/completion-evidence-receipt.mjs';

const sha = 'a'.repeat(40), repository = 'charukun/soul-lineage';
// Unit fixture, never published as user evidence.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVxkAAAAASUVORK5CYII=', 'base64');
function workspace(t) {
  const directory = mkdtempSync(join(tmpdir(), 'completion-evidence-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function collect(directory, extra = {}) {
  return collectCompletionEvidence({ directory, head: sha, result: 'success', environment: 'local PR preview', scenario: 'test fixture', ...extra });
}

test('indexes actual media bytes with checksums; ignores empty, spoofed, symlinked and non-media files', t => {
  const directory = workspace(t);
  mkdirSync(join(directory, 'nested'));
  writeFileSync(join(directory, 'nested', 'capture.png'), png);
  writeFileSync(join(directory, 'empty.mp4'), '');
  writeFileSync(join(directory, 'fake.png'), '<svg>not a PNG</svg>');
  writeFileSync(join(directory, 'notes.txt'), 'private output');
  symlinkSync(join(directory, 'notes.txt'), join(directory, 'secret.png'));
  const report = collect(directory);
  assert.equal(report.state, 'captured');
  assert.equal(report.media.length, 1);
  assert.equal(report.media[0].path, 'nested/capture.png');
  assert.match(report.media[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(report.media[0].bytes, png.length);
  assert.deepEqual(report.omitted, ['empty.mp4', 'fake.png']);
});

test('missing, mismatched and incomplete receipts cannot imply verified visual evidence', t => {
  const directory = workspace(t);
  assert.equal(collect(directory).state, 'missing');
  writeFileSync(join(directory, 'capture.png'), png);
  assert.equal(collect(directory, { requireReceipt: true }).state, 'missing');
  assert.deepEqual(collect(directory, { requireReceipt: true }).media, []);
  assert.throws(() => collect(directory, { receipt: { head: 'b'.repeat(40) } }), /HEAD_MISMATCH/);
  const receipt = { head: sha, executedApps: ['village', 'demon'], completedApps: ['village'], failed: null };
  assert.equal(collect(directory, { receipt }).result, 'failure');
  const failure = collect(directory, { result: 'failure', receipt });
  assert.equal(failure.state, 'captured');
  assert.equal(failure.result, 'failure');
});

test('gallery renders images and playable videos, escapes labels and preserves failed-result scope', t => {
  const directory = workspace(t);
  writeFileSync(join(directory, 'capture.png'), png);
  const report = collect(directory, { result: 'failure', scenario: '<script>alert(1)</script>' });
  report.media.push({ path: 'movement clip.webm', kind: 'video' });
  const page = evidenceHtml(report), markdown = evidenceMarkdown(report);
  assert.match(page, /<img loading="lazy"/);
  assert.match(page, /<video controls playsinline/);
  assert.match(page, /movement%20clip.webm/);
  assert.doesNotMatch(page, /<script>/);
  assert.match(page, /&lt;script&gt;/);
  assert.match(markdown, /failure/);
  assert.match(markdown, /PR previewをDEV公開確認とは扱いません/);
});

function fixture(extra = {}) {
  let reads = 0;
  const comments = [], mutations = [];
  const pr = { state: 'open', draft: false, base: { ref: 'develop' }, head: { sha, repo: { full_name: repository } } };
  const artifact = { id: 99, name: `pr-browser-679-${sha}`, expired: false, size_in_bytes: 2000, expires_at: '2026-09-30T00:00:00Z' };
  const github = { rest: {
    pulls: { get: async () => { reads++; extra.onRead?.(pr, reads); return { data: structuredClone(pr) }; } },
    actions: { listWorkflowRunArtifacts: async () => ({ data: { artifacts: extra.noArtifact ? [] : [{ ...artifact, ...extra.artifact }] } }) },
    issues: {
      listComments: async () => ({ data: structuredClone(comments) }),
      createComment: async ({ body }) => { mutations.push(body); comments.push({ id: 1, body, user: { login: 'github-actions[bot]' } }); },
      updateComment: async ({ body }) => { mutations.push(body); comments[0].body = body; },
    },
  } };
  return { comments, mutations, pr, options: { github, repo: { owner: 'charukun', repo: 'soul-lineage' }, number: 679, head: sha,
    runId: 123, attempt: 1, conclusion: 'success', state: 'captured', images: '1', videos: '1' } };
}

test('receipt links the exact run artifact once; includes environment, limits, expiry and failure diagnostics', async () => {
  const f = fixture();
  const result = await recordCompletionEvidence(f.options);
  assert.equal(result.state, 'captured');
  assert.equal(result.artifactUrl, `https://github.com/${repository}/actions/runs/123/artifacts/99`);
  assert.match(f.comments[0].body, /画像 1件・動画 1件/);
  assert.match(f.comments[0].body, /2026-09-30/);
  assert.match(f.comments[0].body, /DEV公開画面の録画ではありません/);
  await recordCompletionEvidence(f.options);
  assert.equal(f.mutations.length, 1);
  await recordCompletionEvidence({ ...f.options, conclusion: 'failure', attempt: 2 });
  assert.equal(f.comments.length, 1);
  assert.match(f.comments[0].body, /失敗（画像・動画は診断用）/);
});

test('missing, expired, wrong-head or empty artifact never claims a capture even after successful browser job', async () => {
  for (const extra of [{ noArtifact: true }, { artifact: { expired: true } }, { artifact: { name: 'pr-browser-679-other' } }, { artifact: { size_in_bytes: 0 } }]) {
    const f = fixture(extra);
    assert.equal((await recordCompletionEvidence(f.options)).state, 'missing');
    assert.match(f.comments[0].body, /エビデンス未取得/);
    assert.doesNotMatch(f.comments[0].body, /撮影済み/);
  }
  const f = fixture();
  assert.equal((await recordCompletionEvidence({ ...f.options, images: 'invalid', videos: '' })).state, 'missing');
});

test('stale/Draft/foreign/closed/main receipts are rejected again immediately before write; merged exact head is allowed', async () => {
  for (const mutate of [p => p.head.sha = 'b'.repeat(40), p => p.draft = true, p => p.state = 'closed',
    p => p.head.repo.full_name = 'external/fork', p => p.base.ref = 'main']) {
    const f = fixture({ onRead: (pr, n) => { if (n === 2) mutate(pr); } });
    assert.equal((await recordCompletionEvidence(f.options)).skipped, 'stale-or-ineligible-pr');
    assert.equal(f.mutations.length, 0);
  }
  const f = fixture(); f.pr.state = 'closed'; f.pr.merged_at = '2026-09-16T12:00:00Z';
  assert.equal((await recordCompletionEvidence(f.options)).state, 'captured');
});

test('older run or attempt cannot overwrite a newer evidence receipt', async () => {
  const f = fixture();
  await recordCompletionEvidence({ ...f.options, attempt: 2 });
  assert.equal((await recordCompletionEvidence(f.options)).skipped, 'newer-report-exists');
  assert.equal((await recordCompletionEvidence({ ...f.options, runId: 122, attempt: 3 })).skipped, 'newer-report-exists');
  assert.equal(f.mutations.length, 1);
});
