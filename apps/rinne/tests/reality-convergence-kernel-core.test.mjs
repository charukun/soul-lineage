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

test('source-shaped manifest: provisional progress is outside the strong canon until a protected boundary', () => {
  const world = syntheticWorld(3), kernel = genesisKernel(world);
  const before = protectedProjectionFromKernel(kernel);
  world.tick += 100; world.worldSeconds += 5;
  world.players.owner.life.position = { x: 99, z: -31 };
  world.players.owner.life.hp = 44;
  world.players.owner.life.experiences.train.count += 5;
  assert.deepEqual(protectedProjectionFromKernel(kernel), before);
  assert.notDeepEqual(world.players.owner.life.position, { x: 1.25, z: -0.75 });
});

test('birth, seal, rebirth and authority epoch form a closed protected sequence in the finite candidate', () => {
  const world = syntheticWorld(1); let kernel = genesisKernel(world), oracle = initialOracle(world);
  assertKernel(kernel, oracle);
  const friend = syntheticLife('p1');
  [kernel, oracle] = apply(kernel, oracle, { type: 'birth', playerId: 'p1', life: friend }, 'birth:p1:1');
  const seal = sealAction(kernel.players.p1.life, 'p1');
  seal.life.homelands = ['village-a']; seal.life.returns = 1; seal.record.returnedHome = true;
  [kernel, oracle] = apply(kernel, oracle, seal, 'seal:p1:1');
  const rebirth = rebirthAction(kernel.players.p1.life, 'p1');
  [kernel, oracle] = apply(kernel, oracle, rebirth, 'rebirth:p1:1');
  [kernel, oracle] = apply(kernel, oracle, { type: 'epoch-acquire', fromEpoch: 1, toEpoch: 2 }, 'epoch:2');
  assert.equal(kernel.players.p1.life.id, 'p1:2');
  assert.equal(kernel.players.p1.life.lineage.length, 1);
  assert.equal(kernel.epoch, 2);
});

test('operation identity cannot be reused with different protected content', () => {
  const world = syntheticWorld(1); let kernel = genesisKernel(world);
  const action = sealAction(kernel.players.owner.life, 'owner');
  const event = eventFromAction(action, kernel, 'seal:owner:1');
  kernel = appendKernel(kernel, event, mutation);
  const conflict = structuredClone(event); conflict.seq = kernel.seq + 1; conflict.record.defeats++;
  assert.throws(() => appendKernel(kernel, conflict, mutation));
});

test('a sealed actor carries rebirth dependencies instead of trusting an older snapshot', () => {
  const world = syntheticWorld(1); let kernel = genesisKernel(world), oracle = initialOracle(world);
  const base = snapshot(world, kernel);
  const seal = sealAction(kernel.players.owner.life, 'owner'); seal.life.homelands = ['village-a']; seal.life.seed = 98765; seal.life.returns = 1; seal.record.returnedHome = true;
  let event; [kernel, oracle, event] = apply(kernel, oracle, seal, 'seal:owner:1');
  const recovered = recoverSnapshot(base, kernel, mutation);
  assert.deepEqual(lifePatch(recovered.players.owner.life), lifePatch(kernel.players.owner.life), 'INVARIANT: recovery lost terminal/rebirth dependencies');
  assert.equal(event.patch.seed, 98765);
});

test('rebirth operation receipt survives recovery from a pre-rebirth snapshot', () => {
  const world = syntheticWorld(1); let kernel = genesisKernel(world), oracle = initialOracle(world);
  let action = sealAction(kernel.players.owner.life, 'owner'); action.life.homelands = ['village-a'];
  [kernel, oracle] = apply(kernel, oracle, action, 'seal:owner:1');
  const baseWorld = syntheticWorld(1); const baseKernel = genesisKernel(baseWorld); const base = snapshot(baseWorld, baseKernel);
  action = rebirthAction(kernel.players.owner.life, 'owner');
  [kernel, oracle] = apply(kernel, oracle, action, 'rebirth:owner:1');
  const recovered = recoverSnapshot(base, kernel, mutation);
  assert.deepEqual(recovered.rebirthOps?.['owner:1'], action.intent, 'INVARIANT: dedupe/rebirth receipt lost during recovery');
});

test('recovery snapshot must be bound to the canon root at its claimed base sequence', () => {
  const world = syntheticWorld(1), kernel = genesisKernel(world), base = snapshot(world, kernel);
  base.baseRoot = 'forged';
  assert.throws(() => recoverSnapshot(base, kernel, mutation), /snapshot not bound/, 'INVARIANT: unbound snapshot accepted');
});


test('a valid prefix label does not make provisional snapshot contents authoritative', () => {
  const world = syntheticWorld(1), kernel = genesisKernel(world), base = snapshot(world, kernel);
  const expectedSeed = kernel.players.owner.life.seed;
  base.world.players.owner.life.seed = expectedSeed + 777;
  base.world.players.ghost = { token: 'forged', portDwell: 0, life: syntheticLife('ghost') };
  base.world.rebirthOps = { forged: { playerId: 'ghost', lifeId: 'ghost:1', resultId: 'ghost:2' } };
  const recovered = recoverSnapshot(base, kernel, mutation);
  assert.equal(recovered.players.owner.life.seed, expectedSeed, 'INVARIANT: provisional protected field overrode journal');
  assert.equal(Object.hasOwn(recovered.players, 'ghost'), false, 'INVARIANT: non-canonical actor survived recovery');
  assert.deepEqual(recovered.rebirthOps, {}, 'INVARIANT: provisional operation receipt became canonical');
});

test('recovery may roll back provisional position while preserving all protected facts', () => {
  const world = syntheticWorld(2); let kernel = genesisKernel(world), oracle = initialOracle(world);
  const base = snapshot(world, kernel);
  world.players.p1.life.position = { x: 500, z: 500 }; world.players.p1.life.hp = 1;
  const seal = sealAction(kernel.players.owner.life, 'owner'); seal.life.homelands = ['village-a'];
  [kernel, oracle] = apply(kernel, oracle, seal, 'seal:owner:1');
  const recovered = recoverSnapshot(base, kernel, mutation);
  assertKernel(kernel, oracle);
  assert.deepEqual(protectedProjectionFromWorld(recovered, kernel), protectedProjectionFromKernel(kernel), 'INVARIANT: protected projection not recoverable');
  assert.notDeepEqual(recovered.players.p1.life.position, world.players.p1.life.position);
});

test('stale epoch event is rejected unless it is the explicit next authority acquisition', () => {
  const world = syntheticWorld(1); let kernel = genesisKernel(world);
  kernel = appendKernel(kernel, eventFromAction({ type: 'epoch-acquire', fromEpoch: 1, toEpoch: 2 }, kernel, 'epoch:2'), mutation);
  const stale = eventFromAction(sealAction(kernel.players.owner.life, 'owner'), kernel, 'seal:owner:1'); stale.epoch = 1;
  assert.throws(() => appendKernel(kernel, stale, mutation), /stale epoch/, 'INVARIANT: stale authority committed a protected event');
});

test('whole-world strong replication is strictly larger than one affected actor event for source-shaped 30-player state', () => {
  const cost = sizeEnvelope({ players: 30, followerCopies: 1, canonEvents: 4, recoverySnapshots: 60 });
  assert.equal(cost.strictVsWholeCheckpoint, true);
  assert(cost.checkpointBytes > cost.eventBytes * 10);
});

test('fair known semantic/event-sourcing baseline can match the same strong-byte envelope exactly', () => {
  const cost = sizeEnvelope({ players: 30, followerCopies: 2, canonEvents: 7, recoverySnapshots: 60 });
  assert.equal(cost.actorJournalStrong, cost.fairKnownBaselineStrong);
  assert.equal(cost.matchesFairKnownBaseline, true);
});

test('semantic splitting has no coordination-byte advantage when there is no replaceable traffic', () => {
  const zero = coordinationEnvelope({ protectedEvents: 10, replaceableUpdates: 0, protectedBytes: 500, replaceableBytes: 100, followerCopies: 2 });
  assert.equal(zero.savedBySemanticSplit, 0);
  assert.equal(zero.candidateMatchesFairBaseline, true);
});

test('when replaceable traffic exists, savings are exactly removed strong-path bytes rather than protocol magic', () => {
  const result = coordinationEnvelope({ protectedEvents: 2, replaceableUpdates: 1000, protectedBytes: 800, replaceableBytes: 140, followerCopies: 1 });
  assert.equal(result.savedBySemanticSplit, 140000);
  assert.equal(result.candidateBeatsFairBaseline, false);
});

test('strong-path savings scale with protected dependency scope rather than whole room size', () => {
  const one = sizeEnvelope({ players: 1 }), ten = sizeEnvelope({ players: 10 }), thirty = sizeEnvelope({ players: 30 });
  assert(thirty.checkpointBytes > ten.checkpointBytes && ten.checkpointBytes > one.checkpointBytes);
  assert(Math.abs(thirty.eventBytes - ten.eventBytes) < 50);
});

test('old snapshot plus canon overlay can reconstruct a new birth absent from that snapshot', () => {
  const world = syntheticWorld(1); let kernel = genesisKernel(world), oracle = initialOracle(world); const base = snapshot(world, kernel);
  const friend = syntheticLife('p1'); [kernel, oracle] = apply(kernel, oracle, { type: 'birth', playerId: 'p1', life: friend }, 'birth:p1:1');
  const recovered = recoverSnapshot(base, kernel, mutation);
  assert.equal(recovered.players.p1.life.id, 'p1:1');
  assert.deepEqual(protectedProjectionFromWorld(recovered, kernel), protectedProjectionFromKernel(kernel));
});

test('actor-scoped seal event is not enough to prove honest combat or reward derivation', () => {
  const world = syntheticWorld(1), kernel = genesisKernel(world);
  const a = sealAction(kernel.players.owner.life, 'owner');
  const b = sealAction(kernel.players.owner.life, 'owner'); b.life.defeats = 999; b.record.defeats = 999;
  assert.doesNotThrow(() => appendKernel(kernel, eventFromAction(a, kernel, 'seal:a')));
  assert.doesNotThrow(() => appendKernel(kernel, eventFromAction(b, kernel, 'seal:b')));
  assert.notEqual(a.record.defeats, b.record.defeats);
});

test('full-state checkpoint and compact canon are different recovery/authority products', () => {
  const world = syntheticWorld(30), kernel = genesisKernel(world);
  const s = snapshot(world, kernel);
  assert(Object.keys(s.world.players).length === 30);
  assert(kernel.history.every(event => event.type === 'birth'));
  assert(bytesSafe(s.world) > bytesSafe(kernel.history[0]));
});

function bytesSafe(value) { return new TextEncoder().encode(JSON.stringify(value)).byteLength; }


test('genesis snapshot plus protected journal reconstructs protected state without a full snapshot at every canon event', () => {
  const emptyWorld = syntheticWorld(1);
  emptyWorld.players = {}; emptyWorld.rebirthOps = {};
  let kernel = { worldId: emptyWorld.worldId, ownerId: emptyWorld.ownerId, epoch: 1, seq: 0, root: 'genesis', roots: [], players: {}, rebirthOps: {}, history: [] };
  let oracle = { worldId: emptyWorld.worldId, ownerId: emptyWorld.ownerId, epoch: 1, seq: 0, players: {}, rebirthOps: {} };
  const base = { baseSeq: 0, baseRoot: 'genesis', world: structuredClone(emptyWorld) };
  const owner = syntheticLife('owner');
  [kernel, oracle] = apply(kernel, oracle, { type: 'birth', playerId: 'owner', life: owner }, 'birth:owner:1');
  let seal = sealAction(kernel.players.owner.life, 'owner'); seal.life.homelands = ['village-a'];
  [kernel, oracle] = apply(kernel, oracle, seal, 'seal:owner:1');
  const rebirth = rebirthAction(kernel.players.owner.life, 'owner');
  [kernel, oracle] = apply(kernel, oracle, rebirth, 'rebirth:owner:1');
  const recovered = recoverSnapshot(base, kernel, mutation);
  assert.deepEqual(protectedProjectionFromWorld(recovered, kernel), protectedProjectionFromKernel(kernel), 'INVARIANT: journal cannot reconstruct protected state from genesis');
});
