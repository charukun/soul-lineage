import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newState, conflictScope } from '../scripts/integration-rescue-policy.mjs';
import { deriveWorkRepairWake } from '../scripts/integration-rescue-work-wake.mjs';
import { rescueView } from '../ops-board/rescue.mjs';

const now = Date.parse('2026-09-14T13:00:00Z');
const iso = new Date(now - 60_000).toISOString();
function manual(pr, file, extra = {}) {
  return {
    pr,
    title: `PR ${pr}`,
    branch: `feat/${pr}`,
    headSha: String(pr).padStart(40, 'a').slice(-40),
    state: 'FAILED_MANUAL',
    failureReason: `FAILED_MANUAL:SEMANTIC_CONFLICT:${file}`,
    scope: conflictScope([file]),
    priority: { label:'NORMAL', score:10 },
    attempt:1,
    maxAttempts:3,
    detectedAt:iso,
    updatedAt:iso,
    dependencies:[],
    blockedBy:[],
    ...extra,
  };
}
function fixture(...records) {
  const state = newState();
  state.config.maxConcurrency = 6;
  state.coordinator = { configured:true, phase:'observing', heartbeatAt:new Date(now).toISOString() };
  state.updatedAt = new Date(now).toISOString();
  for (const record of records) state.records[record.pr] = record;
  return state;
}

test('eligible manual backlog with free capacity emits durable wake requirement', () => {
  const state = fixture(manual(10,'apps/demon/src/a.js'), manual(11,'apps/village/src/a.js'));
  const wake = deriveWorkRepairWake(state, now);
  assert.equal(wake.status, 'WAKE_REQUIRED');
  assert.equal(wake.wakeRequired, true);
  assert.equal(wake.active, 0);
  assert.equal(wake.capacity, 6);
  assert.equal(wake.eligible, 2);
  assert.equal(wake.claimable, 2);
  assert.equal(wake.blocked, 0);
});

test('RED scope ownership and browser repair make zero workers a legitimate blocked wait', () => {
  const waiting = manual(20,'apps/rinne/src/story/controller.js',{browserRepair:245});
  const locked = manual(21,'apps/rinne/src/story/interface.js');
  const owner = {
    pr:22,state:'CHECKING',scope:conflictScope(['apps/rinne/src/story/interface.js']),
    branch:'feat/22',headSha:'b'.repeat(40),detectedAt:iso,updatedAt:iso,dependencies:[],blockedBy:[],
  };
  const state = fixture(waiting, locked, owner);
  const wake = deriveWorkRepairWake(state, now);
  assert.equal(wake.status, 'BLOCKED');
  assert.equal(wake.claimable, 0);
  assert.equal(wake.blocked, 2);
  assert.match(wake.candidates.find(item => item.pr === 20).blocker, /BROWSER_REPAIR_OWNS_PR/);
  assert.match(wake.candidates.find(item => item.pr === 21).blocker, /SCOPE_LOCK:#22/);
});

test('free slots are filled even while an independent Work repair is already active', () => {
  const active = manual(30,'apps/demon/src/a.js',{workRepair:{status:'working',workerId:'work/a',expiresAt:new Date(now+60_000).toISOString(),scope:conflictScope(['apps/demon/src/a.js'])}});
  const waiting = manual(31,'apps/village/src/a.js');
  const state = fixture(active, waiting);
  const wake = deriveWorkRepairWake(state, now);
  assert.equal(wake.active, 1);
  assert.equal(wake.capacity, 5);
  assert.equal(wake.status, 'WAKE_REQUIRED');
  assert.equal(wake.claimable, 1);
});

test('PULSE marks ACTIVE 0 with claimable AI repair as attention instead of generic idle', () => {
  const state = fixture(manual(40,'apps/demon/src/a.js'));
  state.flowControl = { workRepairWake: { ...deriveWorkRepairWake(state, now), updatedAt:new Date(now).toISOString() } };
  const view = rescueView(state, now);
  assert.equal(view.counts.active, 0);
  assert.equal(view.counts.recoverableManual, 1);
  assert.equal(view.counts.idleEligible, 1);
  assert.equal(view.counts.workRepairClaimable, 1);
  assert.equal(view.status, 'ATTENTION');
  assert.equal(view.flowControl.workRepairWake.status, 'WAKE_REQUIRED');
});

test('PULSE public UI explains wake-required versus safely blocked idle without inflating ACTIVE', () => {
  const source = readFileSync('ops-board/public/rescue-board.js','utf8');
  assert.match(source,/AI修復Worker起動待ち/);
  assert.match(source,/Work Repair wakeを記録済み/);
  assert.match(source,/全AI修復候補がblocked/);
  assert.match(source,/c\.active/);
  assert.doesNotMatch(source,/Math\.max\([^\n]*c\.active/);
});
