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

test('worker prompt keeps GitHub delivery policy above user scope', () => {
  const prompt = buildDispatchPrompt({
    repository: 'charukun/soul-lineage',
    number: 123,
    base: 'develop',
    head: 'dispatch/village-first-build',
    body,
  });
  assert.match(prompt, /Do NOT create another branch or PR/);
  assert.match(prompt, /Do NOT mark the PR Ready, merge it, push it, or modify main\/Production/);
  assert.match(prompt, /Do not create sub-agents/);
  assert.match(prompt, /Do not weaken tests/);
  assert.match(prompt, /<rinne_request>[\s\S]*村の初回建築導線を改善してください。/);
  assert.doesNotMatch(prompt, /この節は依頼本文に含めない/);
});

test('dispatch workflow uses same-repository pull_request, pinned Codex action and existing Draft/Ready lifecycle', async () => {
  const workflow = await readFile(new URL('../.github/workflows/rinne-dispatch.yml', import.meta.url), 'utf8');
  assert.match(workflow, /pull_request:/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.match(workflow, /head\.repo\.full_name == github\.repository/);
  assert.match(workflow, /openai\/codex-action@86365089eb2b84e0a8fb0717b304f8bdcb13b20e/);
  assert.match(workflow, /permission-profile: ':workspace'/);
  assert.match(workflow, /safety-strategy: 'drop-sudo'/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /gh pr ready/);
  assert.match(workflow, /node scripts\/validate\.mjs fast origin\/develop HEAD/);
  assert.doesNotMatch(workflow, /main.*push|push.*main/i);
});
