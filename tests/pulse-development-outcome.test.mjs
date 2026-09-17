import test from 'node:test';
import assert from 'node:assert/strict';
import { developmentOutcomeForPull, developmentOutcomeSummary } from '../ops-board/public/development-outcome.mjs';

test('PULSE maps observable implementation ownership to WORKING and normal Ready handoff to READY', () => {
  assert.equal(developmentOutcomeForPull({ number: 1, state: 'Draft' }, []), 'WORKING');
  assert.equal(developmentOutcomeForPull({ number: 2, state: 'Ready' }, [{ number: 2, stage: 'VALIDATING' }]), 'READY');
  assert.equal(developmentOutcomeForPull({ number: 3, state: 'Ready' }, [{ number: 3, stage: 'REPAIR' }]), 'READY');
});

test('PULSE only promotes explicit Integration hold to BLOCKED and sends source CI failure back to WORKING', () => {
  assert.equal(developmentOutcomeForPull({ number: 4, state: 'Ready' }, [{ number: 4, stage: 'HOLD' }]), 'BLOCKED');
  assert.equal(developmentOutcomeForPull({ number: 5, state: 'Ready' }, [{ number: 5, stage: 'CI_FAILED' }]), 'WORKING');
  assert.equal(developmentOutcomeForPull({ number: 6, state: 'Ready' }, [{ number: 6, stage: 'BLOCKED', blockedBy: [2] }]), 'READY');
});

test('PULSE outcome summary exposes only WORKING READY BLOCKED as active task states', () => {
  const state = {
    pullRequests: { normal: [
      { number: 10, state: 'Draft' },
      { number: 11, state: 'Ready' },
      { number: 12, state: 'Ready' },
      { number: 13, state: 'Ready' },
      { number: 14, state: 'Merged' },
    ] },
    integration: { queue: [
      { number: 11, stage: 'VALIDATING' },
      { number: 12, stage: 'HOLD' },
      { number: 13, stage: 'CI_FAILED' },
    ] },
  };
  const summary = developmentOutcomeSummary(state);
  assert.deepEqual(summary.counts, { WORKING: 2, READY: 1, BLOCKED: 1 });
  assert.equal(summary.headline, 'BLOCKED 1');
  assert.equal(summary.tone, 'danger');
  assert.equal(summary.detail, 'WORKING 2 / READY 1 / BLOCKED 1');
});
