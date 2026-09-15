import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
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

test('AGENTS obeys the hard limit and missing documents are never free reads', t => {
  const root = mkdtempSync(join(tmpdir(), 'context-budget-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'AGENTS.md'), 'あ'.repeat(20));
  const plan = budgetContextDocs({ root, task: 'implement motion', maxBytes: 10 });
  assert.equal(plan.usedBytes, 0);
  assert.deepEqual(plan.read, []);
  assert.equal(plan.deferred[0].reason, 'byte-budget');
  assert.ok(plan.deferred.some(item => item.bytes === null && item.reason === 'size-unknown'));
});

test('document count overflow stays discoverable in deferred instead of disappearing', () => {
  const options = { task: 'implement integration rescue browser dispatch motion mobile monorepo refactor gameplay lean context', maxBytes: 10 ** 7 };
  const candidates = selectContextDocs(options);
  const plan = budgetContextDocs(options);
  assert.ok(candidates.length > 8);
  assert.equal(plan.read.length, 8);
  assert.deepEqual(new Set([...plan.read, ...plan.deferred.map(item => item.path)]), new Set(candidates));
  assert.ok(plan.deferred.some(item => item.reason === 'document-count'));
});

test('invalid byte values cannot silently become a different budget', () => {
  for (const maxBytes of ['10junk', '1.5', 0, -1, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => budgetContextDocs({ maxBytes }), /positive integer/);
  }
  assert.throws(() => execFileSync(process.execPath, ['scripts/context-plan.mjs', '--max-bytes', '12bad'], { stdio: 'pipe' }));
});

test('context maintenance routes to its own current policy and bootstrap', () => {
  const docs = selectContextDocs({ paths: ['scripts/context-plan.mjs'] });
  assert.ok(docs.includes('docs/CONTEXT_EFFICIENCY.md'));
  assert.ok(docs.includes('docs/CHATGPT_PROJECT_BOOTSTRAP.md'));
});

test('unknown diff metadata and unavailable refs require file patches', () => {
  for (const stats of [{ changedLines: null }, { binaryFiles: null }, { fileCount: NaN }]) {
    assert.equal(chooseDiffStrategy(stats), 'metadata→changed-filenames→file-patch');
  }
  const plan = buildContextPlan({ base: 'missing-context-ref', paths: ['AGENTS.md'] });
  assert.equal(plan.git.base, null);
  assert.equal(plan.diff.strategy, 'metadata→changed-filenames→file-patch');
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
