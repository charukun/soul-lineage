import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PULSE_COPY,
  PULSE_FIRST_GLANCE,
  PULSE_ROLE,
} from '../apps/pulse/public/pulse-contract.mjs';

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PULSE semantic contract is the single source for first-glance roles and recovery copy', () => {
  assert.deepEqual(PULSE_FIRST_GLANCE, [
    PULSE_ROLE.DEVELOPMENT,
    PULSE_ROLE.DEV_PUBLICATION,
    PULSE_ROLE.HUMAN_ACTION,
    PULSE_ROLE.RECENT,
  ]);
  assert.equal(PULSE_COPY.recovery.headline, '自動復旧中');
  assert.equal(PULSE_COPY.recovery.syncTitle, '再同期中');

  const browser = text('apps/pulse/browser-check.mjs');
  const tower = text('apps/pulse/public/control-tower.js');
  const freshness = text('apps/pulse/public/freshness.mjs');

  assert.match(browser, /pulse-contract\.mjs/);
  assert.match(tower, /pulse-contract\.mjs/);
  assert.match(freshness, /pulse-contract\.mjs/);
  assert.doesNotMatch(browser, /headline:'自動復旧中'/);
  assert.doesNotMatch(browser, /\/自動復旧中\//);
  assert.doesNotMatch(freshness, /title:\s*'再同期中'/);
});

test('pre-merge DEV validation and post-merge publication use the same canonical PULSE preflight', () => {
  const validate = text('scripts/validate.mjs');
  const workflow = text('.github/workflows/ops-board.yml');
  const pkg = JSON.parse(text('package.json'));

  assert.equal(pkg.scripts['pulse:preflight'], 'node ops-board/preflight.mjs');
  assert.match(validate, /pulseRelevant/);
  assert.match(validate, /run\('npm', \['run', 'pulse:preflight'\]\)/);
  assert.match(workflow, /name: Canonical PULSE preflight/);
  assert.match(workflow, /run: npm run pulse:preflight/);
  assert.equal((workflow.match(/npm run pulse:preflight/g) || []).length, 1);
});

test('post-deploy smoke relies on semantic roles rather than presentation copy', () => {
  const workflow = text('.github/workflows/ops-board.yml');
  for (const role of PULSE_FIRST_GLANCE) {
    assert.match(workflow, new RegExp(`data-pulse-role="${role}"`));
  }
  assert.doesNotMatch(workflow, /grep -q 'あなたの確認が必要'/);
});
