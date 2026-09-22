/** Display-only projection. Hunt rules, completion and rewards remain owned by the game. */
export function huntStakesState({plan, eaten, targetEaten, carried, ready, risk}) {
  const count = Math.min(eaten, plan.quota);
  const extraction = carried + (ready ? plan.bonus : 0);
  return {
    goal: plan.marked ? `${plan.prey}${targetEaten ? '済' : '未'} ${count}/${plan.quota}` : `人影 ${count}/${plan.quota}`,
    haul: `未確保 ${carried}${ready ? ` · 帰還 ${extraction}` : ''}`,
    haulHidden: carried <= 0 && !ready,
    pressure: `警戒 ${risk.label}`,
    pressureHidden: risk.level <= 0,
    pressureLevel: String(risk.level),
    progress: Math.min(1, eaten / plan.quota),
    count,
    extraction
  };
}
