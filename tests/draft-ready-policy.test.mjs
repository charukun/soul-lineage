import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Draft PR uses lightweight CI and Ready owns fast/browser/Integration gates', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(ci, /types: \[opened, synchronize, reopened, ready_for_review, converted_to_draft, edited, labeled, unlabeled\]/);
  assert.match(ci, /name: Draft lightweight check/);
  assert.match(ci, /core.setOutput\('draft', current && pr.draft\)/);
  assert.match(ci, /core.setOutput\('ready', current && !pr.draft\)/);
  const draft = ci.split('  draft-check:')[1].split('  build:')[0];
  assert.match(draft, /needs.readiness.outputs.draft == 'true'/);
  assert.doesNotMatch(draft, /npm ci|playwright|validate.mjs/);
  assert.match(ci, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(ci, /git diff --check "\$BASE_SHA\.\.\.\$HEAD_SHA"/);
  const buildHeader = ci.split('  build:')[1].split('    steps:')[0];
  assert.match(buildHeader, /needs.readiness.outputs.ready == 'true'/);
  assert.match(ci.split('  integration-request:')[1], /needs.readiness.outputs.ready == 'true'/);
  assert.match(ci.split('  browser-repair-dispatch:')[1].split('  integration-request:')[0], /workflow_id: 'deploy\.yml'/);
});
