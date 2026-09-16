import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContextPlan,
  MAX_LOG_BYTES,
  MAX_SESSION_LOG_BYTES,
  MAX_SESSION_LOG_EXCERPTS,
} from '../scripts/context-plan.mjs';

test('context plan exposes per-excerpt and cumulative CI log limits as a stop condition', () => {
  const plan = buildContextPlan({ task: 'CI失敗を修復する', paths: ['.github/workflows/ci.yml'] });
  assert.equal(MAX_LOG_BYTES, 64 * 1024);
  assert.equal(MAX_SESSION_LOG_BYTES, 96 * 1024);
  assert.equal(MAX_SESSION_LOG_EXCERPTS, 3);
  assert.equal(plan.githubRetrieval.maxLogBytes, MAX_LOG_BYTES);
  assert.equal(plan.githubRetrieval.maxSessionLogBytes, MAX_SESSION_LOG_BYTES);
  assert.equal(plan.githubRetrieval.maxSessionLogExcerpts, MAX_SESSION_LOG_EXCERPTS);
  assert.match(plan.githubRetrieval.ci, /failed\/cancelled job/);
  assert.match(plan.githubRetrieval.ci, /summarize\/handoff/);
  assert.match(plan.githubRetrieval.ci, /polling/);
  assert.ok(plan.retrieval.some(rule => /Stop CI log retrieval/.test(rule)));
});
