import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Draft stays lightweight and Ready develop uses no-test CI while browser remains opt-in', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(ci, /types: \[opened, synchronize, reopened, ready_for_review, converted_to_draft, edited, labeled, unlabeled\]/);
  assert.match(ci, /name: Draft lightweight check/);
  assert.match(ci, /core.setOutput\('draft', current && pr.draft\)/);
  assert.match(ci, /core.setOutput\('ready', current && !pr.draft\)/);
  const draft = ci.split('  draft-check:')[1].split('  build:')[0];
  assert.match(draft, /needs.readiness.outputs.draft == 'true'/);
  assert.doesNotMatch(draft, /npm ci|playwright|validate\.mjs/);
  assert.match(ci, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(ci, /git diff --check "\$BASE_SHA\.\.\.\$HEAD_SHA"/);
  const buildHeader = ci.split('  build:')[1].split('    steps:')[0];
  assert.match(buildHeader, /needs.readiness.outputs.ready == 'true'/);
  assert.match(ci, /TARGET_BASE: \$\{\{ github\.event\.pull_request\.base\.ref \}\}/);
  assert.match(ci, /if \[ "\$TARGET_BASE" = "develop" \]; then[\s\S]*node scripts\/validate\.mjs dev/);
  assert.match(ci, /else[\s\S]*node scripts\/validate\.mjs fast/);
  assert.match(ci.split('  merge-ready:')[1], /uses: \.\/\.github\/workflows\/integration-controller\.yml/);
  assert.doesNotMatch(ci, /integration-request:/);
  assert.doesNotMatch(ci, /name: Affected browser smoke/);
  assert.doesNotMatch(ci, /browser-repair-dispatch:/);
  assert.doesNotMatch(ci, /npx playwright install/);
  assert.match(ci, /Tests and browser\/gameplay verification are opt-in on develop/);
});
