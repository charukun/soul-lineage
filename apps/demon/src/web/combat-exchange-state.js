// Read side only. Never infer a hit from a pose, attack phase or HP delta.
export const CONTACT_FEEDBACK_SECONDS = 4;

function vitals(actor, name) {
  if (!Number.isFinite(actor?.hp) || !Number.isFinite(actor?.maxhp) || actor.maxhp <= 0) return null;
  const hp = Math.max(0, Math.min(actor.maxhp, actor.hp));
  return {name, hp: Math.ceil(hp), maxhp: Math.ceil(actor.maxhp), ratio: hp / actor.maxhp};
}

export function latestCombatContact(state) {
  const hero = state?.hero?.id, enemy = state?.enemy?.id, now = state?.time;
  if (hero == null || enemy == null || hero === enemy || !Number.isFinite(now)) return null;
  // Contacts belong to this core only. Secondary cores reuse actor IDs, so do not
  // merge their history into this primary-opponent readout.
  const contact = (Array.isArray(state.contacts) ? state.contacts : []).findLast(row => {
    const age = now - row?.time;
    const pair = row?.source === hero && row?.target === enemy || row?.source === enemy && row?.target === hero;
    return pair && Number.isFinite(row.time) && age >= 0 && age < CONTACT_FEEDBACK_SECONDS
      && Number.isFinite(row.damage) && row.damage >= 0;
  });
  if (!contact) return null;
  const incoming = contact.target === hero, damage = Math.ceil(contact.damage), guarded = contact.guard === true;
  const result = guarded ? '防御' : damage > 0 ? incoming ? '被弾' : '命中' : '接触';
  return {
    direction: incoming ? 'incoming' : 'outgoing',
    guarded, damage,
    text: `${incoming ? '相手 → 自分' : '自分 → 相手'} · ${result} · ${damage > 0 ? '生命 −' + damage : '損傷なし'}`
  };
}

export function combatExchangeState(game, {overlay = false} = {}) {
  const fight = game?.fight;
  if (overlay || !fight || game.finished || game.devour || fight.npc?.dead || fight.npc?.eaten) return null;
  const state = fight.core?.state?.();
  if (!state || state.done || state.hero?.dead || state.enemy?.dead) return null;
  // Player HP includes secondary attackers; enemy vitals belong to the named
  // primary opponent. The native primary core owns its maximum HP.
  const hero = vitals(game.player, '自分');
  const enemy = vitals(state.enemy, fight.npc?.name || '交戦相手');
  if (!hero || !enemy) return null;
  const others = (game.combatants || []).filter(row => row.npc && !row.npc.dead && !row.npc.eaten).length;
  return {hero, enemy, others, contact: latestCombatContact(state)};
}
