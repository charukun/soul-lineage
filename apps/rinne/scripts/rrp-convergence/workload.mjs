import { actorRecoveryState, clone, lineageRecord, rebirthRecoveryState, syntheticLife, lifePatch, terminalLifePatch } from './model.mjs';

export function sealAction(life, playerId) {
  const ended = clone(life);
  ended.ended = true; ended.phase = 'ended'; ended.ageSeconds = 6000; ended.ageYears = 100;
  return { type: 'life-seal', playerId, life: ended, record: lineageRecord(ended) };
}

export function rebirthAction(endedLife, playerId, villageId = 'village-a') {
  const record = lineageRecord(endedLife);
  const nextLife = syntheticLife(playerId, endedLife.generation + 1);
  nextLife.lineage = [...endedLife.lineage, record];
  nextLife.homelands = [...endedLife.homelands];
  nextLife.birthVillageId = villageId;
  nextLife.seed = (endedLife.seed + 0x9e3779b9) >>> 0;
  return { type: 'rebirth', playerId, previousLifeId: endedLife.id, resultLifeId: nextLife.id,
    intent: { playerId, lifeId: endedLife.id, villageId, resultId: nextLife.id }, record, nextLife };
}

export function eventFromAction(action, kernel, opId) {
  const seq = kernel.seq + 1;
  if (action.type === 'epoch-acquire') return { seq, opId, epoch: action.toEpoch, ...clone(action) };
  if (action.type === 'birth') return { seq, opId, epoch: kernel.epoch, playerId: action.playerId, type: 'birth', life: lifePatch(action.life), actor: actorRecoveryState(action.life) };
  if (action.type === 'life-seal') return { seq, opId, epoch: kernel.epoch, playerId: action.playerId, type: 'life-seal', lifeId: action.life.id, patch: terminalLifePatch(action.life), record: clone(action.record) };
  if (action.type === 'rebirth') return { seq, opId, epoch: kernel.epoch, type: 'rebirth', playerId: action.playerId, previousLifeId: action.previousLifeId, resultLifeId: action.resultLifeId, intent: clone(action.intent), record: clone(action.record), actor: rebirthRecoveryState(action.nextLife) };
  throw Error('unknown action');
}
