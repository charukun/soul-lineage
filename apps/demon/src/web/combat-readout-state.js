const PHASES=new Set(['jo','ha','kyu']);

export function nextCombatReadoutState(previous={},action='',phase=''){
  const nextAction=String(action||'').trim();
  const nextPhase=PHASES.has(phase)?phase:'';
  const priorAction=String(previous.action||'').trim();
  const priorPhase=PHASES.has(previous.phase)?previous.phase:'';
  return{
    action:nextAction,
    phase:nextPhase,
    actionChanged:nextAction!==priorAction,
    phaseChanged:nextPhase!==priorPhase,
  };
}

export function combatDamageLine(amount=0,hp=0,maxhp=1){
  const damage=Math.max(0,Math.ceil(Number(amount)||0));
  const current=Math.max(0,Math.ceil(Number(hp)||0));
  const maximum=Math.max(1,Math.ceil(Number(maxhp)||1));
  const ratio=current/maximum;
  const condition=current<=0?'戦闘不能':ratio<=.2?'瀕死':ratio<=.45?'重傷':ratio<=.7?'負傷':'健在';
  return `被弾 −${damage} · 生命 ${current}/${maximum} · ${condition}`;
}

export function combatFeedLane(index=0,max=3){
  const limit=Math.max(1,Math.floor(Number(max)||3));
  return Math.min(limit-1,Math.max(0,Math.floor(Number(index)||0)));
}
