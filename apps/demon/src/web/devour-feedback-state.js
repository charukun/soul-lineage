// Read-only projection: native capture and consume events remain the authority.
export const CONSUME_FEEDBACK_SECONDS = 6;
const positive = value => Number.isFinite(value) && value > 0;
const boundary = new Set(['consume', 'engage', 'down', 'finish']);

export function devourFeedback(game, {overlay = false, prey = {}} = {}) {
  if (!game || overlay || game.finished || game.fight) return null;
  if (game.devour) {
    const value = game.player?.devourProgress;
    const feeding = game.devour.phase === 'feeding' && Number.isFinite(value);
    const progress = feeding ? Math.max(0, Math.min(1, value)) : null;
    const name = game.devour.npc?.name || '獲物';
    return {
      state: feeding ? 'feeding' : 'approach',
      title: feeding ? '捕食中' : '捕食へ近づく',
      detail: feeding ? `${name} · ${Math.floor(progress * 100)}%` : name,
      loot: '', progress,
      action: '止まったまま続ける · スワイプで中断'
    };
  }

  // A later fight/down/finish invalidates an older meal, even after cancellation.
  // Do not consume/mutate this native event queue or infer rewards from a corpse.
  const event = game.events?.findLast(row => boundary.has(row.type));
  if (event?.type !== 'consume' || !event.reward) return null;
  if (!Number.isFinite(game.time) || !Number.isFinite(event.at)) return null;
  const age = game.time - event.at;
  if (age < 0 || age >= CONSUME_FEEDBACK_SECONDS) return null;
  const reward = event.reward, gains = [];
  if (reward.memoryNew) gains.push(`${prey[event.role]?.power || '特能'}を獲得`);
  if (positive(reward.maxHpGain)) gains.push(`最大生命 +${Math.ceil(reward.maxHpGain)}`);
  if (positive(reward.healed) && reward.healed > (reward.maxHpGain || 0)) gains.push(`生命 +${Math.ceil(reward.healed)}`);
  if (positive(reward.techniqueSpeed)) gains.push(`技速 ${reward.techniqueSpeed}%`);
  if (reward.moveNew) gains.push('身捌きを習得');
  const loot = positive(reward.lootGain)
    ? `未確保の戦利品 +${reward.lootGain}${Number.isFinite(reward.carried) ? `（計 ${reward.carried}）` : ''}` : '';
  return {
    state: 'complete', title: '捕食完了', detail: gains.join(' · '), loot,
    progress: null, action: 'スワイプで移動再開 · 帰還で戦利品を確保'
  };
}
