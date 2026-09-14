export function hasCompletedFirstHunt(profile) {
  return Object.values(profile.visits || {}).some(v => ['escaped', 'completed'].includes(v.status) && v.eaten > 0);
}
/** No state mutation: UI cues follow, rather than replace, actual game conditions. */
export function firstHuntGuide(game, profile, { sensed = false, lineageSeen = false, memorySeen = false, returning = false } = {}) {
  if (!game || game.finished || hasCompletedFirstHunt(profile)) return null;
  const cue = (step, text) => ({ step, text });
  if (game.devour) return cue('devour', '喰らえ。');
  if (game.fight) return cue('combat', '交戦。');
  if (game.eaten > 0) {
    if (!(lineageSeen || memorySeen) && !returning) return cue('lineage', '転生史へ。');
    const d = game.nearestEscape?.().distance ?? Math.hypot(game.player.x - game.village.entry.x, game.player.z - game.village.entry.z);
    return d < 2.8 ? cue('escape', '輪で止まれ。') : cue('return', '帰路へ。');
  }
  if (returning) return cue('need-prey', 'まず、喰え。');
  if (game.village.npcs.some(n => n.dead && !n.eaten && Math.hypot(n.x-game.player.x,n.z-game.player.z)<2.5))
    return cue('stop', '止まれ。');
  return sensed ? cue('approach', '人影へ。') : cue('sense', '嗅げ。');
}
