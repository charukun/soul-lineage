import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DISPATCH_MARKER,
  buildDispatchPrompt,
  isEligibleDispatchPull,
  parseDispatchBody,
} from '../scripts/rinne-dispatch-prompt.mjs';

const body = `Village操作導線の改善
初回建築まで迷わない誘導へ調整

${DISPATCH_MARKER}

## Request
村の初回建築導線を改善してください。
既存の操作体系は維持してください。

## Notes
この節は依頼本文に含めない。
`;

const pull = (overrides = {}) => ({
  number: 123,
  draft: true,
  body,
  author_association: 'OWNER',
  base: { ref: 'develop' },
  head: {
    ref: 'dispatch/village-first-build',
    repo: { full_name: 'charukun/soul-lineage' },
  },
  ...overrides,
});

test('dispatch body preserves first-two-line PR contract and extracts only Request section', () => {
  assert.deepEqual(parseDispatchBody(body), {
    title: 'Village操作導線の改善',
    detail: '初回建築まで迷わない誘導へ調整',
    instruction: '村の初回建築導線を改善してください。\n既存の操作体系は維持してください。',
  });
});

test('dispatch body fails closed without marker or Request content', () => {
  assert.throws(() => parseDispatchBody('Title\nDetail\n\n## Request\nDo it'), /RINNE-Dispatch/);
  assert.throws(() => parseDispatchBody(`Title\nDetail\n\n${DISPATCH_MARKER}\n\n## Request\n`), /must not be empty/);
});

test('only trusted same-repository Draft PRs on dispatch branches are eligible', () => {
  assert.equal(isEligibleDispatchPull(pull(), 'charukun/soul-lineage'), true);
  assert.equal(isEligibleDispatchPull(pull({ draft: false }), 'charukun/soul-lineage'), false);
  assert.equal(isEligibleDispatchPull(pull({ author_association: 'CONTRIBUTOR' }), 'charukun/soul-lineage'), false);
  assert.equal(isEligibleDispatchPull(pull({ head: { ref: 'feat/x', repo: { full_name: 'charukun/soul-lineage' } } }), 'charukun/soul-lineage'), false);
  assert.equal(isEligibleDispatchPull(pull({ head: { ref: 'dispatch/x', repo: { full_name: 'someone/fork' } } }), 'charukun/soul-lineage'), false);
});

test('Work handoff prompt keeps repository delivery policy above user scope', () => {
  const prompt = buildDispatchPrompt({
    repository: 'charukun/soul-lineage',
    number: 123,
    base: 'develop',
    head: 'dispatch/village-first-build',
    body,
  });
  assert.match(prompt, /ChatGPT Work implementation worker/);
  assert.match(prompt, /Do NOT create another branch or PR/);
  assert.match(prompt, /Do NOT modify main or Production/);
  assert.match(prompt, /Commit and push the implementation to the same dispatch\/village-first-build branch/);
  assert.match(prompt, /mark that PR Ready for review/);
  assert.match(prompt, /Do not wait synchronously for CI after Ready/);
  assert.match(prompt, /must not call the OpenAI Platform API directly/);
  assert.match(prompt, /must not depend on OPENAI_API_KEY/);
  assert.match(prompt, /<rinne_request>[\s\S]*村の初回建築導線を改善してください。/);
  assert.doesNotMatch(prompt, /この節は依頼本文に含めない/);
});

test('dispatch workflow validates GitHub handoff without paid Codex API execution', async () => {
  const workflow = await readFile(new URL('../.github/workflows/rinne-dispatch.yml', import.meta.url), 'utf8');
  assert.match(workflow, /pull_request:/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.match(workflow, /head\.repo\.full_name == github\.repository/);
  assert.match(workflow, /RINNE Dispatch: QUEUED FOR CHATGPT WORK/);
  assert.match(workflow, /context=dispatch\/handoff/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /openai\/codex-action/);
  assert.doesNotMatch(workflow, /OPENAI_API_KEY/);
  assert.doesNotMatch(workflow, /gh pr ready/);
  assert.doesNotMatch(workflow, /node scripts\/validate\.mjs fast origin\/develop HEAD/);
  assert.doesNotMatch(workflow, /main.*push|push.*main/i);
});

test('dispatcher documentation requires ChatGPT Work GitHub event task and no platform API credits', async () => {
  const docs = await readFile(new URL('../docs/DISPATCHER.md', import.meta.url), 'utf8');
  assert.match(docs, /ChatGPT Work/);
  assert.match(docs, /pull request opened/i);
  assert.match(docs, /no separate OpenAI Platform API credits/i);
  assert.match(docs, /Settings > Apps/);
  assert.doesNotMatch(docs, /Required GitHub Actions secret:[\s\S]*OPENAI_API_KEY/);
});
