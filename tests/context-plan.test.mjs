import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import {
  buildContextPlan,
  budgetContextDocs,
  chooseDiffStrategy,
  DEFAULT_MAX_BYTES,
  MAX_LOG_BYTES,
  selectContextDocs,
  WHOLE_DIFF_MAX_FILES,
  WHOLE_DIFF_MAX_LINES,
} from '../scripts/context-plan.mjs';

test('default context stays minimal instead of preloading the documentation tree', () => {
  assert.deepEqual(selectContextDocs(), ['AGENTS.md']);
});

test('routine implementation selects development contract without integration policy preload', () => {
  const docs = selectContextDocs({ task: 'UIを修正して操作性を改善する' });
  assert.deepEqual(docs, ['AGENTS.md', 'docs/DEVELOPMENT.md']);
  assert.ok(!docs.includes('docs/INTEGRATION.md'));
  assert.ok(!docs.includes('docs/RINNE_PROJECT_EXECUTION_POLICY.md'));
});

test('integration rescue task selects delivery docs without unrelated motion/browser docs', () => {
  const docs = selectContextDocs({ task: 'Integration RescueでReady PRのマージ渋滞を修復する' });
  assert.deepEqual(docs, [
    'AGENTS.md',
    'docs/DEVELOPMENT.md',
    'docs/INTEGRATION.md',
    'docs/RINNE_PROJECT_EXECUTION_POLICY.md',
    'docs/INTEGRATION_RESCUE.md',
  ]);
  assert.ok(!docs.includes('docs/characters/MOTION_QUALITY.md'));
  assert.ok(!docs.includes('docs/BROWSER_SELF_HEALING.md'));
});

test('motion task selects authoring and quality references', () => {
  const docs = selectContextDocs({ task: '構えと武器保持モーションの姿勢を修正' });
  assert.deepEqual(docs, [
    'AGENTS.md',
    'docs/DEVELOPMENT.md',
    'docs/characters/MOTION_AUTHORING.md',
    'docs/characters/MOTION_QUALITY.md',
    'docs/PLATFORMS.md',
  ]);
});

test('paths route workflow, browser, and monorepo changes to focused references', () => {
  const docs = selectContextDocs({ paths: [
    '.github/workflows/ci.yml',
    'tests/browser/smoke.spec.mjs',
    'packages/rendering/package.json',
  ] });
  assert.ok(docs.includes('docs/DEVELOPMENT.md'));
  assert.ok(docs.includes('docs/INTEGRATION.md'));
  assert.ok(docs.includes('docs/BROWSER_SELF_HEALING.md'));
  assert.ok(docs.includes('docs/MONOREPO.md'));
  assert.ok(docs.length <= 8);
});

test('hard byte budget keeps AGENTS and defers oversized follow-up docs', () => {
  const agentsBytes = statSync('AGENTS.md').size;
  const budget = budgetContextDocs({
    task: 'Integration RescueでReady PRのマージ渋滞を修復する',
    maxBytes: agentsBytes,
  });
  assert.deepEqual(budget.read, ['AGENTS.md']);
  assert.ok(budget.deferred.length >= 1);
  assert.ok(budget.deferred.every(item => item.strategy === 'search-or-line-range'));
  assert.equal(budget.maxBytes, agentsBytes);
  assert.equal(budget.overBudget, true);
});

test('default document budget is 48 KiB and is explicitly not a token estimate', () => {
  const plan = buildContextPlan({ task: 'UIを修正する', paths: ['apps/rinne/src/main.js'] });
  assert.equal(DEFAULT_MAX_BYTES, 48 * 1024);
  assert.equal(plan.budget.maxBytes, DEFAULT_MAX_BYTES);
  assert.match(plan.budget.note, /not a token estimate/);
});

test('large or binary diffs force per-file retrieval', () => {
  assert.equal(
    chooseDiffStrategy({ fileCount: WHOLE_DIFF_MAX_FILES + 1, changedLines: 1, binaryFiles: 0 }),
    'metadata→changed-filenames→file-patch',
  );
  assert.equal(
    chooseDiffStrategy({ fileCount: 1, changedLines: WHOLE_DIFF_MAX_LINES + 1, binaryFiles: 0 }),
    'metadata→changed-filenames→file-patch',
  );
  assert.equal(
    chooseDiffStrategy({ fileCount: 1, changedLines: 1, binaryFiles: 1 }),
    'metadata→changed-filenames→file-patch',
  );
  assert.equal(
    chooseDiffStrategy({ fileCount: 2, changedLines: 20, binaryFiles: 0 }),
    'whole-diff-allowed-but-not-required',
  );
});

test('plan caps CI log retrieval and records exact-head cache discipline', () => {
  const plan = buildContextPlan({ task: 'CI失敗を修復する', paths: ['.github/workflows/ci.yml'] });
  assert.equal(MAX_LOG_BYTES, 64 * 1024);
  assert.equal(plan.githubRetrieval.maxLogBytes, MAX_LOG_BYTES);
  assert.match(plan.githubRetrieval.ci, /failed\/cancelled job/);
  assert.match(plan.githubRetrieval.cache, /exact-head/);
});

test('plan explicitly records retrieval and product-context boundaries', () => {
  const plan = buildContextPlan({ task: 'code health refactor', paths: ['scripts/code-health.mjs'] });
  assert.equal(plan.sourceOfTruth, 'latest develop + current GitHub branch/commit/PR state');
  assert.ok(plan.read.includes('docs/DEVELOPMENT.md'));
  assert.ok(plan.read.includes('docs/CODE_HEALTH.md'));
  assert.ok(plan.avoidPreload.includes('past chat history'));
  assert.match(plan.boundary, /product-injected system\/Project\/memory context/);
});

test('repository entrypoints wire the lean context policy and command', () => {
  const agents = readFileSync('AGENTS.md', 'utf8');
  const policy = readFileSync('docs/CONTEXT_EFFICIENCY.md', 'utf8');
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.match(agents, /docs\/CONTEXT_EFFICIENCY\.md/);
  assert.match(agents, /npm run context:plan/);
  assert.match(agents, /do not fetch the full policy unconditionally/);
  assert.match(policy, /過去会話、closed PR、Actions履歴、全docs、全diffを一括取得しない/);
  assert.match(policy, /既定値は48 KiB/);
  assert.equal(pkg.scripts['context:plan'], 'node scripts/context-plan.mjs');
});
