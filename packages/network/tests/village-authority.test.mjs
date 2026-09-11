import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceVillageAuthority, createVillageAuthority, createVillageCheckpoint, VILLAGE_PHASE } from '../src/index.js';
const start = () => createVillageAuthority({ villageId: 'v1', mayorId: 'mayor', now: 0, timings: { hostLeaseMs: 100, migrationTimeoutMs: 200 } });
test('mayor presence gates admission', () => {
  let s = advanceVillageAuthority(start(), { type: 'join', playerId: 'a', now: 1 });
  s = advanceVillageAuthority(s, { type: 'disconnect', playerId: 'mayor', now: 2 });
  assert.throws(() => advanceVillageAuthority(s, { type: 'join', playerId: 'b', now: 3 }), /closed/);
});
test('migration requires the candidate to acknowledge the latest checkpoint', () => {
  let s = advanceVillageAuthority(start(), { type: 'join', playerId: 'a', now: 1 });
  s = advanceVillageAuthority(s, { type: 'checkpoint', playerId: 'mayor', epoch: 1, now: 2, checkpoint: { world: 1 } });
  s = advanceVillageAuthority(s, { type: 'disconnect', playerId: 'mayor', now: 3 });
  assert.equal(s.phase, VILLAGE_PHASE.MIGRATING); assert.equal(s.candidateId, 'a');
  assert.throws(() => advanceVillageAuthority(s, { type: 'migration-ready', playerId: 'a', epoch: s.epoch, checkpointRevision: 0, now: 4 }));
  s = advanceVillageAuthority(s, { type: 'migration-ready', playerId: 'a', epoch: s.epoch, checkpointRevision: 1, now: 5 });
  assert.equal(s.phase, VILLAGE_PHASE.OPEN); assert.equal(s.hostId, 'a');
});
test('failed candidate closes the village and mayor can safely recover it', () => {
  let s = advanceVillageAuthority(start(), { type: 'join', playerId: 'a', now: 1 });
  s = advanceVillageAuthority(s, { type: 'disconnect', playerId: 'mayor', now: 2 });
  s = advanceVillageAuthority(s, { type: 'candidate-failed', playerId: 'a', now: 3 });
  assert.equal(s.phase, VILLAGE_PHASE.CLOSED);
  s = advanceVillageAuthority(s, { type: 'connect', playerId: 'mayor', now: 4 });
  s = advanceVillageAuthority(s, { type: 'migration-ready', playerId: 'mayor', epoch: s.epoch, checkpointRevision: 0, now: 5 });
  assert.equal(s.phase, VILLAGE_PHASE.OPEN);
});
test('epoch fences stale hosts', () => {
  let s = advanceVillageAuthority(start(), { type: 'join', playerId: 'a', now: 1 });
  s = advanceVillageAuthority(s, { type: 'disconnect', playerId: 'mayor', now: 2 });
  assert.deepEqual(advanceVillageAuthority(s, { type: 'heartbeat', playerId: 'mayor', epoch: 1, now: 3 }), s);
  assert.throws(() => advanceVillageAuthority(s, { type: 'checkpoint', playerId: 'mayor', epoch: 1, checkpoint: {}, now: 3 }), /Stale/);
});
test('checkpoint validates entity identity and position', () => {
  assert.equal(createVillageCheckpoint({ worldTimeMs: 10, world: {}, characters: [{ id: 'p', position: [0, 1, 2] }] }).worldTimeMs, 10);
  assert.throws(() => createVillageCheckpoint({ worldTimeMs: 0, world: {}, characters: [{ id: 'x', position: [0, 0, 0] }], npcs: [{ id: 'x', position: [0, 0, 0] }] }));
});
