import { clone, lineageRecord, lifePatch } from './model.mjs';

export function initialOracle(world) {
  const players = {};
  for (const [id, row] of Object.entries(world.players)) players[id] = { life: lifePatch(row.life), sealed: false };
  return { worldId: world.worldId, ownerId: world.ownerId, epoch: world.epoch, seq: Object.keys(players).length, players, rebirthOps: {} };
}

export function applyOracle(state, action) {
  const next = clone(state);
  if (action.type === 'epoch-acquire') {
    if (action.fromEpoch !== next.epoch || action.toEpoch !== next.epoch + 1) throw Error('oracle invalid epoch');
    next.epoch = action.toEpoch;
  } else if (action.type === 'birth') {
    if (next.players[action.playerId]) throw Error('oracle duplicate birth');
    next.players[action.playerId] = { life: lifePatch(action.life), sealed: Boolean(action.life.ended) };
  } else if (action.type === 'life-seal') {
    const row = next.players[action.playerId];
    if (!row || row.sealed || row.life.id !== action.life.id) throw Error('oracle invalid seal');
    if (!action.life.ended) throw Error('oracle nonterminal seal');
    if (JSON.stringify(lineageRecord(action.life)) !== JSON.stringify(action.record)) throw Error('oracle record mismatch');
    row.life = lifePatch(action.life); row.sealed = true;
  } else if (action.type === 'rebirth') {
    const row = next.players[action.playerId];
    if (!row || !row.sealed || row.life.id !== action.previousLifeId) throw Error('oracle predecessor');
    if (action.nextLife.generation !== row.life.generation + 1) throw Error('oracle generation');
    const expected = [...row.life.lineage, action.record];
    if (JSON.stringify(action.nextLife.lineage) !== JSON.stringify(expected)) throw Error('oracle lineage');
    next.rebirthOps[action.previousLifeId] = clone(action.intent);
    row.life = lifePatch(action.nextLife); row.sealed = false;
  } else throw Error('oracle action');
  next.seq++;
  return next;
}
