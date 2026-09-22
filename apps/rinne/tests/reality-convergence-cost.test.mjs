import test from 'node:test';
import assert from 'node:assert/strict';
import { appendKernel, canonical, compactProtectedJournal, coordinationEnvelope, createProtectedSnapshot, emptyKernel, genesisKernel, lifePatch, lineageGrowthEnvelope, protectedProjectionFromKernel, protectedProjectionFromWorld, recoverProtectedSnapshot, recoverSnapshot, recoveryPareto, semanticCompactionPareto, sizeEnvelope, snapshot, strongEncodingEnvelope, syntheticLife, syntheticWorld } from '../scripts/rrp-convergence/model.mjs';
import { applyOracle, initialOracle } from '../scripts/rrp-convergence/oracle.mjs';
import { eventFromAction, rebirthAction, sealAction } from '../scripts/rrp-convergence/workload.mjs';
import { deriveProtectedActions, protectedActionTypes } from '../scripts/rrp-convergence/shadow-extractor.mjs';

const mutation = process.env.RRP_CONVERGENCE_MUTATION ?? 'none';
function normalizedOracle(oracle) {
  return { worldId: oracle.worldId, ownerId: oracle.ownerId, epoch: oracle.epoch, seq: oracle.seq,
    players: Object.fromEntries(Object.entries(oracle.players).sort(([a],[b]) => a.localeCompare(b))), rebirthOps: oracle.rebirthOps };
}
function assertKernel(kernel, oracle) {
  assert.deepEqual(protectedProjectionFromKernel(kernel), normalizedOracle(oracle), 'INVARIANT: kernel diverged from independent semantic oracle');
}
function apply(kernel, oracle, action, opId) {
  const event = eventFromAction(action, kernel, opId);
  const k = appendKernel(kernel, event, mutation);
  const o = applyOracle(oracle, action);
  assertKernel(k, o);
  return [k, o, event];
}

test('sparse protected batches favor actor events but a fully dense batch can make a checkpoint smaller', () => {
  const sparse = strongEncodingEnvelope({ players: 30, affectedActors: 1 });
  const nearDense = strongEncodingEnvelope({ players: 30, affectedActors: 29 });
  const dense = strongEncodingEnvelope({ players: 30, affectedActors: 30 });
  assert.equal(sparse.selected, 'actor-events');
  assert.equal(nearDense.selected, 'actor-events');
  assert.equal(dense.selected, 'checkpoint');
});

test('rebirth creation payload makes dense-batch crossover happen earlier than life-seal', () => {
  assert.equal(strongEncodingEnvelope({ players: 30, affectedActors: 18, eventType: 'rebirth' }).selected, 'actor-events');
  assert.equal(strongEncodingEnvelope({ players: 30, affectedActors: 19, eventType: 'rebirth' }).selected, 'checkpoint');
});

test('adaptive strong encoding is never larger than either fixed actor-event or checkpoint encoding', () => {
  for (const eventType of ['birth', 'lifeSeal', 'rebirth']) for (let affectedActors = 1; affectedActors <= 30; affectedActors++) {
    const row = strongEncodingEnvelope({ players: 30, affectedActors, followerCopies: 2, eventType });
    assert(row.selectedStrongBytes <= row.eventStrongBytes);
    assert(row.selectedStrongBytes <= row.checkpointStrongBytes);
  }
});

test('recovery snapshot cadence is a real bandwidth-versus-provisional-RPO tradeoff, not part of canon safety', () => {
  const curve = recoveryPareto({ players: 30, durationSeconds: 60 });
  assert.equal(curve.tradeoffVisible, true);
  assert(curve.rows[0].bytes > curve.rows.at(-1).bytes);
  assert(curve.rows[0].provisionalRpoSeconds < curve.rows.at(-1).provisionalRpoSeconds);
});

test('every retained canon-prefix snapshot recovers to the same final protected head', () => {
  const emptyWorld = syntheticWorld(1); emptyWorld.players = {}; emptyWorld.rebirthOps = {};
  let kernel = emptyKernel({ worldId: emptyWorld.worldId, ownerId: emptyWorld.ownerId, epoch: 1 });
  let oracle = { worldId: emptyWorld.worldId, ownerId: emptyWorld.ownerId, epoch: 1, seq: 0, players: {}, rebirthOps: {} };
  let provisional = structuredClone(emptyWorld);
  const snapshots = [snapshot(provisional, kernel)];
  const owner = syntheticLife('owner');
  [kernel, oracle] = apply(kernel, oracle, { type: 'birth', playerId: 'owner', life: owner }, 'birth:owner:1');
  provisional = recoverSnapshot(snapshots[0], kernel, mutation); provisional.players.owner.life.position = { x: 40, z: -5 };
  snapshots.push(snapshot(provisional, kernel));
  let seal = sealAction(kernel.players.owner.life, 'owner'); seal.life.homelands = ['village-a']; seal.life.returns = 1; seal.record.returnedHome = true;
  [kernel, oracle] = apply(kernel, oracle, seal, 'seal:owner:1');
  provisional = recoverSnapshot(snapshots.at(-1), kernel, mutation); provisional.players.owner.life.hp = 3;
  snapshots.push(snapshot(provisional, kernel));
  const rebirth = rebirthAction(kernel.players.owner.life, 'owner');
  [kernel, oracle] = apply(kernel, oracle, rebirth, 'rebirth:owner:1');
  provisional = recoverSnapshot(snapshots.at(-1), kernel, mutation); provisional.players.owner.life.position = { x: -100, z: 7 };
  snapshots.push(snapshot(provisional, kernel));
  [kernel, oracle] = apply(kernel, oracle, { type: 'epoch-acquire', fromEpoch: 1, toEpoch: 2 }, 'epoch:2');
  snapshots.push(snapshot(recoverSnapshot(snapshots.at(-1), kernel, mutation), kernel));
  const expected = protectedProjectionFromKernel(kernel);
  for (const [index, base] of snapshots.entries()) {
    const recovered = recoverSnapshot(base, kernel, mutation);
    assert.deepEqual(protectedProjectionFromWorld(recovered, kernel), expected, `INVARIANT: prefix snapshot ${index} failed to recover protected head`);
  }
});

test('delta rebirth events do not repeat the entire lineage prefix', () => {
  const growth = lineageGrowthEnvelope();
  assert.equal(growth.deltaBoundedByHistoryLength, true);
  assert.equal(growth.naiveGrowthVisible, true);
  assert(growth.rows.at(-1).naiveRepeatedLineageBytes > growth.rows.at(-1).deltaBytes * 5);
});

test('an accumulated birth journal can exceed a protected semantic snapshot, so history representation also needs compaction', () => {
  const sizes = sizeEnvelope({ players: 30 }).eventSizes;
  const semantic = semanticCompactionPareto({ players: 30, canonEvents: 1000 });
  assert(sizes.baseKernelBytes > semantic.protectedSnapshotBytes);
});

test('semantic compaction trades background strong bytes for bounded journal replay', () => {
  const curve = semanticCompactionPareto({ players: 30, canonEvents: 1000 });
  assert.equal(curve.tradeoffVisible, true);
  assert(curve.rows[0].maxReplayEvents < curve.rows.at(-1).maxReplayEvents);
  assert(curve.rows[0].totalStrongBytes > curve.rows.at(-1).totalStrongBytes);
  assert(curve.protectedSnapshotBytes < sizeEnvelope({ players: 30 }).checkpointBytes);
});

test('semantic compaction cadence and provisional checkpoint cadence are independent controls', () => {
  const semantic = semanticCompactionPareto({ players: 30, canonEvents: 1000, compactEvery: [10, 100] });
  const provisional = recoveryPareto({ players: 30, durationSeconds: 60, intervals: [1, 10] });
  assert.equal(semantic.rows[0].maxReplayEvents, 9);
  assert.equal(semantic.rows[1].maxReplayEvents, 99);
  assert.equal(provisional.rows[0].provisionalRpoSeconds, 1);
  assert.equal(provisional.rows[1].provisionalRpoSeconds, 10);
});
