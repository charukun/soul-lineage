export function hasCompletedFirstHunt(profile) {
  return Object.values(profile.visits || {}).some(v => ['escaped', 'completed'].includes(v.status) && v.eaten > 0);
}
/** No state mutation: UI advice follows, rather than replaces, actual game conditions. */
export function firstHuntGuide(game, profile, { sensed = false, memorySeen = false, returning = false } = {}) {
  if (!game || game.finished || hasCompletedFirstHunt(profile)) return null;
  const advice = (step, text) => ({ step, text });
  if (game.devour) return advice('devour', '捕食中。指を離して待つ。移動すると中断する。');
  if (game.fight) return advice('combat', '自動戦闘。操作は不要。序 → 破 → 急と敵の生命を見る。');
  if (game.eaten > 0) {
    if (!memorySeen && !returning) return advice('memory', '記憶を得た。「肉体」を押して、装着できる力を確認する。');
    const d = Math.hypot(game.player.x - game.village.entry.x, game.player.z - game.village.entry.z);
    return d < 2.8 ? advice('escape', '帰還口の輪の中で指を離す。その場で待つと帰還する。') :
      advice('return', '「帰路」を押すと、出口方向と残り距離が出る。');
  }
  if (returning) return advice('need-prey', '帰路はまだ閉じている。まず人影に近づき、一度捕食する。');
  if (game.village.npcs.some(n => n.dead && !n.eaten && Math.hypot(n.x-game.player.x,n.z-game.player.z)<2.5))
    return advice('stop', '倒れた獲物のそばで指を離す。止まると捕食が始まる。');
  return sensed ? advice('approach', '人影へ指を滑らせる。近づくと自動戦闘。素早く弾くと走る。') :
    advice('sense', 'まず「嗅覚」を押す。人影と今夜の獲物が浮かぶ。');
}
