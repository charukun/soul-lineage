import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildWorkResumePrompt, draftWorkItems } from '../ops-board/public/work-resume-prompt.js';

const fixture = {
  truncated: true,
  total: 282,
  normal: [
    {
      number: 424,
      title: 'Arcanist AtlasをBlender DCC比較モデルとして追加',
      detail: '実Blender生成と検証を続ける',
      state: 'Draft',
      updatedAt: '2026-09-16T04:40:00+09:00',
      url: 'https://github.com/charukun/soul-lineage/pull/424',
      head: 'feat/arcanist-atlas-dcc',
      headSha: '7ef7d84b4a8f3bc29252c2aa352a7bbe4a548b81',
      baseSha: 'f2ac3484c748ed5389d88a7e0e17d6b2f8f1ab4f',
      staleDraft: true,
      targets: [{ id: 'master-character', label: 'MasterCharacter' }],
      targetsComplete: true,
    },
    { number: 430, title: 'Ready task', detail: 'ready', state: 'Ready', head: 'feat/ready', headSha: 'r'.repeat(40) },
    { number: 23, title: 'Visual Review Lab', detail: 'long lived', state: 'Draft', head: 'work/visual-review-lab-v2', headSha: 'v'.repeat(40) },
  ],
};

test('Draft recovery prompt targets ordinary Drafts only and keeps exact recovery metadata', () => {
  const items = draftWorkItems(fixture);
  assert.equal(items.length, 1);
  assert.equal(items[0].number, 424);
  assert.equal(items[0].head, 'feat/arcanist-atlas-dcc');
  assert.equal(items[0].headSha, '7ef7d84b4a8f3bc29252c2aa352a7bbe4a548b81');
  assert.equal(items[0].staleDraft, true);
  assert.deepEqual(items[0].targets, ['MasterCharacter']);
});

test('Draft recovery prompt requires a current GitHub-wide audit before acting', () => {
  const prompt = buildWorkResumePrompt(fixture, '2026-09-16T05:30:00+09:00');
  assert.match(prompt, /charukun\/soul-lineage/);
  assert.match(prompt, /GitHubから現在openかつDraftの通常PRを全件列挙/);
  assert.match(prompt, /Draft=実行中とは扱わない/);
  assert.match(prompt, /STOPPED \/ INTERRUPTED/);
  assert.match(prompt, /READY_FOR_INTEGRATION/);
  assert.match(prompt, /main \/ Productionは変更しない/);
  assert.match(prompt, /Running \/ Queued \/ Pendingを待機・polling/);
  assert.match(prompt, /"snapshotTruncated": true/);
  assert.match(prompt, /"number": 424/);
  assert.match(prompt, /"head": "feat\/arcanist-atlas-dcc"/);
  assert.match(prompt, /7ef7d84b4a8f3bc29252c2aa352a7bbe4a548b81/);
  assert.doesNotMatch(prompt, /"number": 23/);
});

test('PULSE exposes a mobile-safe button, dialog and copy action for the resume prompt', async () => {
  const [board, css] = await Promise.all([
    readFile(new URL('../ops-board/public/pull-board.js', import.meta.url), 'utf8'),
    readFile(new URL('../ops-board/public/pr-board.css', import.meta.url), 'utf8'),
  ]);
  assert.match(board, /buildWorkResumePrompt/);
  assert.match(board, /作業中が本当に動いているかAIで全件確認/);
  assert.match(board, /AI再開プロンプト/);
  assert.match(board, /work-resume-prompt-dialog/);
  assert.match(board, /プロンプトをコピー/);
  assert.match(board, /navigator\.clipboard/);
  assert.match(board, /drafts\.length > 0 \|\| Boolean\(data\?\.truncated\)/);
  assert.match(board, /AI再開プロンプト 全件確認/);
  assert.match(css, /\.work-resume-action/);
  assert.match(css, /\.work-resume-button/);
  assert.match(css, /\.work-prompt-text/);
  assert.match(css, /@media \(max-width: 430px\)/);
});
