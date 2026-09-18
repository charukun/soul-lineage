import { canonical, clone, lineageRecord } from './model.mjs';

const LIFE_SECONDS = 6000; // Current source constant at the task-start SHA.

function playerMap(checkpoint) {
  const world = checkpoint?.world ?? checkpoint;
  if (!world || typeof world.worldId !== 'string' || !world.players || typeof world.players !== 'object') throw Error('invalid checkpoint');
  return world;
}

function same(a, b) { return canonical(a) === canonical(b); }

// Source-shaped SHADOW extractor for the current trusted-host co-op history surface.
// It is stricter than accepting arbitrary snapshots. Current co-op history now
// accepts both natural lifespan completion and combat-ended lives, provided an
// ended life is in the ended phase and a living life has not reached LIFE_SECONDS.
export function deriveProtectedActions(previousCheckpoint, nextCheckpoint) {
  const oldWorld = playerMap(previousCheckpoint), nextWorld = playerMap(nextCheckpoint);
  if (oldWorld.worldId !== nextWorld.worldId || oldWorld.ownerId !== nextWorld.ownerId) throw Error('world identity changed');
  if (!Number.isSafeInteger(oldWorld.epoch) || !Number.isSafeInteger(nextWorld.epoch) || nextWorld.epoch < oldWorld.epoch || nextWorld.epoch > oldWorld.epoch + 1) throw Error('invalid epoch transition');
  const actions = [];
  if (nextWorld.epoch === oldWorld.epoch + 1) actions.push({ type: 'epoch-acquire', fromEpoch: oldWorld.epoch, toEpoch: nextWorld.epoch });

  for (const playerId of Object.keys(oldWorld.players).sort()) if (!nextWorld.players[playerId]) throw Error('committed player disappeared');

  for (const playerId of Object.keys(nextWorld.players).sort()) {
    const oldRow = oldWorld.players[playerId], nextRow = nextWorld.players[playerId];
    const life = nextRow?.life;
    if (!life || typeof life.id !== 'string' || !Number.isSafeInteger(life.generation)) throw Error('invalid life');
    if (life.ended ? life.phase !== 'ended' : life.ageSeconds >= LIFE_SECONDS) throw Error('current-coop terminal rule mismatch');

    if (!oldRow) {
      if (life.generation !== 1 || (life.lineage?.length ?? -1) !== 0 || life.ended) throw Error('unsupported birth checkpoint');
      actions.push({ type: 'birth', playerId, life: clone(life) });
      continue;
    }

    const old = oldRow.life;
    if (!old || typeof old.id !== 'string') throw Error('invalid previous life');
    if (old.id === life.id) {
      if (!same(old.lineage, life.lineage)) throw Error('lineage changed during life');
      if (old.ended && !life.ended) throw Error('sealed life resurrected');
      if (old.ended && life.ended && !same(lineageRecord(old), lineageRecord(life))) throw Error('sealed life record changed');
      if (!old.ended && life.ended) actions.push({ type: 'life-seal', playerId, life: clone(life), record: lineageRecord(life) });
      continue;
    }

    if (!old.ended) throw Error('rebirth predecessor is not sealed');
    if (life.generation !== old.generation + 1) throw Error('rebirth generation mismatch');
    const record = lineageRecord(old);
    if (!same(life.lineage, [...old.lineage, record])) throw Error('rebirth lineage mismatch');
    const intent = nextWorld.rebirthOps?.[old.id];
    if (!intent || intent.playerId !== playerId || intent.lifeId !== old.id || intent.resultId !== life.id) throw Error('rebirth operation missing or mismatched');
    actions.push({ type: 'rebirth', playerId, previousLifeId: old.id, resultLifeId: life.id,
      intent: clone(intent), record, nextLife: clone(life) });
  }
  return actions;
}

export function protectedActionTypes(previousCheckpoint, nextCheckpoint) {
  return deriveProtectedActions(previousCheckpoint, nextCheckpoint).map(action => action.type);
}
