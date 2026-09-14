export function hasCompletedFirstHunt(profile) {
  return Object.values(profile.visits || {}).some(v => ['escaped', 'completed'].includes(v.status) && v.eaten > 0);
}
/** No state mutation: UI advice follows, rather than replaces, actual game conditions. */
export function firstHuntGuide(game, profile, { returning = false } = {}) {
  if (!game || game.finished || hasCompletedFirstHunt(profile)) return null;
  const advice = (step, text) => ({ step, text });
  if (game.devour) return advice('devour', 'そのまま止まれ。身体が取り込む。');
  if (game.fight) return advice('combat', '戦いは自動。勝てば、その身体を喰える。');
  if (game.eaten > 0) {
    if (game.eaten === 1) return advice('choice', '次は選べ。喰う相手で、次の身体が変わる。');
    const d = game.nearestEscape?.().distance ?? Math.hypot(game.player.x - game.village.entry.x, game.player.z - game.village.entry.z);
    return d < 2.8 ? advice('escape', '帰還口の輪の中で止まれば、この身体を持ち帰れる。') :
      advice('return', '狙った命を追うか、今の身体を持ち帰るか。');
  }
  if (returning) return advice('need-prey', '帰路はまだ閉じている。まず一つ、命を喰らえ。');
  if (game.village.npcs.some(n => n.dead && !n.eaten && Math.hypot(n.x-game.player.x,n.z-game.player.z)<2.5))
    return advice('stop', '倒れた獲物のそばで止まれ。喰い始める。');
  return advice('approach', '近い人影へ。指を滑らせるだけで戦いは始まる。');
}
