import { actorRecoveryState, bytes, clone, lifePatch, lineageRecord, rebirthRecoveryState, syntheticLife, syntheticWorld, terminalLifePatch } from './core.mjs';
import { createProtectedSnapshot, genesisKernel, protectedProjectionFromKernel } from './kernel.mjs';

export function eventSizes({ players = 30 } = {}) {
  const world = syntheticWorld(players);
  const baseKernel = genesisKernel(world);
  const owner = world.players.owner.life;
  const sealed = { ...clone(owner), ended: true, phase: 'ended', ageSeconds: 6000, ageYears: 100 };
  const record = lineageRecord(sealed);
  const nextActor = syntheticLife('owner', owner.generation + 1);
  nextActor.lineage = [...owner.lineage, record];
  const birth = { seq: 99, type: 'birth', opId: 'birth:new:1', playerId: 'new', life: lifePatch(syntheticLife('new')), actor: actorRecoveryState(syntheticLife('new')), epoch: 1 };
  const seal = { seq: 99, type: 'life-seal', opId: 'seal:owner:1', playerId: 'owner', lifeId: 'owner:1', patch: terminalLifePatch(sealed), record, epoch: 1 };
  const rebirth = { seq: 99, type: 'rebirth', opId: 'rebirth:owner:1', playerId: 'owner', previousLifeId: 'owner:1', resultLifeId: nextActor.id,
    intent: { playerId: 'owner', lifeId: 'owner:1', villageId: 'village-a', resultId: nextActor.id }, record, actor: rebirthRecoveryState(nextActor), epoch: 1 };
  const epoch = { seq: 99, type: 'epoch-acquire', opId: 'epoch:2', fromEpoch: 1, toEpoch: 2, epoch: 2 };
  return { birth: bytes(birth), lifeSeal: bytes(seal), rebirth: bytes(rebirth), epochAcquire: bytes(epoch), protectedActor: bytes(lifePatch(owner)), fullActor: bytes(actorRecoveryState(owner)), baseKernelBytes: bytes(baseKernel.history) };
}

export function sizeEnvelope({ players = 30, followerCopies = 1, snapshotCopies = 1, canonEvents = 4, recoverySnapshots = 60 } = {}) {
  const world = syntheticWorld(players);
  const checkpointBytes = bytes({ layout: { id: 'village-a' }, world });
  const sizes = eventSizes({ players });
  // Use life-seal as the representative single-actor boundary for the legacy
  // envelope; individual event types are reported separately via eventSizes().
  const eventBytes = sizes.lifeSeal;
  const allStateStrong = followerCopies * canonEvents * checkpointBytes;
  const actorJournalStrong = followerCopies * canonEvents * eventBytes;
  const fairKnownBaselineStrong = actorJournalStrong;
  const asyncRecovery = snapshotCopies * recoverySnapshots * checkpointBytes;
  return { players, checkpointBytes, actorBytes: sizes.protectedActor, fullActorBytes: sizes.fullActor, eventBytes, eventSizes: sizes, canonEvents, recoverySnapshots, followerCopies, snapshotCopies,
    allStateStrong, actorJournalStrong, fairKnownBaselineStrong, asyncRecovery,
    strictVsWholeCheckpoint: checkpointBytes > eventBytes,
    matchesFairKnownBaseline: actorJournalStrong === fairKnownBaselineStrong };
}

export function strongEncodingEnvelope({ players = 30, affectedActors = 1, followerCopies = 1, eventType = 'lifeSeal' } = {}) {
  if (!Number.isInteger(affectedActors) || affectedActors < 1 || affectedActors > players) throw Error('invalid affected actor count');
  const shape = sizeEnvelope({ players, followerCopies, canonEvents: 1, recoverySnapshots: 0 });
  const perActorEventBytes = shape.eventSizes[eventType];
  if (!Number.isSafeInteger(perActorEventBytes) || perActorEventBytes < 1 || !['birth', 'lifeSeal', 'rebirth'].includes(eventType)) throw Error('invalid actor event type');
  const eventBatchBytes = affectedActors * perActorEventBytes;
  const checkpointBytes = shape.checkpointBytes;
  const eventStrongBytes = followerCopies * eventBatchBytes;
  const checkpointStrongBytes = followerCopies * checkpointBytes;
  const selected = eventBatchBytes <= checkpointBytes ? 'actor-events' : 'checkpoint';
  const selectedStrongBytes = Math.min(eventStrongBytes, checkpointStrongBytes);
  return { players, affectedActors, eventType, perActorEventBytes, eventBatchBytes, checkpointBytes, followerCopies, eventStrongBytes, checkpointStrongBytes, selected, selectedStrongBytes };
}

export function recoveryPareto({ players = 30, durationSeconds = 60, intervals = [0.5, 1, 2, 5, 10, 30, 60], snapshotCopies = 1 } = {}) {
  const checkpointBytes = sizeEnvelope({ players, canonEvents: 0, recoverySnapshots: 0 }).checkpointBytes;
  const rows = intervals.map(intervalSeconds => {
    const snapshots = Math.ceil(durationSeconds / intervalSeconds);
    return { intervalSeconds, provisionalRpoSeconds: intervalSeconds, snapshots, bytes: snapshots * checkpointBytes * snapshotCopies };
  });
  // With fixed snapshot representation/copies, lowering RPO necessarily increases bytes.
  return { checkpointBytes, durationSeconds, snapshotCopies, rows,
    tradeoffVisible: rows.every((row, i) => i === 0 || (row.provisionalRpoSeconds > rows[i - 1].provisionalRpoSeconds && row.bytes < rows[i - 1].bytes)) };
}

export function coordinationEnvelope({ protectedEvents, replaceableUpdates, protectedBytes, replaceableBytes, followerCopies = 1 }) {
  const allStrong = followerCopies * (protectedEvents * protectedBytes + replaceableUpdates * replaceableBytes);
  const semanticStrong = followerCopies * protectedEvents * protectedBytes;
  const fairBaseline = semanticStrong;
  return { allStrong, semanticStrong, fairBaseline, savedBySemanticSplit: allStrong - semanticStrong,
    candidateBeatsFairBaseline: semanticStrong < fairBaseline,
    candidateMatchesFairBaseline: semanticStrong === fairBaseline };
}

export function lineageGrowthEnvelope({ generations = [1, 2, 5, 10, 25, 50] } = {}) {
  const rows = generations.map(generation => {
    if (!Number.isSafeInteger(generation) || generation < 1) throw Error('invalid generation');
    const current = syntheticLife('owner', generation);
    const template = lineageRecord({ ...syntheticLife('owner', 1), ageYears: 100, returns: 1, defeats: 9 });
    current.lineage = Array.from({ length: generation - 1 }, (_, i) => ({ ...clone(template), generation: i + 1 }));
    const sealed = { ...clone(current), ended: true, phase: 'ended', ageSeconds: 6000, ageYears: 100 };
    const record = lineageRecord(sealed);
    const nextActor = syntheticLife('owner', generation + 1);
    nextActor.lineage = [...current.lineage, record];
    const deltaEvent = { seq: generation, type: 'rebirth', opId: `rebirth:owner:${generation}`, playerId: 'owner',
      previousLifeId: current.id, resultLifeId: nextActor.id,
      intent: { playerId: 'owner', lifeId: current.id, villageId: 'village-a', resultId: nextActor.id },
      record, actor: rebirthRecoveryState(nextActor), epoch: 1 };
    const naiveEvent = { ...clone(deltaEvent), actor: actorRecoveryState(nextActor) };
    return { generation, lineageRecords: generation - 1, deltaBytes: bytes(deltaEvent), naiveRepeatedLineageBytes: bytes(naiveEvent) };
  });
  return { rows, deltaBoundedByHistoryLength: rows.every((row, i) => i === 0 || Math.abs(row.deltaBytes - rows[0].deltaBytes) < 32),
    naiveGrowthVisible: rows.at(-1).naiveRepeatedLineageBytes > rows[0].naiveRepeatedLineageBytes };
}

export function semanticCompactionPareto({ players = 30, canonEvents = 1000, compactEvery = [10, 25, 50, 100, 250, 500, 1000], followerCopies = 1 } = {}) {
  if (!Number.isSafeInteger(canonEvents) || canonEvents < 1) throw Error('invalid canon event count');
  const world = syntheticWorld(players), kernel = genesisKernel(world);
  const protectedSnapshotBytes = bytes(createProtectedSnapshot(kernel));
  const semanticStateBytes = bytes(protectedProjectionFromKernel(kernel));
  const dedupeLedgerBytes = bytes(kernel.opDigests);
  const representativeEventBytes = eventSizes({ players }).lifeSeal;
  const appendBytes = canonEvents * representativeEventBytes * followerCopies;
  const rows = compactEvery.map(interval => {
    if (!Number.isSafeInteger(interval) || interval < 1) throw Error('invalid compaction interval');
    const snapshots = Math.floor(canonEvents / interval);
    const backgroundCompactionBytes = snapshots * protectedSnapshotBytes * followerCopies;
    return { intervalEvents: interval, maxReplayEvents: Math.min(interval - 1, canonEvents), snapshots,
      appendBytes, backgroundCompactionBytes, totalStrongBytes: appendBytes + backgroundCompactionBytes };
  });
  return { players, canonEvents, followerCopies, protectedSnapshotBytes, semanticStateBytes, dedupeLedgerBytes, representativeEventBytes, rows,
    tradeoffVisible: rows.every((row, i) => i === 0 ||
      (row.maxReplayEvents > rows[i - 1].maxReplayEvents && row.totalStrongBytes < rows[i - 1].totalStrongBytes)) };
}
