import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  PULSE_COPY,
  PULSE_FIRST_GLANCE,
  PULSE_ROLE,
} from '../ops-board/public/pulse-contract.mjs';

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

  const browser = text('ops-board/browser-check.mjs');
  const tower = text('ops-board/public/control-tower.js');
  const freshness = text('ops-board/public/freshness.mjs');

  assert.match(browser, /pulse-contract\.mjs/);
  assert.match(tower, /pulse-contract\.mjs/);
  assert.match(freshness, /pulse-contract\.mjs/);
  assert.doesNotMatch(browser, /headline:'自動復旧中'/);
  assert.doesNotMatch(browser, /\/自動復旧中\//);
  assert.doesNotMatch(freshness, /title:\s*'再同期中'/);
});

test('PULSE source tooling is detached from the Fast DEV Actions lane', () => {
  const validate = text('scripts/validate.mjs');
  const pkg = JSON.parse(text('package.json'));
  assert.equal(pkg.scripts['pulse:preflight'], 'node ops-board/preflight.mjs');
  assert.doesNotMatch(validate, /pulseRelevant|pulse:preflight/);
  assert.equal(existsSync(new URL('../.github/workflows/ops-board.yml', import.meta.url)), false);
  assert.equal(existsSync(new URL('../.github/workflows/pulse-refresh.yml', import.meta.url)), false);
  assert.equal(existsSync(new URL('../.github/workflows/pulse-events.yml', import.meta.url)), false);
});
