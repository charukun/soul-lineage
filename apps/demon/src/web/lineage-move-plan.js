export const MOVE_NAMES = Object.freeze({ember:'猟りの詰め', dancer:'旅歩の返し', calm:'静かな間合い', stone:'受け止める足', shadow:'影渡りの足'});

/** Read-only preview of RaidSession.learnedMoves/skillSet at the next engagement.
 * Do not apply this to an already-running fight or to the separate trait slots.
 * Keep unknown legacy ids in the ordering; removing them would shift native slots.
 */
export function lineageMovePlan(profile) {
  const adaptations = Object.values(profile.adaptations || {}).slice()
    .sort((a, b) => (b.encounters || 0) - (a.encounters || 0));
  const keys = [];
  for (const adaptation of adaptations) {
    for (const key of adaptation.moves || []) if (!keys.includes(key)) keys.push(key);
  }
  return keys.map((key, index) => {
    const known = Object.hasOwn(MOVE_NAMES, key);
    return {
      key,
      name: known ? MOVE_NAMES[key] : key,
      slot: known && index < 2 ? ['ha', 'kyu'][index] : null,
      role: !known ? '役割未確認' : index === 0 ? '次の交戦：破' : index === 1 ? '次の交戦：急' : '控え',
      known
    };
  });
}
