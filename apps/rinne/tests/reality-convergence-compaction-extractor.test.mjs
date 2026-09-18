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

test('protected semantic compaction plus suffix replay preserves every retained prefix head', () => {
  const world = syntheticWorld(1); let kernel = genesisKernel(world), oracle = initialOracle(world);
  let seal = sealAction(kernel.players.owner.life, 'owner'); seal.life.homelands = ['village-a']; seal.life.returns = 1; seal.record.returnedHome = true;
  [kernel, oracle] = apply(kernel, oracle, seal, 'seal:owner:1');
  const rebirth = rebirthAction(kernel.players.owner.life, 'owner');
  [kernel, oracle] = apply(kernel, oracle, rebirth, 'rebirth:owner:1');
  [kernel, oracle] = apply(kernel, oracle, { type: 'epoch-acquire', fromEpoch: 1, toEpoch: 2 }, 'epoch:2');
  const friend = syntheticLife('p1');
  [kernel, oracle] = apply(kernel, oracle, { type: 'birth', playerId: 'p1', life: friend }, 'birth:p1:1');
  const expected = protectedProjectionFromKernel(kernel);
  for (let prefix = 0; prefix <= kernel.seq; prefix++) {
    const compacted = compactProtectedJournal(kernel, prefix);
    const recovered = recoverProtectedSnapshot(compacted.protectedSnapshot, compacted.suffix, mutation);
    assert.deepEqual(protectedProjectionFromKernel(recovered), expected, `INVARIANT: compact prefix ${prefix} changed protected state`);
    assert.equal(recovered.root, kernel.root, `INVARIANT: compact prefix ${prefix} changed protected root`);
    assert.equal(recovered.seq, kernel.seq);
  }
});

test('protected compaction must derive protected fields from the journal, not a provisional checkpoint', () => {
  const provisional = syntheticWorld(1); let kernel = genesisKernel(provisional), oracle = initialOracle(provisional);
  const seal = sealAction(kernel.players.owner.life, 'owner'); seal.life.seed = 98765; seal.life.homelands = ['village-a']; seal.life.returns = 1; seal.record.returnedHome = true;
  [kernel, oracle] = apply(kernel, oracle, seal, 'seal:owner:1');
  provisional.players.owner.life.seed = 111;
  provisional.players.owner.life.homelands = [];
  const semantic = createProtectedSnapshot(kernel, provisional, mutation);
  const recovered = recoverProtectedSnapshot(semantic, [], mutation);
  assert.deepEqual(protectedProjectionFromKernel(recovered), protectedProjectionFromKernel(kernel), 'INVARIANT: compaction trusted provisional protected fields');
});

test('protected compaction retains the operation-dedupe ledger across prefix garbage collection', () => {
  const world = syntheticWorld(1); let kernel = genesisKernel(world), oracle = initialOracle(world);
  const action = sealAction(kernel.players.owner.life, 'owner');
  [kernel, oracle] = apply(kernel, oracle, action, 'seal:owner:1');
  const compacted = compactProtectedJournal(kernel, kernel.seq, null, mutation);
  const recovered = recoverProtectedSnapshot(compacted.protectedSnapshot, [], mutation);
  const retry = eventFromAction(action, recovered, 'seal:owner:1');
  let afterRetry;
  try { afterRetry = appendKernel(recovered, retry, mutation); }
  catch (error) { assert.fail(`INVARIANT: compacted operation identity no longer accepts an idempotent retry: ${error.message}`); }
  assert.equal(afterRetry.seq, recovered.seq, 'INVARIANT: compacted retry became a second semantic operation');
  const conflict = structuredClone(retry); conflict.record.defeats++;
  assert.throws(() => appendKernel(recovered, conflict, mutation), /operation id conflict/);
});

test('protected compaction snapshot detects body corruption before suffix replay', () => {
  const kernel = genesisKernel(syntheticWorld(1));
  const semantic = createProtectedSnapshot(kernel);
  semantic.players.owner.life.seed++;
  assert.throws(() => recoverProtectedSnapshot(semantic, []), /integrity/);
});

test('shadow extractor ignores movement and current homecoming changes until a protected boundary', () => {
  const before = syntheticWorld(1), after = structuredClone(before);
  after.players.owner.life.position = { x: 400, z: -200 };
  after.players.owner.life.hp = 4;
  after.players.owner.life.returns = 1;
  after.players.owner.life.homelands = ['village-a'];
  assert.deepEqual(protectedActionTypes(before, after), []);
});

test('shadow extractor maps the current natural lifetime end to one life-seal action', () => {
  const before = syntheticWorld(1), after = structuredClone(before);
  after.players.owner.life.ended = true; after.players.owner.life.phase = 'ended';
  after.players.owner.life.ageSeconds = 6000; after.players.owner.life.ageYears = 100;
  const actions = deriveProtectedActions(before, after);
  assert.deepEqual(actions.map(x => x.type), ['life-seal']);
  assert.equal(actions[0].record.generation, 1);
});

test('shadow extractor maps current combat-ended lives to one life-seal action', () => {
  const before = syntheticWorld(1), after = structuredClone(before);
  after.players.owner.life.ended = true; after.players.owner.life.phase = 'ended';
  after.players.owner.life.ageSeconds = 2000; after.players.owner.life.ageYears = 33.333;
  const actions = deriveProtectedActions(before, after);
  assert.deepEqual(actions.map(x => x.type), ['life-seal']);
  assert.equal(actions[0].record.age, 33);
});

test('shadow extractor derives rebirth from a sealed predecessor plus the committed rebirth op', () => {
  const before = syntheticWorld(1); before.players.owner.life.ended = true; before.players.owner.life.phase = 'ended'; before.players.owner.life.ageSeconds = 6000; before.players.owner.life.ageYears = 100;
  const action = rebirthAction(before.players.owner.life, 'owner');
  const after = structuredClone(before); after.players.owner.life = structuredClone(action.nextLife); after.rebirthOps['owner:1'] = structuredClone(action.intent);
  const actions = deriveProtectedActions(before, after);
  assert.deepEqual(actions.map(x => x.type), ['rebirth']);
  assert.deepEqual(actions[0].intent, action.intent);
});

test('shadow extractor derives birth and epoch acquisition deterministically', () => {
  const before = syntheticWorld(1), after = structuredClone(before); after.epoch = 2;
  after.players.p1 = { token: 'T', portDwell: 0, life: syntheticLife('p1') };
  assert.deepEqual(protectedActionTypes(before, after), ['epoch-acquire', 'birth']);
});

test('shadow extractor rejects player deletion, same-life lineage rewrite and sealed-record mutation', () => {
  const before = syntheticWorld(2), deleted = structuredClone(before); delete deleted.players.p1;
  assert.throws(() => deriveProtectedActions(before, deleted), /disappeared/);
  const lineage = structuredClone(before); lineage.players.owner.life.lineage = [{ generation: 0 }];
  assert.throws(() => deriveProtectedActions(before, lineage), /lineage changed/);
  const sealedBefore = structuredClone(before); sealedBefore.players.owner.life.ended = true; sealedBefore.players.owner.life.phase = 'ended'; sealedBefore.players.owner.life.ageSeconds = 6000; sealedBefore.players.owner.life.ageYears = 100;
  const sealedAfter = structuredClone(sealedBefore); sealedAfter.players.owner.life.defeats++;
  assert.throws(() => deriveProtectedActions(sealedBefore, sealedAfter), /record changed/);
});
