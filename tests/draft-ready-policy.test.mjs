import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Draft PR uses lightweight CI and Ready owns fast/browser/Integration gates', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(ci, /types: \[opened, synchronize, reopened, ready_for_review, converted_to_draft, edited, labeled, unlabeled\]/);
  assert.match(ci, /name: Draft lightweight check/);
  assert.match(ci, /github\.event\.pull_request\.draft/);
  assert.match(ci, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(ci, /git diff --check "\$BASE_SHA\.\.\.\$HEAD_SHA"/);
  const buildHeader = ci.split('  build:')[1].split('    steps:')[0];
  assert.match(buildHeader, /!github\.event\.pull_request\.draft/);
  assert.match(ci, /!github\.event\.pull_request\.draft[\s\S]*name: Request Integration/);
  assert.match(ci, /workflow_id: 'browser-repair\.yml'/);
});
