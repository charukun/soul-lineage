import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContextPlan, selectContextDocs } from '../scripts/context-plan.mjs';

test('default context stays minimal instead of preloading the documentation tree', () => {
  assert.deepEqual(selectContextDocs(), ['AGENTS.md']);
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

test('plan explicitly records retrieval and product-context boundaries', () => {
  const plan = buildContextPlan({ task: 'code health refactor', paths: ['scripts/code-health.mjs'] });
  assert.equal(plan.sourceOfTruth, 'latest develop + current GitHub branch/commit/PR state');
  assert.ok(plan.read.includes('docs/CODE_HEALTH.md'));
  assert.ok(plan.avoidPreload.includes('past chat history'));
  assert.match(plan.boundary, /product-injected system\/Project\/memory context/);
});
